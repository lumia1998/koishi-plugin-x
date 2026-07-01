var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
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
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/utils/promise.ts
var promise_exports = {};
__export(promise_exports, {
  runAsync: () => runAsync,
  runAsyncTimeout: () => runAsyncTimeout,
  withResolver: () => withResolver
});
module.exports = __toCommonJS(promise_exports);
function withResolver() {
  let resolve;
  let reject;
  const promise = new Promise((_resolve, _reject) => {
    resolve = _resolve;
    reject = _reject;
  });
  return { promise, resolve, reject };
}
__name(withResolver, "withResolver");
function runAsync(func) {
  func().then(
    () => {
    },
    (err) => {
      throw err;
    }
  );
}
__name(runAsync, "runAsync");
function runAsyncTimeout(func, timeout, defaultValue = null) {
  const timeoutPromise = new Promise((resolve, reject) => {
    setTimeout(() => {
      if (defaultValue != null) {
        resolve(defaultValue);
      } else {
        reject(new Error("timeout"));
      }
    }, timeout);
  });
  const wrappedPromise = func.catch((error) => {
    console.error(error);
    if (defaultValue != null) {
      return defaultValue;
    }
    throw new Error("timeout");
  });
  return Promise.race([wrappedPromise, timeoutPromise]);
}
__name(runAsyncTimeout, "runAsyncTimeout");
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  runAsync,
  runAsyncTimeout,
  withResolver
});
