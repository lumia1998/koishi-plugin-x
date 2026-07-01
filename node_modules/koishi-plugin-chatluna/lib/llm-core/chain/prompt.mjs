var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/llm-core/chain/prompt.ts
import {
  HumanMessage
} from "@langchain/core/messages";
import {
  BaseChatPromptTemplate
} from "@langchain/core/prompts";
import {
  registerAfterUserMessageMiddleware,
  registerAuthorsNoteMiddleware,
  registerChatHistoryMiddleware,
  registerInjectionsMiddleware,
  registerLongHistoryMiddleware,
  registerLoreBooksMiddleware,
  registerReadFilesContextMiddleware,
  registerSystemPromptsMiddleware
} from "koishi-plugin-chatluna/llm-core/prompt";
import { logger } from "koishi-plugin-chatluna";
import { Logger } from "koishi";
import { truncateMessageContentUrls } from "koishi-plugin-chatluna/utils/langchain";
import { trackLogToLocal } from "koishi-plugin-chatluna/utils/logger";
var ChatLunaChatPrompt = class _ChatLunaChatPrompt extends BaseChatPromptTemplate {
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
      registerSystemPromptsMiddleware(cm);
      registerChatHistoryMiddleware(cm);
      registerLongHistoryMiddleware(cm);
      registerInjectionsMiddleware(cm);
      registerLoreBooksMiddleware(cm);
      registerAuthorsNoteMiddleware(cm);
      registerAfterUserMessageMiddleware(cm);
      registerReadFilesContextMiddleware(cm);
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
      agentScratchpad = new HumanMessage(agentScratchpad);
    }
    const longHistory = variables?.["long_memory"] ?? [];
    const knowledge = variables?.["knowledge"] ?? [];
    const otherDocuments = variables?.["documents"] ?? [];
    const documents = [longHistory, knowledge].concat(
      Array.isArray(otherDocuments[0]) ? otherDocuments : [otherDocuments]
    );
    const normalizedChatHistory = Array.isArray(chatHistory) ? chatHistory : typeof chatHistory === "string" ? [new HumanMessage(chatHistory)] : [];
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
    if (logger?.level === Logger.DEBUG) {
      logger?.debug(
        `[Agent ${runtime.configurable?.subagentContext?.agentName || "main"}] ` + (runtime.usedTokens > runtime.sendTokenLimit ? `Used tokens: ${runtime.usedTokens} exceed limit: ${runtime.sendTokenLimit}` : `Used tokens: ${runtime.usedTokens}, token limit: ${runtime.sendTokenLimit}`)
      );
      const mapMessages = runtime.result.map((msg) => {
        const original = msg?.toDict?.();
        if (original == null) return msg;
        const content = original.data.content;
        if (Array.isArray(content)) {
          original.data.content = truncateMessageContentUrls(
            content
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
          );
        }
        return original;
      });
      await trackLogToLocal(
        "ChatLunaPrompt",
        JSON.stringify(mapMessages),
        logger
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
export {
  ChatLunaChatPrompt
};
