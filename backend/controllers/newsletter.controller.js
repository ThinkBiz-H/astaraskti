const crypto = require('crypto');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { sendResponse } = require('../utils/ApiResponse');
const NewsletterSubscriber = require('../models/NewsletterSubscriber');
const { sendEmail, templates } = require('../utils/sendEmail');
const logger = require('../utils/logger');

// @desc    Subscribe to newsletter
// @route   POST /api/v1/newsletter/subscribe
// @access  Public
const subscribe = asyncHandler(async (req, res) => {
  const { email, name } = req.body;

  // Check if already subscribed
  let subscriber = await NewsletterSubscriber.findOne({ email });

  if (subscriber) {
    if (subscriber.isActive) {
      return sendResponse(
        res,
        200,
        {},
        'You are already subscribed to our newsletter'
      );
    }
    // Reactivate if previously unsubscribed
    subscriber.isActive = true;
    subscriber.unsubscribedAt = null;
    subscriber.unsubscribeToken = null;
    if (name) subscriber.name = name;
    await subscriber.save();
  } else {
    subscriber = await NewsletterSubscriber.create({
      email,
      name: name || '',
      subscriptionSource: 'website',
    });
  }

  // Send confirmation email
  try {
    const unsubscribeToken = crypto
      .randomBytes(32)
      .toString('hex');
    subscriber.unsubscribeToken = unsubscribeToken;
    await subscriber.save({ validateBeforeSave: false });

    const unsubscribeUrl = `${process.env.CLIENT_URL}/newsletter/unsubscribe/${unsubscribeToken}`;

    await sendEmail({
      to: email,
      subject: 'Welcome to our Newsletter!',
      html: templates.newsletterSubscription(name || email, unsubscribeUrl),
    });
  } catch (err) {
    logger.error(`Failed to send newsletter subscription email to ${email}: ${err.message}`);
  }

  sendResponse(
    res,
    201,
    { subscriber },
    'Successfully subscribed to our newsletter'
  );
});

// @desc    Unsubscribe from newsletter
// @route   POST /api/v1/newsletter/unsubscribe/:token
// @access  Public
const unsubscribe = asyncHandler(async (req, res) => {
  const { token } = req.params;

  const subscriber = await NewsletterSubscriber.findOne({
    unsubscribeToken: token,
    isActive: true,
  });

  if (!subscriber) {
    throw new ApiError(404, 'Invalid unsubscribe token or already unsubscribed');
  }

  subscriber.isActive = false;
  subscriber.unsubscribedAt = new Date();
  subscriber.unsubscribeToken = null;
  await subscriber.save({ validateBeforeSave: false });

  sendResponse(
    res,
    200,
    {},
    'You have been unsubscribed from our newsletter'
  );
});

// @desc    Get all newsletter subscribers (admin only)
// @route   GET /api/v1/admin/newsletter-subscribers
// @access  Private/Admin
const getAllSubscribers = asyncHandler(async (req, res) => {
  const { isActive = true, page = 1, limit = 50 } = req.query;

  const filter = {};
  if (isActive !== undefined) {
    filter.isActive = isActive === 'true' || isActive === true;
  }

  const skip = (page - 1) * limit;
  const subscribers = await NewsletterSubscriber.find(filter)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit))
    .select('-unsubscribeToken');

  const total = await NewsletterSubscriber.countDocuments(filter);

  sendResponse(
    res,
    200,
    {
      subscribers,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit),
      },
    },
    'Subscribers fetched successfully'
  );
});

// @desc    Export subscribers list
// @route   GET /api/v1/admin/newsletter-subscribers/export
// @access  Private/Admin
const exportSubscribers = asyncHandler(async (req, res) => {
  const { isActive = true } = req.query;

  const filter = {};
  if (isActive !== undefined) {
    filter.isActive = isActive === 'true' || isActive === true;
  }

  const subscribers = await NewsletterSubscriber.find(filter)
    .select('email name createdAt')
    .lean();

  // Return as CSV
  const csv = [
    'Email,Name,Subscribed Date',
    ...subscribers.map(s => `"${s.email}","${s.name || ''}","${s.createdAt.toISOString()}"`),
  ].join('\n');

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader(
    'Content-Disposition',
    'attachment; filename=newsletter-subscribers.csv'
  );
  res.send(csv);
});

// @desc    Delete subscriber
// @route   DELETE /api/v1/admin/newsletter-subscribers/:id
// @access  Private/Admin
const deleteSubscriber = asyncHandler(async (req, res) => {
  const subscriber = await NewsletterSubscriber.findByIdAndDelete(
    req.params.id
  );

  if (!subscriber) {
    throw new ApiError(404, 'Subscriber not found');
  }

  sendResponse(res, 200, {}, 'Subscriber deleted successfully');
});

// @desc    Get newsletter statistics (admin only)
// @route   GET /api/v1/admin/newsletter/stats
// @access  Private/Admin
const getStats = asyncHandler(async (req, res) => {
  const totalSubscribers = await NewsletterSubscriber.countDocuments();
  const activeSubscribers = await NewsletterSubscriber.countDocuments({
    isActive: true,
  });
  const unsubscribed = await NewsletterSubscriber.countDocuments({
    isActive: false,
  });

  sendResponse(
    res,
    200,
    {
      totalSubscribers,
      activeSubscribers,
      unsubscribed,
      unsubscribeRate: (
        ((unsubscribed / totalSubscribers) * 100) ||
        0
      ).toFixed(2),
    },
    'Newsletter statistics fetched successfully'
  );
});

module.exports = {
  subscribe,
  unsubscribe,
  getAllSubscribers,
  exportSubscribers,
  deleteSubscriber,
  getStats,
};
