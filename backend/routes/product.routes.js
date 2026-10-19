const express = require("express");
const router = express.Router();

const {
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
} = require("../controllers/product.controller");

const {
  addReview,
  editReview,
  deleteReview,
  getReviews,
  getRatingDistribution,
} = require("../controllers/review.controller");

const {
  createVariant,
  updateVariant,
  deleteVariant,
  getVariants,
} = require("../controllers/variant.controller");

const {
  variantValidator,
  variantUpdateValidator,
} = require("../validators/variant.validator");

const { protect, authorize, optionalAuth } = require("../middlewares/auth.middleware");
const upload = require("../middlewares/upload.middleware");
const validate = require("../middlewares/validate.middleware");
const {
  createProductValidator,
  updateProductValidator,
} = require("../validators/product.validator");

// Public listing / discovery routes (must come before /:slug)
/**
 * @swagger
 * /products:
 *   get:
 *     summary: List/search/filter products
 *     tags: [Products]
 *     security: []
 *     parameters:
 *       - in: query
 *         name: keyword
 *         schema: { type: string }
 *       - in: query
 *         name: category
 *         schema: { type: string }
 *         description: Category id — matches that category AND every subcategory beneath it
 *       - in: query
 *         name: brand
 *         schema: { type: string }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 12 }
 *       - in: query
 *         name: sort
 *         schema: { type: string }
 *         description: "e.g. -createdAt, price, -price"
 *     responses:
 *       200:
 *         description: Paginated product list
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     products:
 *                       type: array
 *                       items: { $ref: '#/components/schemas/Product' }
 */
router.get("/", optionalAuth, getProducts);
router.get("/featured/list", getFeaturedProducts);
router.get("/new-arrivals/list", getNewArrivals);
router.get("/trending/list", getTrendingProducts);
router.get("/bestsellers/list", getBestSellers);
router.get("/top-rated/list", getTopRatedProducts);

// Recently viewed (must come before /:slug — "me" would otherwise be read as a slug)
router.get("/me/recently-viewed", protect, getRecentlyViewed);

// Admin CRUD
router.post(
  "/",
  protect,
  authorize("admin"),
  upload.array("images", 10),
  createProductValidator,
  validate,
  createProduct,
);
router.put(
  "/:id",
  protect,
  authorize("admin"),
  upload.array("images", 10),
  updateProductValidator,
  validate,
  updateProduct,
);
router.delete("/:id", protect, authorize("admin"), deleteProduct);
router.patch("/:id/restore", protect, authorize("admin"), restoreProduct);
router.delete(
  "/:id/images/:publicId",
  protect,
  authorize("admin"),
  removeProductImage,
);

// Related products (by id)
router.get("/:id/related", getRelatedProducts);
router.get("/:id/related-by-brand", getRelatedProductsByBrand);
router.post("/:id/view", protect, trackProductView);

// Reviews (verified purchase only)
router.get("/:id/reviews", getReviews);
router.get("/:id/reviews/rating-distribution", getRatingDistribution);
router.post("/:id/reviews", protect, addReview);
router.put("/:id/reviews/:reviewId", protect, editReview);
router.delete("/:id/reviews/:reviewId", protect, deleteReview);

// Variants (Phase 5) — nested under a product
router.get("/:productId/variants", getVariants);
router.post(
  "/:productId/variants",
  protect,
  authorize("admin"),
  upload.array("images", 6),
  variantValidator,
  validate,
  createVariant,
);
router.put(
  "/:productId/variants/:variantId",
  protect,
  authorize("admin"),
  upload.array("images", 6),
  variantUpdateValidator,
  validate,
  updateVariant,
);
router.delete(
  "/:productId/variants/:variantId",
  protect,
  authorize("admin"),
  deleteVariant,
);

// Public single product by slug - keep last so it doesn't shadow the routes above
router.get("/id/:id", getProductById);
router.get("/:slug", getProductBySlug);

module.exports = router;
