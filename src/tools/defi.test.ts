import { describe, it, expect, mock, beforeEach, afterEach, type Mock } from "bun:test";

const originalFetch = globalThis.fetch;

// ---------------------------------------------------------------------------
// Mock @coinbase/agentkit — define mock instances inside the factory
// ---------------------------------------------------------------------------

mock.module("@coinbase/agentkit", () => {
  const mockPythInstance = { fetchPriceFeed: mock(), fetchPrice: mock() };
  const mockMessariInstance = { researchQuestion: mock() };
  const mockFarcasterInstance = { postCast: mock(), accountDetails: mock() };
  const mockMorphoInstance = { deposit: mock(), withdraw: mock() };
  const mockWalletProvider = {};

  return {
    PythActionProvider: mock().mockImplementation(() => mockPythInstance),
    MessariActionProvider: mock().mockImplementation(() => mockMessariInstance),
    FarcasterActionProvider: mock().mockImplementation(() => mockFarcasterInstance),
    MorphoActionProvider: mock().mockImplementation(() => mockMorphoInstance),
    CdpEvmWalletProvider: {
      configureWithWallet: mock().mockResolvedValue(mockWalletProvider),
    },
  };
});

import { defiModule } from "./defi.js";
import {
  PythActionProvider,
  MessariActionProvider,
  FarcasterActionProvider,
  MorphoActionProvider,
} from "@coinbase/agentkit";

// Helper functions to access the singleton mock instances created inside the
// mock.module factory closure. Because mock.module creates each provider mock
// once, every `new Provider()` call returns the same instance — so these
// helpers return the same shared object used internally by defiModule.
function getPythMock() {
  return new (PythActionProvider as any)() as { fetchPriceFeed: Mock<any>; fetchPrice: Mock<any> };
}
function getMessariMock() {
  return new (MessariActionProvider as any)() as { researchQuestion: Mock<any> };
}
function getFarcasterMock() {
  return new (FarcasterActionProvider as any)() as { postCast: Mock<any>; accountDetails: Mock<any> };
}
function getMorphoMock() {
  return new (MorphoActionProvider as any)() as { deposit: Mock<any>; withdraw: Mock<any> };
}

// ---------------------------------------------------------------------------
// Module structure
// ---------------------------------------------------------------------------

describe("defiModule structure", () => {
  it("exports definitions array", () => {
    expect(defiModule.definitions.length).toBeGreaterThan(0);
  });

  it("every definition has name, description, and inputSchema", () => {
    for (const def of defiModule.definitions) {
      expect(typeof def.name).toBe("string");
      expect(typeof def.description).toBe("string");
      expect(def.inputSchema.type).toBe("object");
    }
  });

  it("tool names are unique", () => {
    const names = defiModule.definitions.map((d) => d.name);
    expect(new Set(names).size).toBe(names.length);
  });
});

// ---------------------------------------------------------------------------
// Missing environment variables
// ---------------------------------------------------------------------------

describe("defi_messari_research — missing env var", () => {
  beforeEach(() => { delete process.env.MESSARI_API_KEY; });
  afterEach(() => { delete process.env.MESSARI_API_KEY; });

  it("returns isError when MESSARI_API_KEY is absent", async () => {
    const result = await defiModule.handle("defi_messari_research", { question: "What is TVL?" });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("MESSARI_API_KEY");
  });
});

describe("defi_farcaster_post — missing env vars", () => {
  beforeEach(() => {
    delete process.env.NEYNAR_API_KEY;
    delete process.env.NEYNAR_SIGNER_UUID;
  });
  afterEach(() => {
    delete process.env.NEYNAR_API_KEY;
    delete process.env.NEYNAR_SIGNER_UUID;
  });

  it("returns isError when NEYNAR_API_KEY is absent", async () => {
    const result = await defiModule.handle("defi_farcaster_post", { message: "hello" });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("NEYNAR_API_KEY");
  });

  it("returns isError when NEYNAR_SIGNER_UUID is absent (key present)", async () => {
    process.env.NEYNAR_API_KEY = "key";
    const result = await defiModule.handle("defi_farcaster_post", { message: "hello" });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("NEYNAR_SIGNER_UUID");
  });
});

