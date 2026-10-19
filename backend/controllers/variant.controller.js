const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/ApiError");
const { sendResponse } = require("../utils/ApiResponse");
const Product = require("../models/Product");
const Variant = require("../models/Variant");
const {
  uploadToCloudinary,
  deleteFromCloudinary,
} = require("../services/cloudinary.service");
const inventoryService = require("../services/inventory.service");
const logger = require("../utils/logger");

const parseIfString = (raw) => {
  if (typeof raw !== "string") return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
};

/** Keeps Product.hasVariants accurate after any variant create/delete. */
const syncHasVariants = async (productId) => {
  const count = await Variant.countDocuments({ product: productId });
  await Product.findByIdAndUpdate(productId, { hasVariants: count > 0 });
};

/** If `isDefault` is being set true, unset it on every sibling variant first. */
const enforceSingleDefault = async (productId, variantId, isDefault) => {
  if (isDefault) {
    await Variant.updateMany(
      { product: productId, _id: { $ne: variantId } },
      { isDefault: false },
    );
  }
};

// @desc    Create a variant for a product
// @route   POST /api/v1/products/:productId/variants
// @access  Private/Admin
const createVariant = asyncHandler(async (req, res) => {
  const product = await Product.findOne({
    _id: req.params.productId,
    isDeleted: false,
  });
  if (!product) throw new ApiError(404, "Product not found");

  const body = { ...req.body };
  body.attributes = parseIfString(body.attributes) || [];
  body.dimensions = parseIfString(body.dimensions);

  let images = [];
  if (req.files && req.files.length > 0) {
    const uploaded = await Promise.all(
      req.files.map((f) => uploadToCloudinary(f.buffer, "ecommerce/variants")),
    );
    images = uploaded.map((u) => ({ url: u.url, publicId: u.publicId }));
  }

  const existingCount = await Variant.countDocuments({ product: product._id });
  const isDefault =
    body.isDefault === undefined
      ? existingCount === 0
      : body.isDefault === true || body.isDefault === "true";

  const variant = await Variant.create({
    ...body,
    product: product._id,
    images,
    unit: body.unit,
    unitValue: body.unitValue,
    isDefault,
  });

  await enforceSingleDefault(product._id, variant._id, isDefault);
  await syncHasVariants(product._id);

  // Seed the warehouse inventory ledger with the admin's entered stock —
  // same reasoning as createProduct in product.controller.js.
  if (variant.stock > 0) {
    try {
      const warehouse = await inventoryService.getDefaultWarehouse();
      await inventoryService.purchaseStock({
        productId: product._id,
        variantId: variant._id,
        warehouseId: warehouse._id,
        quantity: variant.stock,
        note: "Initial stock on variant creation",
        performedBy: req.user._id,
      });
    } catch (err) {
      logger.error(`Could not seed initial warehouse stock for variant ${variant._id}: ${err.message}`);
    }
  }

  sendResponse(res, 201, { variant }, "Variant created successfully");
});

// @desc    Update a variant
// @route   PUT /api/v1/products/:productId/variants/:variantId
// @access  Private/Admin
const updateVariant = asyncHandler(async (req, res) => {
  const variant = await Variant.findOne({
    _id: req.params.variantId,
    product: req.params.productId,
  });
  if (!variant) throw new ApiError(404, "Variant not found");

  const body = { ...req.body };
  if (body.attributes !== undefined)
    body.attributes = parseIfString(body.attributes);
  if (body.dimensions !== undefined)
    body.dimensions = parseIfString(body.dimensions);

  if (req.files && req.files.length > 0) {
    const uploaded = await Promise.all(
      req.files.map((f) => uploadToCloudinary(f.buffer, "ecommerce/variants")),
    );
    variant.images.push(
      ...uploaded.map((u) => ({ url: u.url, publicId: u.publicId })),
    );
  }

  // Stock must never be edited as a plain field — same reasoning as
  // updateProduct in product.controller.js. Changes go through
  // POST /inventory/adjust with a variantId.
  const excluded = ["images", "product", "stock"];
  Object.keys(body).forEach((key) => {
    if (!excluded.includes(key)) variant[key] = body[key];
  });

  await variant.save();

  const isDefault = variant.isDefault === true;
  await enforceSingleDefault(variant.product, variant._id, isDefault);

  sendResponse(res, 200, { variant }, "Variant updated successfully");
});

// @desc    Delete a variant
// @route   DELETE /api/v1/products/:productId/variants/:variantId
// @access  Private/Admin
const deleteVariant = asyncHandler(async (req, res) => {
  const variant = await Variant.findOne({
    _id: req.params.variantId,
    product: req.params.productId,
  });
  if (!variant) throw new ApiError(404, "Variant not found");

  await Promise.all(
    (variant.images || []).map((img) =>
      img.publicId ? deleteFromCloudinary(img.publicId) : null,
    ),
  );

  const wasDefault = variant.isDefault;
  await variant.deleteOne();
  await syncHasVariants(req.params.productId);

  // If the deleted variant was the default, promote the next remaining one.
  if (wasDefault) {
    const next = await Variant.findOne({ product: req.params.productId }).sort(
      "createdAt",
    );
    if (next) {
      next.isDefault = true;
      await next.save();
    }
  }

  sendResponse(res, 200, {}, "Variant deleted successfully");
});

// @desc    List all variants for a product
// @route   GET /api/v1/products/:productId/variants
// @access  Public
const getVariants = asyncHandler(async (req, res) => {
  const variants = await Variant.find({
    product: req.params.productId,
  })
    .populate("unit", "name symbol allowDecimal")
    .sort("createdAt");
  sendResponse(
    res,
    200,
    { variants, count: variants.length },
    "Variants fetched successfully",
  );
});

module.exports = { createVariant, updateVariant, deleteVariant, getVariants };
