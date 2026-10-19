const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/ApiError");
const { sendResponse } = require("../utils/ApiResponse");
const ApiFeatures = require("../utils/ApiFeatures");
const ConsultationService = require("../models/ConsultationService");
const ConsultationBooking = require("../models/ConsultationBooking");
const Astrologer = require("../models/Astrologer");
const Coupon = require("../models/Coupon");
const { uploadToCloudinary } = require("../services/cloudinary.service");
const { resourceTypeFor } = require("../middlewares/mediaUpload.middleware");
const { notify } = require("../services/notification.service");
const {
  notifyBookingStatusChange,
  notifyAstrologerAssigned,
  notifyReportUploaded,
} = require("../services/consultationBooking.service");
const { assertTransition, TERMINAL_STATUSES } = require("../utils/consultationStatusMachine");
const { getAvailableSlots } = require("../services/availability.service");

// Local to this feature (deliberately not reusing mediaUpload.middleware's
// typeFor, whose return values are constrained by Media.type's enum) —
// matches ConsultationBooking.DELIVERABLE_TYPES exactly.
const deliverableTypeFor = (mimetype) => {
  if (mimetype.startsWith("image/")) return "image";
  if (mimetype.startsWith("audio/")) return "audio";
  if (mimetype.startsWith("video/")) return "video";
  return "pdf";
};

// Maps a service's `type` to the request field that must carry its intake
// details, and the booking field it is stored under. `general` services
// need no specialised detail form.
const DETAIL_FIELD_BY_TYPE = {
  kundli: "kundliDetails",
  horoscope_matching: "horoscopeDetails",
  gemstone: "gemstoneDetails",
  vastu: "vastuDetails",
};

// @desc    Create a consultation booking
// @route   POST /api/v1/consultations/bookings
// @access  Private
const createBooking = asyncHandler(async (req, res) => {
  const {
    serviceId,
    appointmentDate,
    appointmentTime,
    meetingMode,
    contactMobile,
    contactEmail,
    couponCode,
    customerNotes,
  } = req.body;

  const service = await ConsultationService.findById(serviceId);
  if (!service || service.status !== "active") {
    throw new ApiError(404, "Consultation service not found or unavailable");
  }

  const detailField = DETAIL_FIELD_BY_TYPE[service.type];
  let details;
  if (detailField) {
    details = req.body[detailField];
    if (!details) {
      throw new ApiError(400, `${detailField} is required for this service`);
    }
  }

  // Vastu allows optional photo uploads of the property.
  if (service.type === "vastu" && req.files?.length) {
    const uploaded = await Promise.all(
      req.files.map((file) => uploadToCloudinary(file.buffer, "consultations/vastu")),
    );
    details.images = uploaded.map((u) => ({ url: u.url, publicId: u.publicId }));
  }

  // Server-side conflict check — closes the "no double-booking prevention"
  // gap. Re-checks the exact same availability the customer's UI already
  // showed them, right before we commit, since it may have changed
  // (another customer could have taken the slot) between page-load and submit.
  const dateStr = new Date(appointmentDate).toISOString().slice(0, 10);
  const availability = await getAvailableSlots(service._id, dateStr, { emergency: req.body.emergency === true || req.body.emergency === "true" });
  if (availability.isHoliday || availability.closed || availability.fullyBooked) {
    throw new ApiError(400, "This date is not available for booking");
  }
  if (!availability.slots.includes(appointmentTime)) {
    throw new ApiError(409, "The selected time slot is no longer available — please choose another");
  }

  let amount = service.salePrice > 0 ? service.salePrice : service.price;
  // Weekend surcharge, if configured on this service's availability.
  const appointmentDay = new Date(appointmentDate).getDay();
  if ((appointmentDay === 0 || appointmentDay === 6) && availability.weekendPriceMultiplier > 1) {
    amount = Math.round(amount * availability.weekendPriceMultiplier * 100) / 100;
  }
  let couponData = { code: null, discountAmount: 0 };

  if (couponCode) {
    const coupon = await Coupon.findOne({ code: couponCode.toUpperCase() });
    if (!coupon) throw new ApiError(404, "Invalid coupon code");
    if (!coupon.appliesTo?.includes("consultation")) {
      throw new ApiError(400, "This coupon is not valid on consultation bookings");
    }
    const validity = coupon.isValid(amount, req.user._id);
    if (!validity.valid) throw new ApiError(400, validity.reason);

    const discountAmount = coupon.calculateDiscount(amount);
    amount = Math.max(0, amount - discountAmount);
    couponData = { code: coupon.code, discountAmount };
    await coupon.recordUsage(req.user._id);
  }

  const bookingData = {
    user: req.user._id,
    service: service._id,
    serviceSnapshot: {
      name: service.name,
      type: service.type,
      price: service.price,
      duration: service.duration,
    },
    amount,
    coupon: couponData,
    appointmentDate,
    appointmentTime,
    meetingMode,
    contactMobile,
    contactEmail: contactEmail || null,
    customerNotes: customerNotes || null,
    statusHistory: [{ status: "Pending", note: "Booking created" }],
  };
  if (detailField) bookingData[detailField] = details;

  const booking = await ConsultationBooking.create(bookingData);

  await notify({
    user: req.user._id,
    type: "consultation_booking_created",
    title: "Consultation booked",
    message: `Your ${service.name} consultation is booked for ${appointmentDate} at ${appointmentTime}. We'll confirm shortly.`,
    link: `/consultations/bookings/${booking._id}`,
  });

  sendResponse(res, 201, { booking }, "Consultation booked successfully");
});

