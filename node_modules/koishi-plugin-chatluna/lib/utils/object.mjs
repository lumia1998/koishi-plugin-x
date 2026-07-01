var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/utils/object.ts
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
export {
  deepAssign
};
