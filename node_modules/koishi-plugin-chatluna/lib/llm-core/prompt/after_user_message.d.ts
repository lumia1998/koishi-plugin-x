import { ChatLunaContextManagerService, PromptContextMiddleware } from './context_manager';
/**
 * Handles `after_user_message` injections by appending the value (which is
 * typically a BaseMessage or array of BaseMessages) onto the result.
 */
export declare function createAfterUserMessageMiddleware(): PromptContextMiddleware;
/**
 * Register the after_user_message injection middleware on the context
 * manager.
 */
export declare function registerAfterUserMessageMiddleware(contextManager: ChatLunaContextManagerService): () => void;
