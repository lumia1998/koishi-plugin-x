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

// src/llm-core/model/in_memory.ts
var in_memory_exports = {};
__export(in_memory_exports, {
  EmptyEmbeddings: () => EmptyEmbeddings,
  emptyEmbeddings: () => emptyEmbeddings,
  inMemoryVectorStoreRetrieverProvider: () => inMemoryVectorStoreRetrieverProvider
});
module.exports = __toCommonJS(in_memory_exports);
var import_model = require("koishi-plugin-chatluna/llm-core/platform/model");
var import_retrievers = require("koishi-plugin-chatluna/llm-core/retrievers");
var import_vectorstores = require("koishi-plugin-chatluna/llm-core/vectorstores");
var InMemoryVectorStoreRetrieverProvider = class {
  static {
    __name(this, "InMemoryVectorStoreRetrieverProvider");
  }
  async createVectorStoreRetriever(params) {
    const embeddings = params.embeddings;
    const store = await import_vectorstores.MemoryVectorStore.fromExistingIndex(embeddings);
    const retriever = import_retrievers.ScoreThresholdRetriever.fromVectorStore(store, {
      minSimilarityScore: 0.85,
      // Finds results with at least this similarity score
      maxK: 100,
      // The maximum K value to use. Use it based to your chunk size to make sure you don't run out of tokens
      kIncrement: 2
      // How much to increase K by each time. It'll fetch N results, then N + kIncrement, then N + kIncrement * 2, etc.
    });
    return retriever;
  }
};
var EmptyEmbeddings = class extends import_model.ChatLunaBaseEmbeddings {
  static {
    __name(this, "EmptyEmbeddings");
  }
  constructor(params) {
    super(params ?? {});
  }
  embedDocuments(documents) {
    return Promise.resolve(documents.map(() => []));
  }
  embedQuery(_) {
    return Promise.resolve([]);
  }
};
var emptyEmbeddings = new EmptyEmbeddings();
var inMemoryVectorStoreRetrieverProvider = new InMemoryVectorStoreRetrieverProvider();
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  EmptyEmbeddings,
  emptyEmbeddings,
  inMemoryVectorStoreRetrieverProvider
});
