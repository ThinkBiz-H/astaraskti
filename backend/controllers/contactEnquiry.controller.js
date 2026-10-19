const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { sendResponse } = require('../utils/ApiResponse');
const ContactEnquiry = require('../models/ContactEnquiry');
const { sendEmail, templates } = require('../utils/sendEmail');
const logger = require('../utils/logger');

// @desc    Create a new contact enquiry
// @route   POST /api/v1/contact
// @access  Public
const createContactEnquiry = asyncHandler(async (req, res) => {
  const { name, email, mobile, subject, message } = req.body;

  const enquiry = await ContactEnquiry.create({
    name,
    email,
    mobile,
    subject,
    message,
  });

  // Send confirmation email to user
  try {
    await sendEmail({
      to: email,
      subject: 'We received your message',
      html: templates.contactConfirmation(name),
    });
  } catch (err) {
    logger.error(`Failed to send contact confirmation email to ${email}: ${err.message}`);
    // Non-fatal: enquiry is created, user will still see success message
  }

  // Send notification to admin
  try {
    await sendEmail({
      to: process.env.ADMIN_EMAIL,
      subject: `New Contact Enquiry: ${subject}`,
      html: templates.contactAdminNotification(enquiry),
    });
  } catch (err) {
    logger.error(`Failed to send contact admin notification: ${err.message}`);
  }

  sendResponse(
    res,
    201,
    { enquiry },
    'Thank you for contacting us. We will respond shortly.'
  );
});

// @desc    Get all contact enquiries (admin only)
// @route   GET /api/v1/admin/contact-enquiries
// @access  Private/Admin
const getAllEnquiries = asyncHandler(async (req, res) => {
  const { status, page = 1, limit = 20 } = req.query;

  const filter = {};
  if (status) filter.status = status;

  const skip = (page - 1) * limit;
  const enquiries = await ContactEnquiry.find(filter)
    .populate('assignedTo', 'name email')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit));

  const total = await ContactEnquiry.countDocuments(filter);

  sendResponse(
    res,
    200,
    {
      enquiries,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit),
      },
    },
    'Enquiries fetched successfully'
  );
});

// @desc    Get single enquiry by ID
// @route   GET /api/v1/admin/contact-enquiries/:id
// @access  Private/Admin
const getEnquiryById = asyncHandler(async (req, res) => {
  const enquiry = await ContactEnquiry.findById(req.params.id).populate(
    'assignedTo',
    'name email'
  );

  if (!enquiry) {
    throw new ApiError(404, 'Enquiry not found');
  }

  sendResponse(res, 200, { enquiry }, 'Enquiry fetched successfully');
});

// @desc    Update enquiry status and notes
// @route   PATCH /api/v1/admin/contact-enquiries/:id
// @access  Private/Admin
const updateEnquiry = asyncHandler(async (req, res) => {
  const { status, priority, adminNotes, assignedTo } = req.body;

  const enquiry = await ContactEnquiry.findById(req.params.id);
  if (!enquiry) {
    throw new ApiError(404, 'Enquiry not found');
  }

  if (status) enquiry.status = status;
  if (priority) enquiry.priority = priority;
  if (adminNotes !== undefined) enquiry.adminNotes = adminNotes;
  if (assignedTo !== undefined) enquiry.assignedTo = assignedTo;

  if (status === 'Resolved' || status === 'Closed') {
    enquiry.resolvedAt = new Date();
    enquiry.resolvedBy = req.user._id;
  }

  await enquiry.save();

  sendResponse(
    res,
    200,
    { enquiry },
    'Enquiry updated successfully'
  );
});

// @desc    Delete enquiry
// @route   DELETE /api/v1/admin/contact-enquiries/:id
// @access  Private/Admin
const deleteEnquiry = asyncHandler(async (req, res) => {
  const enquiry = await ContactEnquiry.findByIdAndDelete(req.params.id);

  if (!enquiry) {
    throw new ApiError(404, 'Enquiry not found');
  }

  sendResponse(res, 200, {}, 'Enquiry deleted successfully');
});

module.exports = {
  createContactEnquiry,
  getAllEnquiries,
  getEnquiryById,
  updateEnquiry,
  deleteEnquiry,
};
