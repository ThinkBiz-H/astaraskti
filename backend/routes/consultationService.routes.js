const express = require("express");
const router = express.Router();

const {
  getServices,
  getServiceById,
  createService,
  updateService,
  toggleServiceStatus,
  deleteService,
  restoreService,
  getServiceReviews,
} = require("../controllers/consultationService.controller");
const { getSlots } = require("../controllers/availability.controller");

const { protect, authorize, optionalAuth } = require("../middlewares/auth.middleware");
const { requirePermission } = require("../middlewares/permission.middleware");
const upload = require("../middlewares/upload.middleware");
const validate = require("../middlewares/validate.middleware");
const {
  serviceValidator,
  serviceUpdateValidator,
} = require("../validators/consultation.validator");

// Public catalog — optionalAuth populates req.user (without requiring a
// token) so an admin's `?all=true`/`?includeDeleted=true` request can also
// see inactive/deleted services.
router.get("/", optionalAuth, getServices);
router.get("/:id/reviews", getServiceReviews);
router.get("/:id/availability", getSlots);
router.get("/:idOrSlug", getServiceById);

// Admin management — two optional image fields (thumbnail `image` +
// `banner`), same multer instance as everywhere else, just .fields()
// instead of .single() since there are now two.
const serviceImageFields = upload.fields([
  { name: "image", maxCount: 1 },
  { name: "banner", maxCount: 1 },
]);

router.post(
  "/",
  protect,
  authorize("admin"),
  requirePermission("manage_consultations"),
  serviceImageFields,
  serviceValidator,
  validate,
  createService,
);
router.put(
  "/:id",
  protect,
  authorize("admin"),
  requirePermission("manage_consultations"),
  serviceImageFields,
  serviceUpdateValidator,
  validate,
  updateService,
);
router.patch("/:id/status", protect, authorize("admin"), requirePermission("manage_consultations"), toggleServiceStatus);
router.delete("/:id", protect, authorize("admin"), requirePermission("manage_consultations"), deleteService);
router.patch("/:id/restore", protect, authorize("admin"), requirePermission("manage_consultations"), restoreService);

module.exports = router;
