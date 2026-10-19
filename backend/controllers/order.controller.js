const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/ApiError");
const { sendResponse } = require("../utils/ApiResponse");
const Order = require("../models/Order");
const User = require("../models/User");
const Coupon = require("../models/Coupon");
const Product = require("../models/Product");
const razorpayInstance = require("../config/razorpay");
const {
  buildOrderItems,
  calculateTotals,
  reduceStock,
  restoreStock,
  pushStatusHistory,
  notifyOrderStatusChange,
} = require("../services/order.service");
const shiprocket = require("../services/shiprocket.service");
const { streamInvoicePDF } = require("../services/invoice.service");
const {
  canTransition,
  assertTransition,
} = require("../utils/orderStatusMachine");
const { sendEmail, templates } = require("../utils/sendEmail");
const { notify } = require("../services/notification.service");
const logger = require("../utils/logger");
const shippingService = require("../services/shipping.service");
// @desc    Create a new order (COD immediate, Razorpay creates a payment order)
// @route   POST /api/v1/orders
// @access  Private
const createOrder = asyncHandler(async (req, res) => {
  const { shippingAddress, paymentMethod, couponCode, shippingNotes, items } =
    req.body;

  const user = await User.findById(req.user._id)
    .populate("cart.product")
    .populate("cart.variant");

  // `items` is sent for Buy Now and for a guest's checkout (their cart
  // lives only in the frontend's localStorage — see guestCart.js — and
  // gets snapshotted into this payload right before OTP verification logs
  // them in, since the freshly-created account has an empty server cart).
  // Falls back to the account's persisted cart otherwise — the normal,
  // unchanged logged-in-checkout path.
  const usingExplicitItems = Array.isArray(items) && items.length > 0;

  let cartItems;
  if (usingExplicitItems) {
    cartItems = items.map((item) => ({
      product: item.productId,
      variant: item.variantId || null,
      quantity: item.quantity,
      color: item.color,
      size: item.size,
    }));
  } else {
    if (!user.cart || user.cart.length === 0) {
      throw new ApiError(400, "Your cart is empty");
    }
    cartItems = user.cart.map((item) => ({
      product: item.product._id,
      variant: item.variant?._id || null,
      quantity: item.quantity,
      color: item.color,
      size: item.size,
    }));
  }

  const { orderItems, subTotal } = await buildOrderItems(cartItems);

  let discountAmount = 0;
  let coupon = null;
  if (couponCode) {
    coupon = await Coupon.findOne({ code: couponCode.toUpperCase() });
    if (!coupon) throw new ApiError(404, "Invalid coupon code");
    const validity = coupon.isValid(subTotal, user._id);
    if (!validity.valid) throw new ApiError(400, validity.reason);
    discountAmount = coupon.calculateDiscount(subTotal);
  }

  const shipping = await shippingService.calculateShipping({
    deliveryPincode: shippingAddress.pincode,
    weight: 0.5,
    cod: paymentMethod === "cod",
  });
  const shippingCharge = shipping.shippingCharge;

  const { tax, grandTotal } = calculateTotals(
    subTotal,
    discountAmount,
    shippingCharge,
  );

  const order = await Order.create({
    user: user._id,
    items: orderItems,
    shippingAddress,
    shippingNotes,

    coupon: coupon
      ? {
          code: coupon.code,
          discountAmount,
        }
      : undefined,

    subTotal,
    shippingCharge,
    tax,
    grandTotal,

    paymentMethod,
    paymentStatus: "Pending",
    orderStatus: "Pending",

    courier: {
      partner:
        shipping.courierName === "Standard Shipping" ? "Manual" : "Shiprocket",

      courierId: shipping.courierId,
      courierName: shipping.courierName,
    },

    tracking: {
      shipmentStatus: "Not Shipped",
      estimatedDeliveryDate: shipping.estimatedDays
        ? new Date(Date.now() + shipping.estimatedDays * 24 * 60 * 60 * 1000)
        : null,
    },

    statusHistory: [
      {
        status: "Pending",
        note: "Order placed",
      },
    ],
  });
  if (paymentMethod === "cod") {
    await reduceStock(orderItems, {
      orderId: order._id,
      performedBy: user._id,
    });
    if (coupon) {
      await coupon.recordUsage(user._id);
    }
    if (!usingExplicitItems) {
      user.cart = [];
      await user.save({ validateBeforeSave: false });
    }

    try {
      await sendEmail({
        to: user.email,
        subject: `Order Confirmed - ${order.orderNumber}`,
        html: templates.orderConfirmation(user.name, order),
      });
    } catch (e) {
      /* non-fatal */
    }

    notify({
      user: user._id,
      type: "order_confirmed",
      title: "Order placed",
      message: `Your order #${order.orderNumber} has been placed successfully.`,
      relatedOrder: order._id,
    });

    return sendResponse(
      res,
      201,
      { order },
      "Order placed successfully (Cash on Delivery)",
    );
  }

  // Razorpay flow: create a Razorpay order for the grand total
  const razorpayOrder = await razorpayInstance.orders.create({
    amount: Math.round(grandTotal * 100), // in paise
    currency: "INR",
    receipt: order.orderNumber,
  });

  order.paymentInfo = { razorpayOrderId: razorpayOrder.id };
  await order.save();

  sendResponse(
    res,
    201,
    {
      order,
      razorpayOrder,
      razorpayKeyId: process.env.RAZORPAY_KEY_ID,
    },
    "Order created. Proceed to payment.",
  );
});

