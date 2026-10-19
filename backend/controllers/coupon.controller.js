const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { sendResponse } = require('../utils/ApiResponse');
const Coupon = require('../models/Coupon');

// @desc    Validate a coupon code against a subtotal — works for guests
//          (no cart/account needed) and logged-in users alike. Same
//          isValid/calculateDiscount logic as the account cart's
//          applyCoupon (cart.controller.js), just not tied to a persisted
//          cart. Order creation re-validates the coupon again regardless
//          (order.controller.js), so this is a pre-check for UX, not the
//          authoritative check.
// @route   POST /api/v1/coupons/validate
// @access  Public
const validateCoupon = asyncHandler(async (req, res) => {
  const { code, subtotal } = req.body;
  if (!code) throw new ApiError(400, 'Coupon code is required');

  const orderAmount = Number(subtotal) || 0;

  const coupon = await Coupon.findOne({ code: code.toUpperCase() });
  if (!coupon) throw new ApiError(404, 'Invalid coupon code');

  const validity = coupon.isValid(orderAmount, req.user?._id);
  if (!validity.valid) throw new ApiError(400, validity.reason);

  const discountAmount = coupon.calculateDiscount(orderAmount);

  sendResponse(
    res,
    200,
    {
      code: coupon.code,
      discountAmount,
      subTotal: orderAmount,
      total: orderAmount - discountAmount,
    },
    'Coupon is valid',
  );
});

const createCoupon = asyncHandler(async (req, res) => {
  const existing = await Coupon.findOne({ code: req.body.code?.toUpperCase() });
  if (existing) throw new ApiError(409, 'Coupon code already exists');

  const coupon = await Coupon.create(req.body);
  sendResponse(res, 201, { coupon }, 'Coupon created successfully');
});

const updateCoupon = asyncHandler(async (req, res) => {
  const coupon = await Coupon.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });
  if (!coupon) throw new ApiError(404, 'Coupon not found');
  sendResponse(res, 200, { coupon }, 'Coupon updated successfully');
});

const deleteCoupon = asyncHandler(async (req, res) => {
  const coupon = await Coupon.findByIdAndDelete(req.params.id);
  if (!coupon) throw new ApiError(404, 'Coupon not found');
  sendResponse(res, 200, {}, 'Coupon deleted successfully');
});

const getCoupons = asyncHandler(async (req, res) => {
  const coupons = await Coupon.find().sort('-createdAt');
  sendResponse(res, 200, { coupons, count: coupons.length }, 'Coupons fetched successfully');
});

const getCouponById = asyncHandler(async (req, res) => {
  const coupon = await Coupon.findById(req.params.id);
  if (!coupon) throw new ApiError(404, 'Coupon not found');
  sendResponse(res, 200, { coupon }, 'Coupon fetched successfully');
});

// @desc    Analytics for a single coupon: redemptions, unique users, discount given
// @route   GET /api/v1/coupons/:id/analytics
// @access  Private/Admin
const getCouponAnalytics = asyncHandler(async (req, res) => {
  const coupon = await Coupon.findById(req.params.id);
  if (!coupon) throw new ApiError(404, 'Coupon not found');

  const Order = require('../models/Order');
  const orderAgg = await Order.aggregate([
    { $match: { 'coupon.code': coupon.code } },
    {
      $group: {
        _id: null,
        ordersUsingCoupon: { $sum: 1 },
        totalDiscountGiven: { $sum: '$coupon.discountAmount' },
        totalRevenueFromOrders: { $sum: '$grandTotal' },
      },
    },
  ]);

  const stats = orderAgg[0] || { ordersUsingCoupon: 0, totalDiscountGiven: 0, totalRevenueFromOrders: 0 };

  sendResponse(
    res,
    200,
    {
      code: coupon.code,
      isActive: coupon.isActive,
      expiry: coupon.expiry,
      usedCount: coupon.usedCount,
      usageLimit: coupon.usageLimit,
      uniqueUsers: coupon.usedBy.length,
      ordersUsingCoupon: stats.ordersUsingCoupon,
      totalDiscountGiven: stats.totalDiscountGiven,
      totalRevenueFromOrders: stats.totalRevenueFromOrders,
    },
    'Coupon analytics fetched successfully'
  );
});

// @desc    Overview analytics across all coupons
// @route   GET /api/v1/coupons/analytics/overview
// @access  Private/Admin
const getCouponsOverview = asyncHandler(async (req, res) => {
  const [totalCoupons, activeCoupons, mostUsed] = await Promise.all([
    Coupon.countDocuments(),
    Coupon.countDocuments({ isActive: true, expiry: { $gte: new Date() } }),
    Coupon.find().sort('-usedCount').limit(5).select('code usedCount usageLimit discount type'),
  ]);

  sendResponse(
    res,
    200,
    { totalCoupons, activeCoupons, mostUsed },
    'Coupons overview fetched successfully'
  );
});

module.exports = {
  validateCoupon,
  createCoupon,
  updateCoupon,
  deleteCoupon,
  getCoupons,
  getCouponById,
  getCouponAnalytics,
  getCouponsOverview,
};
