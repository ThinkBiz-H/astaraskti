const HoroscopeOrder = require("../models/HoroscopeOrder");
const astrologyApiService = require("./astrologyApi.service");
const geocodingService = require("./geocoding.service");
const pdfService = require("./pdf.service");
const { uploadToCloudinary } = require("./cloudinary.service");
const { sendEmail, templates } = require("../utils/sendEmail");
const logger = require("../utils/logger");

// Mirrors services/kundliGeneration.service.js's generate() structure, but
// the actual AstrologyAPI call is fundamentally different: the real
// documented horoscope_prediction endpoint is a GENERIC sun-sign forecast
// (same result for everyone born under that sign in that period), not a
// personalized birth-chart report — it takes no day/month/year/lat/lon at
// all, just a zodiac sign (derived from DOB below) and `timezone`. Never
// throws — a flaky external API must never break the payment-confirmation
// response this is called from.
const PDF_URL_FIELDS = ["pdf_url", "report_url", "pdf", "file_url"];

const extractPdfUrl = (apiResponse) => {
  if (!apiResponse || typeof apiResponse !== "object") return null;
  for (const field of PDF_URL_FIELDS) {
    if (typeof apiResponse[field] === "string" && apiResponse[field].startsWith("http")) {
      return apiResponse[field];
    }
  }
  return null;
};

/** Standard tropical sun-sign date ranges. */
const getZodiacSign = (month, day) => {
  if ((month === 1 && day >= 20) || (month === 2 && day <= 18)) return "aquarius";
  if ((month === 2 && day >= 19) || (month === 3 && day <= 20)) return "pisces";
  if ((month === 3 && day >= 21) || (month === 4 && day <= 19)) return "aries";
  if ((month === 4 && day >= 20) || (month === 5 && day <= 20)) return "taurus";
  if ((month === 5 && day >= 21) || (month === 6 && day <= 20)) return "gemini";
  if ((month === 6 && day >= 21) || (month === 7 && day <= 22)) return "cancer";
  if ((month === 7 && day >= 23) || (month === 8 && day <= 22)) return "leo";
  if ((month === 8 && day >= 23) || (month === 9 && day <= 22)) return "virgo";
  if ((month === 9 && day >= 23) || (month === 10 && day <= 22)) return "libra";
  if ((month === 10 && day >= 23) || (month === 11 && day <= 21)) return "scorpio";
  if ((month === 11 && day >= 22) || (month === 12 && day <= 21)) return "sagittarius";
  return "capricorn"; // Dec 22 - Jan 19
};

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

const generate = async (orderId) => {
  const order = await HoroscopeOrder.findById(orderId).populate("user", "name email");
  if (!order) {
    logger.error(`horoscope.generate: order ${orderId} not found`);
    return;
  }

  order.reportStatus = "Processing";
  order.statusHistory.push({ status: "Processing", note: "Queued for generation" });
  await order.save();

  try {
    if (!astrologyApiService.isKeyConfigured()) {
      throw new Error("AstrologyAPI key is not configured yet (ASTROLOGY_API_KEY missing)");
    }

    const dob = new Date(order.dob);
    const [birthHour, birthMinute] = order.birthTime.split(":").map(Number);
    const birthDateTime = new Date(dob);
    birthDateTime.setHours(birthHour, birthMinute, 0, 0);

    // The prediction endpoint only needs `timezone` (not lat/lon) — still
    // geocode the birth place for that, reusing the same resolution (and
    // the same pre-payment /kundli/geocode short-circuit) as Kundli.
    let timezoneOffset = order.timezoneOffset;
    if (timezoneOffset == null) {
      const resolved = await geocodingService.resolveBirthCoordinates(order.birthPlace, birthDateTime);
      order.latitude = resolved.latitude;
      order.longitude = resolved.longitude;
      order.timezoneOffset = resolved.timezoneOffset;
      timezoneOffset = resolved.timezoneOffset;
    }

    const sign = getZodiacSign(dob.getUTCMonth() + 1, dob.getUTCDate());
    const apiResponse = await astrologyApiService.getHoroscopePrediction({ sign, timezoneOffset });
    order.apiResponse = apiResponse;

    const pdfUrl = extractPdfUrl(apiResponse);
    let pdfBufferForEmail = null;

    if (pdfUrl) {
      const downloaded = await downloadBuffer(pdfUrl);
      const uploaded = await uploadToCloudinary(downloaded, "premium-horoscope/reports", { resourceType: "raw" });
      order.pdfUrl = uploaded.url;
      order.pdfPublicId = uploaded.publicId;
      pdfBufferForEmail = downloaded;
      order.statusHistory.push({ status: "Generated", note: "Horoscope PDF received directly from AstrologyAPI" });
    } else {
      // Reuses pdf.service.js's generateKundliPdf() as-is, just with the
      // Horoscope report title (see pdf.service.js's optional second
      // param — added without changing its default/Kundli behavior).
      const generatedBuffer = await pdfService.generateKundliPdf(order, { reportTitle: "Premium Horoscope Report" });
      const uploaded = await uploadToCloudinary(generatedBuffer, "premium-horoscope/reports", { resourceType: "raw" });
      order.pdfUrl = uploaded.url;
      order.pdfPublicId = uploaded.publicId;
      pdfBufferForEmail = generatedBuffer;
      order.statusHistory.push({ status: "Generated", note: "Horoscope PDF generated from AstrologyAPI data" });
    }

    order.reportStatus = "Generated";
    await order.save();

    try {
      await sendEmail({
        to: order.email,
        subject: "Your Premium Horoscope Report",
        html: templates.premiumHoroscopeReady(order.user?.name || order.fullName, order),
        attachments: [{ filename: `Horoscope-${order.orderNumber}.pdf`, content: pdfBufferForEmail }],
      });
    } catch (emailError) {
      logger.error(`Non-fatal: premium horoscope ready email failed for order ${order._id}: ${emailError.message}`);
    }
  } catch (error) {
    logger.error(`Horoscope generation failed for order ${order._id}: ${error.message}`);
    order.reportStatus = "Failed";
    order.generationError = error.message;
    order.statusHistory.push({ status: "Failed", note: error.message });
    await order.save().catch((saveError) => {
      logger.error(`Failed to persist Horoscope generation failure for order ${order._id}: ${saveError.message}`);
    });
  }
};

module.exports = { generate };