// @desc    Get logged-in user's orders
// @route   GET /api/v1/orders/my-orders
// @access  Private
const getMyOrders = asyncHandler(async (req, res) => {
  const orders = await Order.find({ user: req.user._id })
    .populate("items.product", "title images price salePrice")
    .sort("-createdAt");

  sendResponse(
    res,
    200,
    { orders, count: orders.length },
    "Orders fetched successfully",
  );
});

// @desc    Get single order by id (owner or admin)
// @route   GET /api/v1/orders/:id
// @access  Private
const getOrderById = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id)
    .populate("user", "name email mobile")
    .populate("items.product", "title images price salePrice")
    .populate("items.variant", "attributes sku");

  if (!order) {
    throw new ApiError(404, "Order not found");
  }

  const isOwner = order.user._id.toString() === req.user._id.toString();
  const isAdmin = req.user.role === "admin";

  if (!isOwner && !isAdmin) {
    throw new ApiError(403, "You are not authorized to view this order");
  }

  // Customers never see internal admin notes
  const payload = order.toObject();
  if (!isAdmin) delete payload.adminNotes;

  sendResponse(res, 200, { order: payload }, "Order fetched successfully");
});

// @desc    Cancel an order (user or admin)
// @route   PATCH /api/v1/orders/:id/cancel
// @access  Private
const cancelOrder = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) throw new ApiError(404, "Order not found");

  if (
    order.user.toString() !== req.user._id.toString() &&
    req.user.role !== "admin"
  ) {
    throw new ApiError(403, "You are not authorized to cancel this order");
  }

  if (!canTransition(order.orderStatus, "Cancelled")) {
    throw new ApiError(
      400,
      `Order cannot be cancelled from its current status (${order.orderStatus})`,
    );
  }

  const reason = req.body.reason || "Cancelled by user";
  pushStatusHistory(order, "Cancelled", reason, req.user._id);
  order.cancelledAt = new Date();
  order.cancelReason = reason;

  // If a Shiprocket shipment already exists, cancel it too so the courier
  // doesn't attempt pickup/delivery on a cancelled order.
  if (shiprocket.isShiprocketEnabled() && order.shiprocket?.awbCode) {
    try {
      await shiprocket.cancelShipment(order.shiprocket.awbCode);
    } catch (e) {
      logger.error(
        `Failed to cancel Shiprocket shipment on order cancel: ${e.message}`,
      );
    }
  }

  if (order.paymentStatus === "Paid" || order.paymentMethod === "cod") {
    await restoreStock(order.items, {
      orderId: order._id,
      performedBy: req.user._id,
    });
  }

  await order.save();

  try {
    const owner = await User.findById(order.user).select("name email");
    if (owner) {
      await sendEmail({
        to: owner.email,
        subject: `Order Cancelled - ${order.orderNumber}`,
        html: templates.orderCancelled(owner.name, order, reason),
      });
    }
  } catch (e) {
    /* non-fatal */
  }

  await notifyOrderStatusChange(order, "Cancelled");

  sendResponse(res, 200, { order }, "Order cancelled successfully");
});

