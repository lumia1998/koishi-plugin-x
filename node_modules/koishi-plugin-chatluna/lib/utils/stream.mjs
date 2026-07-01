var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/utils/stream.ts
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
export {
  readableStreamToAsyncIterable
};
