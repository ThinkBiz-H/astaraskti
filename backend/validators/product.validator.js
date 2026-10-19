const { body } = require("express-validator");

const objectIdArrayValidator = (field) =>
  body(field)
    .optional()
    .custom((value) => {
      const arr = typeof value === "string" ? JSON.parse(value) : value;
      if (!Array.isArray(arr)) throw new Error(`${field} must be an array of product ids`);
      return arr.every((id) => /^[0-9a-fA-F]{24}$/.test(id));
    })
    .withMessage((_, { path }) => `${path} must be an array of valid product ids`);

const createProductValidator = [
  body("title").trim().notEmpty().withMessage("Title is required"),
  body("category")
    .notEmpty()
    .withMessage("Category is required")
    .isMongoId()
    .withMessage("Invalid category id"),
  body("price")
    .isFloat({ min: 0 })
    .withMessage("Price must be a positive number"),
  body("stock")
    .isInt({ min: 0 })
    .withMessage("Stock must be a non-negative integer"),
  body("salePrice")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Sale price must be a positive number"),
  body("brand").optional().isMongoId().withMessage("Invalid brand id"),
  body("unit").optional().isMongoId().withMessage("Invalid unit id"),
  body("unitValue").optional().isFloat({ min: 0 }).withMessage("unitValue must be a positive number"),
  body("weight").optional().isFloat({ min: 0 }).withMessage("Weight must be a positive number"),
  body("minOrderQuantity").optional().isInt({ min: 1 }).withMessage("minOrderQuantity must be at least 1"),
  body("maxOrderQuantity").optional().isInt({ min: 1 }).withMessage("maxOrderQuantity must be at least 1"),
  objectIdArrayValidator("relatedProducts"),
  objectIdArrayValidator("crossSell"),
  objectIdArrayValidator("upSell"),
];

const updateProductValidator = [
  body("price")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Price must be a positive number"),
  // Note: `stock` is intentionally NOT validated/accepted here — it's
  // excluded from updateProduct (see product.controller.js) and must be
  // changed via POST /inventory/adjust so it's logged and stays in sync.
  body("salePrice")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Sale price must be a positive number"),
  body("unit").optional().isMongoId().withMessage("Invalid unit id"),
  body("unitValue").optional().isFloat({ min: 0 }).withMessage("unitValue must be a positive number"),
  body("weight").optional().isFloat({ min: 0 }).withMessage("Weight must be a positive number"),
  objectIdArrayValidator("relatedProducts"),
  objectIdArrayValidator("crossSell"),
  objectIdArrayValidator("upSell"),
];

module.exports = { createProductValidator, updateProductValidator };
