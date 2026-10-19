/**
 * In-memory only (resets on restart) — deliberately not a separate
 * time-series store (Prometheus/etc is real infrastructure a real
 * deployment should add; this is a zero-dependency baseline that's
 * genuinely useful without requiring anything new to run).
 */
const state = {
  requestCount: 0,
  errorCount: 0,
  totalResponseTimeMs: 0,
  slowestRoutes: new Map(), // route -> max ms seen
  statusCounts: {},
};

const recordRequest = (route, durationMs, statusCode) => {
  state.requestCount += 1;
  state.totalResponseTimeMs += durationMs;
  if (statusCode >= 500) state.errorCount += 1;
  state.statusCounts[statusCode] = (state.statusCounts[statusCode] || 0) + 1;

  const current = state.slowestRoutes.get(route) || 0;
  if (durationMs > current) state.slowestRoutes.set(route, durationMs);
};

/** Express middleware — records timing for every request. */
const metricsMiddleware = (req, res, next) => {
  const start = process.hrtime.bigint();
  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
    const route = req.route ? `${req.method} ${req.baseUrl}${req.route.path}` : `${req.method} ${req.path}`;
    recordRequest(route, durationMs, res.statusCode);
  });
  next();
};

const getMetrics = () => {
  const avgResponseTimeMs = state.requestCount > 0 ? state.totalResponseTimeMs / state.requestCount : 0;
  const slowest = [...state.slowestRoutes.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);

  return {
    requestCount: state.requestCount,
    errorCount: state.errorCount,
    errorRate: state.requestCount > 0 ? (state.errorCount / state.requestCount).toFixed(4) : '0',
    avgResponseTimeMs: Math.round(avgResponseTimeMs * 100) / 100,
    statusCounts: state.statusCounts,
    slowestRoutes: slowest.map(([route, ms]) => ({ route, maxMs: Math.round(ms * 100) / 100 })),
    uptimeSeconds: process.uptime(),
  };
};

module.exports = { metricsMiddleware, getMetrics };
