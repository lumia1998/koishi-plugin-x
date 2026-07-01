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

// src/utils/stream.ts
var stream_exports = {};
__export(stream_exports, {
  readableStreamToAsyncIterable: () => readableStreamToAsyncIterable
});
module.exports = __toCommonJS(stream_exports);
function readableStreamToAsyncIterable(stream, preventCancel = false) {
  if (stream[Symbol.asyncIterator]) {
    return stream[Symbol.asyncIterator]();
  }
  const reader = stream.getReader();
  return {
    async next() {
      try {
        const result = await reader.read();
        if (result.done) reader.releaseLock();
        return result;
      } catch (e) {
        reader.releaseLock();
        throw e;
      }
    },
    async return() {
      if (!preventCancel) {
        const cancelPromise = reader.cancel();
        reader.releaseLock();
        await cancelPromise;
      } else {
        reader.releaseLock();
      }
      return { done: true, value: void 0 };
    },
    [Symbol.asyncIterator]() {
      return this;
    }
  };
}
__name(readableStreamToAsyncIterable, "readableStreamToAsyncIterable");
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  readableStreamToAsyncIterable
});
