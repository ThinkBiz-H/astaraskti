const mongoose = require('mongoose');
const slugify = require('slugify');

/**
 * Fully admin-managed units of measure (kg, ml, piece, box, ...). Nothing
 * about units is hardcoded elsewhere in the app — Product just holds an
 * ObjectId ref to one of these, so adding a new unit never requires a code
 * change or deploy.
 */
const unitSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true }, // e.g. "Kilogram"
    slug: { type: String, unique: true, lowercase: true, index: true },
    symbol: { type: String, required: true, trim: true }, // e.g. "kg" — shown next to the value
    allowDecimal: { type: Boolean, default: true }, // false for strictly whole-count units like "Piece"
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
  },
  { timestamps: true }
);

unitSchema.index({ name: 1 }, { unique: true });

// Callback-style (`next`) middleware was removed in Mongoose 9 — this
// pattern made every save() throw "next is not a function" (see
// PaymentTransaction.js for the same fix and full explanation).
unitSchema.pre('save', function () {
  if (this.isModified('name')) {
    this.slug = slugify(this.name, { lower: true, strict: true });
  }
});

module.exports = mongoose.model('Unit', unitSchema);
