const mongoose = require('mongoose');

/**
 * One template per (type, channel) pair — e.g. ('order_confirmed','email')
 * and ('order_confirmed','sms') are two separate templates, since email
 * and SMS need very different content for the same event. `body` supports
 * {{variableName}} placeholders, filled in by
 * services/notificationTemplate.service.js's render().
 */
const notificationTemplateSchema = new mongoose.Schema(
  {
    type: { type: String, required: true }, // matches Notification.type's enum values, plus 'otp', 'blog_published', 'admin_broadcast', etc.
    channel: { type: String, enum: ['in_app', 'email', 'sms', 'push'], required: true },
    subject: { type: String, default: '' }, // used for email; ignored for sms/push/in_app
    body: { type: String, required: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

notificationTemplateSchema.index({ type: 1, channel: 1 }, { unique: true });

module.exports = mongoose.model('NotificationTemplate', notificationTemplateSchema);
