const mongoose = require('mongoose');

/**
 * A lightweight, DB-backed queue — deliberately NOT Bull/BullMQ+Redis,
 * since no Redis exists in this project yet (that infrastructure is
 * Phase 19, not built). This is honest about that tradeoff: correct and
 * durable for a single-instance deployment (jobs survive a restart, retry
 * with backoff), but a multi-instance deployment should swap the processor
 * in services/notificationQueue.service.js for a real broker to avoid two
 * instances picking up the same job — noted in docs, not hidden.
 */
const notificationJobSchema = new mongoose.Schema(
  {
    channel: { type: String, enum: ['email', 'sms', 'push'], required: true }, // in_app is written synchronously, not queued
    recipientUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    to: { type: String, required: true }, // resolved email address / phone number / device token
    subject: { type: String, default: '' },
    body: { type: String, required: true },
    status: { type: String, enum: ['pending', 'processing', 'sent', 'failed'], default: 'pending', index: true },
    attempts: { type: Number, default: 0 },
    maxAttempts: { type: Number, default: 3 },
    nextAttemptAt: { type: Date, default: Date.now, index: true },
    lastError: { type: String, default: '' },
    sentAt: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('NotificationJob', notificationJobSchema);
