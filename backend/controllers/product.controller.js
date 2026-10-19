const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/ApiError");
const { sendResponse } = require("../utils/ApiResponse");
const mongoose = require("mongoose");
const Product = require("../models/Product");
const User = require("../models/User");
const Category = require("../models/Category");
const ApiFeatures = require("../utils/ApiFeatures");
const {
  uploadToCloudinary,
  deleteFromCloudinary,
} = require("../services/cloudinary.service");
const {
  getEffectiveAttributeTemplate,
} = require("../services/category.service");
const inventoryService = require("../services/inventory.service");
const logger = require("../utils/logger");

const RECENTLY_VIEWED_LIMIT = 20;

/**
 * Phase 4 — enforces that any attribute marked `required: true` on the
 * product's category (or one of its ancestors) is present in the product's
 * `attributes` array. This is the backend half of "the product form
 * changes based on category" — the frontend reads
 * GET /categories/:id/attribute-template to know which fields to render;
 * this is what stops a product being saved without them.
 */
const assertRequiredAttributes = async (categoryId, attributes = []) => {
  const template = await getEffectiveAttributeTemplate(categoryId);
  const providedKeys = new Set((attributes || []).map((a) => a.key));
  const missing = template.filter(
    (f) => f.required && !providedKeys.has(f.key),
  );
  if (missing.length > 0) {
    throw new ApiError(
      400,
      `Missing required attribute(s) for this category: ${missing.map((f) => f.label).join(", ")}`,
    );
  }
};

// @desc    Create a new product
// @route   POST /api/v1/products
// @access  Private/Admin
const createProduct = asyncHandler(async (req, res) => {
  const body = { ...req.body };

  // Parse JSON-stringified arrays/objects if sent via multipart/form-data.
  // Every FormData field arrives as a string — an empty, untouched field
  // (e.g. "dimensions" the admin never filled in) arrives as "", which is
  // not valid JSON. JSON.parse("") throws, and for the three object-typed
  // fields (attributes/documents/dimensions) there's no comma-separated
  // fallback, so the field must be deleted rather than left as a raw
  // string — assigning a string to a nested-object schema path crashes the
  // ENTIRE save with a Mongoose "Parameter obj to Document() must be an
  // object" error, which was silently killing image uploads bundled into
  // the same request.
  const COMMA_SEPARATED_FALLBACK = [
    "tags", "colors", "sizes", "relatedProducts", "crossSell", "upSell", "seoKeywords",
  ];
  [...COMMA_SEPARATED_FALLBACK, "attributes", "documents", "dimensions"].forEach((field) => {
    if (typeof body[field] !== "string") return;
    if (body[field].trim() === "") {
      delete body[field];
      return;
    }
    try {
      body[field] = JSON.parse(body[field]);
    } catch (e) {
      if (COMMA_SEPARATED_FALLBACK.includes(field)) {
        body[field] = body[field].split(",").map((s) => s.trim()).filter(Boolean);
      } else {
        delete body[field];
      }
    }
  });

  let images = [];
  let thumbnail;

  if (req.files && req.files.length > 0) {
    const uploaded = await Promise.all(
      req.files.map((file) =>
        uploadToCloudinary(file.buffer, "ecommerce/products"),
      ),
    );
    images = uploaded.map((u) => ({ url: u.url, publicId: u.publicId }));
    thumbnail = images[0];
  }

  await assertRequiredAttributes(body.category, body.attributes);

  const product = await Product.create({ ...body, images, thumbnail });

  // Seed the warehouse inventory ledger with the admin's entered stock so
  // it doesn't diverge from Product.stock the moment any inventory
  // movement (an order, a manual adjustment) touches this product — see
  // inventory.service.js syncAggregateStock / seed/index.js backfillWarehouseStock
  // for why an un-seeded WarehouseStock row silently zeroes stock out.
  if (product.stock > 0) {
    try {
      const warehouse = await inventoryService.getDefaultWarehouse();
      await inventoryService.purchaseStock({
        productId: product._id,
        variantId: null,
        warehouseId: warehouse._id,
        quantity: product.stock,
        note: "Initial stock on product creation",
        performedBy: req.user._id,
      });
    } catch (err) {
      // Don't block product creation on a missing default warehouse — but
      // this product's stock WILL be reset to 0 by the next inventory
      // movement until a default warehouse exists and this is repaired
      // (see scripts/repairWarehouseStock.js).
      logger.error(`Could not seed initial warehouse stock for product ${product._id}: ${err.message}`);
    }
  }

  sendResponse(res, 201, { product }, "Product created successfully");
});

