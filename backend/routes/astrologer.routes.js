const express = require("express");
const router = express.Router();

const {
  getAstrologers,
  getAstrologerById,
  createAstrologer,
  updateAstrologer,
  deleteAstrologer,
  restoreAstrologer,
} = require("../controllers/astrologer.controller");

const { protect, authorize, optionalAuth } = require("../middlewares/auth.middleware");
const { requirePermission } = require("../middlewares/permission.middleware");
const upload = require("../middlewares/upload.middleware");

router.get("/", optionalAuth, getAstrologers);
router.get("/:id", getAstrologerById);

router.post(
  "/",
  protect,
  authorize("admin"),
  requirePermission("manage_consultations"),
  upload.single("photo"),
  createAstrologer,
);
router.put(
  "/:id",
  protect,
  authorize("admin"),
  requirePermission("manage_consultations"),
  upload.single("photo"),
  updateAstrologer,
);
router.delete("/:id", protect, authorize("admin"), requirePermission("manage_consultations"), deleteAstrologer);
router.patch("/:id/restore", protect, authorize("admin"), requirePermission("manage_consultations"), restoreAstrologer);

module.exports = router;
