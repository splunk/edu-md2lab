const LOG_LEVELS = ["info", "warn", "error", "debug"];
const CURRENT_LEVEL = process.env.LOG_LEVEL || "none";

function shouldLog(level) {
  if (level === "debug") {
    const currentIdx = LOG_LEVELS.indexOf(CURRENT_LEVEL);
    const levelIdx = LOG_LEVELS.indexOf(level);
    return levelIdx <= currentIdx;
  }
  return true;
}

const logger = {
  info: (...args) => shouldLog("info") && console.log("", ...args),
  warn: (...args) => shouldLog("warn") && console.warn(" ⚠️ ", ...args),
  error: (...args) => shouldLog("error") && console.error(" ❌ ", ...args),
  debug: (...args) => shouldLog("debug") && console.debug(" 🐛 ", ...args),
};

export default logger;
