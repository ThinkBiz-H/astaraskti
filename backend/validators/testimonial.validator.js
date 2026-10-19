const { body } = require('express-validator');

const testimonialValidator = [
  body('customerName').trim().notEmpty().withMessage('Customer name is required'),
  body('content').trim().notEmpty().withMessage('Testimonial content is required'),
  body('rating').optional().isInt({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5'),
  body('designation').optional().trim().isString(),
  body('sortOrder').optional().isInt().withMessage('sortOrder must be an integer'),
  body('isActive').optional().isBoolean(),
];

const testimonialUpdateValidator = [
  body('customerName').optional().trim().notEmpty().withMessage('Customer name cannot be empty'),
  body('content').optional().trim().notEmpty().withMessage('Testimonial content cannot be empty'),
  body('rating').optional().isInt({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5'),
  body('designation').optional().trim().isString(),
  body('sortOrder').optional().isInt().withMessage('sortOrder must be an integer'),
  body('isActive').optional().isBoolean(),
];

module.exports = { testimonialValidator, testimonialUpdateValidator };
