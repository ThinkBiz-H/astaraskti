const { notify } = require("./notification.service");
const logger = require("../utils/logger");

/**
 * Single source of truth for "what does the customer see when booking
 * status X happens" — mirrors order.service.js's notifyOrderStatusChange
 * exactly. Every status-changing controller calls this instead of writing
 * its own notify() copy, so the wording only ever lives here.
 */
const BOOKING_STATUS_NOTIFICATIONS = {
  Confirmed: { type: "consultation_confirmed", title: "✅ Booking Confirmed", message: (b) => `Your consultation booking #${b.bookingNumber} has been confirmed.` },
  Accepted: { type: "consultation_update", title: "🙌 Booking Accepted", message: (b) => `Your consultation booking #${b.bookingNumber} has been accepted.` },
  Rejected: { type: "consultation_update", title: "❌ Booking Rejected", message: (b) => `Your consultation booking #${b.bookingNumber} could not be accepted.` },
  Rescheduled: { type: "consultation_update", title: "🔄 Rescheduled", message: (b) => `Your consultation booking #${b.bookingNumber} has been rescheduled.` },
  Waiting: { type: "consultation_update", title: "⏳ In Queue", message: (b) => `Your consultation booking #${b.bookingNumber} is next up — please be ready.` },
  Started: { type: "consultation_update", title: "🔔 Consultation Started", message: (b) => `Your consultation for booking #${b.bookingNumber} has started.` },
  Completed: { type: "consultation_completed", title: "🎉 Consultation Completed", message: (b) => `Your consultation for booking #${b.bookingNumber} has been completed.` },
  Cancelled: { type: "consultation_cancelled", title: "❌ Booking Cancelled", message: (b) => `Your consultation booking #${b.bookingNumber} has been cancelled.` },
  Refunded: { type: "consultation_refunded", title: "💰 Refund Completed", message: (b) => `Refund for consultation booking #${b.bookingNumber} has been credited.` },
  "No Show": { type: "consultation_update", title: "⚠️ Missed Consultation", message: (b) => `You missed your scheduled consultation for booking #${b.bookingNumber}.` },
};

const notifyBookingStatusChange = async (booking, status) => {
  const copy = BOOKING_STATUS_NOTIFICATIONS[status];
  if (!copy) return; // Pending: no notification here — createBooking already sends consultation_booking_created
  try {
    await notify({
      user: booking.user._id || booking.user,
      type: copy.type,
      title: copy.title,
      message: copy.message(booking),
      link: `/account/consultations/${booking._id}`,
      relatedConsultationBooking: booking._id,
    });
  } catch (err) {
    logger.error(`Non-fatal: consultation status notification failed for booking ${booking._id}: ${err.message}`);
  }
};

const notifyAstrologerAssigned = async (booking, astrologerName) => {
  try {
    await notify({
      user: booking.user._id || booking.user,
      type: "consultation_assigned",
      title: "👤 Astrologer Assigned",
      message: `${astrologerName} has been assigned to your consultation booking #${booking.bookingNumber}.`,
      link: `/account/consultations/${booking._id}`,
      relatedConsultationBooking: booking._id,
    });
  } catch (err) {
    logger.error(`Non-fatal: astrologer-assigned notification failed for booking ${booking._id}: ${err.message}`);
  }
};

const notifyReportUploaded = async (booking) => {
  try {
    await notify({
      user: booking.user._id || booking.user,
      type: "consultation_report_uploaded",
      title: "📄 Report Ready",
      message: `Your report for consultation booking #${booking.bookingNumber} is ready to download.`,
      link: `/account/kundli-reports`,
      relatedConsultationBooking: booking._id,
    });
  } catch (err) {
    logger.error(`Non-fatal: report-uploaded notification failed for booking ${booking._id}: ${err.message}`);
  }
};

module.exports = {
  notifyBookingStatusChange,
  notifyAstrologerAssigned,
  notifyReportUploaded,
};
