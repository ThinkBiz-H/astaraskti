const { body } = require('express-validator');

const settingsUpdateValidator = [
  body('currency.code').optional().isLength({ min: 3, max: 3 }).withMessage('currency.code must be a 3-letter ISO code'),
  body('currency.position').optional().isIn(['before', 'after']).withMessage('currency.position must be "before" or "after"'),
  body('tax.defaultTaxPercent').optional().isFloat({ min: 0, max: 100 }).withMessage('tax.defaultTaxPercent must be between 0 and 100'),
  body('general.supportEmail').optional({ checkFalsy: true }).isEmail().withMessage('general.supportEmail must be a valid email'),
  body('inventory.lowStockThreshold').optional().isInt({ min: 0 }).withMessage('inventory.lowStockThreshold must be a non-negative integer'),
  body('inventory.criticalStockThreshold').optional().isInt({ min: 0 }).withMessage('inventory.criticalStockThreshold must be a non-negative integer'),
];

module.exports = { settingsUpdateValidator };
