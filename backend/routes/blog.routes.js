const express = require('express');
const router = express.Router();

const { getPublicBlogs, getPublicBlogBySlug, getBlogCategories } = require('../controllers/blog.controller');

router.get('/categories', getBlogCategories);
router.get('/', getPublicBlogs);
router.get('/:slug', getPublicBlogBySlug);

module.exports = router;
