const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { sendResponse } = require('../utils/ApiResponse');
const Warehouse = require('../models/Warehouse');
const WarehouseStock = require('../models/WarehouseStock');

// @desc    Create a warehouse. The first warehouse ever created is
//          automatically the default one (every stock operation needs a
//          default to fall back to when no warehouse is specified).
// @route   POST /api/v1/warehouses
// @access  Private/Admin
const createWarehouse = asyncHandler(async (req, res) => {
  const { name, code, address, contactPerson, contactPhone, status } = req.body;

  const existingCount = await Warehouse.countDocuments();
  const isDefault = req.body.isDefault === true || req.body.isDefault === 'true' || existingCount === 0;

  if (isDefault) {
    await Warehouse.updateMany({}, { isDefault: false });
  }

  const warehouse = await Warehouse.create({ name, code, address, contactPerson, contactPhone, status, isDefault });
  sendResponse(res, 201, { warehouse }, 'Warehouse created successfully');
});

// @desc    Update a warehouse (setting isDefault:true unsets it on every other warehouse)
// @route   PUT /api/v1/warehouses/:id
// @access  Private/Admin
const updateWarehouse = asyncHandler(async (req, res) => {
  const warehouse = await Warehouse.findById(req.params.id);
  if (!warehouse) throw new ApiError(404, 'Warehouse not found');

  ['name', 'code', 'address', 'contactPerson', 'contactPhone', 'status'].forEach((field) => {
    if (req.body[field] !== undefined) warehouse[field] = req.body[field];
  });

  if (req.body.isDefault === true || req.body.isDefault === 'true') {
    await Warehouse.updateMany({ _id: { $ne: warehouse._id } }, { isDefault: false });
    warehouse.isDefault = true;
  } else if (req.body.isDefault === false || req.body.isDefault === 'false') {
    const otherDefaultExists = await Warehouse.exists({ _id: { $ne: warehouse._id }, isDefault: true });
    if (!otherDefaultExists) {
      throw new ApiError(400, 'Cannot unset the only default warehouse — mark another warehouse as default first');
    }
    warehouse.isDefault = false;
  }

  await warehouse.save();
  sendResponse(res, 200, { warehouse }, 'Warehouse updated successfully');
});

// @desc    Deactivate a warehouse (soft — status flip, not deletion, since
//          historical StockMovement/WarehouseStock records must keep
//          referencing it)
// @route   DELETE /api/v1/warehouses/:id
// @access  Private/Admin
const deactivateWarehouse = asyncHandler(async (req, res) => {
  const warehouse = await Warehouse.findById(req.params.id);
  if (!warehouse) throw new ApiError(404, 'Warehouse not found');

  if (warehouse.isDefault) {
    throw new ApiError(400, 'Cannot deactivate the default warehouse — mark another warehouse as default first');
  }

  const stockRemaining = await WarehouseStock.exists({ warehouse: warehouse._id, available: { $gt: 0 } });
  if (stockRemaining) {
    throw new ApiError(400, 'This warehouse still has stock assigned — transfer it out before deactivating');
  }

  warehouse.status = 'inactive';
  await warehouse.save();
  sendResponse(res, 200, { warehouse }, 'Warehouse deactivated successfully');
});

// @desc    List warehouses
// @route   GET /api/v1/warehouses
// @access  Private/Admin
const getWarehouses = asyncHandler(async (req, res) => {
  const filter = req.query.status ? { status: req.query.status } : {};
  const warehouses = await Warehouse.find(filter).sort({ isDefault: -1, name: 1 });
  sendResponse(res, 200, { warehouses, count: warehouses.length }, 'Warehouses fetched successfully');
});

// @desc    Get a single warehouse
// @route   GET /api/v1/warehouses/:id
// @access  Private/Admin
const getWarehouse = asyncHandler(async (req, res) => {
  const warehouse = await Warehouse.findById(req.params.id);
  if (!warehouse) throw new ApiError(404, 'Warehouse not found');
  sendResponse(res, 200, { warehouse }, 'Warehouse fetched successfully');
});

module.exports = { createWarehouse, updateWarehouse, deactivateWarehouse, getWarehouses, getWarehouse };
