const fs = require('fs');
const path = require('path');

const logsDir = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

const timestamp = () => new Date().toISOString();

// Daily rotation: log files are date-stamped (combined-2026-08-01.log), so a
// new file starts automatically each day with no extra dependency needed.
// The un-dated `combined.log` / `error.log` files are kept as symlink-like
// "latest" copies for tools/scripts that expect a fixed filename.
const todayStamp = () => new Date().toISOString().slice(0, 10); // YYYY-MM-DD

const datedPath = (baseName) => path.join(logsDir, `${baseName}-${todayStamp()}.log`);
const latestPath = (baseName) => path.join(logsDir, `${baseName}.log`);

const writeToFile = (baseName, message) => {
  const line = message + '\n';
  fs.appendFile(datedPath(baseName), line, (err) => {
    if (err) console.error('Failed to write dated log:', err.message);
  });
  fs.appendFile(latestPath(baseName), line, (err) => {
    if (err) console.error('Failed to write latest log:', err.message);
  });
};

// Best-effort cleanup of dated log files older than the retention window.
// Runs once at startup and then once every 24h — cheap enough not to need
// a cron job or extra dependency.
const RETENTION_DAYS = Number(process.env.LOG_RETENTION_DAYS) || 14;
const cleanupOldLogs = () => {
  fs.readdir(logsDir, (err, files) => {
    if (err) return;
    const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
    files.forEach((file) => {
      const match = file.match(/-(\d{4}-\d{2}-\d{2})\.log$/);
      if (!match) return; // skip combined.log / error.log "latest" files
      const fileDate = new Date(match[1]).getTime();
      if (fileDate < cutoff) {
        fs.unlink(path.join(logsDir, file), () => {});
      }
    });
  });
};
cleanupOldLogs();
setInterval(cleanupOldLogs, 24 * 60 * 60 * 1000).unref();

const format = (level, message) => `[${timestamp()}] [${level.toUpperCase()}] ${message}`;

const logger = {
  info: (message) => {
    const line = format('info', message);
    console.log(line);
    writeToFile('combined', line);
  },
  warn: (message) => {
    const line = format('warn', message);
    console.warn(line);
    writeToFile('combined', line);
  },
  error: (message) => {
    const line = format('error', message);
    console.error(line);
    writeToFile('combined', line);
    writeToFile('error', line);
  },
  debug: (message) => {
    if (process.env.NODE_ENV !== 'production') {
      const line = format('debug', message);
      console.debug(line);
      writeToFile('combined', line);
    }
  },
};

module.exports = logger;
