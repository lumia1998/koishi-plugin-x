var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/utils/logger.ts
import { sleep } from "koishi";
import os from "os";
import fs from "fs";
var loggers = {};
var logLevel = -1;
function createLogger(ctx, name = "chatluna") {
  const result = loggers[name] || ctx.logger(name);
  if (logLevel >= 0) {
    result.level = logLevel;
  }
  loggers[name] = result;
  return result;
}
__name(createLogger, "createLogger");
function setLoggerLevel(level) {
  logLevel = level;
  for (const name in loggers) {
    loggers[name].level = level;
  }
}
__name(setLoggerLevel, "setLoggerLevel");
function clearLogger() {
  loggers = {};
}
__name(clearLogger, "clearLogger");
async function trackLogToLocal(tag, output, logger) {
  const currentTime = (/* @__PURE__ */ new Date()).toISOString().slice(0, 19).replace("T", "-").replace(/:/g, "-");
  const tempDir = os.tmpdir();
  const logDir = `${tempDir}/chatluna/logs`;
  const logFile = `${logDir}/chatluna-log-${currentTime}.log`;
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }
  const writeAndCleanup = /* @__PURE__ */ __name(async () => {
    await fs.promises.writeFile(logFile, output);
    logger.info(`[${tag}] A local log file has been created at ${logFile}`);
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1e3;
    const files = await fs.promises.readdir(logDir);
    let deletedCount = 0;
    for (const file of files) {
      if (!file.startsWith("chatluna-log-") || !file.endsWith(".log")) {
        continue;
      }
      const filePath = `${logDir}/${file}`;
      let stats;
      try {
        stats = await fs.promises.stat(filePath);
      } catch {
        continue;
      }
      if (stats.mtimeMs < sevenDaysAgo) {
        try {
          await fs.promises.unlink(filePath);
          deletedCount += 1;
        } catch {
        }
        await sleep(0);
      }
    }
    if (deletedCount > 0) {
      logger.debug(`[${tag}] Deleted ${deletedCount} old log file(s).`);
    }
  }, "writeAndCleanup");
  setTimeout(() => {
    writeAndCleanup().catch(() => void 0);
  }, 0);
}
__name(trackLogToLocal, "trackLogToLocal");
export {
  clearLogger,
  createLogger,
  setLoggerLevel,
  trackLogToLocal
};
