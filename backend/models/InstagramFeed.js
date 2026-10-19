const mongoose = require('mongoose');

const instagramFeedSchema = new mongoose.Schema(
  {
    image: {
      url: { type: String, required: true },
      publicId: { type: String, default: '' },
    },
    link: { type: String, default: '' }, // URL to the Instagram post/profile
    caption: { type: String, default: '', trim: true },
    sortOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

instagramFeedSchema.index({ isActive: 1, sortOrder: 1 });

module.exports = mongoose.model('InstagramFeed', instagramFeedSchema);
