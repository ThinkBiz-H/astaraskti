const { body } = require('express-validator');

const warehouseValidator = [
  body('name').trim().notEmpty().withMessage('Warehouse name is required'),
  body('code').trim().notEmpty().withMessage('Warehouse code is required'),
];

const warehouseUpdateValidator = [
  body('name').optional().trim().notEmpty().withMessage('Warehouse name cannot be empty'),
  body('code').optional().trim().notEmpty().withMessage('Warehouse code cannot be empty'),
];

module.exports = { warehouseValidator, warehouseUpdateValidator };
