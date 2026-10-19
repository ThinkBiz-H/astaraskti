const express = require("express");
const router = express.Router();

const {
  createUnit,
  updateUnit,
  deleteUnit,
  getUnits,
  getUnitById,
} = require("../controllers/unit.controller");
const { protect, authorize } = require("../middlewares/auth.middleware");
const validate = require("../middlewares/validate.middleware");
const {
  unitValidator,
  unitUpdateValidator,
} = require("../validators/unit.validator");

router.get("/", getUnits);
router.get("/:id", getUnitById);
router.post(
  "/",
  protect,
  authorize("admin"),
  unitValidator,
  validate,
  createUnit,
);
router.put(
  "/:id",
  protect,
  authorize("admin"),
  unitUpdateValidator,
  validate,
  updateUnit,
);
router.delete("/:id", protect, authorize("admin"), deleteUnit);

module.exports = router;
