const Redis = require("ioredis");
const logger = require("../utils/logger");

/**
 * Same "real interface, safe fallback" pattern already used for
 * sms.service.js / push.service.js / shiprocket.service.js. No Redis
 * instance is available in the environment this was built in, so live
 * caching behavior is unverified beyond in-memory-fallback mode — but the
 * code path is real either way: with REDIS_URL configured this actually
 * caches in Redis; without it, every call is a correctly-behaving no-op
 * (get() always misses, set()/del() succeed silently), so the app works
 * identically either way, just without the performance benefit until
 * Redis is configured.
 */
let client = null;
let connectionAttempted = false;

const getClient = () => {
  if (connectionAttempted) return client;
  connectionAttempted = true;

  if (!process.env.REDIS_URL) {
    logger.warn(
      "REDIS_URL not set — API caching disabled (all cache reads will miss, all requests hit the database directly).",
    );
    return null;
  }

  try {
    client = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 1,
      retryStrategy: () => null, // don't hang retrying forever if Redis is down — just fall back to no-cache
      lazyConnect: true,
    });
    client.on("error", (err) =>
      logger.error(
        `Redis error (cache disabled for this request): ${err.message}`,
      ),
    );
    client
      .connect()
      .catch((err) => logger.error(`Redis connection failed: ${err.message}`));
    return client;
  } catch (err) {
    logger.error(`Failed to initialize Redis client: ${err.message}`);
    return null;
  }
};

const get = async (key) => {
  const c = getClient();
  if (!c) return null;
  try {
    const raw = await c.get(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null; // a cache miss is always safe — never let a cache error break the request
  }
};

const set = async (key, value, ttlSeconds = 300) => {
  const c = getClient();
  if (!c) return false;
  try {
    await c.set(key, JSON.stringify(value), "EX", ttlSeconds);
    return true;
  } catch {
    return false;
  }
};

/** Deletes every key matching `pattern` (e.g. "products:*") — used for invalidation on write. */
const invalidate = async (pattern) => {
  const c = getClient();
  if (!c) return 0;
  try {
    const keys = await c.keys(pattern);
    if (keys.length === 0) return 0;
    await c.del(...keys);
    return keys.length;
  } catch {
    return 0;
  }
};

/**
 * Express middleware factory — caches a GET route's JSON response.
 * Usage: router.get('/', cacheMiddleware('categories', 600), getCategories)
 */
const cacheMiddleware =
  (keyPrefix, ttlSeconds = 300) =>
  async (req, res, next) => {
    const key = `${keyPrefix}:${req.originalUrl}`;
    const cached = await get(key);
    if (cached) {
      res.setHeader("X-Cache", "HIT");
      return res.status(200).json(cached);
    }

    res.setHeader("X-Cache", "MISS");
    const originalJson = res.json.bind(res);
    res.json = (body) => {
      if (res.statusCode === 200) set(key, body, ttlSeconds).catch(() => {});
      return originalJson(body);
    };
    next();
  };

module.exports = { get, set, invalidate, cacheMiddleware, getClient };
