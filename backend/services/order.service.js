const ApiError = require("../utils/ApiError");
const Product = require("../models/Product");
const Variant = require("../models/Variant");
const inventoryService = require("./inventory.service");
const { notify } = require("./notification.service");
const logger = require("../utils/logger");

/**
 * Validates stock for each cart item and builds order items array.
 */
const buildOrderItems = async (cartItems) => {
  const orderItems = [];
  let subTotal = 0;

  for (const item of cartItems) {
    const product = await Product.findOne({
      _id: item.product,
      isDeleted: false,
    });

    if (!product) {
      throw new ApiError(404, `Product not found: ${item.product}`);
    }

    if (product.status !== "active") {
      throw new ApiError(
        400,
        `Product "${product.title}" is not available for purchase`,
      );
    }

    let variant = null;
    if (item.variant) {
      variant = await Variant.findOne({
        _id: item.variant,
        product: product._id,
        status: "active",
      });
      if (!variant) {
        throw new ApiError(
          400,
          `Selected variant is no longer available for "${product.title}"`,
        );
      }
      if (variant.stock < item.quantity) {
        throw new ApiError(
          400,
          `Insufficient stock for "${product.title}" (${variant.sku}). Available: ${variant.stock}`,
        );
      }
    } else if (product.hasVariants) {
      throw new ApiError(
        400,
        `"${product.title}" requires a variant to be selected`,
      );
    } else if (product.stock < item.quantity) {
      throw new ApiError(
        400,
        `Insufficient stock for "${product.title}". Available: ${product.stock}`,
      );
    }

    const price = variant
      ? variant.salePrice && variant.salePrice > 0
        ? variant.salePrice
        : variant.price
      : product.salePrice && product.salePrice > 0
        ? product.salePrice
        : product.price;

    orderItems.push({
      product: product._id,
      variant: variant ? variant._id : null,
      title: product.title,
      sku: variant ? variant.sku : product.SKU,
      unitValue: variant ? variant.unitValue : product.unitValue,
      thumbnail: product.thumbnail?.url || "",
      quantity: item.quantity,
      price,
      color: item.color,
      size: item.size,
    });

    subTotal += price * item.quantity;
  }

  return {
    orderItems,
    subTotal,
  };
};

/**
 * Calculate final order totals
 * Free Shipping
 * No Tax
 */
const calculateTotals = (subTotal, discountAmount = 0, shippingCharge = 0) => {
  const discountedSubTotal = Math.max(subTotal - discountAmount, 0);

  // GST sirf product par lagega, shipping par nahi
  const tax = Math.round(discountedSubTotal * 0.18);

  const grandTotal = discountedSubTotal + shippingCharge + tax;

  return {
    shippingCharge,
    tax,
    grandTotal,
  };
};

/**
 * Reduce stock after successful order.
 * Also bumps salesCount (used for "popularity" sort and the "best sellers"
 * recommendation rail) — this is the single choke point every successful
 * sale path (COD order creation, Razorpay verify, Razorpay webhook) already
 * runs through, so it stays accurate without touching each call site.
 */
const reduceStock = async (
  orderItems,
  { orderId = null, performedBy = null, session = null } = {},
) => {
  for (const item of orderItems) {
    await inventoryService.deductForOrder({
      productId: item.product,
      variantId: item.variant || null,
      quantity: item.quantity,
      orderId,
      performedBy,
      session,
    });
    await Product.findByIdAndUpdate(
      item.product,
      { $inc: { salesCount: item.quantity } },
      { session },
    );
  }
};

/**
 * Restore stock on cancel/refund. Mirrors reduceStock's salesCount bump so
 * "units actually sold" stays correct when an order is later cancelled.
 */
const restoreStock = async (
  orderItems,
  { orderId = null, performedBy = null, session = null } = {},
) => {
  for (const item of orderItems) {
    await inventoryService.restoreForOrderCancellation({
      productId: item.product,
      variantId: item.variant || null,
      quantity: item.quantity,
      orderId,
      performedBy,
      session,
    });
    await Product.findByIdAndUpdate(
      item.product,
      { $inc: { salesCount: -item.quantity } },
      { session },
    );
  }
};

/**
 * Appends a status history entry and updates the top-level orderStatus.
 * Does not save() the order — caller is responsible for persisting.
 */
const pushStatusHistory = (order, status, note, changedBy = null) => {
  order.orderStatus = status;
  order.statusHistory.push({ status, note, changedBy, changedAt: new Date() });
};

/**
 * Single source of truth for "what does the customer see when order status
 * X happens" — every place that changes an order's status (admin manual
 * update, Shiprocket webhook, cancellation) calls this instead of writing
 * its own notify() with its own copy, so the wording only ever lives here.
 * Uses only Notification.type enum values that already exist (see
 * models/Notification.js) — order_update is the deliberate generic
 * fallback for the in-between statuses that don't have a dedicated type,
 * so this never needs a schema change as new statuses are covered.
 */
const ORDER_STATUS_NOTIFICATIONS = {
  Confirmed: { type: "order_confirmed", title: "✅ Order Confirmed", message: (o) => `Your order #${o.orderNumber} has been confirmed.` },
  Processing: { type: "order_update", title: "⚙️ Order Processing", message: (o) => `Your order #${o.orderNumber} is now being processed.` },
  Packed: { type: "order_update", title: "📦 Packed", message: (o) => `Your order #${o.orderNumber} has been packed.` },
  "Ready To Ship": { type: "order_update", title: "📦 Ready to Ship", message: (o) => `Your order #${o.orderNumber} is ready to ship.` },
  Shipped: { type: "order_shipped", title: "🚚 Shipped", message: (o) => `Your order #${o.orderNumber} is on the way.` },
  "Out For Delivery": { type: "order_update", title: "📍 Out for Delivery", message: (o) => `Your order #${o.orderNumber} will arrive today.` },
  Delivered: { type: "order_delivered", title: "🎉 Delivered", message: (o) => `Your order #${o.orderNumber} has been delivered.` },
  Cancelled: { type: "order_cancelled", title: "❌ Cancelled", message: (o) => `Your order #${o.orderNumber} has been cancelled.` },
  Returned: { type: "order_update", title: "↩️ Returned", message: (o) => `Your order #${o.orderNumber} has been returned.` },
  Refunded: { type: "refund_processed", title: "💰 Refund Completed", message: (o) => `Refund for order #${o.orderNumber} has been credited.` },
};

/**
 * Fires the in-app/email/SMS notification (via the existing notify()) for
 * an order status change — non-fatal, never blocks the status update
 * itself if it fails (notify() already swallows its own DB-write errors,
 * this just adds a belt-and-braces catch around the whole call).
 */
const notifyOrderStatusChange = async (order, status) => {
  const copy = ORDER_STATUS_NOTIFICATIONS[status];
  if (!copy) return; // Pending and any future/unmapped status: no notification, nothing to send yet
  try {
    await notify({
      user: order.user._id || order.user,
      type: copy.type,
      title: copy.title,
      message: copy.message(order),
      link: `/account/orders/${order._id}`,
      relatedOrder: order._id,
    });
  } catch (err) {
    logger.error(`Non-fatal: order status notification failed for order ${order._id}: ${err.message}`);
  }
};

module.exports = {
  buildOrderItems,
  calculateTotals,
  reduceStock,
  restoreStock,
  pushStatusHistory,
  notifyOrderStatusChange,
};
