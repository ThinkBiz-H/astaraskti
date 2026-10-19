const { body } = require('express-validator');

const templateValidator = [
  body('type').trim().notEmpty().withMessage('type is required'),
  body('channel').isIn(['in_app', 'email', 'sms', 'push']).withMessage('channel must be in_app, email, sms, or push'),
  body('body').trim().notEmpty().withMessage('body is required'),
];

const broadcastValidator = [
  body('title').trim().notEmpty().withMessage('title is required'),
  body('message').trim().notEmpty().withMessage('message is required'),
  body('audience').optional().isIn(['all', 'admins']).withMessage('audience must be "all" or "admins"'),
];

module.exports = { templateValidator, broadcastValidator };
