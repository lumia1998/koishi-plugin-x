import { ChatLunaContextManagerService, PromptContextMiddleware } from './context_manager';
/**
 * Handles `authors_note` injections.  Renders the note content using the
 * prompt render service, counts its tokens, then inserts it at the
 * configured position in the result list.
 */
export declare function createAuthorsNoteMiddleware(): PromptContextMiddleware;
/**
 * Register the authors_note injection middleware on the context manager.
 */
export declare function registerAuthorsNoteMiddleware(contextManager: ChatLunaContextManagerService): () => void;
