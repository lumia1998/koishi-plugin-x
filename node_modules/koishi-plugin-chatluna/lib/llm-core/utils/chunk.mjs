var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/llm-core/utils/chunk.ts
var chunkArray = /* @__PURE__ */ __name((arr, chunkSize) => arr.reduce((chunks, elem, index) => {
  const chunkIndex = Math.floor(index / chunkSize);
  const chunk = chunks[chunkIndex] || [];
  chunks[chunkIndex] = chunk.concat([elem]);
  return chunks;
}, []), "chunkArray");
var splitArray = /* @__PURE__ */ __name((arr, splitSize) => {
  if (!Number.isFinite(splitSize) || splitSize <= 0) {
    throw new RangeError("splitSize must be a positive integer");
  }
  if (arr.length === 0) return [];
  return chunkArray(arr, Math.ceil(arr.length / splitSize));
}, "splitArray");
export {
  chunkArray,
  splitArray
};
