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

// src/utils/sse.ts
var sse_exports = {};
__export(sse_exports, {
  checkResponse: () => checkResponse,
  rawSeeAsIterable: () => rawSeeAsIterable,
  sse: () => sse,
  sseIterable: () => sseIterable
});
module.exports = __toCommonJS(sse_exports);
var import_error = require("koishi-plugin-chatluna/utils/error");
var BOM = 65279;
var LF = 10;
var CR = 13;
var SPACE = 32;
var COLON = 58;
function createParser() {
  let state = "stream";
  let temp = {};
  let comment = "";
  let fieldName = "";
  let fieldValue = "";
  function* parse(data) {
    const cursor = data[Symbol.iterator]();
    let value = { done: false, value: "" };
    const looks = [];
    function lookNext(ignoreIfFn) {
      next();
      if (value.value === void 0) return;
      if (!ignoreIfFn(value)) {
        looks.push(value);
      }
    }
    __name(lookNext, "lookNext");
    function next() {
      if (looks.length > 0) {
        value = looks.shift();
        return value.done ?? false;
      }
      value = cursor.next();
      return value.done ?? false;
    }
    __name(next, "next");
    while (!next()) {
      let isLF = function() {
        if (charCode === LF) return true;
        if (charCode === CR) {
          lookNext((c) => c.value.codePointAt(0) === LF);
          return true;
        }
        return false;
      };
      __name(isLF, "isLF");
      const char = value.value;
      const charCode = char.codePointAt(0);
      switch (state) {
        case "stream":
          state = "event";
          if (charCode === BOM) break;
        // tslint:disable-next-line: no-fallthrough --> intentional fallthrough
        case "event":
          if (isLF()) {
            yield temp;
            temp = {};
          } else if (charCode === COLON) {
            state = "comment";
            comment = "";
          } else {
            state = "field";
            fieldName = char;
            fieldValue = "";
          }
          break;
        case "comment":
          if (isLF()) {
            if (temp.comments === void 0) {
              temp.comments = [];
            }
            temp.comments.push(comment);
            comment = "";
            state = "event";
          } else {
            comment += char;
          }
          break;
        case "field":
          if (charCode === COLON) {
            lookNext((c) => c.value.codePointAt(0) === SPACE);
            state = "field_value";
          } else if (isLF()) {
            if (temp[fieldName] !== void 0)
              temp[fieldName] += "\n";
            else temp[fieldName] = "";
            fieldName = "";
            fieldValue = "";
            state = "event";
          } else fieldName += char;
          break;
        case "field_value":
          if (isLF()) {
            if (temp[fieldName] !== void 0)
              temp[fieldName] += "\n" + fieldValue;
            else temp[fieldName] = fieldValue;
            fieldName = "";
            fieldValue = "";
            state = "event";
          } else fieldValue += char;
      }
    }
  }
  __name(parse, "parse");
  return (data) => parse(data);
}
__name(createParser, "createParser");
async function checkResponse(response) {
  if (!(response instanceof ReadableStreamDefaultReader || response.ok)) {
    const error = await response.text().catch(() => "");
    throw new import_error.ChatLunaError(
      import_error.ChatLunaErrorCode.NETWORK_ERROR,
      new Error(
        `${response.status} ${response.statusText} ${JSON.stringify(
          error
        )}`
      )
    );
  }
}
__name(checkResponse, "checkResponse");
async function* readSSE(reader) {
  const decoder = new TextDecoder("utf-8");
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) {
        return;
      }
      const decodeValue = decoder.decode(value, { stream: true });
      yield decodeValue;
    }
  } finally {
    reader.releaseLock();
  }
}
__name(readSSE, "readSSE");
async function sse(response, onEvent = async () => {
}, cacheCount = 0) {
  for await (const rawChunk of rawSeeAsIterable(response, cacheCount)) {
    await onEvent(rawChunk);
  }
}
__name(sse, "sse");
async function* rawSeeAsIterable(response, cacheCount = 0) {
  await checkResponse(response);
  const reader = response instanceof ReadableStreamDefaultReader ? response : response.body.getReader();
  let bufferString = "";
  let tempCount = 0;
  for await (const rawChunk of readSSE(reader)) {
    bufferString += rawChunk;
    tempCount++;
    if (tempCount > cacheCount) {
      yield bufferString;
      bufferString = "";
      tempCount = 0;
    }
  }
  if (bufferString.length > 0) {
    yield bufferString;
  }
}
__name(rawSeeAsIterable, "rawSeeAsIterable");
async function* sseIterable(response) {
  const parser = createParser();
  for await (const rawChunk of rawSeeAsIterable(response)) {
    for (const event of parser(rawChunk)) {
      yield event;
    }
  }
  return "[DONE]";
}
__name(sseIterable, "sseIterable");
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  checkResponse,
  rawSeeAsIterable,
  sse,
  sseIterable
});
