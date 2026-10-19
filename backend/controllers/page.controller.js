const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/ApiError");
const { sendResponse } = require("../utils/ApiResponse");
const Page = require("../models/Page");
const { notifyMany } = require("../services/notification.service");
const {
  uploadToCloudinary,
  deleteFromCloudinary,
} = require("../services/cloudinary.service");
const slugify = require("slugify");
// @desc    List published pages (public)
// @route   GET /api/v1/pages
// @access  Public
const getPublishedPages = asyncHandler(async (req, res) => {
  const pages = await Page.find({ status: "published" })
    .select("-content") // list view doesn't need full body
    .sort({ sortOrder: 1, title: 1 });
  sendResponse(
    res,
    200,
    { pages, count: pages.length },
    "Pages fetched successfully",
  );
});

// @desc    Get one published page by slug (public)
// @route   GET /api/v1/pages/:slug
// @access  Public
const getPublishedPageBySlug = asyncHandler(async (req, res) => {
  const page = await Page.findOne({
    slug: req.params.slug,
    status: "published",
  });
  if (!page) throw new ApiError(404, "Page not found");
  sendResponse(res, 200, { page }, "Page fetched successfully");
});

// @desc    List ALL pages regardless of status, with search/filter (admin)
// @route   GET /api/v1/admin/pages
// @access  Private/Admin
const getAllPages = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  if (req.query.keyword)
    filter.title = { $regex: req.query.keyword, $options: "i" };

  const pages = await Page.find(filter)
    .select("-content")
    .sort({ sortOrder: 1, title: 1 });
  sendResponse(
    res,
    200,
    { pages, count: pages.length },
    "Pages fetched successfully",
  );
});

// @desc    Get a single page by id, any status (admin)
// @route   GET /api/v1/admin/pages/:id
// @access  Private/Admin
const getPageById = asyncHandler(async (req, res) => {
  const page = await Page.findById(req.params.id);
  if (!page) throw new ApiError(404, "Page not found");
  sendResponse(res, 200, { page }, "Page fetched successfully");
});

const parseSeo = (raw) => {
  if (raw === undefined) return undefined;
  if (typeof raw !== "string") return raw;
  try {
    return JSON.parse(raw);
  } catch {
    throw new ApiError(400, "seo must be valid JSON");
  }
};

// @desc    Create a page
// @route   POST /api/v1/admin/pages
// @access  Private/Admin
const createPage = asyncHandler(async (req, res) => {
  let { title, slug, content, excerpt, status, sortOrder } = req.body;

  // Auto generate slug
  slug =
    slug && slug.trim()
      ? slugify(slug, { lower: true, strict: true })
      : slugify(title, { lower: true, strict: true });

  // Check duplicate slug
  const exists = await Page.findOne({ slug });

  if (exists) {
    throw new ApiError(400, "Slug already exists");
  }

  const seo = parseSeo(req.body.seo);

  let featuredImage;

  if (req.file) {
    const result = await uploadToCloudinary(req.file.buffer, "ecommerce/pages");

    featuredImage = {
      url: result.url,
      publicId: result.publicId,
    };
  }

  const page = await Page.create({
    title,
    slug,
    content,
    excerpt,
    status,
    sortOrder,
    seo,
    featuredImage,
    createdBy: req.user._id,
    updatedBy: req.user._id,
  });

  sendResponse(res, 201, { page }, "Page created successfully");
});

// @desc    Update a page
// @route   PUT /api/v1/admin/pages/:id
// @access  Private/Admin
const updatePage = asyncHandler(async (req, res) => {
  const page = await Page.findById(req.params.id);
  if (!page) throw new ApiError(404, "Page not found");

  if (req.file) {
    if (page.featuredImage?.publicId)
      await deleteFromCloudinary(page.featuredImage.publicId);
    const result = await uploadToCloudinary(req.file.buffer, "ecommerce/pages");
    page.featuredImage = { url: result.url, publicId: result.publicId };
  }

  ["title", "slug", "content", "excerpt", "status", "sortOrder"].forEach(
    (field) => {
      if (req.body[field] !== undefined) page[field] = req.body[field];
    },
  );

  const seo = parseSeo(req.body.seo);
  if (seo !== undefined) page.seo = { ...page.seo.toObject(), ...seo };

  page.updatedBy = req.user._id;
  await page.save();

  sendResponse(res, 200, { page }, "Page updated successfully");
});

// @desc    Publish / unpublish a page
// @route   PATCH /api/v1/admin/pages/:id/status
// @access  Private/Admin
const setPageStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;

  if (!["draft", "published", "unpublished"].includes(status)) {
    throw new ApiError(400, "status must be draft, published, or unpublished");
  }

  const page = await Page.findById(req.params.id);

  if (!page) {
    throw new ApiError(404, "Page not found");
  }

  page.status = status;
  page.updatedBy = req.user._id;

  await page.save();

  notifyMany({
    filter: {
      role: "admin",
      _id: { $ne: req.user._id },
    },
    type: "admin_broadcast",
    title: `Page ${status}`,
    message: `"${page.title}" was ${status} by ${req.user.name}.`,
  }).catch(() => {});

  sendResponse(res, 200, { page }, `Page ${status} successfully`);
});

// @desc    Delete a page
// @route   DELETE /api/v1/admin/pages/:id
// @access  Private/Admin
const deletePage = asyncHandler(async (req, res) => {
  const page = await Page.findById(req.params.id);
  if (!page) throw new ApiError(404, "Page not found");

  if (page.featuredImage?.publicId)
    await deleteFromCloudinary(page.featuredImage.publicId);
  await page.deleteOne();

  sendResponse(res, 200, {}, "Page deleted successfully");
});

module.exports = {
  getPublishedPages,
  getPublishedPageBySlug,
  getAllPages,
  getPageById,
  createPage,
  updatePage,
  setPageStatus,
  deletePage,
};
