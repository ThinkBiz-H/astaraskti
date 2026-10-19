const express = require('express');
const router = express.Router();

const {
  verifyPayment,
  paymentFailed,
  paymentCancelled,
  retryPayment,
  initiateRefund,
  getOrderTransactions,
} = require('../controllers/payment.controller');
const { protect, authorize } = require('../middlewares/auth.middleware');

router.use(protect);

router.post('/verify', verifyPayment);
router.post('/failure', paymentFailed);
router.post('/cancelled', paymentCancelled);
router.post('/:orderId/retry', retryPayment);
router.post('/:orderId/refund', authorize('admin'), initiateRefund);
router.get('/:orderId/transactions', getOrderTransactions);

module.exports = router;