// @desc    Update product
// @route   PUT /api/v1/products/:id
// @access  Private/Admin
const updateProduct = asyncHandler(async (req, res) => {
  const product = await Product.findOne({
    _id: req.params.id,
    isDeleted: false,
  });
  if (!product) throw new ApiError(404, "Product not found");

  const body = { ...req.body };
  // See the identical, more-commented version of this in createProduct
  // above — same bug, same fix: an empty/invalid "dimensions"/"attributes"/
  // "documents" string must be deleted, never assigned raw (it crashes the
  // whole save, taking any bundled image upload down with it).
  const COMMA_SEPARATED_FALLBACK = [
    "tags", "colors", "sizes", "relatedProducts", "crossSell", "upSell", "seoKeywords",
  ];
  [...COMMA_SEPARATED_FALLBACK, "attributes", "documents", "dimensions"].forEach((field) => {
    if (typeof body[field] !== "string") return;
    if (body[field].trim() === "") {
      delete body[field];
      return;
    }
    try {
      body[field] = JSON.parse(body[field]);
    } catch (e) {
      if (COMMA_SEPARATED_FALLBACK.includes(field)) {
        body[field] = body[field].split(",").map((s) => s.trim()).filter(Boolean);
      } else {
        delete body[field];
      }
    }
  });

  if (req.files && req.files.length > 0) {
    const uploaded = await Promise.all(
      req.files.map((file) =>
        uploadToCloudinary(file.buffer, "ecommerce/products"),
      ),
    );
    const newImages = uploaded.map((u) => ({
      url: u.url,
      publicId: u.publicId,
    }));
    product.images.push(...newImages);
    if (!product.thumbnail || !product.thumbnail.url)
      product.thumbnail = newImages[0];
  }

  // Let the admin pick an already-uploaded gallery image as the thumbnail.
  // Not a schema field itself — just a signal consumed here, then discarded
  // so it never falls through to the generic field-assignment loop below.
  if (body.thumbnailPublicId) {
    const match = product.images.find((img) => img.publicId === body.thumbnailPublicId);
    if (match) product.thumbnail = match;
    delete body.thumbnailPublicId;
  }

  const excluded = [
    "images",
    "thumbnail",
    "reviews",
    "rating",
    "numReviews",
    "isDeleted",
    "slug",
    // Stock must never be edited as a plain field — it's a synced aggregate
    // of WarehouseStock (see inventory.service.js syncAggregateStock).
    // Changes go through POST /inventory/adjust so they get validated,
    // logged as a StockMovement, and stay in sync.
    "stock",
  ];
  Object.keys(body).forEach((key) => {
    if (!excluded.includes(key)) product[key] = body[key];
  });

  await assertRequiredAttributes(product.category, product.attributes);

  await product.save();
  sendResponse(res, 200, { product }, "Product updated successfully");
});

// @desc    Remove a specific image from a product
// @route   DELETE /api/v1/products/:id/images/:publicId
// @access  Private/Admin
const removeProductImage = asyncHandler(async (req, res) => {
  const product = await Product.findOne({
    _id: req.params.id,
    isDeleted: false,
  });
  if (!product) throw new ApiError(404, "Product not found");

  const publicId = decodeURIComponent(req.params.publicId);
  await deleteFromCloudinary(publicId);

  product.images = product.images.filter((img) => img.publicId !== publicId);
  if (product.thumbnail && product.thumbnail.publicId === publicId) {
    product.thumbnail = product.images[0] || null;
  }

  await product.save();
  sendResponse(res, 200, { product }, "Image removed successfully");
});

// @desc    Soft delete product
// @route   DELETE /api/v1/products/:id
// @access  Private/Admin
const deleteProduct = asyncHandler(async (req, res) => {
  const product = await Product.findOne({
    _id: req.params.id,
    isDeleted: false,
  });
  if (!product) throw new ApiError(404, "Product not found");

  product.isDeleted = true;
  product.deletedAt = new Date();
  await product.save();

  sendResponse(res, 200, {}, "Product deleted successfully");
});

// @desc    Restore a soft-deleted product
// @route   PATCH /api/v1/products/:id/restore
// @access  Private/Admin
const restoreProduct = asyncHandler(async (req, res) => {
  const product = await Product.findOne({
    _id: req.params.id,
    isDeleted: true,
  });
  if (!product) throw new ApiError(404, "Deleted product not found");

  product.isDeleted = false;
  product.deletedAt = null;
  await product.save();

  sendResponse(res, 200, { product }, "Product restored successfully");
});

