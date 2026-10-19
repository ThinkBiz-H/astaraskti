const asyncHandler = require('../utils/asyncHandler');
const { sendResponse } = require('../utils/ApiResponse');
const inventoryService = require('../services/inventory.service');
const WarehouseStock = require('../models/WarehouseStock');
const ApiError = require('../utils/ApiError');

// @desc    Purchase / receive stock into a warehouse
// @route   POST /api/v1/inventory/purchase
// @access  Private/Admin
const purchaseStock = asyncHandler(async (req, res) => {
  const { productId, variantId, warehouseId, quantity, note } = req.body;
  const result = await inventoryService.purchaseStock({
    productId,
    variantId,
    warehouseId,
    quantity: Number(quantity),
    note,
    performedBy: req.user._id,
  });
  sendResponse(res, 200, result, 'Stock purchased successfully');
});

// @desc    Manually adjust stock (correction, stocktake, shrinkage, etc.) — signed quantity
// @route   POST /api/v1/inventory/adjust
// @access  Private/Admin
const adjustStock = asyncHandler(async (req, res) => {
  const { productId, variantId, warehouseId, quantity, note, allowNegative } = req.body;
  const result = await inventoryService.adjustStock({
    productId,
    variantId,
    warehouseId,
    quantity: Number(quantity),
    note,
    performedBy: req.user._id,
    allowNegative: !!allowNegative,
  });
  sendResponse(res, 200, result, 'Stock adjusted successfully');
});

// @desc    Move damaged stock out of sellable availability
// @route   POST /api/v1/inventory/damaged
// @access  Private/Admin
const markDamaged = asyncHandler(async (req, res) => {
  const { productId, variantId, warehouseId, quantity, note } = req.body;
  const result = await inventoryService.markDamaged({
    productId,
    variantId,
    warehouseId,
    quantity: Number(quantity),
    note,
    performedBy: req.user._id,
  });
  sendResponse(res, 200, { stockRecord: result }, 'Stock marked as damaged');
});

// @desc    Transfer stock between two warehouses
// @route   POST /api/v1/inventory/transfer
// @access  Private/Admin
const transferStock = asyncHandler(async (req, res) => {
  const { productId, variantId, fromWarehouseId, toWarehouseId, quantity, note } = req.body;
  const result = await inventoryService.transferStock({
    productId,
    variantId,
    fromWarehouseId,
    toWarehouseId,
    quantity: Number(quantity),
    note,
    performedBy: req.user._id,
  });
  sendResponse(res, 200, result, 'Stock transferred successfully');
});

// @desc    Reserve stock (hold against a pending order, manual B2B hold, etc.)
// @route   POST /api/v1/inventory/reserve
// @access  Private/Admin
const reserveStock = asyncHandler(async (req, res) => {
  const { productId, variantId, warehouseId, quantity, referenceId, note } = req.body;
  const result = await inventoryService.reserveStock({
    productId,
    variantId,
    warehouseId,
    quantity: Number(quantity),
    referenceType: 'manual',
    referenceId,
    performedBy: req.user._id,
  });
  sendResponse(res, 200, { stockRecord: result }, 'Stock reserved successfully');
});

// @desc    Release previously reserved stock back to available
// @route   POST /api/v1/inventory/release
// @access  Private/Admin
const releaseReservedStock = asyncHandler(async (req, res) => {
  const { productId, variantId, warehouseId, quantity, referenceId } = req.body;
  const result = await inventoryService.releaseReservedStock({
    productId,
    variantId,
    warehouseId,
    quantity: Number(quantity),
    referenceType: 'manual',
    referenceId,
    performedBy: req.user._id,
  });
  sendResponse(res, 200, { stockRecord: result }, 'Reserved stock released successfully');
});

// @desc    Get the per-warehouse stock breakdown for a product (or one of its variants)
// @route   GET /api/v1/inventory/stock/:productId
// @access  Private/Admin
const getStockByProduct = asyncHandler(async (req, res) => {
  const filter = { product: req.params.productId };
  if (req.query.variantId) filter.variant = req.query.variantId;

  const records = await WarehouseStock.find(filter).populate('warehouse', 'name code isDefault').populate('variant', 'sku');
  sendResponse(res, 200, { stock: records }, 'Warehouse stock fetched successfully');
});

// @desc    Low-stock / out-of-stock products across all (or one) warehouse
// @route   GET /api/v1/inventory/low-stock
// @access  Private/Admin
const getLowStock = asyncHandler(async (req, res) => {
  const records = await inventoryService.getLowStock({ warehouseId: req.query.warehouseId });
  sendResponse(res, 200, { records, count: records.length }, 'Low stock records fetched successfully');
});

// @desc    Inventory page summary — one row per product/variant with
//          current/reserved/available stock and a status bucket
// @route   GET /api/v1/inventory/summary
// @access  Private/Admin
const getInventorySummary = asyncHandler(async (req, res) => {
  const { search, category, brand, stockStatus, page, limit } = req.query;
  const result = await inventoryService.getInventorySummary({ search, category, brand, stockStatus, page, limit });
  sendResponse(res, 200, result, 'Inventory summary fetched successfully');
});

// @desc    Stock movement history (audit trail), filterable
// @route   GET /api/v1/inventory/movements
// @access  Private/Admin
const getMovements = asyncHandler(async (req, res) => {
  const { productId, variantId, warehouseId, type, page, limit } = req.query;
  const result = await inventoryService.getMovementHistory({ productId, variantId, warehouseId, type, page, limit });
  sendResponse(res, 200, result, 'Stock movements fetched successfully');
});

module.exports = {
  purchaseStock,
  adjustStock,
  markDamaged,
  transferStock,
  reserveStock,
  releaseReservedStock,
  getStockByProduct,
  getLowStock,
  getInventorySummary,
  getMovements,
};
