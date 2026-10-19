const mongoose = require('mongoose');

const mediaFolderSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    parent: { type: mongoose.Schema.Types.ObjectId, ref: 'MediaFolder', default: null },
  },
  { timestamps: true }
);

mediaFolderSchema.index({ parent: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('MediaFolder', mediaFolderSchema);