// @desc    Get all products with search/filter/sort/pagination
// @route   GET /api/v1/products
// @access  Public
const getProducts = asyncHandler(async (req, res) => {
  // A product only ever references its final (leaf) category, but browsing
  // a PARENT category should still surface products from every subcategory
  // beneath it. Expand `?category=<id>` into `{ $in: [id, ...descendantIds] }`
  // once, up front, so both the paginated query and the count query below
  // (which each build their own ApiFeatures instance from req.query) see
  // the same expanded filter.
  if (
    req.query.category &&
    mongoose.Types.ObjectId.isValid(req.query.category)
  ) {
    const ids = await Category.getSelfAndDescendantIds(req.query.category);
    req.query.category = { $in: ids };
  }

  // "Stock" filter (admin Products list) — translated into a plain `stock`
  // range in the same {gt,lte} shape ApiFeatures.filter() already expects,
  // then removed so filter() doesn't try to match a literal `stockStatus` field.
  if (req.query.stockStatus === "out") {
    req.query.stock = { lte: 0 };
  } else if (req.query.stockStatus === "in_stock") {
    req.query.stock = { gt: 0 };
  }
  delete req.query.stockStatus;

  // Deleted products are never shown publicly. An authenticated admin can
  // opt into seeing them (?includeDeleted=true) — this is what powers the
  // Products list's Restore action, which otherwise could never find a
  // soft-deleted product to restore.
  const isAdmin = req.user?.role === "admin";
  const showDeleted = isAdmin && req.query.includeDeleted === "true";
  delete req.query.includeDeleted;
  const baseFilter = showDeleted ? {} : { isDeleted: false };

  const baseQuery = Product.find(baseFilter)
    .populate("category", "name slug")
    .populate("brand", "name slug")
    .populate("unit", "name symbol allowDecimal");

  const features = new ApiFeatures(baseQuery, req.query)
    .search(["title", "description", "tags"])
    .filter()
    .sort()
    .limitFields();

  const totalCountFeatures = new ApiFeatures(
    Product.find(baseFilter),
    req.query,
  )
    .search(["title", "description", "tags"])
    .filter();
  const total = await totalCountFeatures.query.countDocuments();

  features.paginate();

  const products = await features.query;

  sendResponse(
    res,
    200,
    {
      products,
      pagination: {
        total,
        page: features.pagination.page,
        limit: features.pagination.limit,
        totalPages: Math.ceil(total / features.pagination.limit),
      },
    },
    "Products fetched successfully",
  );
});

// @desc    Get single product by slug
// @route   GET /api/v1/products/:slug
// @access  Public
const getProductBySlug = asyncHandler(async (req, res) => {
  const product = await Product.findOne({
    slug: req.params.slug,
    isDeleted: false,
  })
    .populate("category", "name slug")
    .populate("brand", "name slug")
    .populate("unit", "name symbol allowDecimal")
    .populate({
      path: "variants",
      populate: {
        path: "unit",
        select: "name symbol allowDecimal",
      },
    })
    .populate("relatedProducts", "title slug price salePrice thumbnail")
    .populate("crossSell", "title slug price salePrice thumbnail")
    .populate("upSell", "title slug price salePrice thumbnail")
    .populate("reviews.user", "name profileImage");

  if (!product) throw new ApiError(404, "Product not found");
  sendResponse(res, 200, { product }, "Product fetched successfully");
});
const getProductById = asyncHandler(async (req, res) => {
  const product = await Product.findOne({
    _id: req.params.id,
    isDeleted: false,
  })
    .populate("category", "name slug")
    .populate("brand", "name slug")
    .populate("unit", "name symbol allowDecimal")
    .populate({
      path: "variants",
      populate: {
        path: "unit",
        select: "name symbol allowDecimal",
      },
    })
    .populate("relatedProducts", "title slug price salePrice thumbnail")
    .populate("crossSell", "title slug price salePrice thumbnail")
    .populate("upSell", "title slug price salePrice thumbnail")
    .populate("reviews.user", "name profileImage");

  if (!product) {
    throw new ApiError(404, "Product not found");
  }

  sendResponse(res, 200, { product }, "Product fetched successfully");
});
// @desc    Get related products (same category, excluding current)
// @route   GET /api/v1/products/:id/related
// @access  Public
const getRelatedProducts = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) throw new ApiError(404, "Product not found");

  const related = await Product.find({
    category: product.category,
    _id: { $ne: product._id },
    isDeleted: false,
    status: "active",
  })
    .limit(8)
    .populate("category", "name slug");

  sendResponse(
    res,
    200,
    { products: related },
    "Related products fetched successfully",
  );
});

// @desc    Get featured products
// @route   GET /api/v1/products/featured/list
// @access  Public
const getFeaturedProducts = asyncHandler(async (req, res) => {
  const products = await Product.find({
    featured: true,
    isDeleted: false,
    status: "active",
  })
    .limit(12)
    .populate("category", "name slug");
  sendResponse(
    res,
    200,
    { products },
    "Featured products fetched successfully",
  );
});

// @desc    Get new arrival products
// @route   GET /api/v1/products/new-arrivals/list
// @access  Public
const getNewArrivals = asyncHandler(async (req, res) => {
  const products = await Product.find({ isDeleted: false, status: "active" })
    .sort("-createdAt")
    .limit(12)
    .populate("category", "name slug");
  sendResponse(res, 200, { products }, "New arrivals fetched successfully");
});

