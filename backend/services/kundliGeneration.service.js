const PremiumKundliOrder = require("../models/PremiumKundliOrder");
const astrologyApiService = require("./astrologyApi.service");
const geocodingService = require("./geocoding.service");
const pdfService = require("./pdf.service");
const settingsService = require("./settings.service");
const { uploadToCloudinary } = require("./cloudinary.service");
const { notifyOrderEvent } = require("./premiumKundliOrder.service");
const { sendEmail, templates } = require("../utils/sendEmail");
const logger = require("../utils/logger");

/**
 * White-label branding fields the Premium Kundli PDF report endpoint
 * requires (chart_style, logo_url, company_name/info/email/mobile,
 * domain_url, footer_link) — all sourced from existing config (the
 * Settings singleton's logo plus the COMPANY_... env vars already used
 * for invoice PDFs, and CLIENT_URL), never hardcoded or duplicated into a
 * new settings surface.
 */
const getBrandingFields = async () => {
  const settings = await settingsService.getSettings().catch(() => null);
  return {
    chartStyle: process.env.ASTROLOGY_PDF_CHART_STYLE || "north-indian",
    footerLink: process.env.CLIENT_URL || "",
    logoUrl: settings?.logo?.url || "",
    companyName: process.env.COMPANY_NAME || "",
    companyInfo: process.env.COMPANY_ADDRESS || "",
    domainUrl: process.env.CLIENT_URL || "",
    companyEmail: process.env.COMPANY_EMAIL || "",
    companyLandline: "",
    companyMobile: process.env.COMPANY_PHONE || "",
  };
};

// Response field names a PDF-producing AstrologyAPI report can use to
// signal "here's a hosted file" — checked in order, first match wins.
// Different astrologyapi.com report products name this differently.
const PDF_URL_FIELDS = ["pdf_url", "report_url", "pdf", "file_url"];

const extractPdfUrl = (apiResponse) => {
  if (!apiResponse || typeof apiResponse !== "object") return null;
  for (const field of PDF_URL_FIELDS) {
    if (typeof apiResponse[field] === "string" && apiResponse[field].startsWith("http")) {
      return apiResponse[field];
    }
  }
  // Some astrologyapi.com report products wrap the result under a nested
  // `response` object rather than returning pdf_url at the top level — the
  // exact wrapping isn't firmly documented, so both shapes are checked.
  if (apiResponse.response && typeof apiResponse.response === "object") {
    return extractPdfUrl(apiResponse.response);
  }
  return null;
};

/**
 * Downloads a file from a URL AstrologyAPI returned — re-hosted on our own
 * Cloudinary account afterward, never linked directly from the customer's
 * dashboard/email (it could expire, rate-limit, or move).
 */
const downloadBuffer = async (url) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`Failed to download generated PDF (status ${response.status})`);
    return Buffer.from(await response.arrayBuffer());
  } finally {
    clearTimeout(timeoutId);
  }
};

/**
 * Calls the real AstrologyAPI for a paid order, resolving the birth place
 * into coordinates first (the intake form only ever collects a place name).
 * Always ends with a real, downloadable PDF: if the API hands back a ready
 * file, it's re-hosted on our own Cloudinary account; otherwise (the
 * typical case for astrologyapi.com's data-only endpoints) one is rendered
 * from the JSON via pdf.service.js. Either way the order ends "Generated"
 * with a working pdfUrl, or "Failed" with generationError set. Never
 * throws — a flaky external API must never break the payment-confirmation
 * response this is called from (see premiumKundli.controller.js verifyPayment).
 */
