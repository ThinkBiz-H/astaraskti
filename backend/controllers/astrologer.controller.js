const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/ApiError");
const { sendResponse } = require("../utils/ApiResponse");
const Astrologer = require("../models/Astrologer");
const { uploadToCloudinary, deleteFromCloudinary } = require("../services/cloudinary.service");

// @desc    List astrologers — public gets active only, admin can pass
//          ?all=true to include inactive/deleted (mirrors ConsultationService's
//          getServices admin-preview pattern).
// @route   GET /api/v1/astrologers
// @access  Public
const getAstrologers = asyncHandler(async (req, res) => {
  const isAdminPreview = req.user?.role === "admin" && req.query.all === "true";
  const filter = isAdminPreview ? {} : { isDeleted: false, status: "active" };
  const astrologers = await Astrologer.find(filter).sort("-createdAt");
  sendResponse(res, 200, { astrologers, count: astrologers.length }, "Astrologers fetched successfully");
});

const getAstrologerById = asyncHandler(async (req, res) => {
  const astrologer = await Astrologer.findOne({ _id: req.params.id, isDeleted: false });
  if (!astrologer) throw new ApiError(404, "Astrologer not found");
  sendResponse(res, 200, { astrologer }, "Astrologer fetched successfully");
});

// @desc    Create an astrologer profile
// @route   POST /api/v1/astrologers
// @access  Private/Admin
const createAstrologer = asyncHandler(async (req, res) => {
  const body = { ...req.body };
  ["expertise", "languages"].forEach((field) => {
    if (typeof body[field] === "string") {
      try {
        body[field] = JSON.parse(body[field]);
      } catch {
        body[field] = body[field].split(",").map((s) => s.trim()).filter(Boolean);
      }
    }
  });

  let photo;
  if (req.file) {
    const result = await uploadToCloudinary(req.file.buffer, "consultations/astrologers");
    photo = { url: result.url, publicId: result.publicId };
  }

  const astrologer = await Astrologer.create({ ...body, photo });
  sendResponse(res, 201, { astrologer }, "Astrologer created successfully");
});

// @desc    Update an astrologer profile
// @route   PUT /api/v1/astrologers/:id
// @access  Private/Admin
const updateAstrologer = asyncHandler(async (req, res) => {
  const astrologer = await Astrologer.findOne({ _id: req.params.id, isDeleted: false });
  if (!astrologer) throw new ApiError(404, "Astrologer not found");

  const body = { ...req.body };
  ["expertise", "languages"].forEach((field) => {
    if (typeof body[field] === "string") {
      try {
        body[field] = JSON.parse(body[field]);
      } catch {
        body[field] = body[field].split(",").map((s) => s.trim()).filter(Boolean);
      }
    }
  });

  if (req.file) {
    if (astrologer.photo?.publicId) await deleteFromCloudinary(astrologer.photo.publicId);
    const result = await uploadToCloudinary(req.file.buffer, "consultations/astrologers");
    astrologer.photo = { url: result.url, publicId: result.publicId };
  }

  ["name", "bio", "experienceYears", "status", "expertise", "languages"].forEach((field) => {
    if (body[field] !== undefined) astrologer[field] = body[field];
  });

  await astrologer.save();
  sendResponse(res, 200, { astrologer }, "Astrologer updated successfully");
});

// @desc    Soft delete an astrologer — bookings already assigned to them
//          keep the reference (assignmentHistory/assignedAstrologer are
//          never rewritten), so past bookings still display correctly.
// @route   DELETE /api/v1/astrologers/:id
// @access  Private/Admin
const deleteAstrologer = asyncHandler(async (req, res) => {
  const astrologer = await Astrologer.findOne({ _id: req.params.id, isDeleted: false });
  if (!astrologer) throw new ApiError(404, "Astrologer not found");

  astrologer.isDeleted = true;
  astrologer.deletedAt = new Date();
  await astrologer.save();

  sendResponse(res, 200, {}, "Astrologer deleted successfully");
});

// @desc    Restore a soft-deleted astrologer
// @route   PATCH /api/v1/astrologers/:id/restore
// @access  Private/Admin
const restoreAstrologer = asyncHandler(async (req, res) => {
  const astrologer = await Astrologer.findOne({ _id: req.params.id, isDeleted: true });
  if (!astrologer) throw new ApiError(404, "Deleted astrologer not found");

  astrologer.isDeleted = false;
  astrologer.deletedAt = null;
  await astrologer.save();

  sendResponse(res, 200, { astrologer }, "Astrologer restored successfully");
});

module.exports = {
  getAstrologers,
  getAstrologerById,
  createAstrologer,
  updateAstrologer,
  deleteAstrologer,
  restoreAstrologer,
};
