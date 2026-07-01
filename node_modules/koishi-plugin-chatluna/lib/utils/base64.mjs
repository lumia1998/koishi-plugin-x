var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/utils/base64.ts
function getBase64EncodedSize(rawBytes) {
  if (!Number.isFinite(rawBytes) || rawBytes <= 0) {
    return 0;
  }
  return Math.ceil(rawBytes / 3) * 4;
}
__name(getBase64EncodedSize, "getBase64EncodedSize");
export {
  getBase64EncodedSize
};