const generate = async (orderId) => {
  const order = await PremiumKundliOrder.findById(orderId).populate("user", "name email");
  if (!order) {
    logger.error(`kundliGeneration.generate: order ${orderId} not found`);
    return;
  }

  order.kundliStatus = "Processing";
  order.statusHistory.push({ status: "Processing", note: "Queued for generation" });
  await order.save();

  try {
    if (!astrologyApiService.isConfigured()) {
      throw new Error("AstrologyAPI is not configured yet (ASTROLOGY_API_USER_ID / ASTROLOGY_API_KEY missing)");
    }

    const dob = new Date(order.dob);
    const [birthHour, birthMinute] = order.birthTime.split(":").map(Number);
    const birthDateTime = new Date(dob);
    birthDateTime.setHours(birthHour, birthMinute, 0, 0);

    // Skip re-geocoding if the frontend already resolved it via
    // POST /kundli/geocode before payment (premiumKundli.controller.js
    // passes it straight through onto the order) — saves a redundant
    // Nominatim call and a second point of failure post-payment.
    let latitude = order.latitude;
    let longitude = order.longitude;
    let timezoneOffset = order.timezoneOffset;
    if (latitude == null || longitude == null || timezoneOffset == null) {
      ({ latitude, longitude, timezoneOffset } = await geocodingService.resolveBirthCoordinates(
        order.birthPlace,
        birthDateTime,
      ));
      order.latitude = latitude;
      order.longitude = longitude;
      order.timezoneOffset = timezoneOffset;
    }

    const birthFields = {
      day: dob.getUTCDate(),
      month: dob.getUTCMonth() + 1,
      year: dob.getUTCFullYear(),
      hour: birthHour,
      min: birthMinute,
      latitude,
      longitude,
      timezoneOffset,
    };

    // Try the official ready-made Premium Kundli PDF report product first
    // (POST .../premium_kundli_report) — this is the real, documented
    // integration for this module. Falls back to the generic /planets
    // JSON + self-rendered PDF path below if that product isn't reachable
    // on this account/plan or the call fails for any reason, so a flaky or
    // unavailable premium endpoint never blocks generation entirely.
    let apiResponse = null;
    try {
      const branding = await getBrandingFields();
      apiResponse = await astrologyApiService.getPremiumKundliPdf({
        name: order.fullName,
        gender: order.gender,
        ...birthFields,
        timezone: timezoneOffset,
        place: order.birthPlace,
        language: "en",
        ...branding,
      });
    } catch (premiumError) {
      logger.error(`Premium Kundli PDF endpoint failed for order ${order._id}, falling back to /planets: ${premiumError.message}`);
    }

    let pdfUrl = extractPdfUrl(apiResponse);
    if (!pdfUrl) {
      apiResponse = await astrologyApiService.getKundliData(birthFields);
    }
    order.apiResponse = apiResponse;
    pdfUrl = extractPdfUrl(apiResponse);

    let pdfBufferForEmail = null;

    if (pdfUrl) {
      // API returned a hosted PDF directly — re-host it on our own
      // Cloudinary account (never link a customer to a third-party URL that
      // could expire/rate-limit/move) and use that same file as the email
      // attachment too.
      const downloaded = await downloadBuffer(pdfUrl);
      const uploaded = await uploadToCloudinary(downloaded, "premium-kundli/reports", { resourceType: "raw" });
      order.pdfUrl = uploaded.url;
      order.pdfPublicId = uploaded.publicId;
      pdfBufferForEmail = downloaded;
      order.statusHistory.push({ status: "Generated", note: "Kundli PDF received directly from AstrologyAPI" });
    } else {
      // JSON response (the default/typical case for astrologyapi.com's
      // /planets-style endpoints) — render our own PDF from the structured
      // data via pdf.service.js, so "auto-download the PDF" always has a
      // real file to deliver, not just for the rare provider that hands
      // back a ready-made PDF link.
      const generatedBuffer = await pdfService.generateKundliPdf(order);
      const uploaded = await uploadToCloudinary(generatedBuffer, "premium-kundli/reports", { resourceType: "raw" });
      order.pdfUrl = uploaded.url;
      order.pdfPublicId = uploaded.publicId;
      pdfBufferForEmail = generatedBuffer;
      order.statusHistory.push({ status: "Generated", note: "Kundli PDF generated from AstrologyAPI data" });
    }

    order.kundliStatus = "Generated";
    await order.save();

    await notifyOrderEvent(order, "generated");
    try {
      await sendEmail({
        to: order.email,
        subject: "Your Premium Kundli is Ready",
        html: templates.premiumKundliReady(order.user?.name || order.fullName, order),
        attachments: [{ filename: `Kundli-${order.orderNumber}.pdf`, content: pdfBufferForEmail }],
      });
    } catch (emailError) {
      logger.error(`Non-fatal: premium kundli ready email failed for order ${order._id}: ${emailError.message}`);
    }
  } catch (error) {
    logger.error(`Kundli generation failed for order ${order._id}: ${error.message}`);
    order.kundliStatus = "Failed";
    order.generationError = error.message;
    order.statusHistory.push({ status: "Failed", note: error.message });
    await order.save().catch((saveError) => {
      logger.error(`Failed to persist Kundli generation failure for order ${order._id}: ${saveError.message}`);
    });
    await notifyOrderEvent(order, "failed");
  }
};

module.exports = { generate };
