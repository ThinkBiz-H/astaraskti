const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { sendResponse } = require('../utils/ApiResponse');
const Product = require('../models/Product');
const Order = require('../models/Order');

const recalculateRating = (product) => {
  if (product.reviews.length === 0) {
    product.rating = 0;
    product.numReviews = 0;
    return;
  }
  const total = product.reviews.reduce((sum, r) => sum + r.rating, 0);
  product.rating = Math.round((total / product.reviews.length) * 10) / 10;
  product.numReviews = product.reviews.length;
};

// @desc    Add a review (verified purchase only)
// @route   POST /api/v1/products/:id/reviews
// @access  Private
const addReview = asyncHandler(async (req, res) => {
  const { rating, comment } = req.body;
  const productId = req.params.id;

  const product = await Product.findOne({ _id: productId, isDeleted: false });
  if (!product) throw new ApiError(404, 'Product not found');

  const alreadyReviewed = product.reviews.find((r) => r.user.toString() === req.user._id.toString());
  if (alreadyReviewed) throw new ApiError(409, 'You have already reviewed this product');

  const deliveredOrder = await Order.findOne({
    user: req.user._id,
    orderStatus: 'Delivered',
    'items.product': productId,
  });

  if (!deliveredOrder) {
    throw new ApiError(403, 'You can only review products you have purchased and received');
  }

  product.reviews.push({
    user: req.user._id,
    rating,
    comment,
    isVerifiedPurchase: true,
  });

  recalculateRating(product);
  await product.save();

  sendResponse(res, 201, { reviews: product.reviews, rating: product.rating }, 'Review added successfully');
});

// @desc    Edit own review (rating and/or comment)
// @route   PUT /api/v1/products/:id/reviews/:reviewId
// @access  Private
const editReview = asyncHandler(async (req, res) => {
  const { rating, comment } = req.body;

  const product = await Product.findOne({ _id: req.params.id, isDeleted: false });
  if (!product) throw new ApiError(404, 'Product not found');

  const review = product.reviews.id(req.params.reviewId);
  if (!review) throw new ApiError(404, 'Review not found');

  if (review.user.toString() !== req.user._id.toString()) {
    throw new ApiError(403, 'You are not authorized to edit this review');
  }

  if (rating !== undefined) review.rating = rating;
  if (comment !== undefined) review.comment = comment;

  recalculateRating(product);
  await product.save();

  sendResponse(res, 200, { reviews: product.reviews, rating: product.rating }, 'Review updated successfully');
});

// Builds a 5-star -> 1-star breakdown with counts and percentages
const buildRatingDistribution = (reviews) => {
  const counts = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  reviews.forEach((r) => {
    if (counts[r.rating] !== undefined) counts[r.rating] += 1;
  });

  const total = reviews.length;
  return [5, 4, 3, 2, 1].map((star) => ({
    star,
    count: counts[star],
    percentage: total ? Math.round((counts[star] / total) * 1000) / 10 : 0,
  }));
};

// @desc    Get rating distribution (count/percentage per star) for a product
// @route   GET /api/v1/products/:id/reviews/rating-distribution
// @access  Public
const getRatingDistribution = asyncHandler(async (req, res) => {
  const product = await Product.findOne({ _id: req.params.id, isDeleted: false });
  if (!product) throw new ApiError(404, 'Product not found');

  sendResponse(
    res,
    200,
    {
      rating: product.rating,
      numReviews: product.numReviews,
      distribution: buildRatingDistribution(product.reviews),
    },
    'Rating distribution fetched successfully'
  );
});

// @desc    Delete a review (admin, or the review's own author)
// @route   DELETE /api/v1/products/:id/reviews/:reviewId
// @access  Private
const deleteReview = asyncHandler(async (req, res) => {
  const product = await Product.findOne({ _id: req.params.id, isDeleted: false });
  if (!product) throw new ApiError(404, 'Product not found');

  const review = product.reviews.id(req.params.reviewId);
  if (!review) throw new ApiError(404, 'Review not found');

  if (review.user.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
    throw new ApiError(403, 'You are not authorized to delete this review');
  }

  review.deleteOne();
  recalculateRating(product);
  await product.save();

  sendResponse(res, 200, { reviews: product.reviews, rating: product.rating }, 'Review deleted successfully');
});

// @desc    Get all reviews for a product
// @route   GET /api/v1/products/:id/reviews
// @access  Public
const getReviews = asyncHandler(async (req, res) => {
  const product = await Product.findOne({ _id: req.params.id, isDeleted: false }).populate(
    'reviews.user',
    'name profileImage'
  );
  if (!product) throw new ApiError(404, 'Product not found');

  sendResponse(
    res,
    200,
    {
      reviews: product.reviews,
      rating: product.rating,
      numReviews: product.numReviews,
      distribution: buildRatingDistribution(product.reviews),
    },
    'Reviews fetched successfully'
  );
});

module.exports = { addReview, editReview, deleteReview, getReviews, getRatingDistribution };
