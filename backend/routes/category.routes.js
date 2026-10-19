const express = require('express');
const router = express.Router();

const {
  createCategory,
  updateCategory,
  deleteCategory,
  getCategories,
  getCategoryBySlug,
  getAttributeTemplate,
} = require('../controllers/category.controller');

const { protect, authorize } = require('../middlewares/auth.middleware');
const upload = require('../middlewares/upload.middleware');
const validate = require('../middlewares/validate.middleware');
const { cacheMiddleware } = require('../services/cache.service');
const { categoryValidator, categoryUpdateValidator } = require('../validators/category.validator');

/**
 * @swagger
 * /categories:
 *   get:
 *     summary: List categories (flat by default, or the full nested tree)
 *     tags: [Categories]
 *     security: []
 *     parameters:
 *       - in: query
 *         name: tree
 *         schema: { type: string, enum: ['true'] }
 *         description: Pass tree=true for the full nested tree instead of a flat list
 *       - in: query
 *         name: parent
 *         schema: { type: string }
 *         description: A category id (direct children only) or "root" (top-level only)
 *     responses:
 *       200:
 *         description: Category list or tree
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     categories:
 *                       type: array
 *                       items: { $ref: '#/components/schemas/Category' }
 */
router.get('/', cacheMiddleware('categories', 600), getCategories);
router.get('/:id/attribute-template', getAttributeTemplate);
router.get('/:slug', getCategoryBySlug);

router.post('/', protect, authorize('admin'), upload.single('image'), categoryValidator, validate, createCategory);
router.put('/:id', protect, authorize('admin'), upload.single('image'), categoryUpdateValidator, validate, updateCategory);
router.delete('/:id', protect, authorize('admin'), deleteCategory);

module.exports = router;
