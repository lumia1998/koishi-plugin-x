var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/llm-core/model/in_memory.ts
import { ChatLunaBaseEmbeddings } from "koishi-plugin-chatluna/llm-core/platform/model";
import { ScoreThresholdRetriever } from "koishi-plugin-chatluna/llm-core/retrievers";
import { MemoryVectorStore } from "koishi-plugin-chatluna/llm-core/vectorstores";
var InMemoryVectorStoreRetrieverProvider = class {
  static {
    __name(this, "InMemoryVectorStoreRetrieverProvider");
  }
  async createVectorStoreRetriever(params) {
    const embeddings = params.embeddings;
    const store = await MemoryVectorStore.fromExistingIndex(embeddings);
    const retriever = ScoreThresholdRetriever.fromVectorStore(store, {
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
var EmptyEmbeddings = class extends ChatLunaBaseEmbeddings {
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
export {
  EmptyEmbeddings,
  emptyEmbeddings,
  inMemoryVectorStoreRetrieverProvider
};
