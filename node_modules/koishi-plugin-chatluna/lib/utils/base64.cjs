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

// src/utils/base64.ts
var base64_exports = {};
__export(base64_exports, {
  getBase64EncodedSize: () => getBase64EncodedSize
});
module.exports = __toCommonJS(base64_exports);
function getBase64EncodedSize(rawBytes) {
  if (!Number.isFinite(rawBytes) || rawBytes <= 0) {
    return 0;
  }
  return Math.ceil(rawBytes / 3) * 4;
}
__name(getBase64EncodedSize, "getBase64EncodedSize");
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  getBase64EncodedSize
});
