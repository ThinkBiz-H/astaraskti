const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/ApiError");
const { sendResponse } = require("../utils/ApiResponse");
const ConsultationAvailability = require("../models/ConsultationAvailability");
const availabilityService = require("../services/availability.service");

// @desc    Get real available time slots for a service on a given date —
//          this is what makes "Choose Time Slot" in the booking flow real.
// @route   GET /api/v1/consultations/services/:id/availability?date=YYYY-MM-DD&emergency=true
// @access  Public
const getSlots = asyncHandler(async (req, res) => {
  const result = await availabilityService.getAvailableSlots(req.params.id, req.query.date, {
    emergency: req.query.emergency === "true",
  });
  sendResponse(res, 200, result, "Available slots fetched successfully");
});

// @desc    Get a service's availability configuration (admin) — returns
//          defaults if none has been saved yet, so the admin form always
//          has something to render/edit.
// @route   GET /api/v1/admin/consultation-availability/:serviceId
// @access  Private/Admin
const getAvailabilityConfig = asyncHandler(async (req, res) => {
  const availability = await availabilityService.getAvailability(req.params.serviceId);
  sendResponse(res, 200, { availability }, "Availability fetched successfully");
});

// @desc    Create/update a service's availability configuration (upsert)
// @route   PUT /api/v1/admin/consultation-availability/:serviceId
// @access  Private/Admin
const updateAvailabilityConfig = asyncHandler(async (req, res) => {
  const fields = [
    "workingDays", "workingHours", "breakTime", "holidays",
    "slotDurationMinutes", "maxDailyBookings", "advanceBookingDays",
    "bufferMinutes", "emergencyEnabled", "weekendPriceMultiplier",
  ];
  const update = {};
  fields.forEach((f) => {
    if (req.body[f] !== undefined) update[f] = req.body[f];
  });
  if (Object.keys(update).length === 0) {
    throw new ApiError(400, "No availability fields provided");
  }

  const availability = await ConsultationAvailability.findOneAndUpdate(
    { service: req.params.serviceId },
    { $set: update, $setOnInsert: { service: req.params.serviceId } },
    { new: true, upsert: true, runValidators: true },
  );

  sendResponse(res, 200, { availability }, "Availability updated successfully");
});

module.exports = { getSlots, getAvailabilityConfig, updateAvailabilityConfig };
