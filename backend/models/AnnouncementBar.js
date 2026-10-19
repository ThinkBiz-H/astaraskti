const mongoose = require('mongoose');

/**
 * Supports multiple simultaneously-active announcements (frontend rotates
 * through them) — `sortOrder` controls rotation order, `startDate`/`endDate`
 * let an admin schedule one without needing to remember to activate/
 * deactivate it manually.
 */
const announcementBarSchema = new mongoose.Schema(
  {
    text: { type: String, required: true, trim: true },
    icon: { type: String, default: '' }, // a lucide-react icon name, rendered by the frontend
    backgroundColor: { type: String, default: '#1F2937' },
    textColor: { type: String, default: '#FFFFFF' },
    buttonText: { type: String, default: '' },
    buttonLink: { type: String, default: '' },
    scrollSpeed: { type: Number, default: 40, min: 5 }, // seconds for one full marquee loop; lower = faster
    repeat: { type: Boolean, default: true }, // marquee loops continuously vs. showing once statically
    startDate: { type: Date, default: null },
    endDate: { type: Date, default: null },
    sortOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

announcementBarSchema.index({ isActive: 1, sortOrder: 1 });

module.exports = mongoose.model('AnnouncementBar', announcementBarSchema);
