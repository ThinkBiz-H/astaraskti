const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { sendResponse } = require('../utils/ApiResponse');
const HomeSection = require('../models/HomeSection');
const { uploadToCloudinary, deleteFromCloudinary } = require('../services/cloudinary.service');
const { invalidate } = require('../services/cache.service');

// @desc    Get active home sections, in display order (public)
// @route   GET /api/v1/home-sections
// @access  Public
const getActiveSections = asyncHandler(async (req, res) => {
  const sections = await HomeSection.find({ isActive: true }).sort('sortOrder');
  sendResponse(res, 200, { sections, count: sections.length }, 'Home sections fetched successfully');
});

// @desc    List ALL sections regardless of active state (admin)
// @route   GET /api/v1/admin/home-sections
// @access  Private/Admin
const getAllSections = asyncHandler(async (req, res) => {
  const sections = await HomeSection.find().sort('sortOrder');
  sendResponse(res, 200, { sections, count: sections.length }, 'Home sections fetched successfully');
});

const parseConfig = (raw) => {
  if (raw === undefined) return undefined;
  if (typeof raw !== 'string') return raw;
  try {
    return JSON.parse(raw);
  } catch {
    throw new ApiError(400, 'config must be valid JSON');
  }
};

// @desc    Create a home section
// @route   POST /api/v1/admin/home-sections
// @access  Private/Admin
const createSection = asyncHandler(async (req, res) => {
  const { type, title, subtitle, content, sortOrder, isActive, backgroundColor, textColor } = req.body;
  const config = parseConfig(req.body.config) || {};
  const button = req.body.button ? (typeof req.body.button === 'string' ? JSON.parse(req.body.button) : req.body.button) : undefined;

  let image;
  if (req.files?.image?.[0]) {
    const result = await uploadToCloudinary(req.files.image[0].buffer, 'ecommerce/home-sections');
    image = { url: result.url, publicId: result.publicId };
  }
  let mobileImage;
  if (req.files?.mobileImage?.[0]) {
    const result = await uploadToCloudinary(req.files.mobileImage[0].buffer, 'ecommerce/home-sections');
    mobileImage = { url: result.url, publicId: result.publicId };
  }

  const section = await HomeSection.create({
    type, title, subtitle, content, sortOrder, isActive, backgroundColor, textColor,
    config, button, image, mobileImage,
  });
  await invalidate('home-sections:*');
  sendResponse(res, 201, { section }, 'Home section created successfully');
});

// @desc    Update a home section
// @route   PUT /api/v1/admin/home-sections/:id
// @access  Private/Admin
const updateSection = asyncHandler(async (req, res) => {
  const section = await HomeSection.findById(req.params.id);
  if (!section) throw new ApiError(404, 'Home section not found');

  if (req.files?.image?.[0]) {
    if (section.image?.publicId) await deleteFromCloudinary(section.image.publicId);
    const result = await uploadToCloudinary(req.files.image[0].buffer, 'ecommerce/home-sections');
    section.image = { url: result.url, publicId: result.publicId };
  }
  if (req.files?.mobileImage?.[0]) {
    if (section.mobileImage?.publicId) await deleteFromCloudinary(section.mobileImage.publicId);
    const result = await uploadToCloudinary(req.files.mobileImage[0].buffer, 'ecommerce/home-sections');
    section.mobileImage = { url: result.url, publicId: result.publicId };
  }

  ['type', 'title', 'subtitle', 'content', 'sortOrder', 'isActive', 'backgroundColor', 'textColor'].forEach((field) => {
    if (req.body[field] !== undefined) section[field] = req.body[field];
  });

  const config = parseConfig(req.body.config);
  if (config !== undefined) section.config = config;
  if (req.body.button !== undefined) {
    section.button = typeof req.body.button === 'string' ? JSON.parse(req.body.button) : req.body.button;
  }

  await section.save();
  await invalidate('home-sections:*');
  sendResponse(res, 200, { section }, 'Home section updated successfully');
});

// @desc    Reorder sections in one call — { order: [id1, id2, id3, ...] }
// @route   PATCH /api/v1/admin/home-sections/reorder
// @access  Private/Admin
const reorderSections = asyncHandler(async (req, res) => {
  const { order } = req.body;
  if (!Array.isArray(order) || order.length === 0) {
    throw new ApiError(400, 'order must be a non-empty array of section ids');
  }

  await Promise.all(order.map((id, index) => HomeSection.findByIdAndUpdate(id, { sortOrder: index })));

  const sections = await HomeSection.find().sort('sortOrder');
  await invalidate('home-sections:*');
  sendResponse(res, 200, { sections }, 'Home sections reordered successfully');
});

// @desc    Delete a home section
// @route   DELETE /api/v1/admin/home-sections/:id
// @access  Private/Admin
const deleteSection = asyncHandler(async (req, res) => {
  const section = await HomeSection.findById(req.params.id);
  if (!section) throw new ApiError(404, 'Home section not found');

  if (section.image?.publicId) await deleteFromCloudinary(section.image.publicId);
  await section.deleteOne();

  await invalidate('home-sections:*');
  sendResponse(res, 200, {}, 'Home section deleted successfully');
});

module.exports = { getActiveSections, getAllSections, createSection, updateSection, reorderSections, deleteSection };
