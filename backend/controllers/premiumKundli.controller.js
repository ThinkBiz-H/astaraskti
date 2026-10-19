const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/ApiError");
const { sendResponse } = require("../utils/ApiResponse");
const ApiFeatures = require("../utils/ApiFeatures");
const PremiumKundliOrder = require("../models/PremiumKundliOrder");
const ConsultationService = require("../models/ConsultationService");
const premiumKundliSettingsService = require("../services/premiumKundliSettings.service");
const kundliGenerationService = require("../services/kundliGeneration.service");
const geocodingService = require("../services/geocoding.service");
const { notifyOrderEvent, notifyAdminsNewOrder } = require("../services/premiumKundliOrder.service");
const { getGateway } = require("../services/paymentGateways");
const { sendEmail, templates } = require("../utils/sendEmail");
const { toCSV, sendCSV } = require("../utils/csv");
const logger = require("../utils/logger");

// Single source of truth for Kundli's price/content, per "manage both
// Kundli and Horoscope prices from Admin -> Consultation Services, no
// duplicate admin pages or service records". A type:'kundli' Consultation
// Service is now authoritative; if one doesn't exist yet it is created
// exactly once (seeded from the legacy PremiumKundliSettings singleton so
// nothing resets to a default price on migration), never a second time —
// every later call just finds and reuses that same record.
const getEffectiveKundliService = async () => {
  const existing = await ConsultationService.findOne({ type: "kundli", isDeleted: false }).sort("-createdAt");
  if (existing) return existing;

  const legacy = await premiumKundliSettingsService.getSettings();
  const migrated = await ConsultationService.create({
    name: legacy.title || "Premium AI Kundli",
    type: "kundli",
    description: legacy.description || "",
    price: legacy.originalPrice > 0 ? legacy.originalPrice : 999,
    salePrice: legacy.salePrice > 0 ? legacy.salePrice : null,
    gstPercent: legacy.gstPercent || 0,
    duration: 1,
    banner: legacy.banner?.url ? { url: legacy.banner.url, publicId: legacy.banner.publicId } : undefined,
    benefits: legacy.features || [],
    seo: legacy.seo || {},
    status: "active", // /kundli must never show "not available" out of the box
  });
  logger.warn(`Auto-migrated Premium Kundli pricing/content into Consultation Services (service ${migrated._id}) — manage it from Admin > Consultation Services from now on.`);
  return migrated;
};

/** Maps a Consultation Service record onto the shape PremiumKundliPage.jsx (frontend) and the admin Settings page already expect — so neither needed a rewrite when the underlying data source moved. */
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
  buttonText: "Get Premium Kundli",
  banner: service.banner,
  seo: service.seo,
});

// @desc    Public settings for the home page card / purchase flow —
//          price/content only ever comes from here, never hardcoded.
// @route   GET /api/v1/kundli/settings
// @access  Public
const getSettings = asyncHandler(async (req, res) => {
  const service = await getEffectiveKundliService();
  sendResponse(res, 200, { settings: toSettingsShape(service) }, "Premium Kundli settings fetched successfully");
});

// @desc    Resolves a free-text birth place into lat/lon/timezone BEFORE
//          payment, so an unresolvable place is caught while the customer
//          can still fix it — not after they've already paid (the generation
//          pipeline still re-resolves it itself if a client skips this and
//          submits without coordinates, so this is a UX improvement, not a
//          new requirement).
// @route   POST /api/v1/kundli/geocode
// @access  Public
const geocodeBirthPlace = asyncHandler(async (req, res) => {
  const { birthPlace, dob, birthTime } = req.body;

  const birthDateTime = new Date(dob);
  const [hour, minute] = birthTime.split(":").map(Number);
  birthDateTime.setHours(hour, minute, 0, 0);

  try {
    const { latitude, longitude, timezoneOffset, resolvedPlaceName } = await geocodingService.resolveBirthCoordinates(
      birthPlace,
      birthDateTime,
    );
    sendResponse(res, 200, { latitude, longitude, timezoneOffset, resolvedPlaceName }, "Place resolved successfully");
  } catch (error) {
    throw new ApiError(422, `Couldn't find "${birthPlace}" — try being more specific, e.g. "Jaipur, Rajasthan, India"`);
  }
});

