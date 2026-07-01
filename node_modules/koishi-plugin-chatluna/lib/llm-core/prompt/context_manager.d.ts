import { BaseMessage } from '@langchain/core/messages';
import { Document } from '@langchain/core/documents';
import { ChainValues } from '@langchain/core/utils/types';
import { AuthorsNote, PresetTemplate, RoleBook } from './type';
import type { ChatLunaPromptRenderService, RenderConfigurable } from '../../services/chat';
import { Context } from 'koishi';
/**
 * Built-in pipeline stages executed in order during prompt assembly.
 *
 * Custom string stages are also allowed; they run after all built-in stages
 * unless an explicit order is given.
 */
export type PromptPipelineStage = 'system_prompts' | 'after_system_prompts' | 'chat_history' | 'long_history' | 'injections' | 'input' | 'scratchpad' | 'after_scratchpad' | string;
/** Canonical ordering for built-in stages. */
export declare const STAGE_ORDER: Record<string, number>;
/**
 * An injection anchored between two messages in the conversation context,
 * identified by `BaseMessage.id`.
 *
 * At collection time every message in the assembled result that lacks an
 * `.id` is stamped with a generated one.  An injection whose
 * `afterMessageId` is no longer found in the current result is immediately
 * pruned from persistent storage — it is considered permanently stale.
 *
 * If only `afterMessageId` is given, the content is inserted after that
 * message.  If only `beforeMessageId` is given, it is inserted before it.
 * If neither is given, the content is appended at the end of the stage.
 */
export interface AnchoredInjection {
    id: string;
    name: string;
    value: unknown;
    /** Insert after the message whose `BaseMessage.id` matches. */
    afterMessageId?: string;
    /** Insert before the message whose `BaseMessage.id` matches. */
    beforeMessageId?: string;
    /** Pipeline stage where this injection should be applied. */
    stage: PromptPipelineStage;
    /** Lower priority = earlier execution within the same stage. */
    priority: number;
    createdAt: number;
    /**
     * If true the injection is removed after a single collection cycle.
     * Otherwise it persists until its `afterMessageId` anchor disappears
     * from the assembled result or it is explicitly removed.
     */
    once?: boolean;
}
export interface PromptContextRuntime {
    /** The final message array being assembled (mutated in place). */
    result: BaseMessage[];
    /** Template / chat variables. */
    variables: ChainValues;
    /** Per-request configurable (session, conversationId, …). */
    configurable?: RenderConfigurable;
    /** Running token count consumed so far. */
    usedTokens: number;
    /** Hard ceiling for the whole prompt. */
    sendTokenLimit: number;
    /** Counts tokens for an arbitrary string. */
    tokenCounter: (text: string) => Promise<number>;
    /** Render service for template expansion. */
    promptRenderService: ChatLunaPromptRenderService;
    /** The preset in use for this request. */
    preset: PresetTemplate;
    /** The current user input message. */
    input?: BaseMessage;
    /** Raw chat history before truncation. */
    chatHistory?: BaseMessage[];
    /** Document collections (long_memory, knowledge, other docs). */
    documents?: Document[][];
    /** Agent scratchpad messages, if any. */
    agentScratchpad?: BaseMessage[] | BaseMessage;
    /** Instructions (e.g. partial variable). */
    instructions?: string;
    /** Message inserted after user message in agent mode. */
    afterUserMessage?: BaseMessage;
}
export interface PromptContextMiddlewareContext {
    injection: AnchoredInjection;
    runtime: PromptContextRuntime;
    handled: boolean;
    markHandled: () => void;
    /** Helper to convert raw values to messages and push onto result. */
    appendMessages: (input: BaseMessage | BaseMessage[] | string | string[]) => BaseMessage[];
    /**
     * Insert messages at the anchor position described by the injection.
     * Returns the index where the first message was inserted.
     */
    insertAtAnchor: (messages: BaseMessage | BaseMessage[]) => number;
}
export type PromptContextMiddleware = (context: PromptContextMiddlewareContext, next: () => Promise<void>) => Promise<void>;
/**
 * A pipeline middleware handles an entire stage of prompt assembly.
 *
 * Unlike injection middlewares (which handle a single `AnchoredInjection`),
 * pipeline middlewares are responsible for a whole stage and receive the full
 * runtime context to produce their output.
 */
