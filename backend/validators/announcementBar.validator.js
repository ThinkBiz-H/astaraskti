const { body } = require('express-validator');

const announcementValidator = [
  body('text').trim().notEmpty().withMessage('Announcement text is required'),
  body('buttonLink').optional({ nullable: true, checkFalsy: true }).isURL({ require_tld: false }).withMessage('buttonLink must be a valid URL'),
  body('scrollSpeed').optional().isInt({ min: 5 }).withMessage('scrollSpeed must be at least 5 seconds'),
  body('repeat').optional().isBoolean(),
  body('startDate').optional({ nullable: true }).isISO8601().withMessage('startDate must be a valid date'),
  body('endDate').optional({ nullable: true }).isISO8601().withMessage('endDate must be a valid date'),
  body('sortOrder').optional().isInt().withMessage('sortOrder must be an integer'),
  body('isActive').optional().isBoolean(),
];

module.exports = { announcementValidator };
