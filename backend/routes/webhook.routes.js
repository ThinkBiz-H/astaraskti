const express = require('express');
const router = express.Router();

const { shiprocketWebhook, razorpayWebhook } = require('../controllers/webhook.controller');

// NOTE: intentionally NOT behind `protect` — these providers call directly.
// Authenticity is verified inside each controller (shared secret / HMAC signature).
router.post('/shiprocket', shiprocketWebhook);
router.post('/razorpay', razorpayWebhook);

module.exports = router;
