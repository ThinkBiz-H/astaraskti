const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: [
        'order_confirmed',
        'payment_success',
        'payment_failed',
        'order_shipped',
        'order_delivered',
        'order_cancelled',
        'return_approved',
        'refund_processed',
        'wishlist_price_drop',
        'coupon',
        'low_stock',
        'blog_published',
        'admin_broadcast',
        'offer',
        'order_update',
        'product_launch',
        'information',
        'otp',
        'system',
        // Consultation module — these were already being passed to notify()
        // by existing code (consultationBooking.controller.js,
        // consultationPayment.controller.js) but weren't in this enum, so
        // every one of those Notification.create() calls was silently
        // failing (caught + logged inside notify(), never surfaced).
        'consultation_booking_created',
        'consultation_confirmed',
        'consultation_update', // generic fallback for statuses with no dedicated copy (mirrors order_update)
        'consultation_completed',
        'consultation_cancelled',
        'consultation_refunded',
        'consultation_assigned',
        'consultation_reminder',
        'consultation_report_uploaded',
        'consultation_payment_received',
        // Premium Kundli purchase module — generic fallback covering every
        // event (payment success/processing/generated/failed), same
        // "one type, distinct copy per call site" approach as consultations.
        'premium_kundli_update',
      ],
      default: 'system',
    },
    title: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true },
    image: { type: String, default: null },
    buttonText: { type: String, default: null },
    // Optional deep-link data so the frontend can navigate straight to the
    // relevant order/product (or wherever an admin broadcast points) without
    // an extra lookup. Doubles as the button's target URL when buttonText is set.
    link: { type: String, default: null },
    relatedOrder: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', default: null },
    relatedProduct: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', default: null },
    relatedConsultationBooking: { type: mongoose.Schema.Types.ObjectId, ref: 'ConsultationBooking', default: null },
    relatedPremiumKundliOrder: { type: mongoose.Schema.Types.ObjectId, ref: 'PremiumKundliOrder', default: null },
    expiresAt: { type: Date, default: null },
    isRead: { type: Boolean, default: false },
    readAt: { type: Date, default: null },
  },
  { timestamps: true }
);

notificationSchema.index({ user: 1, createdAt: -1 });
notificationSchema.index({ user: 1, isRead: 1 });

module.exports = mongoose.model('Notification', notificationSchema);