// @desc    Get related products - same category by default, optionally also
//          matching brand. Additive alternative to getRelatedProducts that
//          never breaks the original category-only endpoint.
// @route   GET /api/v1/products/:id/related?matchBrand=true
// @access  Public
const getRelatedProductsByBrand = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) throw new ApiError(404, "Product not found");
  if (!product.brand) throw new ApiError(400, "This product has no brand set");

  const related = await Product.find({
    brand: product.brand,
    _id: { $ne: product._id },
    isDeleted: false,
    status: "active",
  })
    .limit(8)
    .populate("brand", "name slug")
    .lean();

  sendResponse(
    res,
    200,
    { products: related },
    "Related products by brand fetched successfully",
  );
});

// @desc    Record a product-detail view for the logged-in user. Bumps the
//          product's viewCount (used for "trending") and pushes it to the
//          front of the user's recently-viewed list, capped at 20, with
//          the product de-duplicated if it was already in the list.
// @route   POST /api/v1/products/:id/view
// @access  Private
const trackProductView = asyncHandler(async (req, res) => {
  const product = await Product.findOne({
    _id: req.params.id,
    isDeleted: false,
  });
  if (!product) throw new ApiError(404, "Product not found");

  await Product.findByIdAndUpdate(product._id, { $inc: { viewCount: 1 } });

  const user = await User.findById(req.user._id).select("recentlyViewed");
  user.recentlyViewed = user.recentlyViewed.filter(
    (entry) => entry.product.toString() !== product._id.toString(),
  );
  user.recentlyViewed.unshift({ product: product._id, viewedAt: new Date() });
  user.recentlyViewed = user.recentlyViewed.slice(0, RECENTLY_VIEWED_LIMIT);
  await user.save({ validateBeforeSave: false });

  sendResponse(res, 200, {}, "View recorded");
});

// @desc    Get the logged-in user's recently viewed products (max 20, newest first)
// @route   GET /api/v1/products/me/recently-viewed
// @access  Private
const getRecentlyViewed = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).populate({
    path: "recentlyViewed.product",
    match: { isDeleted: false },
    populate: [
      { path: "category", select: "name slug" },
      { path: "brand", select: "name slug" },
    ],
  });

  const items = user.recentlyViewed.filter((entry) => entry.product);
  sendResponse(
    res,
    200,
    { items },
    "Recently viewed products fetched successfully",
  );
});

// @desc    Trending products - highest view count in a recent window,
//          falling back to all-time views if nothing recent qualifies.
// @route   GET /api/v1/products/trending/list
// @access  Public
const getTrendingProducts = asyncHandler(async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 12, 50);

  const products = await Product.find({
    isDeleted: false,
    status: "active",
    viewCount: { $gt: 0 },
  })
    .sort("-viewCount")
    .limit(limit)
    .populate("category", "name slug")
    .lean();

  sendResponse(
    res,
    200,
    { products },
    "Trending products fetched successfully",
  );
});

// @desc    Best sellers - highest salesCount (units actually sold)
// @route   GET /api/v1/products/bestsellers/list
// @access  Public
const getBestSellers = asyncHandler(async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 12, 50);

  const products = await Product.find({
    isDeleted: false,
    status: "active",
    salesCount: { $gt: 0 },
  })
    .sort("-salesCount")
    .limit(limit)
    .populate("category", "name slug")
    .lean();

  sendResponse(res, 200, { products }, "Best sellers fetched successfully");
});

// @desc    Top rated products - highest rating, tie-broken by review count
//          so a single 5-star review doesn't outrank a well-reviewed product.
// @route   GET /api/v1/products/top-rated/list
// @access  Public
const getTopRatedProducts = asyncHandler(async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 12, 50);
  const minReviews = Math.max(Number(req.query.minReviews) || 1, 0);

  const products = await Product.find({
    isDeleted: false,
    status: "active",
    numReviews: { $gte: minReviews },
  })
    .sort("-rating -numReviews")
    .limit(limit)
    .populate("category", "name slug")
    .lean();

  sendResponse(
    res,
    200,
    { products },
    "Top rated products fetched successfully",
  );
});
exports.getProductById = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id)
      .populate("category")
      .populate("brand")
      .populate("unit");

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Product fetched successfully",
      data: { product },
    });
  } catch (err) {
    next(err);
  }
};
module.exports = {
  createProduct,
  updateProduct,
  removeProductImage,
  deleteProduct,
  restoreProduct,
  getProducts,
  getProductById,
  getProductBySlug,
  getRelatedProducts,
  getRelatedProductsByBrand,
  getFeaturedProducts,
  getNewArrivals,
  trackProductView,
  getRecentlyViewed,
  getTrendingProducts,
  getBestSellers,
  getTopRatedProducts,
};