// @desc    DEV-ONLY — generates a Premium Kundli with payment skipped
//          entirely. Deliberately a separate function from createOrder:
//          it never imports/calls `getGateway`, never touches the Razorpay
//          SDK, so there is no code path here that could open a checkout or
//          create a live charge, regardless of what the frontend sends.
//          Gated independently of any client-supplied value — a request
//          reaches this function at all only via routes/premiumKundli.routes.js,
//          and even then it 403s unless the server's own env has the flag on.
// @route   POST /api/v1/kundli/generate
// @access  Public (dev only — 403s outside development)
const devGenerateKundli = asyncHandler(async (req, res) => {
  if (process.env.NODE_ENV === "production" || process.env.SKIP_KUNDLI_PAYMENT !== "true") {
    throw new ApiError(403, "This endpoint is disabled (SKIP_KUNDLI_PAYMENT is not enabled in this environment)");
  }

  const { fullName, email, mobile, dob, birthTime, birthPlace, gender, latitude, longitude, timezoneOffset } = req.body;

  const service = await getEffectiveKundliService();
  const baseAmount = service.salePrice > 0 ? service.salePrice : service.price;
  const gstAmount = Math.round(baseAmount * (service.gstPercent / 100) * 100) / 100;
  const amount = Math.round((baseAmount + gstAmount) * 100) / 100;

  const order = await PremiumKundliOrder.create({
    user: req.user?._id || null,
    fullName, email, mobile, dob, birthTime, birthPlace, gender,
    latitude, longitude, timezoneOffset,
    amount,
    paymentStatus: "Paid",
    statusHistory: [
      { status: "Pending", note: "Order created (development)" },
      { status: "Paid", note: "Payment skipped — SKIP_KUNDLI_PAYMENT=true (development only, no Razorpay call made)" },
    ],
  });

  logger.warn(`Dev-only /kundli/generate used — order ${order.orderNumber} created with payment skipped entirely (no Razorpay request made)`);

  await notifyOrderEvent(order, "payment_success");
  await notifyAdminsNewOrder(order);

  try {
    await sendEmail({
      to: order.email,
      subject: `Payment Received - ${order.orderNumber}`,
      html: templates.premiumKundliOrderConfirmation(order.fullName, order),
    });
  } catch (e) {
    logger.error(`Non-fatal: premium kundli order confirmation email failed for order ${order._id}: ${e.message}`);
  }

  await kundliGenerationService.generate(order._id);
  const freshOrder = await PremiumKundliOrder.findById(order._id);

  sendResponse(res, 201, { order: freshOrder }, "Premium Kundli generated — payment skipped (development mode)");
});

