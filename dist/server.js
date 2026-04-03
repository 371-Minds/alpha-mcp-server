#!/usr/bin/env node
// Alpha MCP Server — Superintelligence Co-Pilot
// Combines GPU-Bridge AI services with Coinbase DeFi, wallet, payments, portfolio and market tools
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { gpuModule } from "./tools/gpu.js";
import { walletModule } from "./tools/wallet.js";
import { defiModule } from "./tools/defi.js";
import { paymentsModule } from "./tools/payments.js";
import { portfolioModule } from "./tools/portfolio.js";
import { marketModule } from "./tools/market.js";
import { docsModule } from "./tools/docs.js";
import { opencliModule } from "./tools/opencli.js";
// All tool modules — order determines listing order
const modules = [
    gpuModule,
    walletModule,
    defiModule,
    paymentsModule,
    portfolioModule,
    marketModule,
    docsModule,
    opencliModule,
];
// Flat list of all tool definitions
const allTools = modules.flatMap((m) => m.definitions);
// Tool name → module lookup
const toolToModule = new Map();
for (const mod of modules) {
    for (const def of mod.definitions) {
        toolToModule.set(def.name, mod);
    }
}
const server = new Server({ name: "alpha-mcp-server", version: "3.0.0" }, { capabilities: { tools: {} } });
server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: allTools,
}));
server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const mod = toolToModule.get(name);
    if (!mod) {
        return {
            content: [{ type: "text", text: `Unknown tool: ${name}` }],
            isError: true,
        };
    }
    try {
        return await mod.handle(name, (args || {}));
    }
    catch (e) {
        return {
            content: [{ type: "text", text: `Error: ${e.message}` }],
            isError: true,
        };
    }
});
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
}
main().catch(console.error);
//# sourceMappingURL=server.js.map