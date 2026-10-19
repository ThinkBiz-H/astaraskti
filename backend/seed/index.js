require('dotenv').config();
const mongoose = require('mongoose');

const connectDB = require('../config/db');
const logger = require('../utils/logger');
const Product = require('../models/Product');
const Variant = require('../models/Variant');
const WarehouseStock = require('../models/WarehouseStock');

const seedAdmin = require('./adminSeeder');
const seedCategories = require('./categorySeeder');
const seedBrands = require('./brandSeeder');
const seedUnits = require('./unitSeeder');
const seedWarehouse = require('./warehouseSeeder');
const seedProducts = require('./productSeeder');
const seedCms = require('./cmsSeeder');
const seedSettings = require('./settingsSeeder');
const seedConsultationServices = require('./consultationServiceSeeder');

/**
 * Phase 6 backfill: every seeded product/variant already has a flat `stock`
 * number (set directly by productSeeder, same as before Phase 6 existed).
 * This creates the matching WarehouseStock record in the default warehouse
 * so the new per-warehouse ledger starts consistent with it — otherwise the
 * first real inventory operation would recompute the aggregate from an
 * empty ledger and silently zero every seeded product's stock out.
 */
const backfillWarehouseStock = async (warehouse) => {
  const [products, variants] = await Promise.all([
    Product.find({ isDeleted: false, hasVariants: false }),
    Variant.find({}),
  ]);

  const records = [
    ...products.map((p) => ({ product: p._id, variant: null, warehouse: warehouse._id, available: p.stock || 0 })),
    ...variants.map((v) => ({ product: v.product, variant: v._id, warehouse: warehouse._id, available: v.stock || 0 })),
  ];

  if (records.length === 0) return;

  await WarehouseStock.deleteMany({ warehouse: warehouse._id });
  await WarehouseStock.insertMany(records);
  logger.info(`${records.length} warehouse stock records backfilled for ${warehouse.name}`);
};

const runSeeders = async () => {
  try {
    await connectDB();

    logger.info('Starting database seeding...');

    await seedAdmin();
    const categories = await seedCategories();
    const brands = await seedBrands();
    const units = await seedUnits();
    const warehouse = await seedWarehouse();
    await seedProducts(categories, brands, units);
    await backfillWarehouseStock(warehouse);
    await seedCms();
    await seedSettings();
    await seedConsultationServices();

    logger.info('Database seeding completed successfully!');
    process.exit(0);
  } catch (error) {
    logger.error(`Seeding failed: ${error.message}`);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
  }
};

runSeeders();
