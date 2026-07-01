import { ChatLunaContextManagerService, PromptPipelineMiddleware } from './context_manager';
/**
 * Formats document collections (long memory, knowledge, other documents)
 * into the conversation context using the preset's `longMemoryPrompt`
 * template.  Each document collection is rendered and appended after the
 * history messages.
 *
 * The conversation summary prompt template is expected on
 * `runtime._conversationSummaryPrompt` (set by system_prompts middleware).
 */
export declare function createLongHistoryMiddleware(): PromptPipelineMiddleware;
/**
 * Register the long_history pipeline middleware on the context manager.
 */
export declare function registerLongHistoryMiddleware(contextManager: ChatLunaContextManagerService): () => void;
