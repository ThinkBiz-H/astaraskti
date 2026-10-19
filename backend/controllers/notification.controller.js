const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { sendResponse } = require('../utils/ApiResponse');
const Notification = require('../models/Notification');
const User = require('../models/User');

// @desc    Get logged-in user's notifications (paginated), newest first
// @route   GET /api/v1/notifications?page=&limit=&unreadOnly=true
// @access  Private
const getNotifications = asyncHandler(async (req, res) => {
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 20;
  const filter = { user: req.user._id };
  if (req.query.unreadOnly === 'true') filter.isRead = false;

  const [notifications, total, unreadCount] = await Promise.all([
    Notification.find(filter)
      .sort('-createdAt')
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Notification.countDocuments(filter),
    Notification.countDocuments({ user: req.user._id, isRead: false }),
  ]);

  sendResponse(
    res,
    200,
    {
      notifications,
      unreadCount,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    },
    'Notifications fetched successfully'
  );
});

// @desc    Mark a single notification as read
// @route   PATCH /api/v1/notifications/:id/read
// @access  Private
const markAsRead = asyncHandler(async (req, res) => {
  const notification = await Notification.findOneAndUpdate(
    { _id: req.params.id, user: req.user._id },
    { isRead: true, readAt: new Date() },
    { new: true }
  );
  if (!notification) throw new ApiError(404, 'Notification not found');
  sendResponse(res, 200, { notification }, 'Notification marked as read');
});

// @desc    Mark all of the user's notifications as read
// @route   PATCH /api/v1/notifications/read-all
// @access  Private
const markAllAsRead = asyncHandler(async (req, res) => {
  const result = await Notification.updateMany(
    { user: req.user._id, isRead: false },
    { isRead: true, readAt: new Date() }
  );
  sendResponse(res, 200, { modifiedCount: result.modifiedCount }, 'All notifications marked as read');
});

// @desc    Delete a single notification
// @route   DELETE /api/v1/notifications/:id
// @access  Private
const deleteNotification = asyncHandler(async (req, res) => {
  const notification = await Notification.findOneAndDelete({ _id: req.params.id, user: req.user._id });
  if (!notification) throw new ApiError(404, 'Notification not found');
  sendResponse(res, 200, {}, 'Notification deleted successfully');
});

// @desc    Clear all of the user's notifications
// @route   DELETE /api/v1/notifications
// @access  Private
const clearAllNotifications = asyncHandler(async (req, res) => {
  await Notification.deleteMany({ user: req.user._id });
  sendResponse(res, 200, {}, 'All notifications cleared');
});

// @desc    Register this device's push token for the logged-in user
// @route   POST /api/v1/notifications/push-token
// @access  Private
const registerPushToken = asyncHandler(async (req, res) => {
  const { token } = req.body;
  if (!token) throw new ApiError(400, 'token is required');

  await User.findByIdAndUpdate(req.user._id, { $addToSet: { pushTokens: token } });
  sendResponse(res, 200, {}, 'Push token registered');
});

// @desc    Unregister a device's push token (e.g. on logout)
// @route   DELETE /api/v1/notifications/push-token
// @access  Private
const unregisterPushToken = asyncHandler(async (req, res) => {
  const { token } = req.body;
  if (!token) throw new ApiError(400, 'token is required');

  await User.findByIdAndUpdate(req.user._id, { $pull: { pushTokens: token } });
  sendResponse(res, 200, {}, 'Push token unregistered');
});

module.exports = {
  getNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  clearAllNotifications,
  registerPushToken,
  unregisterPushToken,
};
