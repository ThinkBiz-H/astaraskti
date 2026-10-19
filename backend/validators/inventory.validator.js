const { body } = require('express-validator');

const productRefValidator = [
  body('productId').isMongoId().withMessage('Valid productId is required'),
  body('variantId').optional().isMongoId().withMessage('Invalid variantId'),
];

const purchaseValidator = [
  ...productRefValidator,
  body('quantity').isFloat({ gt: 0 }).withMessage('quantity must be greater than 0'),
];

const adjustValidator = [
  ...productRefValidator,
  body('quantity')
    .isFloat()
    .custom((v) => Number(v) !== 0)
    .withMessage('quantity must be a non-zero number'),
  body('note').trim().notEmpty().withMessage('note is required for stock adjustments'),
];

const transferValidator = [
  ...productRefValidator,
  body('fromWarehouseId').isMongoId().withMessage('Valid fromWarehouseId is required'),
  body('toWarehouseId').isMongoId().withMessage('Valid toWarehouseId is required'),
  body('quantity').isFloat({ gt: 0 }).withMessage('quantity must be greater than 0'),
];

const reserveValidator = [
  ...productRefValidator,
  body('quantity').isFloat({ gt: 0 }).withMessage('quantity must be greater than 0'),
];

module.exports = { purchaseValidator, adjustValidator, transferValidator, reserveValidator };
