const express = require('express');
const router = express.Router();

const { getPublicSettings } = require('../controllers/settings.controller');
const { cacheMiddleware } = require('../services/cache.service');

router.get('/', cacheMiddleware('settings', 300), getPublicSettings);

module.exports = router;