describe("defi_farcaster_profile — missing env var", () => {
  beforeEach(() => { delete process.env.NEYNAR_API_KEY; });
  afterEach(() => { delete process.env.NEYNAR_API_KEY; });

  it("returns isError when NEYNAR_API_KEY is absent", async () => {
    const result = await defiModule.handle("defi_farcaster_profile", {});
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("NEYNAR_API_KEY");
  });
});

describe("defi_morpho_deposit — missing CDP credentials", () => {
  beforeEach(() => {
    delete process.env.CDP_API_KEY_ID;
    delete process.env.CDP_API_KEY_SECRET;
  });
  afterEach(() => {
    delete process.env.CDP_API_KEY_ID;
    delete process.env.CDP_API_KEY_SECRET;
  });

  it("returns isError when CDP creds are absent", async () => {
    const result = await defiModule.handle("defi_morpho_deposit", {
      vault_address: "0xvault", assets: "1000", receiver: "0xrec", token_address: "0xtoken",
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("CDP_API_KEY_ID");
  });
});

describe("defi_morpho_withdraw — missing CDP credentials", () => {
  beforeEach(() => {
    delete process.env.CDP_API_KEY_ID;
    delete process.env.CDP_API_KEY_SECRET;
  });
  afterEach(() => {
    delete process.env.CDP_API_KEY_ID;
    delete process.env.CDP_API_KEY_SECRET;
  });

  it("returns isError when CDP creds are absent", async () => {
    const result = await defiModule.handle("defi_morpho_withdraw", {
      vault_address: "0xvault", assets: "1000", receiver: "0xrec",
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("CDP_API_KEY_ID");
  });
});

describe("bazaar_call — missing wallet key", () => {
  beforeEach(() => { delete process.env.GPUBRIDGE_WALLET_KEY; });
  afterEach(() => { delete process.env.GPUBRIDGE_WALLET_KEY; });

  it("returns isError when GPUBRIDGE_WALLET_KEY is absent", async () => {
    const result = await defiModule.handle("bazaar_call", { url: "https://bazaar.x402.org/api/test" });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("GPUBRIDGE_WALLET_KEY");
  });
});

// ---------------------------------------------------------------------------
// Happy paths
// ---------------------------------------------------------------------------

describe("defi_pyth_price_feed — happy path", () => {
  beforeEach(() => {
    getPythMock().fetchPriceFeed.mockResolvedValue("0xpricefeedid");
  });

  it("returns price feed ID", async () => {
    const result = await defiModule.handle("defi_pyth_price_feed", { token_symbol: "BTC" });
    expect(result.isError).toBeFalsy();
    expect(result.content[0].text).toContain("0xpricefeedid");
  });
});

describe("defi_pyth_price — happy path", () => {
  beforeEach(() => {
    getPythMock().fetchPrice.mockResolvedValue("$65000.00");
  });

  it("returns current price", async () => {
    const result = await defiModule.handle("defi_pyth_price", { price_feed_id: "0xfeedid" });
    expect(result.isError).toBeFalsy();
    expect(result.content[0].text).toContain("$65000.00");
  });
});

describe("defi_messari_research — happy path", () => {
  beforeEach(() => {
    process.env.MESSARI_API_KEY = "test-key";
    getMessariMock().researchQuestion.mockResolvedValue("Aave TVL is $5B");
  });

  afterEach(() => { delete process.env.MESSARI_API_KEY; });

  it("returns research answer", async () => {
    const result = await defiModule.handle("defi_messari_research", { question: "What is Aave TVL?" });
    expect(result.isError).toBeFalsy();
    expect(result.content[0].text).toContain("Aave TVL is $5B");
  });
});

describe("defi_farcaster_post — happy path", () => {
  beforeEach(() => {
    process.env.NEYNAR_API_KEY = "test-key";
    process.env.NEYNAR_SIGNER_UUID = "test-uuid";
    getFarcasterMock().postCast.mockResolvedValue("Cast posted!");
  });

  afterEach(() => {
    delete process.env.NEYNAR_API_KEY;
    delete process.env.NEYNAR_SIGNER_UUID;
  });

  it("posts a cast and returns result", async () => {
    const result = await defiModule.handle("defi_farcaster_post", { message: "Hello Farcaster!" });
    expect(result.isError).toBeFalsy();
    expect(result.content[0].text).toContain("Cast posted!");
  });

  it("passes channelId when channel is provided", async () => {
    await defiModule.handle("defi_farcaster_post", { message: "Hello!", channel: "defi" });
    expect(getFarcasterMock().postCast).toHaveBeenCalledWith(
      expect.objectContaining({ channelId: "defi" })
    );
  });
});

describe("defi_farcaster_profile — happy path", () => {
  beforeEach(() => {
    process.env.NEYNAR_API_KEY = "test-key";
    getFarcasterMock().accountDetails.mockResolvedValue("FID: 12345");
  });

  afterEach(() => { delete process.env.NEYNAR_API_KEY; });

  it("returns account details", async () => {
    const result = await defiModule.handle("defi_farcaster_profile", {});
    expect(result.isError).toBeFalsy();
    expect(result.content[0].text).toContain("FID: 12345");
  });
});

// ---------------------------------------------------------------------------
// defi_across_bridge — fetch mocking
// ---------------------------------------------------------------------------

describe("defi_across_bridge", () => {
  afterEach(() => { globalThis.fetch = originalFetch; });

  it("returns bridge quote on success", async () => {
    globalThis.fetch = mock().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ relayFee: { pct: "0.04" }, estimatedFillTime: 120 }),
    }) as unknown as typeof fetch;
    const result = await defiModule.handle("defi_across_bridge", {
      origin_chain_id: 8453,
      destination_chain_id: 1,
      token: "USDC",
      amount: "1000000",
    });
    expect(result.isError).toBeFalsy();
    expect(result.content[0].text).toContain("8453");
    expect(result.content[0].text).toContain("USDC");
  });

  it("returns error when Across API returns non-ok status", async () => {
    globalThis.fetch = mock().mockResolvedValue({
      ok: false,
      statusText: "Service Unavailable",
    }) as unknown as typeof fetch;
    const result = await defiModule.handle("defi_across_bridge", {
      origin_chain_id: 8453,
      destination_chain_id: 1,
      token: "ETH",
      amount: "1000",
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Across API error");
  });

  it("includes recipient in output when provided", async () => {
    globalThis.fetch = mock().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    }) as unknown as typeof fetch;
    const result = await defiModule.handle("defi_across_bridge", {
      origin_chain_id: 8453,
      destination_chain_id: 1,
      token: "USDC",
      amount: "1000000",
      recipient: "0xrecipient",
    });
    expect(result.content[0].text).toContain("0xrecipient");
  });
});