// @desc    List the logged-in user's consultation bookings
// @route   GET /api/v1/consultations/bookings/my
// @access  Private
const getMyBookings = asyncHandler(async (req, res) => {
  const features = new ApiFeatures(
    ConsultationBooking.find({ user: req.user._id }).populate("service", "name type"),
    req.query,
  )
    .filter()
    .sort()
    .paginate();

  const [bookings, total] = await Promise.all([
    features.query,
    ConsultationBooking.countDocuments({ user: req.user._id }),
  ]);

  sendResponse(
    res,
    200,
    { bookings, count: bookings.length, total, pagination: features.pagination },
    "Your consultation bookings fetched successfully",
  );
});

// @desc    Get a single booking (owner or admin only)
// @route   GET /api/v1/consultations/bookings/:id
// @access  Private
const getBookingById = asyncHandler(async (req, res) => {
  const booking = await ConsultationBooking.findById(req.params.id)
    .populate("service", "name type price duration")
    .populate("user", "name mobile email");

  if (!booking) throw new ApiError(404, "Booking not found");

  if (req.user.role !== "admin" && String(booking.user._id) !== String(req.user._id)) {
    throw new ApiError(403, "You are not authorized to view this booking");
  }

  sendResponse(res, 200, { booking }, "Booking fetched successfully");
});

// @desc    Cancel a booking (owner only, before it's completed)
// @route   POST /api/v1/consultations/bookings/:id/cancel
// @access  Private
const cancelBooking = asyncHandler(async (req, res) => {
  const booking = await ConsultationBooking.findById(req.params.id);
  if (!booking) throw new ApiError(404, "Booking not found");

  if (String(booking.user) !== String(req.user._id) && req.user.role !== "admin") {
    throw new ApiError(403, "You are not authorized to cancel this booking");
  }
  if (["Completed", "Cancelled"].includes(booking.bookingStatus)) {
    throw new ApiError(400, `Booking is already ${booking.bookingStatus.toLowerCase()}`);
  }

  booking.bookingStatus = "Cancelled";
  booking.cancelledAt = new Date();
  booking.cancelReason = req.body.reason || null;
  booking.statusHistory.push({ status: "Cancelled", note: req.body.reason });
  await booking.save();

  await notifyBookingStatusChange(booking, "Cancelled");

  sendResponse(res, 200, { booking }, "Booking cancelled successfully");
});

// @desc    Leave a review on a completed booking
// @route   POST /api/v1/consultations/bookings/:id/review
// @access  Private
const addBookingReview = asyncHandler(async (req, res) => {
  const { rating, comment } = req.body;
  const booking = await ConsultationBooking.findById(req.params.id);
  if (!booking) throw new ApiError(404, "Booking not found");
  if (String(booking.user) !== String(req.user._id)) {
    throw new ApiError(403, "You are not authorized to review this booking");
  }
  if (booking.bookingStatus !== "Completed") {
    throw new ApiError(400, "You can only review a completed consultation");
  }
  if (booking.review?.rating) {
    throw new ApiError(409, "You have already reviewed this booking");
  }

  booking.review = { rating, comment, createdAt: new Date() };
  await booking.save();

  sendResponse(res, 200, { booking }, "Review submitted successfully");
});

