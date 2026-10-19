const { body } = require('express-validator');

const variantValidator = [
  body('sku').trim().notEmpty().withMessage('Variant SKU is required'),
  body('price').isFloat({ min: 0 }).withMessage('Price must be a positive number'),
  body('salePrice').optional().isFloat({ min: 0 }).withMessage('Sale price must be a positive number'),
  body('stock').isInt({ min: 0 }).withMessage('Stock must be a non-negative integer'),
];

const variantUpdateValidator = [
  body('sku').optional().trim().notEmpty().withMessage('Variant SKU cannot be empty'),
  body('price').optional().isFloat({ min: 0 }).withMessage('Price must be a positive number'),
  body('salePrice').optional().isFloat({ min: 0 }).withMessage('Sale price must be a positive number'),
  // Note: `stock` is intentionally NOT accepted here — see updateVariant
  // in variant.controller.js; use POST /inventory/adjust instead.
];

module.exports = { variantValidator, variantUpdateValidator };
