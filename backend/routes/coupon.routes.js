const express = require('express');
const router = express.Router();

const {
  validateCoupon,
  createCoupon,
  updateCoupon,
  deleteCoupon,
  getCoupons,
  getCouponById,
  getCouponAnalytics,
  getCouponsOverview,
} = require('../controllers/coupon.controller');

const { protect, authorize, optionalAuth } = require('../middlewares/auth.middleware');
const validate = require('../middlewares/validate.middleware');
const { couponValidator, validateCouponValidator } = require('../validators/coupon.validator');

// Public (guest or logged-in) — must come before the admin-only gate below.
router.post('/validate', optionalAuth, validateCouponValidator, validate, validateCoupon);

router.use(protect, authorize('admin'));

router.get('/analytics/overview', getCouponsOverview);
router.route('/').get(getCoupons).post(couponValidator, validate, createCoupon);
router.get('/:id/analytics', getCouponAnalytics);
router.route('/:id').get(getCouponById).put(updateCoupon).delete(deleteCoupon);

module.exports = router;
