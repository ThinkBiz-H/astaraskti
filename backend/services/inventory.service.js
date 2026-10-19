const mongoose = require("mongoose");
const Product = require("../models/Product");
const Variant = require("../models/Variant");
const Warehouse = require("../models/Warehouse");
const WarehouseStock = require("../models/WarehouseStock");
const StockMovement = require("../models/StockMovement");
const User = require("../models/User");
const Category = require("../models/Category");
const ApiError = require("../utils/ApiError");
const logger = require("../utils/logger");
const { notify } = require("./notification.service");
const settingsService = require("./settings.service");

const runInTransaction = async (fn, externalSession = null) => {
  if (externalSession) {
    return fn(externalSession);
  }

  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      result = await fn(session);
    });
    return result;
  } catch (err) {
    if (
      err.message &&
      /Transaction numbers are only allowed|IllegalOperation/i.test(err.message)
    ) {
      logger.warn(
        "MongoDB deployment does not support transactions (not a replica set) — falling back to non-atomic writes for this inventory operation.",
      );
      return fn(null);
    }
    throw err;
  } finally {
    session.endSession();
  }
};

const getDefaultWarehouse = async (session = null) => {
  const warehouse = await Warehouse.findOne({
    isDefault: true,
    status: "active",
  }).session(session);
  if (warehouse) return warehouse;

  // Self-healing: a missing default warehouse must never hard-fail product
  // creation, inventory adjustments, or (most importantly) checkout — a
  // store should always have somewhere to hold stock. Auto-create one the
  // first time it's needed, participating in the same transaction/session
  // as the caller so it rolls back together with everything else if the
  // surrounding operation fails.
  const [created] = await Warehouse.create(
    [
      {
        name: "Main Warehouse",
        code: "MAIN",
        address: { country: "India" },
        isDefault: true,
        status: "active",
      },
    ],
    { session },
  );
  logger.info("No default warehouse found — auto-created 'Main Warehouse' (MAIN)");
  return created;
};

const resolveWarehouse = async (warehouseId, session = null) => {
  if (!warehouseId) return getDefaultWarehouse(session);
  const warehouse = await Warehouse.findById(warehouseId).session(session);
  if (!warehouse) throw new ApiError(404, "Warehouse not found");
  if (warehouse.status !== "active")
    throw new ApiError(400, "Warehouse is inactive");
  return warehouse;
};

const validateProductOrVariant = async (
  productId,
  variantId,
  session = null,
) => {
  const product = await Product.findOne({
    _id: productId,
    isDeleted: false,
  }).session(session);
  if (!product) throw new ApiError(404, "Product not found");

  let variant = null;
  if (variantId) {
    variant = await Variant.findOne({
      _id: variantId,
      product: productId,
    }).session(session);
    if (!variant) throw new ApiError(404, "Variant not found for this product");
  } else if (product.hasVariants) {
    throw new ApiError(
      400,
      "This product has variants — a variantId is required for inventory operations",
    );
  }

  return { product, variant };
};

const getOrCreateStockRecord = async (
  productId,
  variantId,
  warehouseId,
  session = null,
) => {
  let record = await WarehouseStock.findOne({
    product: productId,
    variant: variantId || null,
    warehouse: warehouseId,
  }).session(session);

  if (!record) {
    const settings = await settingsService.getSettings();
    record = new WarehouseStock({
      product: productId,
      variant: variantId || null,
      warehouse: warehouseId,
      lowStockThreshold: settings.inventory?.lowStockThreshold ?? 10,
    });
    await record.save({ session });
  }
  return record;
};

/** Recomputes Product.stock (or Variant.stock) as the sum of `available` across every warehouse. */
const syncAggregateStock = async (productId, variantId, session = null) => {
  const match = {
    product: new mongoose.Types.ObjectId(productId),
    variant: variantId ? new mongoose.Types.ObjectId(variantId) : null,
  };
  const [agg] = await WarehouseStock.aggregate([
    { $match: match },
    { $group: { _id: null, total: { $sum: "$available" } } },
  ]).session(session);
  const total = agg ? agg.total : 0;

  if (variantId) {
    await Variant.findByIdAndUpdate(variantId, { stock: total }, { session });
  } else {
    await Product.findByIdAndUpdate(productId, { stock: total }, { session });
  }
  return total;
};

/**
 * The single atomic primitive every stock-changing operation goes through.
 * Applies `quantity` (signed) to the given bucket of a product/variant's
 * stock at a specific warehouse, writes an immutable StockMovement record,
 * and keeps the Product/Variant aggregate `stock` field in sync — all in
 * one transaction where the deployment supports it.
 */
