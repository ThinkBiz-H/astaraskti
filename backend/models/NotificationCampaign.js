const mongoose = require('mongoose');

/**
 * An admin-composed notification "campaign" — sent immediately or at a
 * scheduled time, to a resolved audience of users. Each recipient still
 * gets their own `Notification` document (+ optional email job) via the
 * normal `notify()`/`notifyMany()` path; this record is the campaign-level
 * definition + delivery summary/history, not a per-recipient log (that's
 * `Notification` for in-app, `NotificationJob` for email/sms/push).
 */
const notificationCampaignSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true },
    image: {
      url: { type: String, default: '' },
      publicId: { type: String, default: '' },
    },
    buttonText: { type: String, default: '' },
    buttonLink: { type: String, default: '' },
    type: {
      type: String,
      enum: ['information', 'offer', 'order_update', 'coupon', 'blog', 'product_launch', 'admin_broadcast'],
      default: 'information',
    },

    // Recipient targeting
    audience: {
      type: String,
      enum: ['all', 'selected', 'purchasers', 'abandoned_cart'],
      required: true,
    },
    audienceUserIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], // for audience: 'selected'
    audienceProduct: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', default: null }, // for audience: 'purchasers'

    scheduledFor: { type: Date, default: null }, // null = send immediately on create
    expiresAt: { type: Date, default: null },

    status: {
      type: String,
      enum: ['scheduled', 'sent', 'failed', 'cancelled'],
      default: 'scheduled',
    },
    sentAt: { type: Date, default: null },
    totalRecipients: { type: Number, default: 0 },
    sentCount: { type: Number, default: 0 },
    errorMessage: { type: String, default: null },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
);

notificationCampaignSchema.index({ status: 1, scheduledFor: 1 });

module.exports = mongoose.model('NotificationCampaign', notificationCampaignSchema);
