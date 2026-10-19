const logger = require('../utils/logger');


const sendSms = async ({ to, message }) => {
  const provider = process.env.SMS_PROVIDER;

  if (!provider) {
    logger.warn(`[SMS not configured] Would send to ${to}: ${message}`);
    return { success: true, provider: 'console-fallback' };
  }

  switch (provider) {

    default:
      logger.error(`SMS_PROVIDER="${provider}" is not implemented yet.`);
      throw new Error(`SMS provider "${provider}" is not implemented`);
  }
};

module.exports = { sendSms };
