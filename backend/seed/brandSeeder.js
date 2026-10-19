const Brand = require('../models/Brand');
const logger = require('../utils/logger');

const brands = [
  { name: 'Apple' },
  { name: 'Samsung' },
  { name: 'Nike' },
  { name: 'Adidas' },
  { name: 'Sony' },
  { name: 'Philips' },
];

const seedBrands = async () => {
  const existingCount = await Brand.countDocuments();
  if (existingCount > 0) {
    logger.info('Brands already exist, skipping brand seeding');
    return Brand.find();
  }

  const created = await Brand.insertMany(brands);
  logger.info(`${created.length} brands seeded`);
  return created;
};

module.exports = seedBrands;
