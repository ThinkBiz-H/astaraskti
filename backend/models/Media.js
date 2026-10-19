const mongoose = require('mongoose');

const mediaSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    publicId: { type: String, required: true },
    folder: { type: mongoose.Schema.Types.ObjectId, ref: 'MediaFolder', default: null },
    type: { type: String, enum: ['image', 'video', 'raw'], default: 'image' },
    originalName: { type: String, default: '' },
    mimeType: { type: String, default: '' },
    size: { type: Number, default: 0 }, // bytes
    width: { type: Number, default: null },
    height: { type: Number, default: null },
    format: { type: String, default: '' },
    tags: [{ type: String, trim: true }],
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

mediaSchema.index({ folder: 1 });
mediaSchema.index({ originalName: 'text', tags: 'text' });

module.exports = mongoose.model('Media', mediaSchema);
