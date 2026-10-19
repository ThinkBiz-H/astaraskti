const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/ApiError");
const { sendResponse } = require("../utils/ApiResponse");
const Testimonial = require("../models/Testimonial");
const {
  uploadToCloudinary,
  deleteFromCloudinary,
} = require("../services/cloudinary.service");

// @desc    List testimonials (active only, unless admin requests all)
// @route   GET /api/v1/testimonials
// @access  Public
const getTestimonials = asyncHandler(async (req, res) => {
  const isAdminRequest = req.user?.role === "admin" && req.query.all === "true";
  const filter = isAdminRequest ? {} : { isActive: true };

  const testimonials = await Testimonial.find(filter).sort("sortOrder");
  sendResponse(res, 200, { testimonials, count: testimonials.length }, "Testimonials fetched successfully");
});

// @desc    Create a testimonial
// @route   POST /api/v1/testimonials
// @access  Private/Admin
const createTestimonial = asyncHandler(async (req, res) => {
  const { customerName, designation, content, rating, sortOrder, isActive } = req.body;

  let customerImage;
  if (req.file) {
    const result = await uploadToCloudinary(req.file.buffer, "ecommerce/testimonials");
    customerImage = { url: result.url, publicId: result.publicId };
  }

  const testimonial = await Testimonial.create({
    customerName, designation, content, rating, sortOrder, isActive, customerImage,
  });

  sendResponse(res, 201, { testimonial }, "Testimonial created successfully");
});

// @desc    Update a testimonial
// @route   PUT /api/v1/testimonials/:id
// @access  Private/Admin
const updateTestimonial = asyncHandler(async (req, res) => {
  const testimonial = await Testimonial.findById(req.params.id);
  if (!testimonial) throw new ApiError(404, "Testimonial not found");

  if (req.file) {
    if (testimonial.customerImage?.publicId) {
      await deleteFromCloudinary(testimonial.customerImage.publicId);
    }
    const result = await uploadToCloudinary(req.file.buffer, "ecommerce/testimonials");
    testimonial.customerImage = { url: result.url, publicId: result.publicId };
  }

  ["customerName", "designation", "content", "rating", "sortOrder", "isActive"].forEach((field) => {
    if (req.body[field] !== undefined) testimonial[field] = req.body[field];
  });

  await testimonial.save();
  sendResponse(res, 200, { testimonial }, "Testimonial updated successfully");
});

// @desc    Toggle a testimonial's active status
// @route   PATCH /api/v1/testimonials/:id/status
// @access  Private/Admin
const toggleTestimonialStatus = asyncHandler(async (req, res) => {
  const testimonial = await Testimonial.findById(req.params.id);
  if (!testimonial) throw new ApiError(404, "Testimonial not found");

  testimonial.isActive = !testimonial.isActive;
  await testimonial.save();

  sendResponse(res, 200, { testimonial }, `Testimonial ${testimonial.isActive ? "enabled" : "disabled"} successfully`);
});

// @desc    Delete a testimonial
// @route   DELETE /api/v1/testimonials/:id
// @access  Private/Admin
const deleteTestimonial = asyncHandler(async (req, res) => {
  const testimonial = await Testimonial.findById(req.params.id);
  if (!testimonial) throw new ApiError(404, "Testimonial not found");

  if (testimonial.customerImage?.publicId) {
    await deleteFromCloudinary(testimonial.customerImage.publicId);
  }
  await testimonial.deleteOne();

  sendResponse(res, 200, {}, "Testimonial deleted successfully");
});

module.exports = {
  getTestimonials,
  createTestimonial,
  updateTestimonial,
  toggleTestimonialStatus,
  deleteTestimonial,
};
