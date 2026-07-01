import { BaseMessage } from '@langchain/core/messages';
import { BaseChatPromptTemplate, HumanMessagePromptTemplate, MessagesPlaceholder } from '@langchain/core/prompts';
import { ChainValues, PartialValues } from '@langchain/core/utils/types';
import { ChatLunaContextManagerService, PresetTemplate } from 'koishi-plugin-chatluna/llm-core/prompt';
import { SystemPrompts } from 'koishi-plugin-chatluna/llm-core/chain/base';
import type { ChatLunaPromptRenderService, RenderConfigurable } from 'koishi-plugin-chatluna/services/chat';
import { ComputedRef } from '@vue/reactivity';
export interface ChatLunaChatPromptInput {
    messagesPlaceholder?: MessagesPlaceholder;
    tokenCounter: (text: string) => Promise<number>;
    sendTokenLimit?: number;
    preset: ComputedRef<PresetTemplate>;
    partialVariables?: PartialValues;
    promptRenderService: ChatLunaPromptRenderService;
    contextManager: ChatLunaContextManagerService;
}
export interface ChatLunaChatPromptFormat {
    input: BaseMessage;
    chat_history: BaseMessage[] | string;
    variables?: ChainValues;
    agent_scratchpad?: BaseMessage[] | BaseMessage;
    instructions?: string;
    configurable?: RenderConfigurable;
    after_user_message?: BaseMessage;
}
export declare class ChatLunaChatPrompt extends BaseChatPromptTemplate<ChatLunaChatPromptFormat> implements ChatLunaChatPromptInput {
    preset: ComputedRef<PresetTemplate>;
    tokenCounter: (text: string) => Promise<number>;
    conversationSummaryPrompt?: HumanMessagePromptTemplate;
    _tempPreset?: [PresetTemplate, SystemPrompts];
    sendTokenLimit?: number;
    promptRenderService: ChatLunaPromptRenderService;
    contextManager: ChatLunaContextManagerService;
    partialVariables: PartialValues;
    private _systemPrompts;
    private fields;
    constructor(fields: ChatLunaChatPromptInput);
    _getPromptType(): "chatluna_chat";
    /**
     * Register the built-in pipeline and injection middlewares on the
     * context manager. This is done once per context manager; subsequent
     * calls (including across prompt instances) are no-ops.
     */
    private _ensurePipelineRegistered;
    formatMessages({ chat_history: chatHistory, input, variables, agent_scratchpad: agentScratchpad, instructions, after_user_message: afterUserMessage, configurable }: ChatLunaChatPromptFormat): Promise<BaseMessage[]>;
    get tempPreset(): PresetTemplate;
    partial<NewPartialVariableName extends string>(values: PartialValues<NewPartialVariableName>): Promise<ChatLunaChatPrompt>;
    partialSync<NewPartialVariableName extends string>(values: PartialValues<NewPartialVariableName>): ChatLunaChatPrompt;
}
