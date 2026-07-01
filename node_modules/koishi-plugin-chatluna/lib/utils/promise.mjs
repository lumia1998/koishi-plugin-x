var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/utils/promise.ts
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
export {
  runAsync,
  runAsyncTimeout,
  withResolver
};