// @desc    Request a return for a delivered order (owner only)
// @route   POST /api/v1/orders/:id/return-request
// @access  Private
const createReturnRequest = asyncHandler(async (req, res) => {
  const { items, reason, comment } = req.body;
  if (!reason) throw new ApiError(400, "A reason for the return is required");

  const order = await Order.findById(req.params.id);
  if (!order) throw new ApiError(404, "Order not found");

  if (order.user.toString() !== req.user._id.toString()) {
    throw new ApiError(403, "You are not authorized to request a return for this order");
  }

  if (!canTransition(order.orderStatus, "Returned")) {
    throw new ApiError(
      400,
      `Orders can only be returned once Delivered (currently ${order.orderStatus})`,
    );
  }

  if (order.returnRequest && order.returnRequest.status !== "Rejected") {
    throw new ApiError(400, "A return request already exists for this order");
  }

  order.returnRequest = {
    items: Array.isArray(items) ? items : [],
    reason,
    comment,
    status: "Requested",
  };
  await order.save();

  sendResponse(res, 201, { order }, "Return request submitted successfully");
});

// ==================== ADMIN ====================

// @desc    Approve or reject a customer's return request. On approval,
//          creates a Shiprocket reverse-pickup shipment (best-effort).
// @route   PATCH /api/v1/orders/:id/return-request
// @access  Private/Admin
const reviewReturnRequest = asyncHandler(async (req, res) => {
  const { status, adminComment } = req.body;
  if (!["Approved", "Rejected"].includes(status)) {
    throw new ApiError(400, 'status must be "Approved" or "Rejected"');
  }

  const order = await Order.findById(req.params.id).populate("user", "name email");
  if (!order) throw new ApiError(404, "Order not found");
  if (!order.returnRequest) throw new ApiError(404, "No return request exists for this order");
  if (order.returnRequest.status !== "Requested") {
    throw new ApiError(400, `Return request has already been ${order.returnRequest.status.toLowerCase()}`);
  }

  order.returnRequest.status = status;
  order.returnRequest.adminComment = adminComment;
  order.returnRequest.reviewedBy = req.user._id;
  order.returnRequest.reviewedAt = new Date();

  if (status === "Approved") {
    pushStatusHistory(order, "Returned", "Return request approved", req.user._id);

    if (shiprocket.isShiprocketEnabled()) {
      try {
        const { shipmentId } = await shiprocket.createReturnShipment(order);
        order.returnRequest.shiprocket.shipmentId = shipmentId;
      } catch (e) {
        logger.error(`Failed to create Shiprocket return shipment for order ${order.orderNumber}: ${e.message}`);
      }
    }

    try {
      await sendEmail({
        to: order.user.email,
        subject: `Return Approved - ${order.orderNumber}`,
        html: templates.returnApproved(order.user.name, order),
      });
    } catch (e) {
      /* non-fatal */
    }
  }

  await order.save();

  notify({
    user: order.user._id,
    type: "return_request_reviewed",
    title: `Return request ${status.toLowerCase()}`,
    message: `Your return request for order #${order.orderNumber} has been ${status.toLowerCase()}.`,
    relatedOrder: order._id,
  });

  sendResponse(res, 200, { order }, `Return request ${status.toLowerCase()} successfully`);
});

// @desc    Take action on an open NDR (non-delivery report) for a shipment
// @route   POST /api/v1/orders/:id/ndr-action
// @access  Private/Admin
const ndrAction = asyncHandler(async (req, res) => {
  const { action, comment } = req.body;
  const order = await Order.findById(req.params.id);
  if (!order) throw new ApiError(404, "Order not found");

  if (!order.shiprocket?.awbCode) {
    throw new ApiError(400, "No Shiprocket shipment exists for this order");
  }
  if (order.tracking.shipmentStatus !== "Delivery Failed") {
    throw new ApiError(400, "NDR actions can only be taken on a failed delivery attempt");
  }

  await shiprocket.actionNDR(order.shiprocket.awbCode, action, comment);

  order.statusHistory.push({
    status: order.orderStatus,
    note: `NDR action "${action}" submitted to courier${comment ? ` — ${comment}` : ""}`,
    changedBy: req.user._id,
  });
  await order.save();

  sendResponse(res, 200, { order }, "NDR action submitted successfully");
});

