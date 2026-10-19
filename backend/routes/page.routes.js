const express = require('express');
const router = express.Router();

const { getPublishedPages, getPublishedPageBySlug } = require('../controllers/page.controller');

router.get('/', getPublishedPages);
router.get('/:slug', getPublishedPageBySlug);

module.exports = router;
