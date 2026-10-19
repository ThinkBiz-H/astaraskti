const mongoose = require("mongoose");
const slugify = require("slugify");

const reviewSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, trim: true },
    images: [{ url: String, publicId: String }],
    isVerifiedPurchase: { type: Boolean, default: false },
  },
  { timestamps: true },
);

const productSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    slug: { type: String, unique: true, lowercase: true, index: true },
    shortDescription: { type: String, trim: true },
    description: { type: String, trim: true },
    SKU: { type: String, unique: true, sparse: true },
    barcode: { type: String },

    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true,
    },
    brand: { type: mongoose.Schema.Types.ObjectId, ref: "Brand" },

    // Phase 3 — dynamic unit of measure (e.g. Kg, Litre, Piece). unitValue
    // supports decimals (0.5 KG, 7.5 KG) per spec. Optional so existing
    // products created before this field existed are unaffected.
    unit: { type: mongoose.Schema.Types.ObjectId, ref: "Unit", default: null },
    unitValue: { type: Number, min: 0, default: 1 },

    price: { type: Number, required: true, min: 0 },
    salePrice: { type: Number, min: 0 },
    stock: { type: Number, required: true, default: 0, min: 0 },

    images: [{ url: String, publicId: String }],
    thumbnail: { url: String, publicId: String },

    // Downloadable files (spec sheets, care instructions, certificates) and
    // an optional product video — additive "Dynamic Media" fields.
    documents: [{ url: String, publicId: String, name: String }],
    videoUrl: { type: String, default: "" },

    tags: [{ type: String }],
    attributes: [{ key: String, value: String }],
    colors: [{ type: String }],
    sizes: [{ type: String }],

    // Phase 5 — set true once the product has ≥1 Variant document (see
    // models/Variant.js). A product with hasVariants=false is still sold
    // directly off its own price/salePrice/stock, exactly as before —
    // this is purely additive and doesn't change existing simple products.
    hasVariants: { type: Boolean, default: false },

    // Cross-merchandising — plain Product refs, admin-curated.
    relatedProducts: [{ type: mongoose.Schema.Types.ObjectId, ref: "Product" }],
    crossSell: [{ type: mongoose.Schema.Types.ObjectId, ref: "Product" }],
    upSell: [{ type: mongoose.Schema.Types.ObjectId, ref: "Product" }],

    // Shipping / warehouse details
    weight: { type: Number, min: 0 }, // kg
    dimensions: {
      length: { type: Number, min: 0 },
      width: { type: Number, min: 0 },
      height: { type: Number, min: 0 },
      unit: { type: String, enum: ["cm", "in"], default: "cm" },
    },
    shippingClass: { type: String, default: "" }, // free-text, admin-defined (e.g. "Fragile", "Oversized")

    minOrderQuantity: { type: Number, min: 1, default: 1 },
    maxOrderQuantity: { type: Number, min: 1 },

    warranty: { type: String, default: "" },
    returnPolicy: { type: String, default: "" },

    rating: { type: Number, default: 0, min: 0, max: 5 },
    numReviews: { type: Number, default: 0 },
    reviews: [reviewSchema],

    // Additive counters used for "popularity" sort and recommendation rails
    // (trending / best sellers). salesCount is incremented whenever an order
    // containing this product is paid; viewCount on each product-detail view.
    salesCount: { type: Number, default: 0, min: 0 },
    viewCount: { type: Number, default: 0, min: 0 },

    featured: { type: Boolean, default: false },
    status: {
      type: String,
      enum: ["active", "inactive", "draft"],
      default: "active",
    },

    seoTitle: { type: String },
    seoDescription: { type: String },
    seoKeywords: [{ type: String }],

    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

productSchema.pre("save", function () {
  if (this.isModified("title")) {
    this.slug =
      slugify(this.title, {
        lower: true,
        strict: true,
      }) +
      "-" +
      Date.now().toString().slice(-5);
  }
}); 
productSchema.index({ title: "text", description: "text", tags: "text" });
productSchema.index({ category: 1, brand: 1, price: 1, status: 1 });
productSchema.index({ salesCount: -1 });
productSchema.index({ viewCount: -1 });
productSchema.index({ rating: -1, numReviews: -1 });
productSchema.index({ unit: 1 });

// Virtual populate — this product's variants (see models/Variant.js).
// Use with .populate('variants').
productSchema.virtual("variants", {
  ref: "Variant",
  localField: "_id",
  foreignField: "product",
});

productSchema.set("toJSON", { virtuals: true });
productSchema.set("toObject", { virtuals: true });

// Excludes soft-deleted products by default in common queries via statics
productSchema.statics.findActive = function (filter = {}) {
  return this.find({ ...filter, isDeleted: false });
};

module.exports = mongoose.model("Product", productSchema);
