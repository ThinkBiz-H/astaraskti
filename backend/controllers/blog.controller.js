const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/ApiError");
const { sendResponse } = require("../utils/ApiResponse");
const Blog = require("../models/Blog");
const BlogCategory = require("../models/BlogCategory");
const {
  uploadToCloudinary,
  deleteFromCloudinary,
} = require("../services/cloudinary.service");

// A scheduled post becomes publicly visible once its publishedAt time has
// passed, even before any cron job (not yet built — see Phase 19) formally
// flips its status to "published". This is the correct behavior without
// requiring that dependency to exist first.
const PUBLIC_VISIBILITY_FILTER = {
  $or: [
    { status: "published" },
    { status: "scheduled", publishedAt: { $lte: new Date() } },
  ],
};

// @desc    List public blog posts — search, filter by category/tag, paginated
// @route   GET /api/v1/blogs?keyword=&category=&tag=&page=&limit=
// @access  Public
const getPublicBlogs = asyncHandler(async (req, res) => {
  const { keyword, category, tag, page = 1, limit = 10 } = req.query;

  const filter = { ...PUBLIC_VISIBILITY_FILTER };
  if (keyword) filter.$text = { $search: keyword };
  if (category) filter.category = category;
  if (tag) filter.tags = tag;

  const skip = (Number(page) - 1) * Number(limit);
  const [blogs, total] = await Promise.all([
    Blog.find(filter)
      .select("-content")
      .populate("category", "name slug")
      .populate("author", "name")
      .sort("-publishedAt")
      .skip(skip)
      .limit(Number(limit)),
    Blog.countDocuments(filter),
  ]);

  sendResponse(
    res,
    200,
    { blogs, total, page: Number(page), totalPages: Math.ceil(total / limit) },
    "Blogs fetched successfully",
  );
});

// @desc    Get one public blog post by slug — increments view count, falls
//          back to same-category posts for "related" if none are curated
// @route   GET /api/v1/blogs/:slug
// @access  Public
const getPublicBlogBySlug = asyncHandler(async (req, res) => {
  const blog = await Blog.findOneAndUpdate(
    { slug: req.params.slug, ...PUBLIC_VISIBILITY_FILTER },
    { $inc: { viewCount: 1 } },
    { new: true },
  )
    .populate("category", "name slug")
    .populate("author", "name")
    .populate("relatedBlogs", "title slug excerpt featuredImage publishedAt");

  if (!blog) throw new ApiError(404, "Blog post not found");

  let related = blog.relatedBlogs;
  if (!related || related.length === 0) {
    related = blog.category
      ? await Blog.find({
          ...PUBLIC_VISIBILITY_FILTER,
          category: blog.category,
          _id: { $ne: blog._id },
        })
          .select("title slug excerpt featuredImage publishedAt")
          .limit(4)
      : [];
  }

  sendResponse(res, 200, { blog, related }, "Blog post fetched successfully");
});

// @desc    List blog categories
// @route   GET /api/v1/blogs/categories
// @access  Public
const getBlogCategories = asyncHandler(async (req, res) => {
  const categories = await BlogCategory.find({ status: "active" }).sort("name");
  sendResponse(
    res,
    200,
    { categories },
    "Blog categories fetched successfully",
  );
});

// ---------- Admin ----------

// @desc    List ALL posts regardless of status, with search/filter (admin)
// @route   GET /api/v1/admin/blogs?status=&keyword=&category=
// @access  Private/Admin
const getAllBlogs = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  if (req.query.category) filter.category = req.query.category;
  if (req.query.keyword)
    filter.title = { $regex: req.query.keyword, $options: "i" };

  const blogs = await Blog.find(filter)
    .select("-content")
    .populate("category", "name slug")
    .populate("author", "name")
    .sort("-createdAt");

  sendResponse(
    res,
    200,
    { blogs, count: blogs.length },
    "Blogs fetched successfully",
  );
});

