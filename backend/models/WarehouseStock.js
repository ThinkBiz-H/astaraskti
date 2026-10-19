const mongoose = require("mongoose");

const warehouseStockSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    variant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Variant",
      default: null,
    }, // null = non-variant product
    warehouse: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Warehouse",
      required: true,
    },

    available: { type: Number, default: 0 },
    reserved: { type: Number, default: 0, min: 0 },
    damaged: { type: Number, default: 0, min: 0 },
    incoming: { type: Number, default: 0, min: 0 },

    lowStockThreshold: { type: Number, default: 10, min: 0 },
  },
  { timestamps: true },
);

// One stock record per product-or-variant per warehouse — never two rows
// for the same combination.
warehouseStockSchema.index(
  { product: 1, variant: 1, warehouse: 1 },
  { unique: true },
);
warehouseStockSchema.index({ warehouse: 1 });

warehouseStockSchema.virtual("isLowStock").get(function () {
  return this.available <= this.lowStockThreshold;
});
warehouseStockSchema.virtual("isOutOfStock").get(function () {
  return this.available <= 0;
});
warehouseStockSchema.set("toJSON", { virtuals: true });
warehouseStockSchema.set("toObject", { virtuals: true });

module.exports = mongoose.model("WarehouseStock", warehouseStockSchema);
