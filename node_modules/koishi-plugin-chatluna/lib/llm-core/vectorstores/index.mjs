var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/llm-core/vectorstores/memory.ts
import {
  VectorStore
} from "@langchain/core/vectorstores";
import { Document } from "@langchain/core/documents";

// src/llm-core/utils/ml-distance/similarities.ts
function cosine(a, b) {
  let p = 0;
  let p2 = 0;
  let q2 = 0;
  for (let i = 0; i < a.length; i++) {
    p += a[i] * b[i];
    p2 += a[i] * a[i];
    q2 += b[i] * b[i];
  }
  return p / (Math.sqrt(p2) * Math.sqrt(q2));
}
__name(cosine, "cosine");

// src/llm-core/vectorstores/memory.ts
import { maximalMarginalRelevance } from "@langchain/core/utils/math";
var MemoryVectorStore = class _MemoryVectorStore extends VectorStore {
  static {
    __name(this, "MemoryVectorStore");
  }
  memoryVectors = [];
  similarity;
  _vectorstoreType() {
    return "memory";
  }
  constructor(embeddings, { similarity, ...rest } = {}) {
    super(embeddings, rest);
    this.similarity = similarity ?? cosine;
  }
  /**
   * Method to add documents to the memory vector store. It extracts the
   * text from each document, generates embeddings for them, and adds the
   * resulting vectors to the store.
   * @param documents Array of `Document` instances to be added to the store.
   * @returns Promise that resolves when all documents have been added.
   */
  async addDocuments(documents) {
    const texts = documents.map(({ pageContent }) => pageContent);
    return this.addVectors(
      await this.embeddings.embedDocuments(texts),
      documents
    );
  }
  /**
   * Method to add vectors to the memory vector store. It creates
   * `MemoryVector` instances for each vector and document pair and adds
   * them to the store.
   * @param vectors Array of vectors to be added to the store.
   * @param documents Array of `Document` instances corresponding to the vectors.
   * @returns Promise that resolves when all vectors have been added.
   */
  async addVectors(vectors, documents) {
    const memoryVectors = vectors.map((embedding, idx) => ({
      content: documents[idx].pageContent,
      embedding,
      metadata: documents[idx].metadata,
      id: documents[idx].id
    }));
    this.memoryVectors = this.memoryVectors.concat(memoryVectors);
  }
  async _queryVectors(query, k, filter) {
    const filterFunction = /* @__PURE__ */ __name((memoryVector) => {
      if (!filter) {
        return true;
      }
      const doc = new Document({
        metadata: memoryVector.metadata,
        pageContent: memoryVector.content,
        id: memoryVector.id
      });
      return filter(doc);
    }, "filterFunction");
    const filteredMemoryVectors = this.memoryVectors.filter(filterFunction);
    return filteredMemoryVectors.map((vector, index) => ({
      similarity: this.similarity(query, vector.embedding),
      index,
      metadata: vector.metadata,
      content: vector.content,
      embedding: vector.embedding,
      id: vector.id
    })).sort((a, b) => a.similarity > b.similarity ? -1 : 0).slice(0, k);
  }
  /**
   * Method to perform a similarity search in the memory vector store. It
   * calculates the similarity between the query vector and each vector in
   * the store, sorts the results by similarity, and returns the top `k`
   * results along with their scores.
   * @param query Query vector to compare against the vectors in the store.
   * @param k Number of top results to return.
   * @param filter Optional filter function to apply to the vectors before performing the search.
   * @returns Promise that resolves with an array of tuples, each containing a `Document` and its similarity score.
   */
  async similaritySearchVectorWithScore(query, k, filter) {
    const searches = await this._queryVectors(query, k, filter);
    const result = searches.map((search) => [
      new Document({
        metadata: search.metadata,
        pageContent: search.content,
        id: search.id
      }),
      search.similarity
    ]);
    return result;
  }
  async maxMarginalRelevanceSearch(query, options) {
    const queryEmbedding = await this.embeddings.embedQuery(query);
    const searches = await this._queryVectors(
      queryEmbedding,
      options.fetchK ?? 20,
      options.filter
    );
    const embeddingList = searches.map((searchResp) => searchResp.embedding);
    const mmrIndexes = maximalMarginalRelevance(
      queryEmbedding,
      embeddingList,
      options.lambda,
      options.k
    );
    return mmrIndexes.map(
      (idx) => new Document({
        metadata: searches[idx].metadata,
        pageContent: searches[idx].content,
        id: searches[idx].id
      })
    );
  }
  /**
   * Static method to create a `MemoryVectorStore` instance from an array of
   * texts. It creates a `Document` for each text and metadata pair, and
   * adds them to the store.
   * @param texts Array of texts to be added to the store.
   * @param metadatas Array or single object of metadata corresponding to the texts.
   * @param embeddings `Embeddings` instance used to generate embeddings for the texts.
   * @param dbConfig Optional `MemoryVectorStoreArgs` to configure the `MemoryVectorStore` instance.
   * @returns Promise that resolves with a new `MemoryVectorStore` instance.
   */
  static async fromTexts(texts, metadatas, embeddings, dbConfig) {
    const docs = [];
    for (let i = 0; i < texts.length; i += 1) {
      const metadata = Array.isArray(metadatas) ? metadatas[i] : metadatas;
      const newDoc = new Document({
        pageContent: texts[i],
        metadata
      });
      docs.push(newDoc);
    }
    return _MemoryVectorStore.fromDocuments(docs, embeddings, dbConfig);
  }
  /**
   * Static method to create a `MemoryVectorStore` instance from an array of
   * `Document` instances. It adds the documents to the store.
   * @param docs Array of `Document` instances to be added to the store.
   * @param embeddings `Embeddings` instance used to generate embeddings for the documents.
   * @param dbConfig Optional `MemoryVectorStoreArgs` to configure the `MemoryVectorStore` instance.
   * @returns Promise that resolves with a new `MemoryVectorStore` instance.
   */
  static async fromDocuments(docs, embeddings, dbConfig) {
    const instance = new this(embeddings, dbConfig);
    await instance.addDocuments(docs);
    return instance;
  }
  /**
   * Static method to create a `MemoryVectorStore` instance from an existing
   * index. It creates a new `MemoryVectorStore` instance without adding any
   * documents or vectors.
   * @param embeddings `Embeddings` instance used to generate embeddings for the documents.
   * @param dbConfig Optional `MemoryVectorStoreArgs` to configure the `MemoryVectorStore` instance.
   * @returns Promise that resolves with a new `MemoryVectorStore` instance.
   */
  static async fromExistingIndex(embeddings, dbConfig) {
    const instance = new this(embeddings, dbConfig);
    return instance;
  }
};

