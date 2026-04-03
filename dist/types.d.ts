export type McpContent = {
    type: "text";
    text: string;
};
export type McpResult = {
    content: McpContent[];
    isError?: boolean;
};
export interface ToolDef {
    name: string;
    description: string;
    inputSchema: {
        type: "object";
        properties: Record<string, unknown>;
        required?: string[];
    };
}
export interface ToolModule {
    definitions: ToolDef[];
    handle(name: string, args: Record<string, unknown>): Promise<McpResult>;
}
export declare function ok(text: string): McpResult;
export declare function err(text: string): McpResult;
export declare function missingEnv(...vars: string[]): McpResult;
//# sourceMappingURL=types.d.ts.map