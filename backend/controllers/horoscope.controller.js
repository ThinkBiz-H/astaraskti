const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/ApiError");
const { sendResponse } = require("../utils/ApiResponse");
const HoroscopeOrder = require("../models/HoroscopeOrder");
const ConsultationService = require("../models/ConsultationService");
const horoscopeService = require("../services/horoscope.service");
const { getGateway } = require("../services/paymentGateways");
const { sendEmail, templates } = require("../utils/sendEmail");
const logger = require("../utils/logger");

// Mirrors controllers/premiumKundli.controller.js's createOrder/verifyPayment
// structure and style exactly. Price comes from the existing Consultation
// Services collection, fetched fresh on every order so an admin price
// change takes effect immediately with no caching layer to invalidate.
// "horoscope" is a FIXED service (no admin create/edit/delete UI — see
// admin's ConsultationServicesAdminPage.jsx, which only exposes a price
// field for it), so exactly like getEffectiveKundliService in
// premiumKundli.controller.js, this auto-creates the one record it needs
// the first time it's accessed rather than requiring any manual setup.
const getActiveHoroscopeService = async () => {
  const existing = await ConsultationService.findOne({ type: "horoscope", isDeleted: false }).sort("-createdAt");
  if (existing) return existing;

  const created = await ConsultationService.create({
    name: "Premium AI Horoscope",
    type: "horoscope",
    price: 999,
    duration: 1,
    status: "active",
  });
  logger.warn(`Auto-created the fixed Premium Horoscope Consultation Service (service ${created._id}) with a placeholder price — set the real price from Admin > Consultation Services.`);
  return created;
};

// @desc    Public — the Horoscope purchase page reads name/price/image/
//          description from here (Consultation Services collection only,
//          never a hardcoded value).
// @route   GET /api/v1/horoscope/service
// @access  Public
const getHoroscopeService = asyncHandler(async (req, res) => {
  const service = await getActiveHoroscopeService();
  sendResponse(res, 200, { service }, "Premium Horoscope service fetched successfully");
});

// Maps a Consultation Service record onto the exact same shape
// premiumKundli.controller.js's toSettingsShape produces, so the Horoscope
// admin Settings page and PremiumHoroscopePage.jsx (frontend) can reuse
// the identical GET/UPDATE API pattern and field names as Premium Kundli.
// Duplicated here (not imported from premiumKundli.controller.js) only
// because that file must not be touched — this is a plain ~12-line object
// mapping, not business logic; the actual reused logic is
// getActiveHoroscopeService above (identical role to getEffectiveKundliService).
const toSettingsShape = (service) => ({
  isActive: service.status === "active",
  title: service.name,
  subtitle: "",
  description: service.description,
  features: service.benefits || [],
  originalPrice: service.price,
  salePrice: service.salePrice,
  gstPercent: service.gstPercent,
  deliveryText: "",
  buttonText: "Get Premium Horoscope",
  banner: service.banner,
  seo: service.seo,
});

// @desc    Public settings for the home page card / purchase flow — same
//          GET/UPDATE API pattern as premiumKundli.controller.js's
//          getSettings/updateSettings, reusing the same Consultation
//          Service record getHoroscopeService/createOrder already use.
// @route   GET /api/v1/horoscope/settings
// @access  Public
const getHoroscopeSettings = asyncHandler(async (req, res) => {
  const service = await getActiveHoroscopeService();
  sendResponse(res, 200, { settings: toSettingsShape(service) }, "Premium Horoscope settings fetched successfully");
});

