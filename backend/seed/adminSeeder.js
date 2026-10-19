const User = require('../models/User');
const logger = require('../utils/logger');

const seedAdmin = async () => {
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@myshop.com';

  const existingAdmin = await User.findOne({ email: adminEmail });
  if (existingAdmin) {
    logger.info('Admin user already exists, skipping admin seeding');
    return existingAdmin;
  }

  const admin = await User.create({
    name: process.env.ADMIN_NAME || 'Super Admin',
    email: adminEmail,
    mobile: process.env.ADMIN_MOBILE || '9999999999',
    password: process.env.ADMIN_PASSWORD || 'Admin@12345',
    role: 'admin',
    isVerified: true,
  });

  logger.info(`Admin user created: ${admin.email}`);
  return admin;
};

module.exports = seedAdmin;
