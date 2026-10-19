const { body } = require('express-validator');

const newsletterSubscribeValidator = [
  body('email')
    .trim()
    .isEmail()
    .withMessage('Valid email is required')
    .normalizeEmail(),
  body('name')
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ min: 2 })
    .withMessage('Name must be at least 2 characters if provided'),
];

module.exports = {
  newsletterSubscribeValidator,
};
