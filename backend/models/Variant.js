const mongoose = require("mongoose");

/**
 * Phase 5 — Variant Engine. A separate collection (not embedded on Product)
 * so that:
 *   - each variant's SKU can be globally unique via a top-level index
 *   - inventory operations (Phase 6) can query/update stock across variants
 *     directly and efficiently, without reaching into every product's
 *     subdocument array
 *   - a product can be queried for "all its variants" via the `variants`
 *     virtual added on Product (populate('variants')), same pattern as
 *     Category's `children` virtual from Phase 1
 *
 * `attributes` is what makes a variant distinct — e.g.
 * [{key:'Weight', value:'1kg'}, {key:'Color', value:'Black'}] — reusing the
 * same {key,value} shape as Product.attributes for consistency, rather than
 * inventing a second dynamic-attribute mechanism.
 */
const variantSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
      index: true,
    },

    attributes: [
      {
        key: { type: String, required: true },
        value: { type: String, required: true },
      },
    ],

    sku: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    barcode: {
      type: String,
      default: "",
    },

    // ✅ Variant Price
    price: {
      type: Number,
      required: true,
      min: 0,
    },

    salePrice: {
      type: Number,
      min: 0,
    },

    // ✅ Variant Stock
    stock: {
      type: Number,
      default: 0,
      min: 0,
    },

    // ✅ Unit
    unit: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Unit",
    },

    // ✅ Unit Value
    unitValue: {
      type: Number,
      required: true,
    },

    weight: {
      type: Number,
      min: 0,
    },

    dimensions: {
      length: Number,
      width: Number,
      height: Number,
      unit: {
        type: String,
        enum: ["cm", "in"],
        default: "cm",
      },
    },

    images: [
      {
        url: String,
        publicId: String,
      },
    ],

    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },

    isDefault: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  },
);

variantSchema.index({ product: 1, status: 1 });

module.exports = mongoose.model("Variant", variantSchema);
