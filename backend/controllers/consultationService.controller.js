const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/ApiError");
const { sendResponse } = require("../utils/ApiResponse");
const ApiFeatures = require("../utils/ApiFeatures");
const ConsultationService = require("../models/ConsultationService");
const {
  uploadToCloudinary,
  deleteFromCloudinary,
} = require("../services/cloudinary.service");

const JSON_FIELDS = ["benefits", "faq", "seo", "modes"];

const parseJsonFields = (body) => {
  const parsed = { ...body };
  JSON_FIELDS.forEach((field) => {
    if (typeof parsed[field] === "string") {
      try {
        parsed[field] = JSON.parse(parsed[field]);
      } catch {
        // benefits/modes may arrive as a plain comma-separated string
        if (field === "benefits" || field === "modes") {
          parsed[field] = parsed[field].split(",").map((s) => s.trim()).filter(Boolean);
        }
      }
    }
  });
  return parsed;
};

// @desc    List consultation services (public storefront — active only, unless admin)
// @route   GET /api/v1/consultations/services
// @access  Public
const getServices = asyncHandler(async (req, res) => {
  const isAdmin = req.user?.role === "admin";
  const isAdminPreview = isAdmin && req.query.all === "true";
  const showDeleted = isAdmin && req.query.includeDeleted === "true";

  const baseQuery = { ...(showDeleted ? {} : { isDeleted: false }), ...(isAdminPreview ? {} : { status: "active" }) };
  delete req.query.includeDeleted;

  const features = new ApiFeatures(ConsultationService.find(baseQuery), req.query)
    .search(["name", "description"])
    .filter()
    .sort()
    .limitFields()
    .paginate();

  const [services, total] = await Promise.all([
    features.query,
    ConsultationService.countDocuments(baseQuery),
  ]);

  sendResponse(
    res,
    200,
    { services, count: services.length, total, pagination: features.pagination },
    "Consultation services fetched successfully",
  );
});

// @desc    Get a single consultation service by id or slug
// @route   GET /api/v1/consultations/services/:idOrSlug
// @access  Public
const getServiceById = asyncHandler(async (req, res) => {
  const { idOrSlug } = req.params;
  const query = idOrSlug.match(/^[0-9a-fA-F]{24}$/)
    ? { _id: idOrSlug }
    : { slug: idOrSlug };

  const service = await ConsultationService.findOne({ ...query, isDeleted: false });
  if (!service) throw new ApiError(404, "Consultation service not found");

  sendResponse(res, 200, { service }, "Consultation service fetched successfully");
});

const UPLOADABLE_FIELDS = ["image", "banner"];
const DIRECT_FIELDS = [
  "name", "type", "description", "price", "salePrice", "gstPercent", "duration",
  "status", "sortOrder", "preparationInstructions", "featured", "trending",
  "modes", "benefits", "faq", "seo",
];

// @desc    Create a consultation service
// @route   POST /api/v1/consultations/services
// @access  Private/Admin
const createService = asyncHandler(async (req, res) => {
  const body = parseJsonFields(req.body);
  const data = {};
  DIRECT_FIELDS.forEach((field) => {
    if (body[field] !== undefined) data[field] = body[field];
  });

  for (const field of UPLOADABLE_FIELDS) {
    const file = req.files?.[field]?.[0];
    if (file) {
      const result = await uploadToCloudinary(file.buffer, "consultations/services");
      data[field] = { url: result.url, publicId: result.publicId };
    }
  }

  const service = await ConsultationService.create(data);
  sendResponse(res, 201, { service }, "Consultation service created successfully");
});

// @desc    Update a consultation service
// @route   PUT /api/v1/consultations/services/:id
// @access  Private/Admin
const updateService = asyncHandler(async (req, res) => {
  const service = await ConsultationService.findOne({ _id: req.params.id, isDeleted: false });
  if (!service) throw new ApiError(404, "Consultation service not found");

  const body = parseJsonFields(req.body);

  for (const field of UPLOADABLE_FIELDS) {
    const file = req.files?.[field]?.[0];
    if (file) {
      if (service[field]?.publicId) await deleteFromCloudinary(service[field].publicId);
      const result = await uploadToCloudinary(file.buffer, "consultations/services");
      service[field] = { url: result.url, publicId: result.publicId };
    }
  }

  DIRECT_FIELDS.forEach((field) => {
    if (body[field] !== undefined) service[field] = body[field];
  });

  await service.save();
  sendResponse(res, 200, { service }, "Consultation service updated successfully");
});

// @desc    Enable/disable a consultation service (shorthand for updateService status)
// @route   PATCH /api/v1/consultations/services/:id/status
// @access  Private/Admin
const toggleServiceStatus = asyncHandler(async (req, res) => {
  const service = await ConsultationService.findOne({ _id: req.params.id, isDeleted: false });
  if (!service) throw new ApiError(404, "Consultation service not found");

  service.status = service.status === "active" ? "inactive" : "active";
  await service.save();

  sendResponse(
    res,
    200,
    { service },
    `Consultation service ${service.status === "active" ? "enabled" : "disabled"} successfully`,
  );
});

// @desc    Soft delete a consultation service — historical bookings keep
//          their serviceSnapshot regardless, so this is safe.
// @route   DELETE /api/v1/consultations/services/:id
// @access  Private/Admin
const deleteService = asyncHandler(async (req, res) => {
  const service = await ConsultationService.findOne({ _id: req.params.id, isDeleted: false });
  if (!service) throw new ApiError(404, "Consultation service not found");

  service.isDeleted = true;
  service.deletedAt = new Date();
  await service.save();

  sendResponse(res, 200, {}, "Consultation service deleted successfully");
});

// @desc    Restore a soft-deleted consultation service
// @route   PATCH /api/v1/consultations/services/:id/restore
// @access  Private/Admin
const restoreService = asyncHandler(async (req, res) => {
  const service = await ConsultationService.findOne({ _id: req.params.id, isDeleted: true });
  if (!service) throw new ApiError(404, "Deleted consultation service not found");

  service.isDeleted = false;
  service.deletedAt = null;
  await service.save();

  sendResponse(res, 200, { service }, "Consultation service restored successfully");
});

// @desc    List approved reviews for a service (for the service detail page)
// @route   GET /api/v1/consultations/services/:id/reviews
// @access  Public
const getServiceReviews = asyncHandler(async (req, res) => {
  // Lazy require to avoid a require-cycle at module-load time (ConsultationBooking
  // doesn't import this controller, so this is safe either way, but keeping
  // the top-level imports of this file service-only is clearer).
  const ConsultationBooking = require("../models/ConsultationBooking");

  const bookings = await ConsultationBooking.find({
    service: req.params.id,
    "review.status": "Approved",
    "review.rating": { $exists: true },
  })
    .select("review user")
    .populate("user", "name")
    .sort("-review.createdAt");

  const reviews = bookings.map((b) => ({
    _id: b._id,
    user: b.user,
    rating: b.review.rating,
    comment: b.review.comment,
    images: b.review.images,
    isFeatured: b.review.isFeatured,
    createdAt: b.review.createdAt,
  }));

  sendResponse(res, 200, { reviews, count: reviews.length }, "Reviews fetched successfully");
});

module.exports = {
  getServices,
  getServiceById,
  createService,
  updateService,
  toggleServiceStatus,
  deleteService,
  restoreService,
  getServiceReviews,
};
