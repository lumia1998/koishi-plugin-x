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

// src/utils/object.ts
var object_exports = {};
__export(object_exports, {
  deepAssign: () => deepAssign
});
module.exports = __toCommonJS(object_exports);
function deepAssign(target, ...sources) {
  for (const src of sources) {
    for (const key in src) {
      if (!Object.prototype.hasOwnProperty.call(src, key)) {
        continue;
      }
      const value = src[key];
      if (typeof value === "object" && value !== null && !Array.isArray(value)) {
        if (!target[key] || typeof target[key] !== "object" || target[key] === null || Array.isArray(target[key])) {
          target[key] = {};
        }
        deepAssign(target[key], value);
      } else {
        target[key] = value;
      }
    }
  }
  return target;
}
__name(deepAssign, "deepAssign");
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  deepAssign
});
