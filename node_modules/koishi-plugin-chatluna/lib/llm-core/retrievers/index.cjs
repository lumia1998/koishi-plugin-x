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

// src/llm-core/retrievers/index.ts
var retrievers_exports = {};
__export(retrievers_exports, {
  ScoreThresholdRetriever: () => ScoreThresholdRetriever
});
module.exports = __toCommonJS(retrievers_exports);

// src/llm-core/retrievers/score_threshold.ts
var import_vectorstores = require("@langchain/core/vectorstores");
var ScoreThresholdRetriever = class extends import_vectorstores.VectorStoreRetriever {
  static {
    __name(this, "ScoreThresholdRetriever");
  }
  minSimilarityScore;
  kIncrement = 10;
  maxK = 100;
  constructor(input) {
    super(input);
    this.maxK = input.maxK ?? this.maxK;
    this.minSimilarityScore = input.minSimilarityScore ?? this.minSimilarityScore;
    this.kIncrement = input.kIncrement ?? this.kIncrement;
  }
  async getRelevantDocuments(query) {
    let currentK = 0;
    let filteredResults = [];
    do {
      currentK += this.kIncrement;
      const results = await this.vectorStore.similaritySearchWithScore(
        query,
        currentK,
        this.filter
      );
      filteredResults = results.filter(
        ([, score]) => score >= this.minSimilarityScore
      );
    } while (filteredResults.length >= currentK && currentK < this.maxK);
    return filteredResults.map((documents) => documents[0]).slice(0, this.maxK);
  }
  static fromVectorStore(vectorStore, options) {
    return new this({ ...options, vectorStore });
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  ScoreThresholdRetriever
});
