const { notify, notifyMany } = require("./notification.service");
const logger = require("../utils/logger");

/**
 * Single source of truth for Premium Kundli customer-facing notification
 * copy — mirrors order.service.js's notifyOrderStatusChange /
 * consultationBooking.service.js's notifyBookingStatusChange exactly.
 */
const EVENT_COPY = {
  payment_success: { title: "✅ Payment Successful", message: (o) => `Payment received for your Premium Kundli order #${o.orderNumber}. We're preparing your report.` },
  processing: { title: "⚙️ Kundli Processing", message: (o) => `Your Premium Kundli order #${o.orderNumber} is being generated.` },
  generated: { title: "🎉 Kundli Ready", message: (o) => `Your Premium Kundli report for order #${o.orderNumber} is ready to download.` },
  failed: { title: "❌ Generation Failed", message: (o) => `We couldn't generate your Premium Kundli report for order #${o.orderNumber}. Our team has been notified.` },
};

const notifyOrderEvent = async (order, event) => {
  const copy = EVENT_COPY[event];
  if (!copy) return;
  // True guest order (no linked account) — there's no in-app notification
  // inbox to deliver to (Notification.user is required). Email is the
  // real customer-facing channel for guests, sent separately where it
  // matters (see updateStatus in premiumKundli.controller.js).
  if (!order.user) return;
  try {
    await notify({
      user: order.user,
      type: "premium_kundli_update",
      title: copy.title,
      message: copy.message(order),
      link: `/account/premium-kundli`,
      relatedPremiumKundliOrder: order._id,
    });
  } catch (err) {
    logger.error(`Non-fatal: premium kundli notification failed for order ${order._id}: ${err.message}`);
  }
};

/** "Admin: New Premium Order" — fans out to every admin via the existing notifyMany(). */
const notifyAdminsNewOrder = async (order) => {
  try {
    await notifyMany({
      filter: { role: "admin" },
      type: "premium_kundli_update",
      title: "🛒 New Premium Kundli Order",
      message: `New Premium Kundli order #${order.orderNumber} — payment received, ₹${order.amount}.`,
      link: `/premium-kundli/orders/${order._id}`,
    });
  } catch (err) {
    logger.error(`Non-fatal: admin new-order notification failed for order ${order._id}: ${err.message}`);
  }
};

module.exports = { notifyOrderEvent, notifyAdminsNewOrder };
