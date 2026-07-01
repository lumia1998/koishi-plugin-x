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

// src/llm-core/chain/prompt.ts
var prompt_exports = {};
__export(prompt_exports, {
  ChatLunaChatPrompt: () => ChatLunaChatPrompt
});
module.exports = __toCommonJS(prompt_exports);
var import_messages = require("@langchain/core/messages");
var import_prompts = require("@langchain/core/prompts");
var import_prompt = require("koishi-plugin-chatluna/llm-core/prompt");
var import_koishi_plugin_chatluna = require("koishi-plugin-chatluna");
var import_koishi = require("koishi");
var import_langchain = require("koishi-plugin-chatluna/utils/langchain");
var import_logger = require("koishi-plugin-chatluna/utils/logger");
var ChatLunaChatPrompt = class _ChatLunaChatPrompt extends import_prompts.BaseChatPromptTemplate {
  static {
    __name(this, "ChatLunaChatPrompt");
  }
  preset;
  tokenCounter;
  conversationSummaryPrompt;
  _tempPreset;
  sendTokenLimit;
  promptRenderService;
  contextManager;
  partialVariables = {};
  _systemPrompts;
  fields;
  constructor(fields) {
    super({
      inputVariables: [
        "chat_history",
        "variables",
        "input",
        "agent_scratchpad",
        "instructions",
        "configurable"
      ]
    });
    this.partialVariables = fields.partialVariables;
    this.tokenCounter = fields.tokenCounter;
    this.sendTokenLimit = fields.sendTokenLimit ?? 4096;
    this.preset = fields.preset;
    this.promptRenderService = fields.promptRenderService;
    if (fields.contextManager == null) {
      throw new Error("contextManager is required");
    }
    this.contextManager = fields.contextManager;
    this.fields = fields;
    this._ensurePipelineRegistered();
  }
  _getPromptType() {
    return "chatluna_chat";
  }
  /**
   * Register the built-in pipeline and injection middlewares on the
   * context manager. This is done once per context manager; subsequent
   * calls (including across prompt instances) are no-ops.
   */
  _ensurePipelineRegistered() {
    const cm = this.contextManager;
    if (cm == null) {
      throw new Error("contextManager is required");
    }
    cm.ensureCoreMiddlewares(() => {
      (0, import_prompt.registerSystemPromptsMiddleware)(cm);
      (0, import_prompt.registerChatHistoryMiddleware)(cm);
      (0, import_prompt.registerLongHistoryMiddleware)(cm);
      (0, import_prompt.registerInjectionsMiddleware)(cm);
      (0, import_prompt.registerLoreBooksMiddleware)(cm);
      (0, import_prompt.registerAuthorsNoteMiddleware)(cm);
      (0, import_prompt.registerAfterUserMessageMiddleware)(cm);
      (0, import_prompt.registerReadFilesContextMiddleware)(cm);
    });
  }
  // -----------------------------------------------------------------------
  // Main entry point
  // -----------------------------------------------------------------------
  async formatMessages({
    chat_history: chatHistory,
    input,
    variables,
    agent_scratchpad: agentScratchpad,
    instructions,
    after_user_message: afterUserMessage,
    configurable
  }) {
    instructions = instructions ?? (typeof this.partialVariables?.instructions === "function" ? await this.partialVariables.instructions() : this.partialVariables?.instructions);
    if (agentScratchpad && typeof agentScratchpad === "string") {
      agentScratchpad = new import_messages.HumanMessage(agentScratchpad);
    }
    const longHistory = variables?.["long_memory"] ?? [];
    const knowledge = variables?.["knowledge"] ?? [];
    const otherDocuments = variables?.["documents"] ?? [];
    const documents = [longHistory, knowledge].concat(
      Array.isArray(otherDocuments[0]) ? otherDocuments : [otherDocuments]
    );
    const normalizedChatHistory = Array.isArray(chatHistory) ? chatHistory : typeof chatHistory === "string" ? [new import_messages.HumanMessage(chatHistory)] : [];
    const runtime = {
      result: [],
      variables: variables ?? {},
      configurable,
      usedTokens: 0,
      sendTokenLimit: this.sendTokenLimit ?? 4096,
      tokenCounter: this.tokenCounter,
      promptRenderService: this.promptRenderService,
      preset: this.preset.value,
      input,
      chatHistory: normalizedChatHistory,
      documents,
      agentScratchpad,
      instructions,
      afterUserMessage: agentScratchpad ? afterUserMessage : void 0
    };
    if (this.contextManager == null) {
      throw new Error("contextManager is required");
    }
    await this.contextManager.runPipeline(runtime);
    this._systemPrompts = runtime._systemPrompts ?? [];
    this._tempPreset = [this.preset.value, this._systemPrompts];
    if (import_koishi_plugin_chatluna.logger?.level === import_koishi.Logger.DEBUG) {
      import_koishi_plugin_chatluna.logger?.debug(
        `[Agent ${runtime.configurable?.subagentContext?.agentName || "main"}] ` + (runtime.usedTokens > runtime.sendTokenLimit ? `Used tokens: ${runtime.usedTokens} exceed limit: ${runtime.sendTokenLimit}` : `Used tokens: ${runtime.usedTokens}, token limit: ${runtime.sendTokenLimit}`)
      );
      const mapMessages = runtime.result.map((msg) => {
        const original = msg?.toDict?.();
        if (original == null) return msg;
        const content = original.data.content;
        if (Array.isArray(content)) {
          original.data.content = (0, import_langchain.truncateMessageContentUrls)(
            content
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
          );
        }
        return original;
      });
      await (0, import_logger.trackLogToLocal)(
        "ChatLunaPrompt",
        JSON.stringify(mapMessages),
        import_koishi_plugin_chatluna.logger
      );
    }
    return runtime.result;
  }
  get tempPreset() {
    return this._tempPreset?.[0];
  }
  async partial(values) {
    return this.partialSync(values);
  }
  partialSync(values) {
    const newInputVariables = this.inputVariables.filter(
      (iv) => !(iv in values)
    );
    const newPartialVariables = {
      ...this.partialVariables ?? {},
      ...values
    };
    const promptDict = {
      ...this.fields,
      inputVariables: newInputVariables,
      partialVariables: newPartialVariables
    };
    return new _ChatLunaChatPrompt(promptDict);
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  ChatLunaChatPrompt
});
