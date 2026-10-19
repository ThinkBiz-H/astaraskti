const NotificationJob = require('../models/NotificationJob');
const { sendEmail } = require('../utils/sendEmail');
const { sendSms } = require('./sms.service');
const { sendPush } = require('./push.service');
const logger = require('../utils/logger');

const enqueue = ({ channel, recipientUser = null, to, subject = '', body }) => {
  if (!to) return null; // e.g. a user with no email on a mobile-only account — skip, don't queue a job that can never send
  return NotificationJob.create({ channel, recipientUser, to, subject, body });
};

const BACKOFF_MINUTES = [1, 5, 30]; // attempt 1 fails -> retry in 1min, attempt 2 fails -> 5min, attempt 3 fails -> 30min, then give up

const deliverOne = async (job) => {
  if (job.channel === 'email') {
    await sendEmail({ to: job.to, subject: job.subject, html: job.body, text: job.body.replace(/<[^>]+>/g, '') });
  } else if (job.channel === 'sms') {
    await sendSms({ to: job.to, message: job.body });
  } else if (job.channel === 'push') {
    await sendPush({ tokens: [job.to], title: job.subject, body: job.body });
  }
};

/**
 * Claims and processes a batch of due jobs. Uses findOneAndUpdate as an
 * atomic claim (pending -> processing) so even multiple overlapping timer
 * ticks within THIS process never double-send the same job. This does
 * NOT protect against multiple separate server instances polling the same
 * database concurrently — that needs a real broker (Redis/Bull, Phase 19).
 * Documented, not hidden: fine for a single-instance deployment, which is
 * what this project currently is.
 */
const processPendingJobs = async (batchSize = 10) => {
  let processed = 0;

  for (let i = 0; i < batchSize; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    const job = await NotificationJob.findOneAndUpdate(
      { status: 'pending', nextAttemptAt: { $lte: new Date() } },
      { status: 'processing', $inc: { attempts: 1 } },
      { new: true, sort: { nextAttemptAt: 1 } }
    );
    if (!job) break;

    try {
      // eslint-disable-next-line no-await-in-loop
      await deliverOne(job);
      job.status = 'sent';
      job.sentAt = new Date();
      // eslint-disable-next-line no-await-in-loop
      await job.save();
    } catch (err) {
      const giveUp = job.attempts >= job.maxAttempts;
      job.status = giveUp ? 'failed' : 'pending';
      job.lastError = err.message;
      if (!giveUp) {
        const minutes = BACKOFF_MINUTES[job.attempts - 1] || BACKOFF_MINUTES[BACKOFF_MINUTES.length - 1];
        job.nextAttemptAt = new Date(Date.now() + minutes * 60_000);
      }
      // eslint-disable-next-line no-await-in-loop
      await job.save();
      logger.error(`Notification job ${job._id} (${job.channel} to ${job.to}) failed on attempt ${job.attempts}: ${err.message}`);
    }
    processed += 1;
  }

  return processed;
};

module.exports = { enqueue, processPendingJobs };
