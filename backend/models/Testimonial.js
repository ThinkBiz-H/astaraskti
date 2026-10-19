const mongoose = require('mongoose');

const testimonialSchema = new mongoose.Schema(
  {
    customerName: { type: String, required: true, trim: true },
    designation: { type: String, default: '', trim: true }, // e.g. "Verified Customer", "Mumbai"
    content: { type: String, required: true, trim: true },
    rating: { type: Number, min: 1, max: 5, default: 5 },
    customerImage: {
      url: { type: String, default: '' },
      publicId: { type: String, default: '' },
    },
    sortOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

testimonialSchema.index({ isActive: 1, sortOrder: 1 });

module.exports = mongoose.model('Testimonial', testimonialSchema);
