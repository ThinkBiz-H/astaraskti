const { body } = require('express-validator');

const unitValidator = [
  body('name').trim().notEmpty().withMessage('Unit name is required'),
  body('symbol').trim().notEmpty().withMessage('Unit symbol is required'),
  body('allowDecimal').optional().isBoolean().withMessage('allowDecimal must be true or false'),
];

const unitUpdateValidator = [
  body('name').optional().trim().notEmpty().withMessage('Unit name cannot be empty'),
  body('symbol').optional().trim().notEmpty().withMessage('Unit symbol cannot be empty'),
  body('allowDecimal').optional().isBoolean().withMessage('allowDecimal must be true or false'),
];

module.exports = { unitValidator, unitUpdateValidator };
