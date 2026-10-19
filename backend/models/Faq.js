const mongoose = require('mongoose');

const faqSchema = new mongoose.Schema(
  {
    question: { type: String, required: true, trim: true },
    answer: { type: String, required: true },
    category: { type: String, default: '', trim: true }, // free text grouping (e.g. "Shipping", "Returns") — admin-defined, not a fixed list
    sortOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

faqSchema.index({ isActive: 1, category: 1, sortOrder: 1 });

module.exports = mongoose.model('Faq', faqSchema);
