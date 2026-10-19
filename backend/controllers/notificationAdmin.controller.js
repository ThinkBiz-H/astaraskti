const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { sendResponse } = require('../utils/ApiResponse');
const NotificationTemplate = require('../models/NotificationTemplate');
const { notifyMany } = require('../services/notification.service');

// ---------- Template Manager ----------

// @desc    List notification templates
// @route   GET /api/v1/admin/notification-templates
// @access  Private/Admin
const getTemplates = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.type) filter.type = req.query.type;
  if (req.query.channel) filter.channel = req.query.channel;

  const templates = await NotificationTemplate.find(filter).sort({ type: 1, channel: 1 });
  sendResponse(res, 200, { templates, count: templates.length }, 'Templates fetched successfully');
});

// @desc    Create (or overwrite via upsert semantics) a template for a (type, channel) pair
// @route   POST /api/v1/admin/notification-templates
// @access  Private/Admin
const createTemplate = asyncHandler(async (req, res) => {
  const { type, channel, subject, body, isActive } = req.body;

  const existing = await NotificationTemplate.findOne({ type, channel });
  if (existing) throw new ApiError(409, `A template for type "${type}" + channel "${channel}" already exists — use PUT to update it.`);

  const template = await NotificationTemplate.create({ type, channel, subject, body, isActive });
  sendResponse(res, 201, { template }, 'Template created successfully');
});

// @desc    Update a template
// @route   PUT /api/v1/admin/notification-templates/:id
// @access  Private/Admin
const updateTemplate = asyncHandler(async (req, res) => {
  const template = await NotificationTemplate.findById(req.params.id);
  if (!template) throw new ApiError(404, 'Template not found');

  ['subject', 'body', 'isActive'].forEach((field) => {
    if (req.body[field] !== undefined) template[field] = req.body[field];
  });

  await template.save();
  sendResponse(res, 200, { template }, 'Template updated successfully');
});

// @desc    Delete a template (falls back to the built-in default, if any, for that type)
// @route   DELETE /api/v1/admin/notification-templates/:id
// @access  Private/Admin
const deleteTemplate = asyncHandler(async (req, res) => {
  const template = await NotificationTemplate.findById(req.params.id);
  if (!template) throw new ApiError(404, 'Template not found');
  await template.deleteOne();
  sendResponse(res, 200, {}, 'Template deleted successfully');
});

// ---------- Broadcast ----------

// @desc    Send a notification to every user, or every admin — { audience: "all"|"admins", title, message }
// @route   POST /api/v1/admin/notifications/broadcast
// @access  Private/Admin
const broadcastNotification = asyncHandler(async (req, res) => {
  const { audience = 'all', title, message } = req.body;
  if (!title || !message) throw new ApiError(400, 'title and message are required');

  const filter = audience === 'admins' ? { role: 'admin' } : {};
  const result = await notifyMany({ filter, type: 'admin_broadcast', title, message });

  sendResponse(res, 200, result, `Broadcast sent to ${result.sent}/${result.total} user(s)`);
});

module.exports = { getTemplates, createTemplate, updateTemplate, deleteTemplate, broadcastNotification };
