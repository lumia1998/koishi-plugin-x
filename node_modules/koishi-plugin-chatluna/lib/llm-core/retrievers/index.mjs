var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/llm-core/retrievers/score_threshold.ts
import {
  VectorStoreRetriever
} from "@langchain/core/vectorstores";
var ScoreThresholdRetriever = class extends VectorStoreRetriever {
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
export {
  ScoreThresholdRetriever
};