// @desc    Get all orders (admin)
// @route   GET /api/v1/orders
// @access  Private/Admin
const getAllOrders = asyncHandler(async (req, res) => {
  const filter = {};

  if (req.query.status) filter.orderStatus = req.query.status;
  if (req.query.paymentStatus) filter.paymentStatus = req.query.paymentStatus;
  if (req.query.paymentMethod) filter.paymentMethod = req.query.paymentMethod;

  if (req.query.orderNumber) {
    filter.orderNumber = { $regex: req.query.orderNumber, $options: "i" };
  }

  if (req.query.from || req.query.to) {
    filter.createdAt = {};
    if (req.query.from) filter.createdAt.$gte = new Date(req.query.from);
    if (req.query.to) filter.createdAt.$lte = new Date(req.query.to);
  }

  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 20;

  const total = await Order.countDocuments(filter);

  const orders = await Order.find(filter)
    .populate("user", "name email mobile")
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();

  sendResponse(
    res,
    200,
    {
      orders,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    },
    "Orders fetched successfully",
  );
});

// @desc    Update order status (admin) — validates the transition,
//          supports manual courier/tracking info, admin/shipping notes,
//          and delivery attempt tracking.
// @route   PATCH /api/v1/orders/:id/status
// @access  Private/Admin
const updateOrderStatus = asyncHandler(async (req, res) => {
  const {
    orderStatus,
    note,
    adminNote,
    shippingNotes,
    trackingNumber,
    trackingUrl,
    estimatedDeliveryDate,
    courierPartner,
    courierName,
    deliveryFailed,
  } = req.body;

  const order = await Order.findById(req.params.id).populate(
    "user",
    "name email mobile",
  );
  if (!order) throw new ApiError(404, "Order not found");

  let statusActuallyChanged = false;

  if (orderStatus && orderStatus !== order.orderStatus) {
    assertTransition(order.orderStatus, orderStatus);
    pushStatusHistory(order, orderStatus, note, req.user._id);
    statusActuallyChanged = true;

    if (orderStatus === "Delivered") {
      order.deliveredAt = new Date();
      order.tracking.shipmentStatus = "Delivered";
      if (order.paymentMethod === "cod") order.paymentStatus = "Paid";
    }

    if (orderStatus === "Shipped") {
      order.tracking.shipmentStatus = "In Transit";
    }

    if (orderStatus === "Out For Delivery") {
      order.tracking.shipmentStatus = "Out For Delivery";
      order.tracking.deliveryAttempts += 1;
      order.tracking.lastAttemptAt = new Date();
      if (deliveryFailed)
        order.tracking.lastAttemptNote = note || "Delivery attempt failed";
    }

    if (["Cancelled", "Returned", "Refunded"].includes(orderStatus)) {
      await restoreStock(order.items, {
        orderId: order._id,
        performedBy: req.user._id,
      });
    }
  } else if (orderStatus === "Out For Delivery") {
    // Repeated "Out For Delivery" = another delivery attempt, no status change
    order.tracking.deliveryAttempts += 1;
    order.tracking.lastAttemptAt = new Date();
    order.tracking.lastAttemptNote = note || "Delivery attempt failed";
    order.statusHistory.push({
      status: orderStatus,
      note: note || `Delivery attempt #${order.tracking.deliveryAttempts}`,
      changedBy: req.user._id,
    });
    statusActuallyChanged = true; // re-notify: "will arrive today" per delivery attempt
  }

  if (trackingNumber) order.tracking.number = trackingNumber;
  if (trackingUrl) order.tracking.url = trackingUrl;
  if (estimatedDeliveryDate)
    order.tracking.estimatedDeliveryDate = new Date(estimatedDeliveryDate);
  if (courierPartner) order.courier.partner = courierPartner;
  if (courierName) order.courier.courierName = courierName;
  if (adminNote) order.adminNotes = adminNote;
  if (shippingNotes) order.shippingNotes = shippingNotes;

  await order.save();

  if (orderStatus === "Delivered") {
    try {
      await sendEmail({
        to: order.user.email,
        subject: `Order Delivered - ${order.orderNumber}`,
        html: templates.orderDelivered(order.user.name, order),
      });
    } catch (e) {
      /* non-fatal */
    }
  }

  if (orderStatus === "Shipped") {
    try {
      await sendEmail({
        to: order.user.email,
        subject: `Order Shipped - ${order.orderNumber}`,
        html: templates.shipmentDispatched(order.user.name, order),
      });
    } catch (e) {
      /* non-fatal */
    }
  }

  // Fires for every status transition (Confirmed through Refunded), not
  // just Delivered/Shipped — see notifyOrderStatusChange in order.service.js
  // for the single place that copy lives.
  if (statusActuallyChanged) {
    await notifyOrderStatusChange(order, orderStatus);
  }

  sendResponse(res, 200, { order }, "Order status updated successfully");
});

