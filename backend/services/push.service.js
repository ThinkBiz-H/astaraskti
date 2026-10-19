const logger = require('../utils/logger');

/**
 * Same abstraction pattern as services/sms.service.js: the push-sending
 * INTERFACE is real, but no Firebase project credentials are available in
 * the environment this was built in, so live delivery is unverified. Until
 * FIREBASE_PROJECT_ID (or another push provider) is configured, this logs
 * instead of silently dropping — loud in logs, never a silent failure.
 */
const sendPush = async ({ tokens, title, body, data = {} }) => {
  if (!tokens || tokens.length === 0) return { success: false, reason: 'no_device_tokens' };

  const provider = process.env.PUSH_PROVIDER;
  if (!provider) {
    logger.warn(`[Push not configured] Would send to ${tokens.length} device(s): "${title}" — ${body}`);
    return { success: true, provider: 'console-fallback' };
  }

  switch (provider) {
    // case 'firebase': {
    //   const admin = require('firebase-admin');
    //   if (!admin.apps.length) {
    //     admin.initializeApp({ credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
    //   }
    //   const result = await admin.messaging().sendEachForMulticast({ tokens, notification: { title, body }, data });
    //   return { success: true, provider: 'firebase', successCount: result.successCount };
    // }
    default:
      logger.error(`PUSH_PROVIDER="${provider}" is not implemented yet.`);
      throw new Error(`Push provider "${provider}" is not implemented`);
  }
};

module.exports = { sendPush };
