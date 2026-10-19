const Unit = require('../models/Unit');
const logger = require('../utils/logger');

const units = [
  { name: 'Kilogram', symbol: 'kg', allowDecimal: true },
  { name: 'Gram', symbol: 'gm', allowDecimal: true },
  { name: 'Milligram', symbol: 'mg', allowDecimal: true },
  { name: 'Litre', symbol: 'ltr', allowDecimal: true },
  { name: 'Millilitre', symbol: 'ml', allowDecimal: true },
  { name: 'Piece', symbol: 'pc', allowDecimal: false },
  { name: 'Pair', symbol: 'pair', allowDecimal: false },
  { name: 'Set', symbol: 'set', allowDecimal: false },
  { name: 'Kit', symbol: 'kit', allowDecimal: false },
  { name: 'Pack', symbol: 'pack', allowDecimal: false },
  { name: 'Box', symbol: 'box', allowDecimal: false },
  { name: 'Carton', symbol: 'carton', allowDecimal: false },
  { name: 'Bag', symbol: 'bag', allowDecimal: false },
  { name: 'Bottle', symbol: 'bottle', allowDecimal: false },
  { name: 'Jar', symbol: 'jar', allowDecimal: false },
  { name: 'Tube', symbol: 'tube', allowDecimal: false },
  { name: 'Can', symbol: 'can', allowDecimal: false },
  { name: 'Roll', symbol: 'roll', allowDecimal: false },
  { name: 'Sheet', symbol: 'sheet', allowDecimal: false },
  { name: 'Bundle', symbol: 'bundle', allowDecimal: false },
  { name: 'Dozen', symbol: 'dozen', allowDecimal: false },
  { name: 'Meter', symbol: 'm', allowDecimal: true },
  { name: 'Centimeter', symbol: 'cm', allowDecimal: true },
  { name: 'Millimeter', symbol: 'mm', allowDecimal: true },
  { name: 'Inch', symbol: 'in', allowDecimal: true },
  { name: 'Feet', symbol: 'ft', allowDecimal: true },
  { name: 'Square Feet', symbol: 'sq.ft', allowDecimal: true },
  { name: 'Square Meter', symbol: 'sq.m', allowDecimal: true },
];

const seedUnits = async () => {
  const existingCount = await Unit.countDocuments();
  if (existingCount > 0) {
    logger.info('Units already exist, skipping unit seeding');
    return Unit.find();
  }

  const created = await Unit.insertMany(units);
  logger.info(`${created.length} units seeded`);
  return created;
};

module.exports = seedUnits;