/**
 * Best-effort admin alert when a decreasing movement pushes stock at/below
 * its threshold. Only fires for 'sale'/'adjustment'/'damaged' (movements
 * that typically CAUSE a low-stock state) — not for purchases/transfers-in,
 * since those are stock increasing and re-alerting "still low, but we just
 * added some" on every restock step would just be noise. This is not
 * deduplicated across repeated breaches (e.g. five small sales in a row
 * while already low each re-notify) — a full "notify once per breach"
 * state machine is a reasonable future addition, not implemented here.
 */
const maybeAlertLowStock = async ({
  product,
  variant,
  warehouse,
  record,
  type,
}) => {
  if (!["sale", "adjustment", "damaged"].includes(type)) return;
  if (record.available > record.lowStockThreshold) return;

  try {
    const admins = await User.find({ role: "admin", isActive: true }).select(
      "_id",
    );
    const label = variant ? `${product.title} (${variant.sku})` : product.title;
    const message =
      record.available <= 0
        ? `${label} is OUT OF STOCK at ${warehouse.name}.`
        : `${label} is low on stock at ${warehouse.name}: ${record.available} left (threshold ${record.lowStockThreshold}).`;

    await Promise.all(
      admins.map((admin) =>
        notify({
          user: admin._id,
          type: "low_stock",
          title: record.available <= 0 ? "Out of stock" : "Low stock alert",
          message,
          relatedProduct: product._id,
          variables: {
            productTitle: label,
            available: record.available,
            warehouseName: warehouse.name,
          },
        }),
      ),
    );
  } catch (err) {
    logger.error(`Low-stock alert failed (non-fatal): ${err.message}`);
  }
};

const applyMovement = async ({
  productId,
  variantId = null,
  warehouseId,
  bucket = "available", // 'available' | 'reserved' | 'damaged' | 'incoming'
  quantity, // signed delta
  type,
  referenceType = "manual",
  referenceId = null,
  note = "",
  performedBy = null,
  allowNegative = false,
  session: externalSession = null,
}) => {
  if (!Number.isFinite(quantity) || quantity === 0) {
    throw new ApiError(400, "quantity must be a non-zero number");
  }

  const { product, variant } = await validateProductOrVariant(
    productId,
    variantId,
    externalSession,
  );
  const warehouse = await resolveWarehouse(warehouseId, externalSession);

  return runInTransaction(async (session) => {
    const record = await getOrCreateStockRecord(
      product._id,
      variant?._id,
      warehouse._id,
      session,
    );

    const previousStock = record[bucket];
    const newStock = previousStock + quantity;
    if (newStock < 0 && !allowNegative) {
      throw new ApiError(
        400,
        `Insufficient ${bucket} stock for "${product.title}"${variant ? ` (${variant.sku})` : ""} at ${warehouse.name}. Have ${previousStock}, requested change ${quantity}.`,
      );
    }

    record[bucket] = newStock;
    await record.save({ session });

    const total = await syncAggregateStock(product._id, variant?._id, session);

    const [movement] = await StockMovement.create(
      [
        {
          product: product._id,
          variant: variant?._id || null,
          warehouse: warehouse._id,
          unit: product.unit || null,
          type,
          quantity,
          previousStock,
          newStock,
          referenceType,
          referenceId,
          note,
          performedBy,
        },
      ],
      { session },
    );

    return { movement, stockRecord: record, aggregateStock: total };
  }, externalSession).then(async (result) => {
    await maybeAlertLowStock({
      product,
      variant,
      warehouse,
      record: result.stockRecord,
      type,
    });
    return result;
  });
};

const purchaseStock = ({
  productId,
  variantId,
  warehouseId,
  quantity,
  note,
  performedBy,
  referenceId,
}) => {
  if (quantity <= 0)
    throw new ApiError(400, "Purchase quantity must be positive");
  return applyMovement({
    productId,
    variantId,
    warehouseId,
    bucket: "available",
    quantity,
    type: "purchase",
    referenceType: "purchase",
    referenceId,
    note,
    performedBy,
  });
};

/** Signed delta adjustment (+ or -), for stock counts / corrections. */
const adjustStock = ({
  productId,
  variantId,
  warehouseId,
  quantity,
  note,
  performedBy,
  allowNegative = false,
}) => {
  if (!note)
    throw new ApiError(
      400,
      "A note explaining the reason for this adjustment is required",
    );
  return applyMovement({
    productId,
    variantId,
    warehouseId,
    bucket: "available",
    quantity,
    type: "adjustment",
    referenceType: "manual",
    note,
    performedBy,
    allowNegative,
  });
};

