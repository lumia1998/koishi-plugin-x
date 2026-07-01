import { ChatLunaContextManagerService, PromptContextMiddleware } from './context_manager';
/**
 * Handles `read_files_context` injections produced by the multimodal
 * file-reading tool.
 *
 * The value is a `HumanMessage` (or array of them) containing multimodal
 * content parts (image_url, audio_url, video_url, inline_data, etc.).
 * We append it directly to the result so it appears as context immediately
 * before the current user input.
 */
export declare function createReadFilesContextMiddleware(): PromptContextMiddleware;
/**
 * Register the read_files_context injection middleware on the context manager.
 */
export declare function registerReadFilesContextMiddleware(contextManager: ChatLunaContextManagerService): () => void;
