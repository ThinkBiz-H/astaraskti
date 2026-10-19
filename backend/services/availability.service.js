const ConsultationAvailability = require("../models/ConsultationAvailability");
const ConsultationBooking = require("../models/ConsultationBooking");
const ConsultationService = require("../models/ConsultationService");
const ApiError = require("../utils/ApiError");

// Statuses that still hold a slot — Cancelled/Rejected free it back up.
const SLOT_BLOCKING_STATUSES = ["Pending", "Confirmed", "Accepted", "Rescheduled", "Waiting", "Started", "Completed", "No Show"];

const DEFAULTS = {
  workingDays: [0, 1, 2, 3, 4, 5, 6],
  workingHours: { start: "09:00", end: "18:00" },
  breakTime: { start: null, end: null },
  holidays: [],
  slotDurationMinutes: null,
  maxDailyBookings: 20,
  advanceBookingDays: 30,
  bufferMinutes: 0,
  emergencyEnabled: false,
  weekendPriceMultiplier: 1,
};

/** Returns the service's availability config, or the defaults above if none has been configured yet. */
const getAvailability = async (serviceId) => {
  const doc = await ConsultationAvailability.findOne({ service: serviceId });
  return doc ? doc.toObject() : { service: serviceId, ...DEFAULTS };
};

const minutesToTime = (mins) => {
  const h = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
};
const timeToMinutes = (time) => {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
};

const isSameDay = (a, b) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

const isHoliday = (date, holidays) => (holidays || []).some((h) => isSameDay(new Date(h), date));

/**
 * Computes real available time slots for a service on a given date —
 * working hours minus break time minus buffer minus already-booked slots,
 * capped by maxDailyBookings, respecting holidays/advance-booking window.
 * `emergency=true` bypasses working-days/hours (only when the service's
 * availability has emergencyEnabled) and offers slots from now until
 * midnight instead.
 */
const getAvailableSlots = async (serviceId, dateStr, { emergency = false } = {}) => {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    throw new ApiError(400, "A valid date (YYYY-MM-DD) is required");
  }

  const date = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(date.getTime())) throw new ApiError(400, "Invalid date");

  const service = await ConsultationService.findOne({ _id: serviceId, isDeleted: false }).select("duration");
  if (!service) throw new ApiError(404, "Consultation service not found");

  const availability = await getAvailability(serviceId);
  const now = new Date();
  const isToday = isSameDay(date, now);
  const dayOfWeek = date.getDay();

  const result = { date: dateStr, slots: [], fullyBooked: false, isHoliday: false, closed: false, weekendPriceMultiplier: availability.weekendPriceMultiplier };

  if (isHoliday(date, availability.holidays)) {
    result.isHoliday = true;
    return result;
  }

  const useEmergency = emergency && availability.emergencyEnabled;

  if (!useEmergency) {
    if (!availability.workingDays.includes(dayOfWeek)) {
      result.closed = true;
      return result;
    }
    const maxAdvanceDate = new Date(now);
    maxAdvanceDate.setDate(maxAdvanceDate.getDate() + availability.advanceBookingDays);
    if (date > maxAdvanceDate) {
      result.closed = true;
      return result;
    }
  }

  // Existing bookings for this service on this date, that still hold a slot.
  const dayStart = new Date(date);
  const dayEnd = new Date(date);
  dayEnd.setHours(23, 59, 59, 999);
  const existingBookings = await ConsultationBooking.find({
    service: serviceId,
    appointmentDate: { $gte: dayStart, $lte: dayEnd },
    bookingStatus: { $in: SLOT_BLOCKING_STATUSES },
  }).select("appointmentTime");

  if (existingBookings.length >= availability.maxDailyBookings) {
    result.fullyBooked = true;
    return result;
  }

  const bookedMinutes = existingBookings.map((b) => timeToMinutes(b.appointmentTime));
  const buffer = availability.bufferMinutes || 0;

  const slotDuration = availability.slotDurationMinutes || service.duration || 30;

  let startMinutes;
  let endMinutes;
  if (useEmergency) {
    startMinutes = isToday ? now.getHours() * 60 + now.getMinutes() + buffer : 0;
    endMinutes = 24 * 60;
  } else {
    startMinutes = timeToMinutes(availability.workingHours.start);
    endMinutes = timeToMinutes(availability.workingHours.end);
    if (isToday) startMinutes = Math.max(startMinutes, now.getHours() * 60 + now.getMinutes() + buffer);
  }

  const breakStart = availability.breakTime?.start ? timeToMinutes(availability.breakTime.start) : null;
  const breakEnd = availability.breakTime?.end ? timeToMinutes(availability.breakTime.end) : null;

  const slots = [];
  for (let t = startMinutes; t + slotDuration <= endMinutes; t += slotDuration) {
    if (breakStart !== null && breakEnd !== null && t < breakEnd && t + slotDuration > breakStart) continue; // overlaps break
    const conflictsWithExisting = bookedMinutes.some((b) => Math.abs(b - t) < Math.max(slotDuration, buffer));
    if (conflictsWithExisting) continue;
    slots.push(minutesToTime(t));
  }

  result.slots = slots;
  return result;
};

module.exports = {
  getAvailability,
  getAvailableSlots,
  SLOT_BLOCKING_STATUSES,
};