// ---------------------------------------------------------------------------
// bazaar_list — fetch mocking
// ---------------------------------------------------------------------------

describe("bazaar_list", () => {
  afterEach(() => { globalThis.fetch = originalFetch; });

  it("returns service list on success", async () => {
    globalThis.fetch = mock().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([{ name: "GPUBridge", url: "https://api.gpubridge.io" }]),
    }) as unknown as typeof fetch;
    const result = await defiModule.handle("bazaar_list", {});
    expect(result.isError).toBeFalsy();
    expect(result.content[0].text).toContain("GPUBridge");
  });

  it("falls back to root endpoint when /api/services fails", async () => {
    let callCount = 0;
    globalThis.fetch = mock().mockImplementation(() => {
      callCount++;
      if (callCount === 1) return Promise.resolve({ ok: false, status: 404 });
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ services: ["svc1"] }),
      });
    }) as unknown as typeof fetch;
    const result = await defiModule.handle("bazaar_list", {});
    expect(result.isError).toBeFalsy();
    expect(result.content[0].text).toContain("svc1");
  });

  it("returns error when both endpoints fail", async () => {
    globalThis.fetch = mock().mockResolvedValue({ ok: false, status: 503 }) as unknown as typeof fetch;
    const result = await defiModule.handle("bazaar_list", {});
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("unavailable");
  });
});

// ---------------------------------------------------------------------------
// Unknown tool
// ---------------------------------------------------------------------------

describe("defi unknown tool", () => {
  it("returns error for unknown tool name", async () => {
    const result = await defiModule.handle("defi_nonexistent", {});
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Unknown defi tool");
  });
});
