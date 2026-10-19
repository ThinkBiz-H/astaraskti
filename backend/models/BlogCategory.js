const mongoose = require('mongoose');
const slugify = require('slugify');

const blogCategorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    slug: { type: String, unique: true, lowercase: true, index: true },
    description: { type: String, default: '' },
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
  },
  { timestamps: true }
);

// Callback-style (`next`) middleware was removed in Mongoose 9 — this
// pattern made every save() throw "next is not a function" (see
// PaymentTransaction.js for the same fix and full explanation).
blogCategorySchema.pre('save', function () {
  if (this.isModified('name')) {
    this.slug = slugify(this.name, { lower: true, strict: true });
  }
});

module.exports = mongoose.model('BlogCategory', blogCategorySchema);