// @desc    Update settings (admin)
// @route   PUT /api/v1/admin/premium-kundli/settings
// @access  Private/Admin
const updateSettings = asyncHandler(async (req, res) => {
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

  // Writes through to the SAME Consultation Service record getSettings()
  // reads from (see getEffectiveKundliService above) — this admin Settings
  // page and Admin > Consultation Services now edit one shared record, not
  // two, regardless of which UI an admin uses.
  const service = await getEffectiveKundliService();

  if (req.files?.banner?.[0] || req.files?.thumbnail?.[0]) {
    const { uploadToCloudinary, deleteFromCloudinary } = require("../services/cloudinary.service");
    // "thumbnail" (legacy field name) maps onto ConsultationService.image —
    // "banner" maps onto ConsultationService.banner directly (same meaning
    // on both: the large hero image).
    const FIELD_MAP = { banner: "banner", thumbnail: "image" };
    for (const legacyField of ["banner", "thumbnail"]) {
      const file = req.files?.[legacyField]?.[0];
      if (file) {
        const serviceField = FIELD_MAP[legacyField];
        if (service[serviceField]?.publicId) await deleteFromCloudinary(service[serviceField].publicId);
        const result = await uploadToCloudinary(file.buffer, "premium-kundli");
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
  sendResponse(res, 200, { settings: toSettingsShape(service) }, "Premium Kundli settings updated successfully");
});

// @desc    Create a Premium Kundli order + Razorpay order (PART 4 flow, steps 1-3)
//          Full guest checkout — no login/OTP required. When the buyer is
//          logged in (req.user set by optionalAuth), the order is linked
//          to their account so it shows up in their dashboard; otherwise
//          it's a pure guest order identified by fullName/email/mobile.
// @route   POST /api/v1/kundli/order
// @access  Public
const createOrder = asyncHandler(async (req, res) => {
  const { fullName, email, mobile, dob, birthTime, birthPlace, gender, gateway: gatewayName, latitude, longitude, timezoneOffset } = req.body;

  const service = await getEffectiveKundliService();
  if (service.status !== "active") {
    throw new ApiError(400, "Premium Kundli is not currently available");
  }

  // Price always comes from the admin-configured Consultation Service —
  // never a client-sent amount.
  const baseAmount = service.salePrice > 0 ? service.salePrice : service.price;
  const gstAmount = Math.round(baseAmount * (service.gstPercent / 100) * 100) / 100;
  const amount = Math.round((baseAmount + gstAmount) * 100) / 100;
  if (amount <= 0) {
    throw new ApiError(400, "Premium Kundli price has not been configured yet");
  }

  const order = await PremiumKundliOrder.create({
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
      notes: { premiumKundliOrderId: String(order._id), type: "premium_kundli" },
    });
  } catch (error) {
    // The Razorpay SDK throws an error object carrying ITS OWN HTTP status
    // (e.g. 401 when our Razorpay API keys are invalid) — letting that
    // raw statusCode fall through error.middleware.js unchanged would make
    // a payment-gateway failure look like an auth rejection on this
    // (deliberately public) endpoint. Always surface it as 502, matching
    // the same translation payment.controller.js's refund path already
    // uses for the identical class of failure.
    order.paymentStatus = "Failed";
    order.statusHistory.push({ status: "Failed", note: `Gateway order creation failed: ${error.error?.description || error.message}` });
    await order.save();
    throw new ApiError(502, `Payment gateway error: ${error.error?.description || error.message}`);
  }

  order.razorpayOrderId = gatewayOrder.gatewayOrderId;
  await order.save();

  sendResponse(res, 201, { order, gatewayOrder }, "Premium Kundli order created successfully");
});

// @desc    Verify payment, mark paid, kick off the placeholder generation service.
//          Public — a guest never has an account to "own" the order, so
//          the real security boundary here is the Razorpay signature
//          itself (unforgeable without having actually paid), not a
//          login check. When the order IS linked to an account (bought
//          while logged in), that link is still enforced below.
// @route   POST /api/v1/kundli/payment/verify
// @access  Public
const verifyPayment = asyncHandler(async (req, res) => {
  const { orderId, gatewayOrderId, gatewayPaymentId, signature } = req.body;
  if (!orderId || !gatewayOrderId || !gatewayPaymentId || !signature) {
    throw new ApiError(400, "Missing required payment verification fields");
  }

  const order = await PremiumKundliOrder.findById(orderId).populate("user", "name email");
  if (!order) throw new ApiError(404, "Order not found");
  if (order.user && String(order.user._id) !== String(req.user?._id)) {
    throw new ApiError(403, "You are not authorized to verify this order");
  }
  if (order.razorpayOrderId !== gatewayOrderId) {
    throw new ApiError(400, "Order ID mismatch");
  }

  // Idempotency — if this order was already verified+paid (e.g. a client
  // retry after a network hiccup, or the same request arriving twice),
  // return its current state as-is rather than re-running generation,
  // re-sending the email, and re-uploading a PDF for a payment that's
  // already been processed.
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

  await notifyOrderEvent(order, "payment_success"); // no-ops for guest orders (no account to notify in-app)
  await notifyAdminsNewOrder(order);

  // The real, durable confirmation for a guest (no account, no in-app
  // notification) — matches how product orders already email a
  // confirmation regardless of guest/logged-in status.
  try {
    await sendEmail({
      to: order.email,
      subject: `Payment Received - ${order.orderNumber}`,
      html: templates.premiumKundliOrderConfirmation(order.user?.name || order.fullName, order),
    });
  } catch (e) {
    logger.error(`Non-fatal: premium kundli order confirmation email failed for order ${order._id}: ${e.message}`);
  }

  // The one placeholder call site named in the spec. It saves its own copy
  // of the document, so re-fetch before responding — otherwise the client
  // gets back the stale pre-"Processing" kundliStatus.
  await kundliGenerationService.generate(order._id);
  const freshOrder = await PremiumKundliOrder.findById(order._id);

  sendResponse(res, 200, { order: freshOrder }, "Payment verified successfully");
});

// @desc    The logged-in user's Premium Kundli orders (Customer Dashboard)
// @route   GET /api/v1/kundli/my-orders
// @access  Private
const getMyOrders = asyncHandler(async (req, res) => {
  const orders = await PremiumKundliOrder.find({ user: req.user._id }).sort("-createdAt");
  sendResponse(res, 200, { orders, count: orders.length }, "Premium Kundli orders fetched successfully");
});

// @desc    A single order (owner or admin)
// @route   GET /api/v1/kundli/order/:id
// @access  Private
const getOrderById = asyncHandler(async (req, res) => {
  const order = await PremiumKundliOrder.findById(req.params.id).populate("user", "name email mobile");
  if (!order) throw new ApiError(404, "Order not found");
  // order.user is null for a guest order — this route is account-only
  // (protect-gated), so a guest order has no logged-in owner who could
  // legitimately hit it; only an admin can.
  if (req.user.role !== "admin" && String(order.user?._id) !== String(req.user._id)) {
    throw new ApiError(403, "You are not authorized to view this order");
  }
  sendResponse(res, 200, { order }, "Order fetched successfully");
});

// @desc    List all orders (admin) — search/filter/pagination
// @route   GET /api/v1/kundli/orders
// @access  Private/Admin
const getAllOrders = asyncHandler(async (req, res) => {
  const baseQuery = PremiumKundliOrder.find().populate("user", "name email mobile");

  const features = new ApiFeatures(baseQuery, req.query)
    .search(["orderNumber", "fullName", "email", "mobile"])
    .filter()
    .sort()
    .paginate();

  const totalCountFeatures = new ApiFeatures(PremiumKundliOrder.find(), req.query)
    .search(["orderNumber", "fullName", "email", "mobile"])
    .filter();

  const [orders, total] = await Promise.all([
    features.query,
    totalCountFeatures.query.countDocuments(),
  ]);

  sendResponse(
    res,
    200,
    { orders, count: orders.length, total, pagination: features.pagination },
    "Premium Kundli orders fetched successfully",
  );
});

// @desc    Admin manual status update — sets kundliStatus and/or uploads a PDF.
//          The moment pdfUrl transitions from empty to set, this is what
//          genuinely, automatically notifies + emails the customer (not a
//          separate manual "send" action) — same field the future real
//          generation API will set instead of this endpoint.
// @route   PATCH /api/v1/kundli/status
// @access  Private/Admin
const updateStatus = asyncHandler(async (req, res) => {
  const { orderId, kundliStatus, note, adminNotes } = req.body;
  const order = await PremiumKundliOrder.findById(orderId).populate("user", "name email");
  if (!order) throw new ApiError(404, "Order not found");

  const hadNoPdf = !order.pdfUrl;

  if (kundliStatus && kundliStatus !== order.kundliStatus) {
    order.kundliStatus = kundliStatus;
    order.statusHistory.push({ status: kundliStatus, note });
  }

  if (req.file) {
    const { uploadToCloudinary, deleteFromCloudinary } = require("../services/cloudinary.service");
    const { resourceTypeFor } = require("../middlewares/mediaUpload.middleware");
    if (order.pdfPublicId) await deleteFromCloudinary(order.pdfPublicId, "raw");
    const result = await uploadToCloudinary(req.file.buffer, "premium-kundli/reports", { resourceType: resourceTypeFor(req.file.mimetype) });
    order.pdfUrl = result.url;
    order.pdfPublicId = result.publicId;
    if (order.kundliStatus !== "Generated") {
      order.kundliStatus = "Generated";
      order.statusHistory.push({ status: "Generated", note: "Report uploaded" });
    }
  }

  if (adminNotes !== undefined) order.adminNotes = adminNotes;
  await order.save();

  if (hadNoPdf && order.pdfUrl) {
    await notifyOrderEvent(order, "generated");
    try {
      await sendEmail({
        to: order.user.email,
        subject: `Your Premium Kundli is Ready - ${order.orderNumber}`,
        html: templates.premiumKundliReady(order.user.name || order.fullName, order),
      });
    } catch (e) {
      logger.error(`Non-fatal: premium kundli ready email failed for order ${order._id}: ${e.message}`);
    }
  } else if (kundliStatus === "Processing") {
    await notifyOrderEvent(order, "processing");
  } else if (kundliStatus === "Failed") {
    await notifyOrderEvent(order, "failed");
  }

  sendResponse(res, 200, { order }, "Order status updated successfully");
});

// @desc    Re-run generation for an order (admin) — e.g. after a transient
//          AstrologyAPI failure, or to pick up newly-configured credentials.
// @route   POST /api/v1/kundli/orders/:id/regenerate
// @access  Private/Admin
const regenerate = asyncHandler(async (req, res) => {
  const order = await PremiumKundliOrder.findById(req.params.id);
  if (!order) throw new ApiError(404, "Order not found");
  if (order.paymentStatus !== "Paid") {
    throw new ApiError(400, "Cannot generate a Kundli for an order that hasn't been paid");
  }

  await kundliGenerationService.generate(order._id);
  const freshOrder = await PremiumKundliOrder.findById(order._id);
  sendResponse(res, 200, { order: freshOrder }, "Regeneration triggered successfully");
});

// @desc    Manually resend the customer's email for this order (admin) —
//          the "ready" email if a PDF exists, otherwise the order
//          confirmation email.
// @route   POST /api/v1/kundli/orders/:id/resend-email
// @access  Private/Admin
const resendEmail = asyncHandler(async (req, res) => {
  const order = await PremiumKundliOrder.findById(req.params.id).populate("user", "name email");
  if (!order) throw new ApiError(404, "Order not found");

  const name = order.user?.name || order.fullName;
  if (order.pdfUrl) {
    await sendEmail({
      to: order.email,
      subject: `Your Premium Kundli is Ready - ${order.orderNumber}`,
      html: templates.premiumKundliReady(name, order),
    });
  } else {
    await sendEmail({
      to: order.email,
      subject: `Payment Received - ${order.orderNumber}`,
      html: templates.premiumKundliOrderConfirmation(name, order),
    });
  }

  sendResponse(res, 200, {}, "Email resent successfully");
});

// @desc    Export Premium Kundli orders as CSV (admin)
// @route   GET /api/v1/kundli/orders/export
// @access  Private/Admin
const exportOrders = asyncHandler(async (req, res) => {
  const orders = await PremiumKundliOrder.find().sort("-createdAt").lean();

  const rows = orders.map((o) => ({
    orderNumber: o.orderNumber,
    fullName: o.fullName,
    email: o.email,
    mobile: o.mobile,
    amount: o.amount,
    paymentStatus: o.paymentStatus,
    kundliStatus: o.kundliStatus,
    pdfReady: o.pdfUrl ? "Yes" : "No",
    createdAt: o.createdAt.toISOString().slice(0, 10),
  }));

  const csv = toCSV(
    ["orderNumber", "fullName", "email", "mobile", "amount", "paymentStatus", "kundliStatus", "pdfReady", "createdAt"],
    rows,
  );
  sendCSV(res, `premium-kundli-orders-${Date.now()}.csv`, csv);
});

// @desc    Download the generated PDF (owner or admin) — 404s clearly if
//          not ready yet, never fabricates a file.
// @route   GET /api/v1/kundli/download/:id
// @access  Private
const downloadPdf = asyncHandler(async (req, res) => {
  const order = await PremiumKundliOrder.findById(req.params.id);
  if (!order) throw new ApiError(404, "Order not found");
  if (req.user.role !== "admin" && String(order.user) !== String(req.user._id)) {
    throw new ApiError(403, "You are not authorized to download this report");
  }
  if (!order.pdfUrl) {
    throw new ApiError(404, "This Kundli report is not ready yet");
  }
  res.redirect(order.pdfUrl);
});

module.exports = {
  getSettings,
  updateSettings,
  geocodeBirthPlace,
  devGenerateKundli,
  createOrder,
  verifyPayment,
  getMyOrders,
  getOrderById,
  getAllOrders,
  updateStatus,
  regenerate,
  resendEmail,
  exportOrders,
  downloadPdf,
};
