const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { sendResponse } = require('../utils/ApiResponse');
const Category = require('../models/Category');
const { uploadToCloudinary, deleteFromCloudinary } = require('../services/cloudinary.service');
const {
  normalizeParentInput,
  resolveParent,
  reparentCategory,
  assertDeletable,
  getEffectiveAttributeTemplate,
} = require('../services/category.service');
const { invalidate } = require('../services/cache.service');

const parseAttributeTemplate = (raw) => {
  if (raw === undefined) return undefined;
  if (typeof raw !== 'string') return raw;
  try {
    return JSON.parse(raw);
  } catch {
    throw new ApiError(400, 'attributeTemplate must be valid JSON: an array of {key,label,type,options,unit,required}');
  }
};

// @desc    Create category (root, or nested under `parent`)
// @route   POST /api/v1/categories
// @access  Private/Admin
const createCategory = asyncHandler(async (req, res) => {
  const { name, description, status, sortOrder } = req.body;
  const parentId = normalizeParentInput(req.body.parent);
  const attributeTemplate = parseAttributeTemplate(req.body.attributeTemplate);

  const parent = await resolveParent(parentId ?? null);

  let image;
  if (req.file) {
    const result = await uploadToCloudinary(req.file.buffer, 'ecommerce/categories');
    image = { url: result.url, publicId: result.publicId };
  }

  const category = await Category.create({
    name,
    description,
    status,
    image,
    sortOrder: sortOrder || 0,
    attributeTemplate,
    parent: parent ? parent._id : null,
    ancestors: parent ? [...parent.ancestors, parent._id] : [],
    level: parent ? parent.ancestors.length + 1 : 0,
  });

  await invalidate('categories:*');
  sendResponse(res, 201, { category }, 'Category created successfully');
});

// @desc    Update category (and re-parent it if `parent` is included and different)
// @route   PUT /api/v1/categories/:id
// @access  Private/Admin
const updateCategory = asyncHandler(async (req, res) => {
  const category = await Category.findById(req.params.id);
  if (!category) throw new ApiError(404, 'Category not found');

  if (req.file) {
    if (category.image && category.image.publicId) {
      await deleteFromCloudinary(category.image.publicId);
    }
    const result = await uploadToCloudinary(req.file.buffer, 'ecommerce/categories');
    category.image = { url: result.url, publicId: result.publicId };
  }

  ['name', 'description', 'status', 'sortOrder'].forEach((field) => {
    if (req.body[field] !== undefined) category[field] = req.body[field];
  });

  const attributeTemplate = parseAttributeTemplate(req.body.attributeTemplate);
  if (attributeTemplate !== undefined) category.attributeTemplate = attributeTemplate;

  const parentId = normalizeParentInput(req.body.parent);
  if (parentId !== undefined) {
    const currentParentId = category.parent ? String(category.parent) : null;
    if (parentId !== currentParentId) {
      const newParent = await resolveParent(parentId, category._id);
      await reparentCategory(category, newParent);
      await invalidate('categories:*');
      return sendResponse(res, 200, { category }, 'Category updated and moved successfully');
    }
  }

  await category.save();
  await invalidate('categories:*');
  sendResponse(res, 200, { category }, 'Category updated successfully');
});

// @desc    Delete category (blocked if it has subcategories or products)
// @route   DELETE /api/v1/categories/:id
// @access  Private/Admin
const deleteCategory = asyncHandler(async (req, res) => {
  const category = await Category.findById(req.params.id);
  if (!category) throw new ApiError(404, 'Category not found');

  await assertDeletable(category._id);

  if (category.image && category.image.publicId) {
    await deleteFromCloudinary(category.image.publicId);
  }

  await category.deleteOne();
  await invalidate('categories:*');
  sendResponse(res, 200, {}, 'Category deleted successfully');
});

// @desc    Get categories — flat list (default, same shape as before) or
//          nested tree (?tree=true), optionally scoped to direct children
//          of a given parent (?parent=<id>, or ?parent=root for top-level)
// @route   GET /api/v1/categories
// @access  Public
const getCategories = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.status) filter.status = req.query.status;

  if (req.query.tree === 'true') {
    const tree = await Category.getTree(filter);
    return sendResponse(res, 200, { categories: tree }, 'Category tree fetched successfully');
  }

  if (req.query.parent !== undefined) {
    const parentId = normalizeParentInput(req.query.parent);
    filter.parent = parentId; // null = top-level categories only
  }

  const categories = await Category.find(filter).sort({ level: 1, sortOrder: 1, name: 1 });
  sendResponse(res, 200, { categories, count: categories.length }, 'Categories fetched successfully');
});

// @desc    Get category by slug, with breadcrumb (ancestors) and direct children
// @route   GET /api/v1/categories/:slug
// @access  Public
const getCategoryBySlug = asyncHandler(async (req, res) => {
  const category = await Category.findOne({ slug: req.params.slug })
    .populate('ancestors', 'name slug')
    .populate('children', 'name slug image status');

  if (!category) throw new ApiError(404, 'Category not found');
  sendResponse(res, 200, { category }, 'Category fetched successfully');
});

// @desc    Get the effective attribute template for a category — its own
//          template merged with every ancestor's. This is what the admin
//          product form should call to know which fields to render when
//          the admin picks this category.
// @route   GET /api/v1/categories/:id/attribute-template
// @access  Public
const getAttributeTemplate = asyncHandler(async (req, res) => {
  const attributeTemplate = await getEffectiveAttributeTemplate(req.params.id);
  sendResponse(res, 200, { attributeTemplate }, 'Attribute template fetched successfully');
});

module.exports = { createCategory, updateCategory, deleteCategory, getCategories, getCategoryBySlug, getAttributeTemplate };