// src/llm-core/vectorstores/base.ts
import { VectorStore as VectorStore2 } from "@langchain/core/vectorstores";
import {
  chunkArray,
  splitArray
} from "koishi-plugin-chatluna/llm-core/utils/chunk";
import {
  ChatLunaError,
  ChatLunaErrorCode
} from "koishi-plugin-chatluna/utils/error";
import { randomUUID } from "node:crypto";
var ChatLunaSaveableVectorStore = class extends VectorStore2 {
  static {
    __name(this, "ChatLunaSaveableVectorStore");
  }
  _isActive = true;
  _store;
  _docstore;
  constructor(input) {
    super(input.embeddings, {});
    this._store = input.store;
    this._docstore = input.docstore;
  }
  async editDocument(oldDocumentId, newDocument) {
    this.checkActive();
    await this.delete({ ids: [oldDocumentId] });
    await this.addDocuments([newDocument]);
  }
  async addVectors(vectors, documents, options) {
    this.checkActive();
    const ids = await this._store.addVectors(vectors, documents, options);
    await this.save();
    return ids;
  }
  async addDocuments(documents, options) {
    this.checkActive();
    const ids = await this._store.addDocuments(documents, options);
    await this._docstore.add(
      Object.fromEntries(
        documents.map((document) => [
          document.id || document.metadata["raw_id"] || randomUUID(),
          document
        ])
      )
    );
    await this.save();
    return ids;
  }
  similaritySearchVectorWithScore(query, k, filter) {
    if (query.length === 0) {
      throw new Error("Embedding dimension is 0");
    }
    return this._store.similaritySearchVectorWithScore(query, k, filter);
  }
  async save() {
    this.checkActive();
  }
  async delete(options) {
    this.checkActive();
    const ids = [];
    if (options.deleteAll) {
      await this._docstore.delete({ deleteAll: true });
      await this.save();
      return;
    }
    if (options.ids) {
      ids.push(...options.ids);
    }
    if (options.documents) {
      const documentIds = options.documents?.map((document) => {
        return document.id ?? document.metadata?.raw_id;
      }).filter((id) => id != null);
      ids.push(...documentIds);
    }
    if (!ids || ids.length === 0) return;
    await this._docstore.delete({ ids });
    await this.save();
  }
  _vectorstoreType() {
    return this._store?._vectorstoreType() ?? "chatluna";
  }
  async reIndex() {
    await this.delete({ deleteAll: true });
    const documents = await this.docstore.list();
    const chunkedArray = chunkArray(documents, 30);
    const chunkedPromise = splitArray(
      chunkedArray.map((chunk) => this.addDocuments(chunk)),
      6
    );
    for (const promise of chunkedPromise) {
      await Promise.all(promise);
    }
  }
  get docstore() {
    return this._docstore;
  }
  checkActive(throwError = true) {
    if (!this._isActive && throwError) {
      throw new ChatLunaError(
        ChatLunaErrorCode.VECTOR_STORE_NOT_ACTIVE,
        Error("VectorStore is not active")
      );
    }
    return this._isActive;
  }
  async free() {
    this._isActive = false;
    this._store = void 0;
    this._docstore = void 0;
  }
};

