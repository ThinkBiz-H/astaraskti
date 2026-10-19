const { body } = require('express-validator');

const blogValidator = [
  body('title').trim().notEmpty().withMessage('Blog title is required'),
  body('content').trim().notEmpty().withMessage('Blog content is required'),
  body('status').optional().isIn(['draft', 'published', 'scheduled']).withMessage('Invalid status'),
  body('category').optional().isMongoId().withMessage('Invalid category id'),
];

const blogUpdateValidator = [
  body('title').optional().trim().notEmpty().withMessage('Blog title cannot be empty'),
  body('content').optional().trim().notEmpty().withMessage('Blog content cannot be empty'),
  body('status').optional().isIn(['draft', 'published', 'scheduled']).withMessage('Invalid status'),
  body('category').optional().isMongoId().withMessage('Invalid category id'),
];

const blogCategoryValidator = [body('name').trim().notEmpty().withMessage('Category name is required')];

module.exports = { blogValidator, blogUpdateValidator, blogCategoryValidator };
