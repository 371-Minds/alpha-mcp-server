// Shared types for all MCP tool modules

export type McpContent = { type: "text"; text: string };
export type McpResult = { content: McpContent[]; isError?: boolean };

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

export function ok(text: string): McpResult {
  return { content: [{ type: "text", text }] };
}

export function err(text: string): McpResult {
  return { content: [{ type: "text", text }], isError: true };
}

export function missingEnv(...vars: string[]): McpResult {
  return err(
    `Missing required environment variable(s): ${vars.join(", ")}. ` +
      `Set them in your MCP server configuration to use this tool.`
  );
}