// src/llm-core/vectorstores/database.ts
import { Document as Document2 } from "@langchain/core/documents";
import { $ } from "koishi";
var DataBaseDocstore = class {
  constructor(ctx, key) {
    this.ctx = ctx;
    this.key = key;
    this.ctx.runtime.inject["database"] = {
      required: false
    };
  }
  static {
    __name(this, "DataBaseDocstore");
  }
  /**
   * Searches for a document in the store based on its ID.
   * @param search The ID of the document to search for.
   * @returns The document with the given ID.
   */
  async get(search) {
    const document = await this.ctx.database.get("chatluna_docstore", {
      key: this.key,
      id: search
    });
    if (!document || document.length === 0)
      throw new Error(`Document with id ${search} does not exist.`);
    if (document.length > 1)
      throw new Error(`More than one document with id ${search} exists.`);
    return asDocument(document[0]);
  }
  /**
   * Adds new documents to the store.
   * @param texts An object where the keys are document IDs and the values are the documents themselves.
   * @returns Void
   */
  async add(texts) {
    const documents = Object.keys(texts).map(
      (id) => toStoredDocument(texts[id], this.key, id)
    );
    await this.ctx.database.upsert("chatluna_docstore", documents);
  }
  async list(options) {
    if (!options) {
      return (await this.ctx.database.get("chatluna_docstore", {
        key: this.key
      })).map(asDocument);
    }
    return await this.ctx.database.select("chatluna_docstore").where(
      (row) => $.and(
        $.eq(row.key, this.key),
        ...options.ids?.length > 0 ? [$.in(row.id, options.ids)] : []
      )
    ).orderBy((row) => row.createdAt, "asc").limit(options.limit ?? 10).offset(options.offset ?? 0).execute().then((rows) => rows.map(asDocument));
  }
  async delete(options) {
    const { deleteAll, ids } = options;
    if (deleteAll) {
      await this.ctx.database.remove("chatluna_docstore", {
        key: this.key
      });
      return;
    }
    await this.ctx.database.remove("chatluna_docstore", {
      key: this.key,
      id: ids
    });
  }
  async stat() {
    const count = await this.ctx.database.select("chatluna_docstore").where((row) => $.eq(row.key, this.key)).execute((row) => $.count(row.id));
    const lastUpdated = await this.ctx.database.select("chatluna_docstore").where((row) => $.eq(row.key, this.key)).execute((row) => $.max(row.createdAt));
    return {
      count,
      lastUpdated
    };
  }
};
function asDocument(document) {
  return new Document2({
    pageContent: document.pageContent,
    metadata: {
      ...document.metadata,
      createdAt: document.createdAt
    },
    id: document.id
  });
}
__name(asDocument, "asDocument");
function toStoredDocument(document, key, id) {
  document.id = id ?? document.id;
  return {
    pageContent: document.pageContent,
    id: document.id,
    metadata: document.metadata,
    createdAt: /* @__PURE__ */ new Date(),
    key
  };
}
__name(toStoredDocument, "toStoredDocument");
export {
  ChatLunaSaveableVectorStore,
  DataBaseDocstore,
  MemoryVectorStore,
  asDocument,
  toStoredDocument
};