// ---------- Admin ----------

// @desc    List all consultation bookings (admin), with filtering
// @route   GET /api/v1/consultations/admin/bookings
// @access  Private/Admin
const getAllBookings = asyncHandler(async (req, res) => {
  // `type` filters by serviceSnapshot.type (e.g. ?type=kundli for the
  // Kundli Requests admin page) — translated here since ApiFeatures.filter()
  // would otherwise try to match a literal top-level `type` field that
  // doesn't exist on this model.
  if (req.query.type) {
    req.query["serviceSnapshot.type"] = req.query.type;
    delete req.query.type;
  }

  const baseQuery = ConsultationBooking.find()
    .populate("service", "name type")
    .populate("user", "name mobile email")
    .populate("assignedAstrologer", "name photo");

  const features = new ApiFeatures(baseQuery, req.query)
    .search(["bookingNumber", "contactMobile", "contactEmail", "serviceSnapshot.name"])
    .filter()
    .sort()
    .paginate();

  const totalCountFeatures = new ApiFeatures(ConsultationBooking.find(), req.query)
    .search(["bookingNumber", "contactMobile", "contactEmail", "serviceSnapshot.name"])
    .filter();

  const [bookings, total] = await Promise.all([
    features.query,
    totalCountFeatures.query.countDocuments(),
  ]);

  sendResponse(
    res,
    200,
    { bookings, count: bookings.length, total, pagination: features.pagination },
    "Consultation bookings fetched successfully",
  );
});

// @desc    Update booking status (admin) — Confirmed/Completed/Cancelled + optional meeting link
// @route   PUT /api/v1/consultations/admin/bookings/:id/status
// @access  Private/Admin
const updateBookingStatus = asyncHandler(async (req, res) => {
  const { bookingStatus, note, meetingLink } = req.body;

  const booking = await ConsultationBooking.findById(req.params.id);
  if (!booking) throw new ApiError(404, "Booking not found");

  let statusChanged = false;
  if (bookingStatus && bookingStatus !== booking.bookingStatus) {
    assertTransition(booking.bookingStatus, bookingStatus);
    booking.bookingStatus = bookingStatus;
    if (bookingStatus === "Completed") booking.completedAt = new Date();
    if (bookingStatus === "Cancelled") {
      booking.cancelledAt = new Date();
      booking.cancelReason = note || booking.cancelReason;
    }
    booking.statusHistory.push({ status: bookingStatus, note });
    statusChanged = true;
  }
  if (meetingLink !== undefined) booking.meetingLink = meetingLink;
  await booking.save();

  if (statusChanged) {
    await notifyBookingStatusChange(booking, bookingStatus);
  }

  sendResponse(res, 200, { booking }, "Booking status updated successfully");
});

// @desc    Update booking payment status (admin — manual record, ahead of gateway integration)
// @route   PUT /api/v1/consultations/admin/bookings/:id/payment
// @access  Private/Admin
const updateBookingPayment = asyncHandler(async (req, res) => {
  const { paymentStatus, paymentMethod } = req.body;

  const booking = await ConsultationBooking.findById(req.params.id);
  if (!booking) throw new ApiError(404, "Booking not found");

  const wasRefunded = paymentStatus === "Refunded" && booking.paymentStatus !== "Refunded";

  if (paymentStatus) booking.paymentStatus = paymentStatus;
  if (paymentMethod) booking.paymentMethod = paymentMethod;
  if (paymentStatus === "Paid") booking.paymentInfo.paidAt = new Date();
  await booking.save();

  // This was the only payment/status path with zero notification before —
  // a customer marked "Refunded" here never found out.
  if (wasRefunded) {
    await notifyBookingStatusChange(booking, "Refunded");
  }

  sendResponse(res, 200, { booking }, "Booking payment status updated successfully");
});

