const { body } = require('express-validator');

const folderValidator = [body('name').trim().notEmpty().withMessage('Folder name is required')];

module.exports = { folderValidator };
