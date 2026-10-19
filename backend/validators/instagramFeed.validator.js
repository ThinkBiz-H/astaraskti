const { body } = require('express-validator');

const instagramFeedValidator = [
  body('link').optional({ nullable: true, checkFalsy: true }).isURL().withMessage('link must be a valid URL'),
  body('caption').optional().trim().isString(),
  body('sortOrder').optional().isInt().withMessage('sortOrder must be an integer'),
  body('isActive').optional().isBoolean(),
];

module.exports = { instagramFeedValidator };
