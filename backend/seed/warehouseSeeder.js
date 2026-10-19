const Warehouse = require('../models/Warehouse');
const logger = require('../utils/logger');

const seedWarehouse = async () => {
  const existing = await Warehouse.findOne({ isDefault: true });
  if (existing) {
    logger.info('Default warehouse already exists, skipping warehouse seeding');
    return existing;
  }

  const warehouse = await Warehouse.create({
    name: 'Main Warehouse',
    code: 'MAIN',
    address: { city: '', state: '', country: 'India' },
    isDefault: true,
    status: 'active',
  });

  logger.info('Default warehouse seeded (MAIN)');
  return warehouse;
};

module.exports = seedWarehouse;
