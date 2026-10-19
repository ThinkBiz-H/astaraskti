const { body } = require('express-validator');

const createContactEnquiryValidator = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Name is required')
    .isLength({ min: 2 })
    .withMessage('Name must be at least 2 characters'),
  body('email')
    .trim()
    .isEmail()
    .withMessage('Valid email is required')
    .normalizeEmail(),
  body('mobile')
    .optional({ checkFalsy: true })
    .trim()
    .matches(/^[0-9]{10}$/)
    .withMessage('Mobile number must be 10 digits'),
  body('subject')
    .trim()
    .notEmpty()
    .withMessage('Subject is required')
    .isLength({ min: 5 })
    .withMessage('Subject must be at least 5 characters'),
  body('message')
    .trim()
    .notEmpty()
    .withMessage('Message is required')
    .isLength({ min: 10 })
    .withMessage('Message must be at least 10 characters'),
];

module.exports = {
  createContactEnquiryValidator,
};
