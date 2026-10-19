const Settings = require('../models/Settings');
const logger = require('../utils/logger');

const seedSettings = async () => {
  const existing = await Settings.findOne();
  if (existing) {
    logger.info('Settings already exist, skipping settings seeding');
    return existing;
  }

  const settings = await Settings.create({
    general: { siteName: 'My Store', supportEmail: 'support@example.com' },
  });

  logger.info('Default settings seeded');
  return settings;
};

module.exports = seedSettings;
