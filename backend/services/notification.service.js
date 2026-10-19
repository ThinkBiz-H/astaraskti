const Notification = require('../models/Notification');
const User = require('../models/User');
const Order = require('../models/Order');
const logger = require('../utils/logger');
const { renderTemplate } = require('./notificationTemplate.service');
const { enqueue } = require('./notificationQueue.service');

/**
 * Creates an in-app notification for a user — always, exactly as before
 * this phase, for every existing caller (order/payment/webhook/inventory
 * controllers). Additively, if an active template exists for
 * (type, 'email') or (type, 'sms') or (type, 'push'), this ALSO enqueues
 * delivery on that channel. No template configured for a channel = that
 * channel is silently skipped (not an error) — most types only ever go
 * out on some channels.
 */
const notify = async ({
  user, type = 'system', title, message, link = null, image = null, buttonText = null,
  expiresAt = null, relatedOrder = null, relatedProduct = null,
  // Added for the Consultation and Premium Kundli modules — previously
  // callers already passed relatedConsultationBooking but this function
  // silently dropped it (not destructured/forwarded), so it was never
  // actually saved despite the schema field existing.
  relatedConsultationBooking = null, relatedPremiumKundliOrder = null,
  variables = null,
}) => {
  let inApp = null;
  try {
    inApp = await Notification.create({
      user, type, title, message, link, image, buttonText, expiresAt,
      relatedOrder, relatedProduct, relatedConsultationBooking, relatedPremiumKundliOrder,
    });
  } catch (error) {
    logger.error(`Failed to create notification for user ${user}: ${error.message}`);
  }

  try {
    const recipient = await User.findById(user).select('email mobile pushTokens name');
    if (!recipient) return inApp;

    const vars = { name: recipient.name, title, message, ...(variables || {}) };

    const [emailTemplate, smsTemplate, pushTemplate] = await Promise.all([
      renderTemplate(type, 'email', vars),
      renderTemplate(type, 'sms', vars),
      renderTemplate(type, 'push', vars),
    ]);

    if (emailTemplate && recipient.email) {
      await enqueue({ channel: 'email', recipientUser: recipient._id, to: recipient.email, subject: emailTemplate.subject, body: emailTemplate.body });
    }
    if (smsTemplate && recipient.mobile) {
      await enqueue({ channel: 'sms', recipientUser: recipient._id, to: recipient.mobile, body: smsTemplate.body });
    }
    if (pushTemplate && recipient.pushTokens?.length) {
      await Promise.all(recipient.pushTokens.map((token) => enqueue({ channel: 'push', recipientUser: recipient._id, to: token, subject: pushTemplate.subject, body: pushTemplate.body })));
    }
  } catch (error) {
    // Multi-channel fan-out is a bonus on top of the in-app notification,
    // which already succeeded above — never let this fail the caller.
    logger.error(`Multi-channel dispatch failed for notification type "${type}" (user ${user}): ${error.message}`);
  }

  return inApp;
};

/** Sends the same notification to every user matching `filter` (default: everyone). Used by admin broadcast. */
const notifyMany = async ({ filter = {}, type = 'system', title, message, link = null, image = null, buttonText = null, expiresAt = null }) => {
  const users = await User.find(filter).select('_id');
  const results = await Promise.allSettled(
    users.map((u) => notify({ user: u._id, type, title, message, link, image, buttonText, expiresAt })),
  );
  return { total: users.length, sent: results.filter((r) => r.status === 'fulfilled').length };
};

/**
 * Resolves a campaign's audience definition into a Mongo filter for
 * User.find(). Only 'all', 'selected', 'purchasers', and 'abandoned_cart'
 * are implemented — there is no "customer groups/segments" concept
 * anywhere else in this codebase, so that audience type is deliberately
 * not offered rather than faked.
 */
const resolveAudienceFilter = async ({ audience, audienceUserIds, audienceProduct }) => {
  switch (audience) {
    case 'selected':
      return { _id: { $in: audienceUserIds || [] } };
    case 'purchasers': {
      if (!audienceProduct) return { _id: null }; // matches nothing
      const userIds = await Order.distinct('user', { 'items.product': audienceProduct });
      return { _id: { $in: userIds } };
    }
    case 'abandoned_cart':
      return { 'cart.0': { $exists: true } };
    case 'all':
    default:
      return {};
  }
};

module.exports = { notify, notifyMany, resolveAudienceFilter };
