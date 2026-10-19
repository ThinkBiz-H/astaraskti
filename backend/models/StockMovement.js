const mongoose = require('mongoose');

/**
 * Immutable ledger — every inventory change writes exactly one of these,
 * never updated afterward. This is what makes "stock movement history" a
 * real audit trail rather than just a mutable counter.
 */
const stockMovementSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    variant: { type: mongoose.Schema.Types.ObjectId, ref: 'Variant', default: null },
    warehouse: { type: mongoose.Schema.Types.ObjectId, ref: 'Warehouse', required: true },
    unit: { type: mongoose.Schema.Types.ObjectId, ref: 'Unit', default: null }, // snapshot of the product's unit at the time

    type: {
      type: String,
      required: true,
      enum: [
        'purchase', // stock received in
        'sale', // deducted for a paid/confirmed order
        'return', // customer return, added back
        'adjustment', // manual correction (+/-)
        'transfer_in', // received from another warehouse
        'transfer_out', // sent to another warehouse
        'reservation', // held for a pending order (does not change `available`+`reserved` total)
        'release', // reservation released back to available
        'damaged', // moved into damaged bucket
      ],
    },

    quantity: { type: Number, required: true }, // signed delta applied to `available` (or the relevant bucket)
    previousStock: { type: Number, required: true },
    newStock: { type: Number, required: true },

    referenceType: { type: String, enum: ['order', 'manual', 'transfer', 'purchase', 'system'], default: 'manual' },
    referenceId: { type: mongoose.Schema.Types.ObjectId, default: null }, // e.g. the Order this sale/return relates to

    note: { type: String, default: '' },
    performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }, // null for system-originated (e.g. webhook)
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

stockMovementSchema.index({ product: 1, variant: 1, createdAt: -1 });
stockMovementSchema.index({ warehouse: 1, createdAt: -1 });
stockMovementSchema.index({ referenceType: 1, referenceId: 1 });

module.exports = mongoose.model('StockMovement', stockMovementSchema);
