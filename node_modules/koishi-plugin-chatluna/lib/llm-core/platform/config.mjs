var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/llm-core/platform/config.ts
import { createHash } from "crypto";
import {
  ChatLunaError,
  ChatLunaErrorCode
} from "koishi-plugin-chatluna/utils/error";
var ClientConfigPool = class {
  constructor(ctx, mode = 1 /* AlwaysTheSame */) {
    this.ctx = ctx;
    this._mode = mode;
    ctx.setInterval(() => {
      const now = Date.now();
      this._configs.forEach((config) => {
        this._updateConfigAvailability(config, now);
      });
    }, 1e3 * 10);
  }
  static {
    __name(this, "ClientConfigPool");
  }
  _configs = [];
  _mode = 1 /* AlwaysTheSame */;
  _currentLoadConfigIndex = 0;
  LOCK_DURATIONS = [
    1e3,
    5 * 1e3,
    10 * 1e3,
    30 * 1e3,
    60 * 1e3,
    2 * 60 * 1e3,
    3 * 60 * 1e3,
    5 * 60 * 1e3,
    10 * 60 * 1e3
  ];
  FAILURE_RESET_WINDOW = 5 * 60 * 1e3;
  MAX_FAILURES_WINDOW = 30 * 60 * 1e3;
  addConfig(config) {
    const wrapperConfig = this._createWrapperConfig(config);
    this._configs.push(wrapperConfig);
    this._updateConfigAvailability(wrapperConfig);
  }
  findAvailableConfig() {
    const now = Date.now();
    return this._configs.find((config) => {
      this._updateConfigAvailability(config, now);
      return config.isAvailable;
    });
  }
  getConfig(lockSelectConfig = false) {
    const now = Date.now();
    switch (this._mode) {
      case 1 /* AlwaysTheSame */:
        return this._getFirstAvailableConfig(now);
      case 0 /* LoadBalancing */:
      case 2 /* RoundRobin */:
        return this._getRoundRobinConfig(now, lockSelectConfig);
      case 3 /* Random */:
        return this._getRandomConfig(now);
      default:
        return this._getFirstAvailableConfig(now);
    }
  }
  getConfigs() {
    return this._configs;
  }
  markConfigStatus(config, isAvailable) {
    const key = this._getConfigMD5(config);
    const wrapper = this._configs.find((c) => c.md5() === key);
    if (!wrapper) return;
    const now = Date.now();
    if (isAvailable) {
      wrapper.isAvailable = true;
      wrapper.lockUntil = void 0;
      wrapper.failureCount = 0;
      wrapper.lastFailureTime = void 0;
    } else {
      this._applyFailureLock(wrapper, now);
    }
  }
  _getConfigMD5(config) {
    const values = Object.keys(config).sort().map((key) => config[key]);
    return createHash("md5").update(values.join("")).digest("hex");
  }
  _createWrapperConfig(config) {
    const wrapper = {
      value: config,
      md5: /* @__PURE__ */ __name(() => {
        if (wrapper._md5 == null) {
          wrapper._md5 = this._getConfigMD5(config);
        }
        return wrapper._md5;
      }, "md5"),
      isAvailable: true,
      failureCount: 0
    };
    return wrapper;
  }
  _getFirstAvailableConfig(now) {
    const config = this.findAvailableConfig();
    if (!config) {
      throw new ChatLunaError(ChatLunaErrorCode.NOT_AVAILABLE_CONFIG);
    }
    return config;
  }
  _getRoundRobinConfig(now, lockSelectConfig) {
    if (this._configs.length === 0) {
      throw new ChatLunaError(ChatLunaErrorCode.NOT_AVAILABLE_CONFIG);
    }
    const startIndex = this._currentLoadConfigIndex;
    do {
      const config = this._configs[this._currentLoadConfigIndex];
      if (config) {
        this._updateConfigAvailability(config, now);
        if (config.isAvailable) {
          if (!lockSelectConfig) {
            this._currentLoadConfigIndex = (this._currentLoadConfigIndex + 1) % this._configs.length;
          }
          return config;
        }
      }
      this._currentLoadConfigIndex = (this._currentLoadConfigIndex + 1) % this._configs.length;
    } while (this._currentLoadConfigIndex !== startIndex);
    throw new ChatLunaError(ChatLunaErrorCode.NOT_AVAILABLE_CONFIG);
  }
  _getRandomConfig(now) {
    const availableConfigs = this._configs.filter((config) => {
      this._updateConfigAvailability(config, now);
      return config.isAvailable;
    });
    if (availableConfigs.length === 0) {
      throw new ChatLunaError(ChatLunaErrorCode.NOT_AVAILABLE_CONFIG);
    }
    const randomIndex = Math.floor(Math.random() * availableConfigs.length);
    return availableConfigs[randomIndex];
  }
  _updateConfigAvailability(wrapper, now = Date.now()) {
    if (wrapper.lockUntil && now >= wrapper.lockUntil) {
      wrapper.isAvailable = true;
      wrapper.lockUntil = void 0;
    }
    if (wrapper.lastFailureTime && now - wrapper.lastFailureTime > this.FAILURE_RESET_WINDOW) {
      wrapper.failureCount = 0;
      wrapper.lastFailureTime = void 0;
      wrapper.isAvailable = true;
    }
    if (wrapper.lockUntil && now < wrapper.lockUntil) {
      wrapper.isAvailable = false;
    }
  }
  _applyFailureLock(wrapper, now) {
    wrapper.failureCount += 1;
    wrapper.lastFailureTime = now;
    wrapper.isAvailable = false;
    const lockIndex = Math.min(
      wrapper.failureCount - 1,
      this.LOCK_DURATIONS.length - 1
    );
    const lockDuration = this.LOCK_DURATIONS[lockIndex];
    if (wrapper.failureCount === 2 && wrapper.lastFailureTime && now - wrapper.lastFailureTime > this.MAX_FAILURES_WINDOW) {
      wrapper.failureCount = 1;
    }
    wrapper.lockUntil = now + lockDuration;
  }
};
var ClientConfigPoolMode = /* @__PURE__ */ ((ClientConfigPoolMode2) => {
  ClientConfigPoolMode2[ClientConfigPoolMode2["LoadBalancing"] = 0] = "LoadBalancing";
  ClientConfigPoolMode2[ClientConfigPoolMode2["AlwaysTheSame"] = 1] = "AlwaysTheSame";
  ClientConfigPoolMode2[ClientConfigPoolMode2["RoundRobin"] = 2] = "RoundRobin";
  ClientConfigPoolMode2[ClientConfigPoolMode2["Random"] = 3] = "Random";
  return ClientConfigPoolMode2;
})(ClientConfigPoolMode || {});
export {
  ClientConfigPool,
  ClientConfigPoolMode
};
