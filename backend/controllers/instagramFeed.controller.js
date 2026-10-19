const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/ApiError");
const { sendResponse } = require("../utils/ApiResponse");
const InstagramFeed = require("../models/InstagramFeed");
const {
  uploadToCloudinary,
  deleteFromCloudinary,
} = require("../services/cloudinary.service");

// @desc    List Instagram feed items (active only, unless admin requests all)
// @route   GET /api/v1/instagram-feed
// @access  Public
const getFeedItems = asyncHandler(async (req, res) => {
  const isAdminRequest = req.user?.role === "admin" && req.query.all === "true";
  const filter = isAdminRequest ? {} : { isActive: true };

  const items = await InstagramFeed.find(filter).sort("sortOrder");
  sendResponse(res, 200, { items, count: items.length }, "Instagram feed fetched successfully");
});

// @desc    Add an Instagram feed item
// @route   POST /api/v1/instagram-feed
// @access  Private/Admin
const createFeedItem = asyncHandler(async (req, res) => {
  const { link, caption, sortOrder, isActive } = req.body;
  if (!req.file) throw new ApiError(400, "An image is required");

  const result = await uploadToCloudinary(req.file.buffer, "ecommerce/instagram-feed");
  const image = { url: result.url, publicId: result.publicId };

  const item = await InstagramFeed.create({ image, link, caption, sortOrder, isActive });
  sendResponse(res, 201, { item }, "Instagram feed item created successfully");
});

// @desc    Update an Instagram feed item
// @route   PUT /api/v1/instagram-feed/:id
// @access  Private/Admin
const updateFeedItem = asyncHandler(async (req, res) => {
  const item = await InstagramFeed.findById(req.params.id);
  if (!item) throw new ApiError(404, "Instagram feed item not found");

  if (req.file) {
    if (item.image?.publicId) await deleteFromCloudinary(item.image.publicId);
    const result = await uploadToCloudinary(req.file.buffer, "ecommerce/instagram-feed");
    item.image = { url: result.url, publicId: result.publicId };
  }

  ["link", "caption", "sortOrder", "isActive"].forEach((field) => {
    if (req.body[field] !== undefined) item[field] = req.body[field];
  });

  await item.save();
  sendResponse(res, 200, { item }, "Instagram feed item updated successfully");
});

// @desc    Delete an Instagram feed item
// @route   DELETE /api/v1/instagram-feed/:id
// @access  Private/Admin
const deleteFeedItem = asyncHandler(async (req, res) => {
  const item = await InstagramFeed.findById(req.params.id);
  if (!item) throw new ApiError(404, "Instagram feed item not found");

  if (item.image?.publicId) await deleteFromCloudinary(item.image.publicId);
  await item.deleteOne();

  sendResponse(res, 200, {}, "Instagram feed item deleted successfully");
});

module.exports = { getFeedItems, createFeedItem, updateFeedItem, deleteFeedItem };
