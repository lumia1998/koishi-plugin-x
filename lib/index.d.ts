import { Context, Schema, Logger } from 'koishi';
export declare const name = "x";
export declare const logger: Logger;
export declare const inject: {
    required: string[];
    optional: string[];
};
export interface Config {
    cookies: string;
    fetchRetries: number;
    whe_translate?: boolean;
    model?: string;
    prompt?: string;
    translateRetries?: number;
    outputLogs?: boolean;
    detectXLinks?: boolean;
    useForward?: boolean;
}
export declare const Config: Schema<Config>;
declare module 'koishi' {
    interface Context {
        chatluna: any;
        puppeteer: any;
    }
}
export declare function apply(ctx: Context, config: Config): Promise<void>;