const getBlogById = asyncHandler(async (req, res) => {
  const blog = await Blog.findById(req.params.id)
    .populate("category", "name slug")
    .populate("relatedBlogs", "title slug");
  if (!blog) throw new ApiError(404, "Blog post not found");
  sendResponse(res, 200, { blog }, "Blog post fetched successfully");
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

const parseArrayField = (raw) => {
  if (raw === undefined) return undefined;
  if (Array.isArray(raw)) return raw;
  if (typeof raw !== "string") return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
};

// @desc    Create a blog post
// @route   POST /api/v1/admin/blogs
// @access  Private/Admin
const createBlog = asyncHandler(async (req, res) => {
  const { title, slug, content, excerpt, category, status, publishedAt } =
    req.body;
  const tags = parseArrayField(req.body.tags) || [];
  const relatedBlogs = parseArrayField(req.body.relatedBlogs) || [];
  const seo = parseSeo(req.body.seo);

  let featuredImage;
  if (req.file) {
    const result = await uploadToCloudinary(req.file.buffer, "ecommerce/blog");
    featuredImage = { url: result.url, publicId: result.publicId };
  }

  const blog = await Blog.create({
    title,
    slug,
    content,
    excerpt,
    category: category || null,
    tags,
    relatedBlogs,
    status,
    publishedAt,
    seo,
    featuredImage,
    author: req.user._id,
  });

  sendResponse(res, 201, { blog }, "Blog post created successfully");
});

// @desc    Update a blog post
// @route   PUT /api/v1/admin/blogs/:id
// @access  Private/Admin
const updateBlog = asyncHandler(async (req, res) => {
  const blog = await Blog.findById(req.params.id);
  if (!blog) throw new ApiError(404, "Blog post not found");

  if (req.file) {
    if (blog.featuredImage?.publicId)
      await deleteFromCloudinary(blog.featuredImage.publicId);
    const result = await uploadToCloudinary(req.file.buffer, "ecommerce/blog");
    blog.featuredImage = { url: result.url, publicId: result.publicId };
  }

  [
    "title",
    "slug",
    "content",
    "excerpt",
    "category",
    "status",
    "publishedAt",
  ].forEach((field) => {
    if (req.body[field] !== undefined) blog[field] = req.body[field];
  });

  const tags = parseArrayField(req.body.tags);
  if (tags !== undefined) blog.tags = tags;
  const relatedBlogs = parseArrayField(req.body.relatedBlogs);
  if (relatedBlogs !== undefined) blog.relatedBlogs = relatedBlogs;
  const seo = parseSeo(req.body.seo);
  if (seo !== undefined) blog.seo = { ...blog.seo.toObject(), ...seo };

  await blog.save();
  sendResponse(res, 200, { blog }, "Blog post updated successfully");
});

// @desc    Publish / unpublish / schedule a post
// @route   PATCH /api/v1/admin/blogs/:id/status
// @access  Private/Admin
const setBlogStatus = asyncHandler(async (req, res) => {
  const { status, publishedAt } = req.body;
  if (!["draft", "published", "scheduled"].includes(status)) {
    throw new ApiError(400, "status must be draft, published, or scheduled");
  }
  if (status === "scheduled" && !publishedAt) {
    throw new ApiError(
      400,
      "publishedAt (a future date) is required to schedule a post",
    );
  }

  const blog = await Blog.findById(req.params.id);
  if (!blog) throw new ApiError(404, "Blog post not found");

  blog.status = status;
  if (publishedAt) blog.publishedAt = publishedAt;
  await blog.save();

  sendResponse(res, 200, { blog }, `Blog post ${status} successfully`);
});

// @desc    Delete a blog post
// @route   DELETE /api/v1/admin/blogs/:id
// @access  Private/Admin
const deleteBlog = asyncHandler(async (req, res) => {
  const blog = await Blog.findById(req.params.id);
  if (!blog) throw new ApiError(404, "Blog post not found");

  if (blog.featuredImage?.publicId)
    await deleteFromCloudinary(blog.featuredImage.publicId);
  await blog.deleteOne();

  sendResponse(res, 200, {}, "Blog post deleted successfully");
});

// ---------- Blog Categories (admin) ----------

const createBlogCategory = asyncHandler(async (req, res) => {
  const category = await BlogCategory.create(req.body);
  sendResponse(res, 201, { category }, "Blog category created successfully");
});

const updateBlogCategory = asyncHandler(async (req, res) => {
  const category = await BlogCategory.findById(req.params.id);
  if (!category) throw new ApiError(404, "Blog category not found");
  ["name", "description", "status"].forEach((f) => {
    if (req.body[f] !== undefined) category[f] = req.body[f];
  });
  await category.save();
  sendResponse(res, 200, { category }, "Blog category updated successfully");
});

const deleteBlogCategory = asyncHandler(async (req, res) => {
  const inUse = await Blog.countDocuments({ category: req.params.id });
  if (inUse > 0) {
    throw new ApiError(
      400,
      `Cannot delete: ${inUse} blog post(s) still use this category. Reassign them first.`,
    );
  }
  const category = await BlogCategory.findById(req.params.id);
  if (!category) throw new ApiError(404, "Blog category not found");
  await category.deleteOne();
  sendResponse(res, 200, {}, "Blog category deleted successfully");
});

module.exports = {
  getPublicBlogs,
  getPublicBlogBySlug,
  getBlogCategories,
  getAllBlogs,
  getBlogById,
  createBlog,
  updateBlog,
  setBlogStatus,
  deleteBlog,
  createBlogCategory,
  updateBlogCategory,
  deleteBlogCategory,
  PUBLIC_VISIBILITY_FILTER,
};
