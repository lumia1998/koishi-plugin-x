import { BaseMessage } from '@langchain/core/messages';
import { ChatLunaContextManagerService, PromptContextMiddleware } from './context_manager';
import { PresetTemplate } from './type';
/**
 * Handles `lore_books` injections.  Renders each matched lore book using
 * the preset's `loreBooksPrompt` template, then inserts it at the
 * appropriate position in the result message list (respecting
 * `insertPosition`).
 */
export declare function createLoreBooksMiddleware(): PromptContextMiddleware;
/**
 * Find the index in the result list where a lore book should be inserted
 * based on its `insertPosition` setting.
 */
declare function findMessageIndex(chatHistory: BaseMessage[], systemPrompts: BaseMessage[], insertPosition: PresetTemplate['loreBooks']['insertPosition'] | PresetTemplate['authorsNote']['insertPosition'] | 'before_char' | 'after_char' | 'in_chat'): number;
/**
 * Register the lore_books injection middleware on the context manager.
 */
export declare function registerLoreBooksMiddleware(contextManager: ChatLunaContextManagerService): () => void;
export { findMessageIndex };
