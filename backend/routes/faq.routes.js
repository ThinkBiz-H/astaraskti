const express = require('express');
const router = express.Router();

const { getActiveFaqs } = require('../controllers/faq.controller');
const { cacheMiddleware } = require('../services/cache.service');

router.get('/', cacheMiddleware('faqs', 300), getActiveFaqs);

module.exports = router;
