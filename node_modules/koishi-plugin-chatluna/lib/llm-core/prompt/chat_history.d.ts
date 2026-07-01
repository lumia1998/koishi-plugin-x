import { ChatLunaContextManagerService, PromptPipelineMiddleware } from './context_manager';
/**
 * Truncates conversation history to fit within the token budget, keeping
 * the most recent complete turns.  Also accounts for input + scratchpad
 * token consumption so that downstream stages know the remaining budget.
 */
export declare function createChatHistoryMiddleware(): PromptPipelineMiddleware;
/**
 * Register the chat_history pipeline middleware on the context manager.
 */
export declare function registerChatHistoryMiddleware(contextManager: ChatLunaContextManagerService): () => void;