// @desc    Create a Shiprocket shipment for an order (or no-op if Shiprocket
//          is disabled, in which case use PATCH /:id/status to set courier
//          info manually instead).
// @route   POST /api/v1/orders/:id/shipment
// @access  Private/Admin
const createShipment = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) throw new ApiError(404, "Order not found");

  if (order.shiprocket?.shipmentId) {
    throw new ApiError(400, "A shipment already exists for this order");
  }

  if (!["Confirmed", "Processing", "Packed", "Ready To Ship"].includes(order.orderStatus)) {
    throw new ApiError(
      400,
      `Order must be Confirmed, Processing, Packed or Ready To Ship before creating a shipment (currently ${order.orderStatus})`,
    );
  }

  const { courierId } = req.body;

  const { shiprocketOrderId, shipmentId } =
    await shiprocket.createShipment(order);
  order.shiprocket.orderId = shiprocketOrderId;
  order.shiprocket.shipmentId = shipmentId;

  const { awbCode, courierCompanyId, courierName } = await shiprocket.assignAWB(
    shipmentId,
    courierId,
  );
  order.shiprocket.awbCode = awbCode;
  order.shiprocket.courierCompanyId = courierCompanyId;
  order.courier.partner = "Shiprocket";
  order.courier.courierId = courierCompanyId;
  order.courier.courierName = courierName;
  order.tracking.number = awbCode;
  order.tracking.url = `https://shiprocket.co/tracking/${awbCode}`;
  order.tracking.shipmentStatus = "AWB Assigned";

  // Best-effort: fetch a shipping label. Not fatal if it fails.
  try {
    order.shiprocket.labelUrl = await shiprocket.generateLabel(shipmentId);
  } catch (e) {
    logger.error(
      `Label generation failed for shipment ${shipmentId}: ${e.message}`,
    );
  }

  if (["Confirmed", "Processing"].includes(order.orderStatus)) {
    pushStatusHistory(
      order,
      "Packed",
      "Shipment created via Shiprocket",
      req.user._id,
    );
  }

  await order.save();

  sendResponse(
    res,
    201,
    { order },
    "Shipment created and courier assigned successfully",
  );
});

// @desc    Request a courier pickup for an already-created shipment
// @route   POST /api/v1/orders/:id/shipment/pickup
// @access  Private/Admin
const requestPickup = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) throw new ApiError(404, "Order not found");

  if (!order.shiprocket?.shipmentId) {
    throw new ApiError(400, "No Shiprocket shipment exists for this order yet");
  }

  const { pickupScheduledAt, pickupTokenNumber } =
    await shiprocket.requestPickup(order.shiprocket.shipmentId);
  order.shiprocket.pickupScheduledAt = pickupScheduledAt;
  order.shiprocket.pickupTokenNumber = pickupTokenNumber;
  order.tracking.shipmentStatus = "Pickup Scheduled";
  order.statusHistory.push({
    status: order.orderStatus,
    note: "Courier pickup scheduled",
    changedBy: req.user._id,
  });

  await order.save();
  sendResponse(res, 200, { order }, "Pickup requested successfully");
});

