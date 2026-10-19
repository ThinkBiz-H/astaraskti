const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { sendResponse } = require('../utils/ApiResponse');
const NotificationCampaign = require('../models/NotificationCampaign');
const NotificationJob = require('../models/NotificationJob');
const { notifyMany, resolveAudienceFilter } = require('../services/notification.service');
const { uploadToCloudinary } = require('../services/cloudinary.service');
const logger = require('../utils/logger');

/**
 * Resolves the audience and actually dispatches a campaign. Used both by
 * `createCampaign` (immediate send) and the scheduler (due scheduled sends).
 */
const fireCampaign = async (campaign) => {
  try {
    const filter = await resolveAudienceFilter({
      audience: campaign.audience,
      audienceUserIds: campaign.audienceUserIds,
      audienceProduct: campaign.audienceProduct,
    });

    const result = await notifyMany({
      filter,
      type: campaign.type,
      title: campaign.title,
      message: campaign.message,
      link: campaign.buttonLink || null,
      image: campaign.image?.url || null,
      buttonText: campaign.buttonText || null,
      expiresAt: campaign.expiresAt,
    });

    campaign.status = 'sent';
    campaign.sentAt = new Date();
    campaign.totalRecipients = result.total;
    campaign.sentCount = result.sent;
  } catch (error) {
    campaign.status = 'failed';
    campaign.errorMessage = error.message;
    logger.error(`Notification campaign ${campaign._id} failed to send: ${error.message}`);
  }

  await campaign.save();
  return campaign;
};

// @desc    Create a notification campaign — sends immediately, or schedules
//          it for later if scheduledFor is in the future.
// @route   POST /api/v1/admin/notification-campaigns
// @access  Private/Admin
const createCampaign = asyncHandler(async (req, res) => {
  const {
    title, message, buttonText, buttonLink, type, audience,
    audienceUserIds, audienceProduct, scheduledFor, expiresAt,
  } = req.body;

  if (!title || !message) throw new ApiError(400, 'title and message are required');
  if (!audience) throw new ApiError(400, 'audience is required');
  if (audience === 'selected' && (!audienceUserIds || JSON.parse(audienceUserIds || '[]').length === 0)) {
    throw new ApiError(400, 'audienceUserIds is required when audience is "selected"');
  }
  if (audience === 'purchasers' && !audienceProduct) {
    throw new ApiError(400, 'audienceProduct is required when audience is "purchasers"');
  }

  let image;
  if (req.file) {
    const result = await uploadToCloudinary(req.file.buffer, 'ecommerce/notifications');
    image = { url: result.url, publicId: result.publicId };
  }

  const isScheduled = scheduledFor && new Date(scheduledFor) > new Date();

  const campaign = await NotificationCampaign.create({
    title, message, buttonText, buttonLink, type: type || 'information',
    audience,
    audienceUserIds: audience === 'selected' ? JSON.parse(audienceUserIds) : [],
    audienceProduct: audience === 'purchasers' ? audienceProduct : null,
    scheduledFor: isScheduled ? scheduledFor : null,
    expiresAt: expiresAt || null,
    status: 'scheduled', // fireCampaign() below flips this to 'sent'/'failed' immediately when not actually scheduled for later
    image,
    createdBy: req.user._id,
  });

  if (!isScheduled) {
    await fireCampaign(campaign);
  }

  sendResponse(
    res,
    201,
    { campaign },
    isScheduled ? 'Notification scheduled successfully' : `Notification sent to ${campaign.sentCount}/${campaign.totalRecipients} user(s)`,
  );
});

// @desc    List notification campaigns (history)
// @route   GET /api/v1/admin/notification-campaigns
// @access  Private/Admin
const getCampaigns = asyncHandler(async (req, res) => {
  const campaigns = await NotificationCampaign.find()
    .populate('audienceProduct', 'title')
    .populate('createdBy', 'name')
    .sort('-createdAt')
    .limit(100);

  sendResponse(res, 200, { campaigns, count: campaigns.length }, 'Campaigns fetched successfully');
});

// @desc    Cancel a not-yet-sent scheduled campaign
// @route   DELETE /api/v1/admin/notification-campaigns/:id
// @access  Private/Admin
const cancelCampaign = asyncHandler(async (req, res) => {
  const campaign = await NotificationCampaign.findById(req.params.id);
  if (!campaign) throw new ApiError(404, 'Campaign not found');
  if (campaign.status !== 'scheduled') {
    throw new ApiError(400, `Campaign has already been ${campaign.status} and cannot be cancelled`);
  }

  campaign.status = 'cancelled';
  await campaign.save();
  sendResponse(res, 200, { campaign }, 'Campaign cancelled successfully');
});

// ---------- Delivery logs (email/sms/push jobs) ----------

// @desc    List notification delivery jobs (email/sms/push queue), optionally filtered by status
// @route   GET /api/v1/admin/notification-jobs?status=failed
// @access  Private/Admin
const getNotificationJobs = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  if (req.query.channel) filter.channel = req.query.channel;

  const jobs = await NotificationJob.find(filter).sort('-createdAt').limit(200);
  sendResponse(res, 200, { jobs, count: jobs.length }, 'Notification jobs fetched successfully');
});

// @desc    Retry a failed delivery job
// @route   POST /api/v1/admin/notification-jobs/:id/retry
// @access  Private/Admin
const retryNotificationJob = asyncHandler(async (req, res) => {
  const job = await NotificationJob.findById(req.params.id);
  if (!job) throw new ApiError(404, 'Notification job not found');
  if (job.status !== 'failed') throw new ApiError(400, 'Only failed jobs can be retried');

  job.status = 'pending';
  job.nextAttemptAt = new Date();
  job.attempts = 0;
  job.lastError = null;
  await job.save();

  sendResponse(res, 200, { job }, 'Job queued for retry');
});

module.exports = {
  fireCampaign,
  createCampaign,
  getCampaigns,
  cancelCampaign,
  getNotificationJobs,
  retryNotificationJob,
};
