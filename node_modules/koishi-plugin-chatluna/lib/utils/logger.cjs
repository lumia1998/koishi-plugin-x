var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/utils/logger.ts
var logger_exports = {};
__export(logger_exports, {
  clearLogger: () => clearLogger,
  createLogger: () => createLogger,
  setLoggerLevel: () => setLoggerLevel,
  trackLogToLocal: () => trackLogToLocal
});
module.exports = __toCommonJS(logger_exports);
var import_koishi = require("koishi");
var import_os = __toESM(require("os"), 1);
var import_fs = __toESM(require("fs"), 1);
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
  const tempDir = import_os.default.tmpdir();
  const logDir = `${tempDir}/chatluna/logs`;
  const logFile = `${logDir}/chatluna-log-${currentTime}.log`;
  if (!import_fs.default.existsSync(logDir)) {
    import_fs.default.mkdirSync(logDir, { recursive: true });
  }
  const writeAndCleanup = /* @__PURE__ */ __name(async () => {
    await import_fs.default.promises.writeFile(logFile, output);
    logger.info(`[${tag}] A local log file has been created at ${logFile}`);
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1e3;
    const files = await import_fs.default.promises.readdir(logDir);
    let deletedCount = 0;
    for (const file of files) {
      if (!file.startsWith("chatluna-log-") || !file.endsWith(".log")) {
        continue;
      }
      const filePath = `${logDir}/${file}`;
      let stats;
      try {
        stats = await import_fs.default.promises.stat(filePath);
      } catch {
        continue;
      }
      if (stats.mtimeMs < sevenDaysAgo) {
        try {
          await import_fs.default.promises.unlink(filePath);
          deletedCount += 1;
        } catch {
        }
        await (0, import_koishi.sleep)(0);
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
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  clearLogger,
  createLogger,
  setLoggerLevel,
  trackLogToLocal
});