// @desc    Update settings (admin) — mirrors premiumKundli.controller.js's
//          updateSettings exactly (same field names, same banner/thumbnail
//          upload handling), writing to the Consultation Service record.
// @route   PUT /api/v1/admin/premium-horoscope/settings
// @access  Private/Admin
const updateHoroscopeSettings = asyncHandler(async (req, res) => {
  const body = { ...req.body };
  ["features"].forEach((field) => {
    if (typeof body[field] === "string") {
      try {
        body[field] = JSON.parse(body[field]);
      } catch {
        body[field] = body[field].split(",").map((s) => s.trim()).filter(Boolean);
      }
    }
  });
  ["seo"].forEach((field) => {
    if (typeof body[field] === "string") {
      try {
        body[field] = JSON.parse(body[field]);
      } catch {
        delete body[field];
      }
    }
  });

  const service = await getActiveHoroscopeService();

  if (req.files?.banner?.[0] || req.files?.thumbnail?.[0]) {
    const { uploadToCloudinary, deleteFromCloudinary } = require("../services/cloudinary.service");
    // "thumbnail" (legacy field name, same as Kundli's admin form) maps
    // onto ConsultationService.image — "banner" maps onto .banner directly.
    const FIELD_MAP = { banner: "banner", thumbnail: "image" };
    for (const legacyField of ["banner", "thumbnail"]) {
      const file = req.files?.[legacyField]?.[0];
      if (file) {
        const serviceField = FIELD_MAP[legacyField];
        if (service[serviceField]?.publicId) await deleteFromCloudinary(service[serviceField].publicId);
        const result = await uploadToCloudinary(file.buffer, "premium-horoscope");
        service[serviceField] = { url: result.url, publicId: result.publicId };
      }
    }
  }

  if (body.title !== undefined) service.name = body.title;
  if (body.description !== undefined) service.description = body.description;
  if (body.originalPrice !== undefined) service.price = body.originalPrice;
  if (body.salePrice !== undefined) service.salePrice = body.salePrice;
  if (body.gstPercent !== undefined) service.gstPercent = body.gstPercent;
  if (body.features !== undefined) service.benefits = body.features;
  if (body.isActive !== undefined) service.status = body.isActive ? "active" : "inactive";
  if (body.seo !== undefined) service.seo = { ...(service.seo?.toObject?.() ?? service.seo), ...body.seo };

  await service.save();
  sendResponse(res, 200, { settings: toSettingsShape(service) }, "Premium Horoscope settings updated successfully");
});

// @desc    Create a Premium Horoscope order + Razorpay order.
//          Full guest checkout — no login/OTP required, identical pattern
//          to Premium Kundli's createOrder.
// @route   POST /api/v1/horoscope/order
// @access  Public
const createOrder = asyncHandler(async (req, res) => {
  const { fullName, email, mobile, dob, birthTime, birthPlace, gender, gateway: gatewayName, latitude, longitude, timezoneOffset } = req.body;

  const service = await getActiveHoroscopeService();

  // Price always comes from the admin-configured Consultation Service —
  // never a client-sent amount.
  const baseAmount = service.salePrice > 0 ? service.salePrice : service.price;
  const gstAmount = Math.round(baseAmount * (service.gstPercent / 100) * 100) / 100;
  const amount = Math.round((baseAmount + gstAmount) * 100) / 100;
  if (amount <= 0) {
    throw new ApiError(400, "Premium Horoscope price has not been configured yet");
  }

  const order = await HoroscopeOrder.create({
    user: req.user?._id || null,
    fullName, email, mobile, dob, birthTime, birthPlace, gender,
    latitude, longitude, timezoneOffset,
    amount,
    statusHistory: [{ status: "Pending", note: "Order created" }],
  });

  const gateway = getGateway(gatewayName || "razorpay");
  let gatewayOrder;
  try {
    gatewayOrder = await gateway.createOrder({
      amount: order.amount,
      receipt: order.orderNumber,
      notes: { horoscopeOrderId: String(order._id), type: "premium_horoscope" },
    });
  } catch (error) {
    order.paymentStatus = "Failed";
    order.statusHistory.push({ status: "Failed", note: `Gateway order creation failed: ${error.error?.description || error.message}` });
    await order.save();
    throw new ApiError(502, `Payment gateway error: ${error.error?.description || error.message}`);
  }

  order.razorpayOrderId = gatewayOrder.gatewayOrderId;
  await order.save();

  sendResponse(res, 201, { order, gatewayOrder, service }, "Premium Horoscope order created successfully");
});

