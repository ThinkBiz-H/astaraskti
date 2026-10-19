const express = require("express");
const router = express.Router();

const {
  getTestimonials,
  createTestimonial,
  updateTestimonial,
  toggleTestimonialStatus,
  deleteTestimonial,
} = require("../controllers/testimonial.controller");

const { protect, authorize, optionalAuth } = require("../middlewares/auth.middleware");
const upload = require("../middlewares/upload.middleware");
const validate = require("../middlewares/validate.middleware");
const {
  testimonialValidator,
  testimonialUpdateValidator,
} = require("../validators/testimonial.validator");

// Public catalog — optionalAuth populates req.user (without requiring a
// token) so an admin's `?all=true` request can also see inactive items.
router.get("/", optionalAuth, getTestimonials);

// Admin management
router.post(
  "/",
  protect,
  authorize("admin"),
  upload.single("customerImage"),
  testimonialValidator,
  validate,
  createTestimonial,
);
router.put(
  "/:id",
  protect,
  authorize("admin"),
  upload.single("customerImage"),
  testimonialUpdateValidator,
  validate,
  updateTestimonial,
);
router.patch("/:id/status", protect, authorize("admin"), toggleTestimonialStatus);
router.delete("/:id", protect, authorize("admin"), deleteTestimonial);

module.exports = router;
