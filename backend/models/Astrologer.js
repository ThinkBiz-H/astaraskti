const mongoose = require("mongoose");

/**
 * Admin-managed profile record only — astrologers do not log in or have
 * their own portal/dashboard (confirmed scope). Used purely for assignment
 * and display (e.g. "Assigned Astrologer" on a booking).
 */
const astrologerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    photo: { url: { type: String, default: "" }, publicId: { type: String, default: "" } },
    expertise: [{ type: String, trim: true }], // e.g. ["Vedic Astrology", "Vastu", "Numerology"]
    bio: { type: String, default: "" },
    experienceYears: { type: Number, min: 0, default: 0 },
    languages: [{ type: String, trim: true }],
    status: { type: String, enum: ["active", "inactive"], default: "active" },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

astrologerSchema.index({ status: 1 });

astrologerSchema.statics.findActive = function (filter = {}) {
  return this.find({ ...filter, isDeleted: false });
};

module.exports = mongoose.model("Astrologer", astrologerSchema);
