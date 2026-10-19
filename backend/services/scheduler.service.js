const Blog = require('../models/Blog');
const NotificationJob = require('../models/NotificationJob');
const NotificationCampaign = require('../models/NotificationCampaign');
const AuditLog = require('../models/AuditLog');
const LoginHistory = require('../models/LoginHistory');
const { processPendingJobs } = require('./notificationQueue.service');
const { notify } = require('./notification.service');
const logger = require('../utils/logger');

/**
 * Auto-publishes any Blog post whose status is still "scheduled" but whose
 * publishedAt has arrived, then notifies its author. This is what makes
 * Blog's "scheduled" status a real, working feature rather than a value
 * nothing ever transitions out of.
 */
const processScheduledBlogs = async () => {
  const due = await Blog.find({ status: 'scheduled', publishedAt: { $lte: new Date() } });

  for (const blog of due) {
    // eslint-disable-next-line no-await-in-loop
    blog.status = 'published';
    // eslint-disable-next-line no-await-in-loop
    await blog.save();
    // eslint-disable-next-line no-await-in-loop
    await notify({
      user: blog.author,
      type: 'blog_published',
      title: 'Your post is live',
      message: `"${blog.title}" has just been published.`,
      link: `/blog/${blog.slug}`,
      variables: { title: blog.title },
    });
  }

  return due.length;
};

/**
 * Fires any admin-scheduled notification campaign whose send time has
 * arrived. Requires the controller lazily (not at module load) to avoid a
 * require-cycle at startup, since the controller also requires services
 * this file doesn't otherwise touch.
 */
const processScheduledCampaigns = async () => {
  const due = await NotificationCampaign.find({
    status: 'scheduled',
    scheduledFor: { $lte: new Date() },
  });
  if (due.length === 0) return 0;

  const { fireCampaign } = require('../controllers/notificationCampaign.controller');
  for (const campaign of due) {
    // eslint-disable-next-line no-await-in-loop
    await fireCampaign(campaign);
  }
  return due.length;
};

/** Deletes notification job records older than 30 days that finished (sent or gave up failing) — keeps the queue table from growing unbounded. */
const cleanupOldNotificationJobs = async () => {
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const result = await NotificationJob.deleteMany({ status: { $in: ['sent', 'failed'] }, updatedAt: { $lt: cutoff } });
  return result.deletedCount;
};

/** Retention: audit logs older than 1 year and login history older than 6 months are pruned. Configurable via env without a code change. */
const cleanupOldAuditRecords = async () => {
  const auditRetentionDays = parseInt(process.env.AUDIT_LOG_RETENTION_DAYS, 10) || 365;
  const loginRetentionDays = parseInt(process.env.LOGIN_HISTORY_RETENTION_DAYS, 10) || 180;

  const [auditResult, loginResult] = await Promise.all([
    AuditLog.deleteMany({ createdAt: { $lt: new Date(Date.now() - auditRetentionDays * 24 * 60 * 60 * 1000) } }),
    LoginHistory.deleteMany({ createdAt: { $lt: new Date(Date.now() - loginRetentionDays * 24 * 60 * 60 * 1000) } }),
  ]);

  return { auditLogs: auditResult.deletedCount, loginHistory: loginResult.deletedCount };
};

let intervals = [];

/**
 * Starts the in-process scheduler. Single-instance-appropriate (same
 * caveat as notificationQueue.service.js's processor) — a multi-instance
 * deployment should move this to a real cron/worker system (Phase 19 notes
 * this explicitly rather than hiding it).
 */
const startScheduler = () => {
  intervals.push(
    setInterval(async () => {
      try {
        await processPendingJobs();
      } catch (err) {
        logger.error(`Notification queue processing error: ${err.message}`);
      }
    }, 30_000) // every 30s
  );

  intervals.push(
    setInterval(async () => {
      try {
        const count = await processScheduledBlogs();
        if (count) logger.info(`${count} scheduled blog post(s) auto-published`);
      } catch (err) {
        logger.error(`Scheduled blog publishing error: ${err.message}`);
      }
    }, 60_000) // every 60s
  );

  intervals.push(
    setInterval(async () => {
      try {
        const count = await processScheduledCampaigns();
        if (count) logger.info(`${count} scheduled notification campaign(s) sent`);
      } catch (err) {
        logger.error(`Scheduled notification campaign error: ${err.message}`);
      }
    }, 60_000) // every 60s
  );

  intervals.push(
    setInterval(async () => {
      try {
        const count = await cleanupOldNotificationJobs();
        if (count) logger.info(`${count} old notification job record(s) cleaned up`);
      } catch (err) {
        logger.error(`Notification job cleanup error: ${err.message}`);
      }
    }, 6 * 60 * 60 * 1000) // every 6h
  );

  intervals.push(
    setInterval(async () => {
      try {
        const result = await cleanupOldAuditRecords();
        if (result.auditLogs || result.loginHistory) {
          logger.info(`Retention cleanup: ${result.auditLogs} audit log(s), ${result.loginHistory} login history record(s) pruned`);
        }
      } catch (err) {
        logger.error(`Audit/login history cleanup error: ${err.message}`);
      }
    }, 24 * 60 * 60 * 1000) // once a day
  );

  logger.info('Scheduler started (notification queue, scheduled blog publishing, job cleanup, audit retention)');
};

const stopScheduler = () => {
  intervals.forEach(clearInterval);
  intervals = [];
};

module.exports = { startScheduler, stopScheduler, processScheduledBlogs, processScheduledCampaigns, cleanupOldNotificationJobs, cleanupOldAuditRecords };
