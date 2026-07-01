import { BaseMessage } from '@langchain/core/messages';
import { ChatGeneration } from '@langchain/core/outputs';
import { AgentStep } from '@langchain/core/agents';
import { BaseOutputParser } from '@langchain/core/output_parsers';
import { AgentAction, AgentFinish } from '../types';
/**
 * Type that represents an agent action with an optional message log.
 */
export type FunctionsAgentAction = AgentAction & {
    messageLog?: BaseMessage[];
};
export declare class OpenAIFunctionsAgentOutputParser extends BaseOutputParser<AgentAction | AgentFinish> {
    lc_namespace: string[];
    static lc_name(): string;
    parse(text: string): Promise<AgentAction | AgentFinish>;
    parseResult(generations: ChatGeneration[]): Promise<AgentFinish | FunctionsAgentAction>;
    /**
     * Parses the output message into a FunctionsAgentAction or AgentFinish
     * object.
     * @param message The BaseMessage to parse.
     * @returns A FunctionsAgentAction or AgentFinish object.
     */
    parseAIMessage(message: BaseMessage): FunctionsAgentAction | AgentFinish;
    getFormatInstructions(): string;
}
/**
 * Type that represents an agent action with an optional message log.
 */
export type ToolsAgentAction = AgentAction & {
    toolCallId: string;
    messageLog?: BaseMessage[];
};
export type ToolsAgentStep = AgentStep & {
    action: ToolsAgentAction;
};
export declare class OpenAIToolsAgentOutputParser extends BaseOutputParser<AgentAction[] | AgentFinish> {
    lc_namespace: string[];
    static lc_name(): string;
    parse(text: string): Promise<AgentAction[] | AgentFinish>;
    parseResult(generations: ChatGeneration[]): Promise<AgentFinish | ToolsAgentAction[]>;
    /**
     * Parses the output message into a ToolsAgentAction[] or AgentFinish
     * object.
     * @param message The BaseMessage to parse.
     * @returns A ToolsAgentAction[] or AgentFinish object.
     */
    parseAIMessage(message: BaseMessage): ToolsAgentAction[] | AgentFinish;
    getFormatInstructions(): string;
}
