import { Context, Schema } from 'koishi';
export declare const name = "x";
export declare const inject: string[];
declare module 'koishi' {
    interface Context {
        puppeteer: any;
        chatluna: any;
    }
}
export interface Config {
    detectXLinks: boolean;
    enableTranslation: boolean;
    model: string;
    translationPrompt: string;
    cookies?: string;
}
export declare const Config: Schema<Config>;
export declare function apply(ctx: Context, config: Config): void;
