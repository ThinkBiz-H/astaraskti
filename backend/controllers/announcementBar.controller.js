const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { sendResponse } = require('../utils/ApiResponse');
const AnnouncementBar = require('../models/AnnouncementBar');

// @desc    List currently-live announcements (active + within date window),
//          unless an admin explicitly asks for everything via ?all=true
// @route   GET /api/v1/announcements
// @access  Public
const getAnnouncements = asyncHandler(async (req, res) => {
  const isAdminRequest = req.user?.role === 'admin' && req.query.all === 'true';

  let filter = {};
  if (!isAdminRequest) {
    const now = new Date();
    filter = {
      isActive: true,
      $and: [
        { $or: [{ startDate: null }, { startDate: { $lte: now } }] },
        { $or: [{ endDate: null }, { endDate: { $gte: now } }] },
      ],
    };
  }

  const announcements = await AnnouncementBar.find(filter).sort('sortOrder');
  sendResponse(res, 200, { announcements, count: announcements.length }, 'Announcements fetched successfully');
});

// @desc    Create an announcement
// @route   POST /api/v1/announcements
// @access  Private/Admin
const createAnnouncement = asyncHandler(async (req, res) => {
  const announcement = await AnnouncementBar.create(req.body);
  sendResponse(res, 201, { announcement }, 'Announcement created successfully');
});

// @desc    Update an announcement
// @route   PUT /api/v1/announcements/:id
// @access  Private/Admin
const updateAnnouncement = asyncHandler(async (req, res) => {
  const announcement = await AnnouncementBar.findById(req.params.id);
  if (!announcement) throw new ApiError(404, 'Announcement not found');

  Object.keys(req.body).forEach((field) => {
    announcement[field] = req.body[field];
  });

  await announcement.save();
  sendResponse(res, 200, { announcement }, 'Announcement updated successfully');
});

// @desc    Toggle an announcement's active status
// @route   PATCH /api/v1/announcements/:id/status
// @access  Private/Admin
const toggleAnnouncementStatus = asyncHandler(async (req, res) => {
  const announcement = await AnnouncementBar.findById(req.params.id);
  if (!announcement) throw new ApiError(404, 'Announcement not found');

  announcement.isActive = !announcement.isActive;
  await announcement.save();

  sendResponse(res, 200, { announcement }, `Announcement ${announcement.isActive ? 'enabled' : 'disabled'} successfully`);
});

// @desc    Delete an announcement
// @route   DELETE /api/v1/announcements/:id
// @access  Private/Admin
const deleteAnnouncement = asyncHandler(async (req, res) => {
  const announcement = await AnnouncementBar.findById(req.params.id);
  if (!announcement) throw new ApiError(404, 'Announcement not found');
  await announcement.deleteOne();
  sendResponse(res, 200, {}, 'Announcement deleted successfully');
});

module.exports = {
  getAnnouncements,
  createAnnouncement,
  updateAnnouncement,
  toggleAnnouncementStatus,
  deleteAnnouncement,
};
