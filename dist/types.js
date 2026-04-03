// Shared types for all MCP tool modules
export function ok(text) {
    return { content: [{ type: "text", text }] };
}
export function err(text) {
    return { content: [{ type: "text", text }], isError: true };
}
export function missingEnv(...vars) {
    return err(`Missing required environment variable(s): ${vars.join(", ")}. ` +
        `Set them in your MCP server configuration to use this tool.`);
}
//# sourceMappingURL=types.js.map