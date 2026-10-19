require('dotenv').config();
const mongoose = require('mongoose');

const connectDB = require('../config/db');
const logger = require('../utils/logger');
const Product = require('../models/Product');
const Variant = require('../models/Variant');
const WarehouseStock = require('../models/WarehouseStock');
const seedWarehouse = require('../seed/warehouseSeeder');

/**
 * One-off data repair for products/variants created through the admin API
 * BEFORE the WarehouseStock-seeding fix in product.controller.js /
 * variant.controller.js existed. Those items have a `stock` number on the
 * document but no matching WarehouseStock row, so the next inventory
 * movement (an order, a manual adjustment) would silently reset their
 * stock to 0/negative — see inventory.service.js syncAggregateStock.
 *
 * Unlike seed/index.js's backfillWarehouseStock (which wipes and rebuilds
 * every record — fine for a fresh seed, destructive on live data), this
 * ONLY fills in rows that don't exist yet. Existing WarehouseStock rows
 * (already-correct ledger state) are left untouched.
 *
 * Run once: node scripts/repairWarehouseStock.js
 */
const repair = async () => {
  try {
    await connectDB();
    logger.info('Starting WarehouseStock gap repair...');

    const warehouse = await seedWarehouse(); // returns existing default warehouse, or creates one

    const [products, variants] = await Promise.all([
      Product.find({ isDeleted: false, hasVariants: false }).select('_id stock'),
      Variant.find({}).select('_id product stock'),
    ]);

    const existing = await WarehouseStock.find({ warehouse: warehouse._id }).select('product variant');
    const existingKeys = new Set(existing.map((r) => `${r.product}_${r.variant || 'null'}`));

    const missing = [
      ...products
        .filter((p) => !existingKeys.has(`${p._id}_null`))
        .map((p) => ({ product: p._id, variant: null, warehouse: warehouse._id, available: p.stock || 0 })),
      ...variants
        .filter((v) => !existingKeys.has(`${v.product}_${v._id}`))
        .map((v) => ({ product: v.product, variant: v._id, warehouse: warehouse._id, available: v.stock || 0 })),
    ];

    if (missing.length === 0) {
      logger.info('Nothing to repair — every product/variant already has a WarehouseStock row.');
    } else {
      await WarehouseStock.insertMany(missing);
      logger.info(`Repaired ${missing.length} missing WarehouseStock row(s) in ${warehouse.name}.`);
    }

    process.exit(0);
  } catch (error) {
    logger.error(`WarehouseStock repair failed: ${error.message}`);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
  }
};

repair();
