const mongoose = require("mongoose");

/**
 * One document per ConsultationService — the real inputs to
 * services/availability.service.js's slot computation. A service with no
 * document here falls back to sane defaults (see getOrCreateAvailability)
 * rather than failing, so existing services keep working unchanged until
 * an admin explicitly configures availability for them.
 */
const consultationAvailabilitySchema = new mongoose.Schema(
  {
    service: { type: mongoose.Schema.Types.ObjectId, ref: "ConsultationService", required: true, unique: true },

    workingDays: { type: [Number], default: [0, 1, 2, 3, 4, 5, 6] }, // 0=Sunday .. 6=Saturday
    workingHours: {
      start: { type: String, default: "09:00" }, // "HH:mm"
      end: { type: String, default: "18:00" },
    },
    breakTime: {
      start: { type: String, default: null },
      end: { type: String, default: null },
    },
    holidays: [{ type: Date }],

    // null = fall back to the service's own `duration` field.
    slotDurationMinutes: { type: Number, min: 5, default: null },
    maxDailyBookings: { type: Number, min: 1, default: 20 },
    advanceBookingDays: { type: Number, min: 0, default: 30 },
    bufferMinutes: { type: Number, min: 0, default: 0 },

    emergencyEnabled: { type: Boolean, default: false },
    weekendPriceMultiplier: { type: Number, min: 1, default: 1 },
  },
  { timestamps: true },
);

module.exports = mongoose.model("ConsultationAvailability", consultationAvailabilitySchema);
