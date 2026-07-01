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

// src/utils/pagination.ts
var pagination_exports = {};
__export(pagination_exports, {
  Pagination: () => Pagination
});
module.exports = __toCommonJS(pagination_exports);
var Pagination = class {
  constructor(input) {
    this.input = input;
    input.page = input.page ?? 1;
    input.limit = input.limit ?? 5;
  }
  static {
    __name(this, "Pagination");
  }
  _cacheMap = {};
  async push(items, key = "default") {
    this._cacheMap[key] = items;
  }
  async getPage(page = this.input.page, limit = this.input.limit, key = "default") {
    const items = this._cacheMap[key];
    if (!items) {
      return [];
    }
    const normalizedPage = Math.max(1, page);
    const normalizedLimit = Math.max(1, limit);
    return items.slice(
      (normalizedPage - 1) * normalizedLimit,
      Math.min(items.length, normalizedPage * normalizedLimit)
    );
  }
  async formatItems(items, page = this.input.page, limit = this.input.limit, total) {
    const buffer = [this.input.formatString.top];
    const actualTotal = total ?? Math.ceil(items.length / limit);
    const formatPromises = items.map((item) => {
      const result = this.input.formatItem(item);
      return result instanceof Promise ? result : Promise.resolve(result);
    });
    const formattedItems = await Promise.all(formatPromises);
    buffer.push(...formattedItems);
    buffer.push(this.input.formatString.bottom);
    const formattedPageString = this.input.formatString.pages.replaceAll("[page]", Math.min(actualTotal, page).toString()).replaceAll("[total]", actualTotal.toString());
    buffer.push(formattedPageString);
    return buffer.join("\n");
  }
  async getFormattedPage(page = this.input.page, limit = this.input.limit, key = "default") {
    const sliceItems = await this.getPage(page, limit, key);
    return this.formatItems(
      sliceItems,
      page,
      limit,
      Math.ceil(this._cacheMap[key].length / limit)
    );
  }
  async searchPage(find, page = this.input.page, limit = this.input.limit, key = "default") {
    const items = this._cacheMap[key]?.filter(find) ?? [];
    return this.formatItems(items, page, limit);
  }
  updateFormatString(formatString) {
    this.input.formatString = formatString;
  }
  updateFormatItem(formatItem) {
    this.input.formatItem = formatItem;
  }
  getTotalPages(key = "default") {
    const items = this._cacheMap[key];
    if (!items) return 0;
    return Math.ceil(items.length / (this.input.limit ?? 5));
  }
  hasPage(page, key = "default") {
    return page > 0 && page <= this.getTotalPages(key);
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  Pagination
});