// @desc    Assign (or auto-assign) an astrologer to a booking
// @route   PUT /api/v1/admin/consultation-bookings/:id/assign
// @access  Private/Admin
const assignAstrologer = asyncHandler(async (req, res) => {
  const { astrologerId, note } = req.body;
  const booking = await ConsultationBooking.findById(req.params.id);
  if (!booking) throw new ApiError(404, "Booking not found");

  let astrologer;
  if (astrologerId) {
    astrologer = await Astrologer.findOne({ _id: astrologerId, isDeleted: false, status: "active" });
    if (!astrologer) throw new ApiError(404, "Astrologer not found or inactive");
  } else {
    // Auto assignment — pick the active astrologer with the fewest
    // currently-open (non-terminal) bookings. A real, scoped
    // least-busy algorithm, not a fake/random button.
    const astrologers = await Astrologer.find({ isDeleted: false, status: "active" });
    if (astrologers.length === 0) throw new ApiError(400, "No active astrologers available for auto-assignment");

    const loadCounts = await ConsultationBooking.aggregate([
      { $match: { assignedAstrologer: { $in: astrologers.map((a) => a._id) }, bookingStatus: { $nin: TERMINAL_STATUSES } } },
      { $group: { _id: "$assignedAstrologer", count: { $sum: 1 } } },
    ]);
    const loadMap = new Map(loadCounts.map((l) => [String(l._id), l.count]));
    astrologer = astrologers.sort((a, b) => (loadMap.get(String(a._id)) || 0) - (loadMap.get(String(b._id)) || 0))[0];
  }

  booking.assignedAstrologer = astrologer._id;
  booking.assignmentHistory.push({ astrologer: astrologer._id, assignedBy: req.user._id, note });
  await booking.save();

  await notifyAstrologerAssigned(booking, astrologer.name);

  sendResponse(res, 200, { booking }, "Astrologer assigned successfully");
});

/** Recomputes ConsultationService.rating/numReviews from every Approved
 * review across all its bookings — mirrors Product's recalculateRating
 * (review.controller.js), just aggregated across a separate collection
 * since consultation reviews live per-booking, not embedded on the service. */
const recalculateServiceRating = async (serviceId) => {
  const [agg] = await ConsultationBooking.aggregate([
    { $match: { service: serviceId, "review.status": "Approved", "review.rating": { $exists: true } } },
    { $group: { _id: null, avg: { $avg: "$review.rating" }, count: { $sum: 1 } } },
  ]);
  await ConsultationService.findByIdAndUpdate(serviceId, {
    rating: agg ? Math.round(agg.avg * 10) / 10 : 0,
    numReviews: agg ? agg.count : 0,
  });
};

// @desc    Moderate a booking's review (approve/reject/feature)
// @route   PATCH /api/v1/admin/consultation-bookings/:id/review
// @access  Private/Admin
const moderateReview = asyncHandler(async (req, res) => {
  const { status, isFeatured } = req.body;
  const booking = await ConsultationBooking.findById(req.params.id);
  if (!booking) throw new ApiError(404, "Booking not found");
  if (!booking.review?.rating) throw new ApiError(404, "This booking has no review to moderate");

  if (status && ["Pending", "Approved", "Rejected"].includes(status)) {
    booking.review.status = status;
  }
  if (isFeatured !== undefined) booking.review.isFeatured = !!isFeatured;
  await booking.save();

  await recalculateServiceRating(booking.service);

  sendResponse(res, 200, { booking }, "Review moderated successfully");
});

// @desc    Upload a deliverable (Kundli report PDF/image/audio/video) to a booking
// @route   POST /api/v1/admin/consultation-bookings/:id/deliverables
// @access  Private/Admin
const uploadDeliverable = asyncHandler(async (req, res) => {
  const booking = await ConsultationBooking.findById(req.params.id);
  if (!booking) throw new ApiError(404, "Booking not found");
  if (!req.files?.length) throw new ApiError(400, "At least one file is required");

  const uploaded = await Promise.all(
    req.files.map((file) =>
      uploadToCloudinary(file.buffer, "consultations/deliverables", { resourceType: resourceTypeFor(file.mimetype) }).then((result) => ({
        url: result.url,
        publicId: result.publicId,
        type: deliverableTypeFor(file.mimetype),
        label: req.body.label || file.originalname,
        uploadedBy: req.user._id,
      })),
    ),
  );

  booking.deliverables.push(...uploaded);
  await booking.save();

  await notifyReportUploaded(booking);

  sendResponse(res, 201, { booking }, "Deliverable uploaded successfully");
});

module.exports = {
  createBooking,
  getMyBookings,
  getBookingById,
  cancelBooking,
  addBookingReview,
  getAllBookings,
  updateBookingStatus,
  updateBookingPayment,
  assignAstrologer,
  moderateReview,
  uploadDeliverable,
};
