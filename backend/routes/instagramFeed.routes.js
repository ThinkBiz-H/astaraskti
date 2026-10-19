const express = require("express");
const router = express.Router();

const {
  getFeedItems,
  createFeedItem,
  updateFeedItem,
  deleteFeedItem,
} = require("../controllers/instagramFeed.controller");

const { protect, authorize, optionalAuth } = require("../middlewares/auth.middleware");
const upload = require("../middlewares/upload.middleware");
const validate = require("../middlewares/validate.middleware");
const { instagramFeedValidator } = require("../validators/instagramFeed.validator");

// Public feed — optionalAuth populates req.user (without requiring a
// token) so an admin's `?all=true` request can also see inactive items.
router.get("/", optionalAuth, getFeedItems);

// Admin management
router.post(
  "/",
  protect,
  authorize("admin"),
  upload.single("image"),
  instagramFeedValidator,
  validate,
  createFeedItem,
);
router.put(
  "/:id",
  protect,
  authorize("admin"),
  upload.single("image"),
  instagramFeedValidator,
  validate,
  updateFeedItem,
);
router.delete("/:id", protect, authorize("admin"), deleteFeedItem);

module.exports = router;
