const express = require('express');
const router = express.Router();

const { getActiveSections } = require('../controllers/homeSection.controller');
const { cacheMiddleware } = require('../services/cache.service');

router.get('/', cacheMiddleware('home-sections', 300), getActiveSections);

module.exports = router;
