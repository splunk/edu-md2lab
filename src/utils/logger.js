const LOG_LEVELS = ["info", "warn", "error", "debug"];
const CURRENT_LEVEL = process.env.LOG_LEVEL || "info";

function shouldLog(level) {
  const currentIdx = LOG_LEVELS.indexOf(CURRENT_LEVEL);
  const levelIdx = LOG_LEVELS.indexOf(level);
  return levelIdx <= currentIdx;
}

module.exports = {
  info: (...args) => shouldLog("info") && console.log("ℹ️", ...args),
  warn: (...args) => shouldLog("warn") && console.warn("⚠️", ...args),
  error: (...args) => shouldLog("error") && console.error("❌", ...args),
  debug: (...args) => shouldLog("debug") && console.debug("🐛", ...args),
};