export type PromptPipelineMiddleware = (runtime: PromptContextRuntime, next: () => Promise<void>) => Promise<void>;
export interface PipelineMiddlewareEntry {
    stage: PromptPipelineStage;
    middleware: PromptPipelineMiddleware;
    priority: number;
}
export interface InjectPromptContextOptions {
    name: string;
    value: unknown;
    conversationId?: string;
    stage?: PromptPipelineStage;
    /**
     * Anchor: insert after the message whose `BaseMessage.id` equals this
     * value.  The injection is considered stale and will be pruned the
     * moment this message is no longer present in the assembled result.
     */
    afterMessageId?: string;
    /**
     * Anchor: insert before the message whose `BaseMessage.id` equals this
     * value.
     */
    beforeMessageId?: string;
    /** If true the injection is consumed after one collection cycle. */
    once?: boolean;
    priority?: number;
}
export interface CollectPromptContextOptions {
    variables?: ChainValues;
    configurable?: RenderConfigurable;
    afterUserMessage?: BaseMessage;
    /**
     * The messages assembled so far in the current pipeline run (i.e.
     * `runtime.result` at the moment the injections stage fires).
     *
     * `collectInjections` will:
     * 1. Stamp a generated `id` on any message that has none.
     * 2. Build the live id set from these messages.
     * 3. Prune persistent injections whose `afterMessageId` is no longer
     *    present — they are dropped from storage immediately.
     */
    currentMessages: BaseMessage[];
}
export type PromptInjectionStage = PromptPipelineStage;
export type PromptContextInjection = AnchoredInjection;
export interface PromptContextInjectionCollection {
    beforeScratchpad: AnchoredInjection[];
    afterScratchpad: AnchoredInjection[];
}
export interface PromptContextRuntimeHelpers {
    formatLoreBooks?: (loreBooks: RoleBook[], usedTokens: number, result: BaseMessage[], variables: ChainValues) => Promise<number>;
    counterAuthorsNote?: (authorsNote: AuthorsNote, variables?: ChainValues, configurable?: RenderConfigurable) => Promise<[string, number]>;
    formatAuthorsNote?: (authorsNote: AuthorsNote, result: BaseMessage[], formatResult: [string, number]) => void | number;
}
export declare class ChatLunaContextManagerService {
    private _middlewares;
    private _pipelineMiddlewares;
    private _conversationPersistent;
    private _conversationQueue;
    private _skillProviders;
    private _coreRegistered;
    ensureCoreMiddlewares(register: () => void): void;
    constructor(ctx: Context);
    /**
     * Register a pipeline middleware for a given stage.
     *
     * Pipeline middlewares execute in `(stage-order, priority)` order.
     * Lower priority = earlier within the same stage.
     *
     * Returns a disposer function.
     */
    pipeline(stage: PromptPipelineStage, middleware: PromptPipelineMiddleware, priority?: number): () => void;
    /**
     * Execute the full pipeline.  Each registered pipeline middleware is
     * called in order.  The `next()` function advances to the next
     * middleware.
     */
    runPipeline(runtime: PromptContextRuntime): Promise<void>;
    intercept(name: string, middleware: PromptContextMiddleware, priority?: number): () => void;
    replace(name: string, middleware: PromptContextMiddleware): () => void;
    has(name: string): boolean;
    /**
     * Inject content into a conversation's context.
     *
     * Content can be anchored between two messages (by message ID).  As long
     * as both anchor messages exist in the assembled prompt, the injection
     * will be placed between them.
     *
     * If `once` is true the injection is consumed after one collection.
     * Otherwise it persists until the anchor messages are gone or it is
     * cleared.
     */
    inject(options: InjectPromptContextOptions): void;
    /**
     * Remove a specific persistent injection by id.
     */
    removeInjection(conversationId: string, injectionId: string): boolean;
    collectInjections({ variables, configurable, afterUserMessage, currentMessages }: CollectPromptContextOptions): PromptContextInjectionCollection;
    applyInjections(injections: AnchoredInjection[], runtime: PromptContextRuntime): Promise<PromptContextRuntime>;
    /**
     * Find the index in `messages` where content anchored by
     * `afterMessageId` / `beforeMessageId` should be inserted.
     *
     * Matches against `BaseMessage.id`.  Returns the splice index.
     */
    static findAnchorIndex(messages: BaseMessage[], afterMessageId?: string, beforeMessageId?: string): number;
    /**
     * Return true when all specified anchor messages are present in
     * `messages` (matched by `BaseMessage.id`).
     */
    static anchorsExist(messages: BaseMessage[], afterMessageId?: string, beforeMessageId?: string): boolean;
    clearConversation(conversationId: string): void;
    clearAll(): void;
    registerSkillProvider(provider: unknown): () => void;
    private _createInjection;
    private _resolveDefaultStage;
    private _createId;
    private _addToStore;
    private _applySingleInjection;
}
export declare function toMessages(input: unknown): BaseMessage[];
