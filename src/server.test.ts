/**
 * Cross-module sanity tests that verify the server's tool routing assumptions:
 * - All modules export correct { definitions, handle } shape
 * - Tool names are unique across the entire server
 * - Every definition name is routeable through its module's handle
 */

import { describe, it, expect, mock } from "bun:test";

// ---------------------------------------------------------------------------
// Mocks needed by walletModule and defiModule at import time
// ---------------------------------------------------------------------------

mock.module("@coinbase/cdp-sdk", () => ({
  CdpClient: mock().mockImplementation(() => ({ evm: {} })),
}));

mock.module("@coinbase/agentkit", () => ({
  PythActionProvider: mock().mockImplementation(() => ({})),
  MessariActionProvider: mock().mockImplementation(() => ({})),
  FarcasterActionProvider: mock().mockImplementation(() => ({})),
  MorphoActionProvider: mock().mockImplementation(() => ({})),
  CdpEvmWalletProvider: { configureWithWallet: mock() },
}));

// ---------------------------------------------------------------------------

import { gpuModule } from "../src/tools/gpu.js";
import { walletModule } from "../src/tools/wallet.js";
import { defiModule } from "../src/tools/defi.js";
import { paymentsModule } from "../src/tools/payments.js";
import { portfolioModule } from "../src/tools/portfolio.js";
import { marketModule } from "../src/tools/market.js";
import { docsModule } from "../src/tools/docs.js";

const ALL_MODULES = [
  gpuModule,
  walletModule,
  defiModule,
  paymentsModule,
  portfolioModule,
  marketModule,
  docsModule,
];

// Mirrors the toolToModule Map built by server.ts
const toolToModule = new Map(
  ALL_MODULES.flatMap((mod) => mod.definitions.map((def) => [def.name, mod]))
);

// ---------------------------------------------------------------------------

describe("Server module aggregation", () => {
  it("all module definitions arrays are non-empty", () => {
    for (const mod of ALL_MODULES) {
      expect(mod.definitions.length).toBeGreaterThan(0);
    }
  });

  it("tool names are unique across ALL modules (no collision)", () => {
    const allNames = ALL_MODULES.flatMap((m) => m.definitions.map((d) => d.name));
    const unique = new Set(allNames);
    expect(unique.size).toBe(allNames.length);
  });

  it("toolToModule map covers every tool definition", () => {
    const mapSize = toolToModule.size;
    const totalDefs = ALL_MODULES.flatMap((m) => m.definitions).length;
    expect(mapSize).toBe(totalDefs);
  });

  it("every tool definition resolves to the module that owns it", () => {
    for (const mod of ALL_MODULES) {
      for (const def of mod.definitions) {
        expect(toolToModule.get(def.name)).toBe(mod);
      }
    }
  });

  it("every definition has a non-empty string name", () => {
    for (const mod of ALL_MODULES) {
      for (const def of mod.definitions) {
        expect(typeof def.name).toBe("string");
        expect(def.name.length).toBeGreaterThan(0);
      }
    }
  });

  it("every definition has a non-empty description", () => {
    for (const mod of ALL_MODULES) {
      for (const def of mod.definitions) {
        expect(typeof def.description).toBe("string");
        expect(def.description.length).toBeGreaterThan(0);
      }
    }
  });

  it("every definition inputSchema has type 'object'", () => {
    for (const mod of ALL_MODULES) {
      for (const def of mod.definitions) {
        expect(def.inputSchema.type).toBe("object");
      }
    }
  });

  it("every module's handle function is callable", () => {
    for (const mod of ALL_MODULES) {
      expect(typeof mod.handle).toBe("function");
    }
  });

  it("total tool count matches expected 49 tools", () => {
    const total = ALL_MODULES.reduce((sum, m) => sum + m.definitions.length, 0);
    expect(total).toBe(49);
  });
});

// ---------------------------------------------------------------------------
// Server routing behaviour — unknown tool
// ---------------------------------------------------------------------------

describe("Server routing — unknown tool handling", () => {
  it("unknown tool is not in toolToModule map", () => {
    expect(toolToModule.has("definitely_unknown_tool")).toBe(false);
  });

  it("toolToModule returns undefined for unknown tool name", () => {
    expect(toolToModule.get("nonexistent_tool")).toBeUndefined();
  });
});