// @desc    Cancel an existing Shiprocket shipment (does not cancel the order itself)
// @route   POST /api/v1/orders/:id/shipment/cancel
// @access  Private/Admin
const cancelShipmentAdmin = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) throw new ApiError(404, "Order not found");

  if (!order.shiprocket?.awbCode) {
    throw new ApiError(400, "No active Shiprocket shipment to cancel");
  }

  await shiprocket.cancelShipment(order.shiprocket.awbCode);
  order.tracking.shipmentStatus = "Cancelled";
  order.statusHistory.push({
    status: order.orderStatus,
    note: "Shiprocket shipment cancelled",
    changedBy: req.user._id,
  });

  await order.save();
  sendResponse(res, 200, { order }, "Shipment cancelled successfully");
});

// @desc    Generate a Shiprocket manifest PDF for an order's shipment
// @route   POST /api/v1/orders/:id/shipment/manifest
// @access  Private/Admin
const generateManifest = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) throw new ApiError(404, "Order not found");

  if (!order.shiprocket?.shipmentId) {
    throw new ApiError(400, "No Shiprocket shipment exists for this order yet");
  }

  order.shiprocket.manifestUrl = await shiprocket.generateManifest(
    order.shiprocket.shipmentId,
  );
  await order.save();

  sendResponse(res, 200, { order }, "Manifest generated successfully");
});

// @desc    Generate/fetch the Shiprocket-hosted invoice PDF for an order
// @route   POST /api/v1/orders/:id/shipment/invoice
// @access  Private/Admin
const generateShiprocketInvoice = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) throw new ApiError(404, "Order not found");

  if (!order.shiprocket?.orderId) {
    throw new ApiError(400, "No Shiprocket order exists for this order yet");
  }

  order.shiprocket.invoiceUrl = await shiprocket.generateInvoice(
    order.shiprocket.orderId,
  );
  await order.save();

  sendResponse(res, 200, { order }, "Invoice generated successfully");
});

// @desc    Resend the order confirmation email to the customer
// @route   POST /api/v1/orders/:id/resend-email
// @access  Private/Admin
const resendOrderEmail = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id).populate(
    "user",
    "name email",
  );
  if (!order) throw new ApiError(404, "Order not found");
  if (!order.user?.email) throw new ApiError(400, "This order has no customer email on file");

  await sendEmail({
    to: order.user.email,
    subject: `Your Order - ${order.orderNumber}`,
    html: templates.orderConfirmation(order.user.name, order),
  });

  sendResponse(res, 200, {}, "Order email resent successfully");
});

// @desc    Track an order's shipment (owner or admin). Pulls live data from
//          Shiprocket when available, otherwise falls back to stored tracking info.
// @route   GET /api/v1/orders/:id/track
// @access  Private
const trackOrder = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) throw new ApiError(404, "Order not found");

  if (
    order.user.toString() !== req.user._id.toString() &&
    req.user.role !== "admin"
  ) {
    throw new ApiError(403, "You are not authorized to track this order");
  }

  let live = null;
  if (shiprocket.isShiprocketEnabled() && order.shiprocket?.awbCode) {
    try {
      live = await shiprocket.trackByAWB(order.shiprocket.awbCode);
    } catch (e) {
      logger.error(
        `Live tracking fetch failed for order ${order.orderNumber}: ${e.message}`,
      );
    }
  }

  sendResponse(
    res,
    200,
    {
      orderNumber: order.orderNumber,
      orderStatus: order.orderStatus,
      tracking: order.tracking,
      courier: order.courier,
      statusHistory: order.statusHistory,
      live,
    },
    "Tracking info fetched successfully",
  );
});

// @desc    Download a PDF invoice for an order (owner or admin)
// @route   GET /api/v1/orders/:id/invoice
// @access  Private
const downloadInvoice = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id).populate(
    "user",
    "name email",
  );
  if (!order) throw new ApiError(404, "Order not found");

  if (
    order.user._id.toString() !== req.user._id.toString() &&
    req.user.role !== "admin"
  ) {
    throw new ApiError(403, "You are not authorized to view this invoice");
  }

  streamInvoicePDF(order, res);
});

module.exports = {
  createOrder,
  getMyOrders,
  getOrderById,
  cancelOrder,
  getAllOrders,
  updateOrderStatus,
  createShipment,
  requestPickup,
  cancelShipmentAdmin,
  generateManifest,
  generateShiprocketInvoice,
  resendOrderEmail,
  createReturnRequest,
  reviewReturnRequest,
  ndrAction,
  trackOrder,
  downloadInvoice,
};
