const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/ApiError");
const { sendResponse } = require("../utils/ApiResponse");
const Unit = require("../models/Unit");
const Product = require("../models/Product");

// @desc    Create a unit
// @route   POST /api/v1/units
// @access  Private/Admin
const createUnit = asyncHandler(async (req, res) => {
  const { name, symbol, allowDecimal, status } = req.body;
  const unit = await Unit.create({ name, symbol, allowDecimal, status });
  sendResponse(res, 201, { unit }, "Unit created successfully");
});

// @desc    Update a unit
// @route   PUT /api/v1/units/:id
// @access  Private/Admin
const updateUnit = asyncHandler(async (req, res) => {
  const unit = await Unit.findById(req.params.id);
  if (!unit) throw new ApiError(404, "Unit not found");

  ["name", "symbol", "allowDecimal", "status"].forEach((field) => {
    if (req.body[field] !== undefined) unit[field] = req.body[field];
  });

  await unit.save();
  sendResponse(res, 200, { unit }, "Unit updated successfully");
});

// @desc    Delete a unit (blocked if any product still references it)
// @route   DELETE /api/v1/units/:id
// @access  Private/Admin
const deleteUnit = asyncHandler(async (req, res) => {
  const unit = await Unit.findById(req.params.id);
  if (!unit) throw new ApiError(404, "Unit not found");

  const inUse = await Product.countDocuments({
    unit: unit._id,
    isDeleted: false,
  });
  if (inUse > 0) {
    throw new ApiError(
      400,
      `Cannot delete: ${inUse} product${inUse === 1 ? "" : "s"} still use this unit.`,
    );
  }

  await unit.deleteOne();
  sendResponse(res, 200, {}, "Unit deleted successfully");
});

// @desc    List units
// @route   GET /api/v1/units
// @access  Public
const getUnits = asyncHandler(async (req, res) => {
  const filter = req.query.status ? { status: req.query.status } : {};
  const units = await Unit.find(filter).sort("name");
  sendResponse(
    res,
    200,
    { units, count: units.length },
    "Units fetched successfully",
  );
});
// @desc    Get unit by ID
// @route   GET /api/v1/units/:id
// @access  Public
const getUnitById = asyncHandler(async (req, res) => {
  const unit = await Unit.findById(req.params.id);

  if (!unit) {
    throw new ApiError(404, "Unit not found");
  }

  sendResponse(res, 200, { unit }, "Unit fetched successfully");
});

module.exports = {
  createUnit,
  updateUnit,
  deleteUnit,
  getUnits,
  getUnitById,
};
