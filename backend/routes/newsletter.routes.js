const express = require('express');
const router = express.Router();

const {
  subscribe,
  unsubscribe,
  getAllSubscribers,
  exportSubscribers,
  deleteSubscriber,
  getStats,
} = require('../controllers/newsletter.controller');

const { protect, authorize } = require('../middlewares/auth.middleware');
const validate = require('../middlewares/validate.middleware');
const { newsletterSubscribeValidator } = require('../validators/newsletter.validator');

// Public routes
router.post('/subscribe', newsletterSubscribeValidator, validate, subscribe);
router.post('/unsubscribe/:token', unsubscribe);

// Admin routes
router.use(protect, authorize('admin'));

router.get('/admin/stats', getStats);
router.get('/admin/subscribers', getAllSubscribers);
router.get('/admin/subscribers/export', exportSubscribers);
router.delete('/admin/subscribers/:id', deleteSubscriber);

module.exports = router;
