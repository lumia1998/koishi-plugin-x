import { ChatLunaContextManagerService, PromptPipelineMiddleware } from './context_manager';
/**
 * The `injections` pipeline stage collects all pending injections
 * (persistent + queued + inline from variables) and applies them
 * through the injection middleware chain.
 *
 * This replaces the manual `collectInjections` + `applyInjections`
 * calls that were previously scattered in ChatLunaChatPrompt.
 */
export declare function createInjectionsMiddleware(contextManager: ChatLunaContextManagerService): PromptPipelineMiddleware;
/**
 * Register the injections pipeline middleware on the context manager.
 *
 * This middleware covers the `injections`, `input`, `scratchpad`, and
 * `after_scratchpad` stages in a single pass.
 */
export declare function registerInjectionsMiddleware(contextManager: ChatLunaContextManagerService): () => void;
