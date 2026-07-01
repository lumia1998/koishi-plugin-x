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

// src/llm-core/utils/chunk.ts
var chunk_exports = {};
__export(chunk_exports, {
  chunkArray: () => chunkArray,
  splitArray: () => splitArray
});
module.exports = __toCommonJS(chunk_exports);
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
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  chunkArray,
  splitArray
});