const markDamaged = ({
  productId,
  variantId,
  warehouseId,
  quantity,
  note,
  performedBy,
}) => {
  if (quantity <= 0) throw new ApiError(400, "Quantity must be positive");
  return runInTransaction(async () => {
    await applyMovement({
      productId,
      variantId,
      warehouseId,
      bucket: "available",
      quantity: -quantity,
      type: "damaged",
      referenceType: "manual",
      note,
      performedBy,
    });
    const { product, variant } = await validateProductOrVariant(
      productId,
      variantId,
    );
    const warehouse = await resolveWarehouse(warehouseId);
    const record = await getOrCreateStockRecord(
      product._id,
      variant?._id,
      warehouse._id,
    );
    record.damaged += quantity;
    await record.save();
    return record;
  });
};

const transferStock = async ({
  productId,
  variantId,
  fromWarehouseId,
  toWarehouseId,
  quantity,
  note,
  performedBy,
}) => {
  if (quantity <= 0)
    throw new ApiError(400, "Transfer quantity must be positive");
  if (String(fromWarehouseId) === String(toWarehouseId)) {
    throw new ApiError(
      400,
      "Source and destination warehouse must be different",
    );
  }

  await applyMovement({
    productId,
    variantId,
    warehouseId: fromWarehouseId,
    bucket: "available",
    quantity: -quantity,
    type: "transfer_out",
    referenceType: "transfer",
    note,
    performedBy,
  });

  return applyMovement({
    productId,
    variantId,
    warehouseId: toWarehouseId,
    bucket: "available",
    quantity,
    type: "transfer_in",
    referenceType: "transfer",
    note,
    performedBy,
  });
};

/** Moves stock from available -> reserved. Does not change the aggregate total (still counted as "not sellable"). */
const reserveStock = ({
  productId,
  variantId,
  warehouseId,
  quantity,
  referenceType = "order",
  referenceId,
  performedBy,
}) =>
  runInTransaction(async () => {
    await applyMovement({
      productId,
      variantId,
      warehouseId,
      bucket: "available",
      quantity: -quantity,
      type: "reservation",
      referenceType,
      referenceId,
      performedBy,
    });
    const warehouse = await resolveWarehouse(warehouseId);
    const record = await getOrCreateStockRecord(
      productId,
      variantId,
      warehouse._id,
    );
    record.reserved += quantity;
    await record.save();
    return record;
  });

const releaseReservedStock = ({
  productId,
  variantId,
  warehouseId,
  quantity,
  referenceType = "order",
  referenceId,
  performedBy,
}) =>
  runInTransaction(async () => {
    await applyMovement({
      productId,
      variantId,
      warehouseId,
      bucket: "available",
      quantity,
      type: "release",
      referenceType,
      referenceId,
      performedBy,
    });
    const warehouse = await resolveWarehouse(warehouseId);
    const record = await getOrCreateStockRecord(
      productId,
      variantId,
      warehouse._id,
    );
    record.reserved = Math.max(0, record.reserved - quantity);
    await record.save();
    return record;
  });

const deductForOrder = ({
  productId,
  variantId,
  quantity,
  orderId,
  performedBy = null,
  session = null,
}) => {
  return applyMovement({
    productId,
    variantId,
    warehouseId: null,
    bucket: "available",
    quantity: -quantity,
    type: "sale",
    referenceType: "order",
    referenceId: orderId,
    performedBy,
    allowNegative: true,
    session,
  });
};

const restoreForOrderCancellation = ({
  productId,
  variantId,
  quantity,
  orderId,
  performedBy = null,
  session = null,
}) =>
  applyMovement({
    productId,
    variantId,
    warehouseId: null,
    bucket: "available",
    quantity,
    type: "return",
    referenceType: "order",
    referenceId: orderId,
    performedBy,
    session,
  });

const getLowStock = async ({ warehouseId } = {}) => {
  const filter = { $expr: { $lte: ["$available", "$lowStockThreshold"] } };
  if (warehouseId) filter.warehouse = warehouseId;

  return WarehouseStock.find(filter)
    .populate("product", "title thumbnail SKU isDeleted")
    .populate("variant", "sku")
    .populate("warehouse", "name code")
    .sort("available")
    .then((records) =>
      records.filter((r) => r.product && !r.product.isDeleted),
    );
};

/**
 * Powers the admin Inventory page — one row per sellable unit (a variant if
 * the product has variants, otherwise the product itself), with stock
 * broken into current (available+reserved) / reserved / available, and a
 * status bucket derived from the admin-configured Settings thresholds.
 */
