const { body } = require('express-validator');
const mongoose = require('mongoose');

const isRootSentinel = (v) => v === undefined || v === null || v === '' || v === 'null' || v === 'root';

const categoryValidator = [
  body('name').trim().notEmpty().withMessage('Category name is required'),
  body('parent')
    .optional()
    .custom((value) => isRootSentinel(value) || mongoose.Types.ObjectId.isValid(value))
    .withMessage('parent must be a valid category id, or omitted/null for a top-level category'),
];

const categoryUpdateValidator = [
  body('name').optional().trim().notEmpty().withMessage('Category name cannot be empty'),
  body('parent')
    .optional()
    .custom((value) => isRootSentinel(value) || mongoose.Types.ObjectId.isValid(value))
    .withMessage('parent must be a valid category id, or null/"root" to move to top-level'),
];

const brandValidator = [body('name').trim().notEmpty().withMessage('Brand name is required')];

module.exports = { categoryValidator, categoryUpdateValidator, brandValidator };
