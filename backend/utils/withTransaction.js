const mongoose = require("mongoose");
const logger = require("./logger");

let transactionsSupported = null; // cached after first probe, null = unknown

/**
 * Runs `fn(session)` inside a Mongo transaction when the connected MongoDB
 * deployment supports them (replica set / Atlas / sharded cluster).
 *
 * Standalone MongoDB instances (common in local dev / simple Docker setups)
 * do NOT support multi-document transactions. Rather than crash the whole
 * webhook flow in that case, we detect the "Transaction numbers are only
 * allowed..." error once, cache the result, and fall back to running `fn`
 * without a session (sequential, non-atomic but still functionally correct
 * for our use case since each individual write is still atomic on its own).
 */
const withTransaction = async (fn) => {
  if (transactionsSupported === false) {
    return fn(null);
  }

  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      result = await fn(session);
    });
    transactionsSupported = true;
    return result;
  } catch (error) {
    const notSupported =
      /Transaction numbers are only allowed|IllegalOperation|transaction/i.test(error.message) &&
      /replica set|sharded cluster|standalone/i.test(error.message);

    if (notSupported || error.code === 20) {
      logger.warn(
        "MongoDB transactions are not supported on this deployment (standalone instance) — falling back to non-transactional writes for this operation.",
      );
      transactionsSupported = false;
      return fn(null);
    }
    throw error;
  } finally {
    await session.endSession();
  }
};

module.exports = { withTransaction };