// @desc    Verify payment, mark paid, generate the Horoscope report.
// @route   POST /api/v1/horoscope/payment/verify
// @access  Public
const verifyPayment = asyncHandler(async (req, res) => {
  const { orderId, gatewayOrderId, gatewayPaymentId, signature } = req.body;
  if (!orderId || !gatewayOrderId || !gatewayPaymentId || !signature) {
    throw new ApiError(400, "Missing required payment verification fields");
  }

  const order = await HoroscopeOrder.findById(orderId).populate("user", "name email");
  if (!order) throw new ApiError(404, "Order not found");
  if (order.user && String(order.user._id) !== String(req.user?._id)) {
    throw new ApiError(403, "You are not authorized to verify this order");
  }
  if (order.razorpayOrderId !== gatewayOrderId) {
    throw new ApiError(400, "Order ID mismatch");
  }

  // Idempotency — see premiumKundli.controller.js's verifyPayment for the
  // same guard: a retried verify call for an already-paid order must not
  // re-trigger generation/email for the same payment.
  if (order.paymentStatus === "Paid") {
    return sendResponse(res, 200, { order }, "Payment already verified");
  }

  const gateway = getGateway("razorpay");
  const isValid = gateway.verifyPayment({ gatewayOrderId, gatewayPaymentId, signature });

  if (!isValid) {
    order.paymentStatus = "Failed";
    order.statusHistory.push({ status: "Failed", note: "Signature verification failed" });
    await order.save();
    throw new ApiError(400, "Payment verification failed: invalid signature");
  }

  order.paymentStatus = "Paid";
  order.razorpayPaymentId = gatewayPaymentId;
  order.statusHistory.push({ status: "Paid", note: "Payment received" });
  await order.save();

  try {
    await sendEmail({
      to: order.email,
      subject: `Payment Received - ${order.orderNumber}`,
      html: templates.premiumHoroscopeOrderConfirmation(order.user?.name || order.fullName, order),
    });
  } catch (e) {
    logger.error(`Non-fatal: premium horoscope order confirmation email failed for order ${order._id}: ${e.message}`);
  }

  await horoscopeService.generate(order._id);
  const freshOrder = await HoroscopeOrder.findById(order._id);

  sendResponse(res, 200, { order: freshOrder }, "Payment verified successfully");
});

// @desc    DEV-ONLY — generates a Premium Horoscope with payment skipped
//          entirely. Mirrors premiumKundli.controller.js's devGenerateKundli
//          exactly, gated on a SEPARATE env flag (TEST_MODE, not
//          SKIP_KUNDLI_PAYMENT) so the two modules' dev bypasses can be
//          toggled independently. Never imports/calls getGateway — no code
//          path here can reach the Razorpay SDK, regardless of what the
//          frontend sends.
// @route   POST /api/v1/horoscope/generate
// @access  Public (dev only — 403s outside development)
const devGenerateHoroscope = asyncHandler(async (req, res) => {
  if (process.env.NODE_ENV === "production" || process.env.TEST_MODE !== "true") {
    throw new ApiError(403, "This endpoint is disabled (TEST_MODE is not enabled in this environment)");
  }

  const { fullName, email, mobile, dob, birthTime, birthPlace, gender, latitude, longitude, timezoneOffset } = req.body;

  const service = await getActiveHoroscopeService();
  const baseAmount = service.salePrice > 0 ? service.salePrice : service.price;
  const gstAmount = Math.round(baseAmount * (service.gstPercent / 100) * 100) / 100;
  const amount = Math.round((baseAmount + gstAmount) * 100) / 100;

  const order = await HoroscopeOrder.create({
    user: req.user?._id || null,
    fullName, email, mobile, dob, birthTime, birthPlace, gender,
    latitude, longitude, timezoneOffset,
    amount,
    paymentStatus: "Paid",
    statusHistory: [
      { status: "Pending", note: "Order created (development)" },
      { status: "Paid", note: "Payment skipped — TEST_MODE=true (development only, no Razorpay call made)" },
    ],
  });

  logger.warn(`Dev-only /horoscope/generate used — order ${order.orderNumber} created with payment skipped entirely (no Razorpay request made)`);

  try {
    await sendEmail({
      to: order.email,
      subject: `Payment Received - ${order.orderNumber}`,
      html: templates.premiumHoroscopeOrderConfirmation(order.fullName, order),
    });
  } catch (e) {
    logger.error(`Non-fatal: premium horoscope order confirmation email failed for order ${order._id}: ${e.message}`);
  }

  await horoscopeService.generate(order._id);
  const freshOrder = await HoroscopeOrder.findById(order._id);

  sendResponse(res, 201, { order: freshOrder }, "Premium Horoscope generated — payment skipped (development mode)");
});

module.exports = {
  getHoroscopeService,
  getHoroscopeSettings,
  updateHoroscopeSettings,
  createOrder,
  verifyPayment,
  devGenerateHoroscope,
};
