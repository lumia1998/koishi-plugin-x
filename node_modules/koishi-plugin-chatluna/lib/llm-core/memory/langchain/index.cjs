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

// src/llm-core/memory/langchain/index.ts
var langchain_exports = {};
__export(langchain_exports, {
  BaseChatMemory: () => BaseChatMemory,
  BufferMemory: () => BufferMemory,
  VectorStoreRetrieverMemory: () => VectorStoreRetrieverMemory,
  formatDocumentsAsString: () => formatDocumentsAsString
});
module.exports = __toCommonJS(langchain_exports);

// src/llm-core/memory/langchain/buffer_memory.ts
var import_messages = require("@langchain/core/messages");

// src/llm-core/memory/langchain/chat_memory.ts
var import_memory = require("@langchain/core/memory");
var BaseChatMemory = class extends import_memory.BaseMemory {
  static {
    __name(this, "BaseChatMemory");
  }
  chatHistory;
  returnMessages = false;
  inputKey;
  outputKey;
  constructor(fields) {
    super();
    if (!fields?.chatHistory) {
      throw new Error("chatHistory is required");
    }
    this.chatHistory = fields.chatHistory;
    this.returnMessages = fields?.returnMessages ?? this.returnMessages;
    this.inputKey = fields?.inputKey ?? this.inputKey;
    this.outputKey = fields?.outputKey ?? this.outputKey;
  }
  /**
   * Method to add user and AI messages to the chat history in sequence.
   * @param inputValues The input values from the user.
   * @param outputValues The output values from the AI.
   * @returns Promise that resolves when the context has been saved.
   */
  async saveContext(inputValues, outputValues) {
    await this.chatHistory.addUserMessage(
      (0, import_memory.getInputValue)(inputValues, this.inputKey)
    );
    await this.chatHistory.addAIChatMessage(
      (0, import_memory.getOutputValue)(outputValues, this.outputKey)
    );
  }
  /**
   * Method to clear the chat history.
   * @returns Promise that resolves when the chat history has been cleared.
   */
  async clear() {
    await this.chatHistory.clear();
  }
};

// src/llm-core/memory/langchain/buffer_memory.ts
var BufferMemory = class extends BaseChatMemory {
  static {
    __name(this, "BufferMemory");
  }
  humanPrefix = "Human";
  aiPrefix = "AI";
  memoryKey = "history";
  constructor(fields) {
    super({
      chatHistory: fields?.chatHistory,
      returnMessages: fields?.returnMessages ?? false,
      inputKey: fields?.inputKey,
      outputKey: fields?.outputKey
    });
    this.humanPrefix = fields?.humanPrefix ?? this.humanPrefix;
    this.aiPrefix = fields?.aiPrefix ?? this.aiPrefix;
    this.memoryKey = fields?.memoryKey ?? this.memoryKey;
  }
  get memoryKeys() {
    return [this.memoryKey];
  }
  /**
   * Loads the memory variables. It takes an `InputValues` object as a
   * parameter and returns a `Promise` that resolves with a
   * `MemoryVariables` object.
   * @param _values `InputValues` object.
   * @returns A `Promise` that resolves with a `MemoryVariables` object.
   */
  async loadMemoryVariables(_values) {
    const messages = await this.chatHistory.getMessages();
    if (this.returnMessages) {
      const result2 = {
        [this.memoryKey]: messages
      };
      return result2;
    }
    const result = {
      [this.memoryKey]: (0, import_messages.getBufferString)(
        messages,
        this.humanPrefix,
        this.aiPrefix
      )
    };
    return result;
  }
};

// src/llm-core/memory/langchain/vector_store.ts
var import_documents = require("@langchain/core/documents");
var import_memory2 = require("@langchain/core/memory");
var VectorStoreRetrieverMemory = class extends import_memory2.BaseMemory {
  static {
    __name(this, "VectorStoreRetrieverMemory");
  }
  vectorStoreRetriever;
  inputKey;
  memoryKey;
  returnDocs;
  metadata;
  constructor(fields) {
    super();
    this.vectorStoreRetriever = fields.vectorStoreRetriever;
    this.inputKey = fields.inputKey;
    this.memoryKey = fields.memoryKey ?? "memory";
    this.returnDocs = fields.returnDocs ?? false;
    this.metadata = fields.metadata;
  }
  get memoryKeys() {
    return [this.memoryKey];
  }
  /**
   * Method to load memory variables. It uses the vectorStoreRetriever to
   * get relevant documents based on the query obtained from the input
   * values.
   * @param values An InputValues object.
   * @returns A Promise that resolves to a MemoryVariables object.
   */
  async loadMemoryVariables(values) {
    const query = (0, import_memory2.getInputValue)(values, this.inputKey);
    const results = await this.vectorStoreRetriever.getRelevantDocuments(query);
    return {
      [this.memoryKey]: this.returnDocs ? results : formatDocumentsAsString(results)
    };
  }
  /**
   * Method to save context. It constructs a document from the input and
   * output values (excluding the memory key) and adds it to the vector
   * store database using the vectorStoreRetriever.
   * @param inputValues An InputValues object.
   * @param outputValues An OutputValues object.
   * @returns A Promise that resolves to void.
   */
  async saveContext(inputValues, outputValues) {
    const metadata = typeof this.metadata === "function" ? this.metadata(inputValues, outputValues) : this.metadata;
    const text = Object.entries(inputValues).filter(([k]) => k !== this.memoryKey).concat(Object.entries(outputValues)).map(([k, v]) => `${k}: ${v}`).join("\n");
    await this.vectorStoreRetriever.addDocuments([
      new import_documents.Document({ pageContent: text, metadata })
    ]);
  }
};
var formatDocumentsAsString = /* @__PURE__ */ __name((documents) => documents.map((doc) => doc.pageContent).join("\n\n"), "formatDocumentsAsString");
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  BaseChatMemory,
  BufferMemory,
  VectorStoreRetrieverMemory,
  formatDocumentsAsString
});