const getInventorySummary = async ({
  search,
  category,
  brand,
  stockStatus, // 'out' | 'critical' | 'low' | 'in_stock'
  page = 1,
  limit = 20,
} = {}) => {
  const settings = await settingsService.getSettings();
  const lowStockThreshold = settings.inventory?.lowStockThreshold ?? 10;
  const criticalStockThreshold = settings.inventory?.criticalStockThreshold ?? 3;

  const productFilter = { isDeleted: false };
  if (category && mongoose.Types.ObjectId.isValid(category)) {
    productFilter.category = { $in: await Category.getSelfAndDescendantIds(category) };
  }
  if (brand && mongoose.Types.ObjectId.isValid(brand)) {
    productFilter.brand = brand;
  }
  if (search) {
    productFilter.$or = [
      { title: { $regex: search, $options: "i" } },
      { SKU: { $regex: search, $options: "i" } },
      { barcode: { $regex: search, $options: "i" } },
    ];
  }

  const products = await Product.find(productFilter)
    .select("title thumbnail SKU barcode stock hasVariants category brand status")
    .populate("category", "name")
    .populate("brand", "name")
    .populate({ path: "variants", select: "sku barcode stock status attributes" })
    .sort("title")
    .lean({ virtuals: true });

  const productIds = products.map((p) => p._id);
  const stockAgg = await WarehouseStock.aggregate([
    { $match: { product: { $in: productIds } } },
    {
      $group: {
        _id: { product: "$product", variant: "$variant" },
        reserved: { $sum: "$reserved" },
        available: { $sum: "$available" },
      },
    },
  ]);
  const stockMap = new Map(
    stockAgg.map((s) => [`${s._id.product}_${s._id.variant || "null"}`, s]),
  );

  const classify = (available) => {
    if (available <= 0) return "out";
    if (available <= criticalStockThreshold) return "critical";
    if (available <= lowStockThreshold) return "low";
    return "in_stock";
  };

  const buildRow = (product, variant) => {
    const key = `${product._id}_${variant?._id || "null"}`;
    const agg = stockMap.get(key);
    const available = agg ? agg.available : (variant ? variant.stock : product.stock) || 0;
    const reserved = agg ? agg.reserved : 0;
    const status = classify(available);
    return {
      productId: product._id,
      variantId: variant?._id || null,
      title: product.title,
      variantLabel: variant?.attributes?.length
        ? variant.attributes.map((a) => `${a.key}: ${a.value}`).join(", ")
        : null,
      thumbnail: product.thumbnail,
      sku: variant?.sku || product.SKU || "",
      barcode: variant?.barcode || product.barcode || "",
      category: product.category,
      brand: product.brand,
      productStatus: product.status,
      currentStock: available + reserved,
      reservedStock: reserved,
      availableStock: available,
      status,
      isLowStock: status === "low" || status === "critical",
    };
  };

  let rows = [];
  products.forEach((product) => {
    if (product.hasVariants && product.variants?.length) {
      product.variants.forEach((variant) => rows.push(buildRow(product, variant)));
    } else {
      rows.push(buildRow(product, null));
    }
  });

  if (stockStatus) {
    rows = rows.filter((r) => r.status === stockStatus);
  }

  const total = rows.length;
  const pageNum = Math.max(Number(page) || 1, 1);
  const limitNum = Math.max(Number(limit) || 20, 1);
  const start = (pageNum - 1) * limitNum;
  const paginated = rows.slice(start, start + limitNum);

  return {
    rows: paginated,
    total,
    page: pageNum,
    limit: limitNum,
    totalPages: Math.max(Math.ceil(total / limitNum), 1),
    thresholds: { lowStockThreshold, criticalStockThreshold },
  };
};

const getMovementHistory = async ({
  productId,
  variantId,
  warehouseId,
  type,
  page = 1,
  limit = 20,
}) => {
  const filter = {};
  if (productId) filter.product = productId;
  if (variantId) filter.variant = variantId;
  if (warehouseId) filter.warehouse = warehouseId;
  if (type) filter.type = type;

  const skip = (page - 1) * limit;
  const [movements, total] = await Promise.all([
    StockMovement.find(filter)
      .populate("product", "title SKU")
      .populate("variant", "sku")
      .populate("warehouse", "name code")
      .populate("performedBy", "name email")
      .sort("-createdAt")
      .skip(skip)
      .limit(limit),
    StockMovement.countDocuments(filter),
  ]);

  return {
    movements,
    total,
    page: Number(page),
    totalPages: Math.ceil(total / limit),
  };
};

module.exports = {
  getDefaultWarehouse,
  resolveWarehouse,
  getOrCreateStockRecord,
  syncAggregateStock,
  applyMovement,
  purchaseStock,
  adjustStock,
  markDamaged,
  transferStock,
  reserveStock,
  releaseReservedStock,
  deductForOrder,
  restoreForOrderCancellation,
  getLowStock,
  getInventorySummary,
  getMovementHistory,
};
