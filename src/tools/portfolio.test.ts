import { describe, it, expect, mock, beforeEach, afterEach, type Mock } from "bun:test";
import { portfolioModule } from "./portfolio.js";

const originalFetch = globalThis.fetch;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function stubFetchOk(body: unknown): Mock<(...args: any[]) => any> {
  const m = mock().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
    status: 200,
  });
  globalThis.fetch = m as unknown as typeof fetch;
  return m;
}

function stubFetchError(status: number): void {
  globalThis.fetch = mock().mockResolvedValue({
    ok: false,
    status,
    text: () => Promise.resolve("Error body"),
  }) as unknown as typeof fetch;
}

// ---------------------------------------------------------------------------
// Module structure
// ---------------------------------------------------------------------------

describe("portfolioModule structure", () => {
  it("exports definitions array with 7 tools", () => {
    expect(portfolioModule.definitions).toHaveLength(7);
  });

  it("every definition has name, description, and inputSchema", () => {
    for (const def of portfolioModule.definitions) {
      expect(typeof def.name).toBe("string");
      expect(typeof def.description).toBe("string");
      expect(def.inputSchema.type).toBe("object");
    }
  });

  it("tool names are unique", () => {
    const names = portfolioModule.definitions.map((d) => d.name);
    expect(new Set(names).size).toBe(names.length);
  });
});

// ---------------------------------------------------------------------------
// Missing env var guards
// ---------------------------------------------------------------------------

describe("cb_oauth_url — missing COINBASE_CLIENT_ID", () => {
  beforeEach(() => { delete process.env.COINBASE_CLIENT_ID; });
  afterEach(() => { delete process.env.COINBASE_CLIENT_ID; });

  it("returns isError when COINBASE_CLIENT_ID absent", async () => {
    const result = await portfolioModule.handle("cb_oauth_url", { redirect_uri: "https://app.example.com/cb" });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("COINBASE_CLIENT_ID");
  });
});

describe("cb_exchange_token — missing credentials", () => {
  afterEach(() => {
    delete process.env.COINBASE_CLIENT_ID;
    delete process.env.COINBASE_CLIENT_SECRET;
    globalThis.fetch = originalFetch;
  });

  it("returns isError when COINBASE_CLIENT_ID absent", async () => {
    delete process.env.COINBASE_CLIENT_ID;
    const result = await portfolioModule.handle("cb_exchange_token", {
      code: "authcode", redirect_uri: "https://app.example.com/cb",
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("COINBASE_CLIENT_ID");
  });

  it("returns isError when COINBASE_CLIENT_SECRET absent", async () => {
    process.env.COINBASE_CLIENT_ID = "client-id";
    delete process.env.COINBASE_CLIENT_SECRET;
    const result = await portfolioModule.handle("cb_exchange_token", {
      code: "authcode", redirect_uri: "https://app.example.com/cb",
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("COINBASE_CLIENT_SECRET");
  });
});

describe("cb_get_user — missing COINBASE_OAUTH_TOKEN", () => {
  beforeEach(() => { delete process.env.COINBASE_OAUTH_TOKEN; });
  afterEach(() => { delete process.env.COINBASE_OAUTH_TOKEN; });

  it("returns isError", async () => {
    const result = await portfolioModule.handle("cb_get_user", {});
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("COINBASE_OAUTH_TOKEN");
  });
});

describe("cb_get_accounts — missing COINBASE_OAUTH_TOKEN", () => {
  beforeEach(() => { delete process.env.COINBASE_OAUTH_TOKEN; });
  afterEach(() => { delete process.env.COINBASE_OAUTH_TOKEN; });

  it("returns isError", async () => {
    const result = await portfolioModule.handle("cb_get_accounts", {});
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("COINBASE_OAUTH_TOKEN");
  });
});

describe("cb_get_transactions — missing COINBASE_OAUTH_TOKEN", () => {
  beforeEach(() => { delete process.env.COINBASE_OAUTH_TOKEN; });
  afterEach(() => { delete process.env.COINBASE_OAUTH_TOKEN; });

  it("returns isError", async () => {
    const result = await portfolioModule.handle("cb_get_transactions", { account_id: "acct-001" });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("COINBASE_OAUTH_TOKEN");
  });
});

// ---------------------------------------------------------------------------
// cb_oauth_url — URL generation
// ---------------------------------------------------------------------------

describe("cb_oauth_url — URL generation", () => {
  beforeEach(() => { process.env.COINBASE_CLIENT_ID = "my-client-id"; });
  afterEach(() => { delete process.env.COINBASE_CLIENT_ID; });

  it("generates a URL containing client_id and redirect_uri", async () => {
    const result = await portfolioModule.handle("cb_oauth_url", {
      redirect_uri: "https://myapp.com/callback",
    });
    expect(result.isError).toBeFalsy();
    const text = result.content[0].text;
    expect(text).toContain("my-client-id");
    expect(text).toContain("myapp.com");
    expect(text).toContain("response_type=code");
  });

  it("uses default scopes when none are provided", async () => {
    const result = await portfolioModule.handle("cb_oauth_url", {
      redirect_uri: "https://myapp.com/cb",
    });
    const decoded = decodeURIComponent(result.content[0].text);
    expect(decoded).toContain("wallet:accounts:read");
    expect(decoded).toContain("wallet:transactions:read");
  });

  it("uses custom scopes when provided", async () => {
    const result = await portfolioModule.handle("cb_oauth_url", {
      redirect_uri: "https://myapp.com/cb",
      scopes: ["wallet:accounts:read", "wallet:buys:create"],
    });
    const decoded = decodeURIComponent(result.content[0].text);
    expect(decoded).toContain("wallet:buys:create");
  });

  it("includes state parameter when provided", async () => {
    const result = await portfolioModule.handle("cb_oauth_url", {
      redirect_uri: "https://myapp.com/cb",
      state: "csrf-token-123",
    });
    expect(result.content[0].text).toContain("csrf-token-123");
  });
});

// ---------------------------------------------------------------------------
// cb_exchange_token — HTTP error branch
// ---------------------------------------------------------------------------

describe("cb_exchange_token — token exchange failure", () => {
  beforeEach(() => {
    process.env.COINBASE_CLIENT_ID = "client-id";
    process.env.COINBASE_CLIENT_SECRET = "client-secret";
    stubFetchError(400);
  });

  afterEach(() => {
    delete process.env.COINBASE_CLIENT_ID;
    delete process.env.COINBASE_CLIENT_SECRET;
    globalThis.fetch = originalFetch;
  });

  it("returns isError on HTTP failure", async () => {
    const result = await portfolioModule.handle("cb_exchange_token", {
      code: "bad-code",
      redirect_uri: "https://myapp.com/cb",
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("400");
  });
});

// ---------------------------------------------------------------------------
// cb_get_user — happy path
// ---------------------------------------------------------------------------

describe("cb_get_user — happy path", () => {
  beforeEach(() => {
    process.env.COINBASE_OAUTH_TOKEN = "test-token";
    stubFetchOk({
      data: {
        id: "user-001",
        name: "Alice",
        email: "alice@example.com",
        username: "alice",
        country: { name: "United States" },
        native_currency: "USD",
        created_at: "2022-01-01T00:00:00Z",
      },
    });
  });

  afterEach(() => {
    delete process.env.COINBASE_OAUTH_TOKEN;
    globalThis.fetch = originalFetch;
  });

  it("returns user profile info", async () => {
    const result = await portfolioModule.handle("cb_get_user", {});
    expect(result.isError).toBeFalsy();
    expect(result.content[0].text).toContain("Alice");
    expect(result.content[0].text).toContain("alice@example.com");
    expect(result.content[0].text).toContain("United States");
  });
});

// ---------------------------------------------------------------------------
// cb_get_accounts — happy path
// ---------------------------------------------------------------------------

describe("cb_get_accounts", () => {
  afterEach(() => {
    delete process.env.COINBASE_OAUTH_TOKEN;
    globalThis.fetch = originalFetch;
  });

  it("returns 'No accounts found' when list is empty", async () => {
    process.env.COINBASE_OAUTH_TOKEN = "test-token";
    stubFetchOk({ data: [] });
    const result = await portfolioModule.handle("cb_get_accounts", {});
    expect(result.content[0].text).toContain("No accounts found");
  });

  it("lists accounts with non-zero balances", async () => {
    process.env.COINBASE_OAUTH_TOKEN = "test-token";
    stubFetchOk({
      data: [
        {
          id: "acct-btc",
          name: "BTC Wallet",
          balance: { amount: "0.5", currency: "BTC" },
          native_balance: { amount: "30000.00", currency: "USD" },
        },
        {
          id: "acct-empty",
          name: "Empty Wallet",
          balance: { amount: "0", currency: "ETH" },
          native_balance: { amount: "0.00", currency: "USD" },
        },
      ],
    });
    const result = await portfolioModule.handle("cb_get_accounts", {});
    expect(result.isError).toBeFalsy();
    expect(result.content[0].text).toContain("BTC Wallet");
    expect(result.content[0].text).toContain("0.5");
    expect(result.content[0].text).not.toContain("Empty Wallet");
  });

  it("shows 'All accounts have zero balance' when all are empty", async () => {
    process.env.COINBASE_OAUTH_TOKEN = "test-token";
    stubFetchOk({
      data: [
        { id: "acct-1", name: "Zero Wallet", balance: { amount: "0", currency: "BTC" } },
      ],
    });
    const result = await portfolioModule.handle("cb_get_accounts", {});
    expect(result.content[0].text).toContain("zero balance");
  });
});

// ---------------------------------------------------------------------------
// cb_get_transactions — happy path
// ---------------------------------------------------------------------------

describe("cb_get_transactions", () => {
  afterEach(() => {
    delete process.env.COINBASE_OAUTH_TOKEN;
    globalThis.fetch = originalFetch;
  });

  it("returns 'No transactions found' when empty", async () => {
    process.env.COINBASE_OAUTH_TOKEN = "test-token";
    stubFetchOk({ data: [] });
    const result = await portfolioModule.handle("cb_get_transactions", { account_id: "acct-001" });
    expect(result.content[0].text).toContain("No transactions");
  });

  it("lists transactions with sign, type, and status", async () => {
    process.env.COINBASE_OAUTH_TOKEN = "test-token";
    stubFetchOk({
      data: [
        {
          created_at: "2024-01-15T12:00:00Z",
          type: "buy",
          status: "completed",
          amount: { amount: "0.01", currency: "BTC" },
          native_amount: { amount: "650.00", currency: "USD" },
        },
        {
          created_at: "2024-01-10T08:00:00Z",
          type: "send",
          status: "completed",
          amount: { amount: "-0.005", currency: "BTC" },
          native_amount: { amount: "-325.00", currency: "USD" },
        },
      ],
    });
    const result = await portfolioModule.handle("cb_get_transactions", { account_id: "acct-001" });
    expect(result.isError).toBeFalsy();
    expect(result.content[0].text).toContain("buy");
    expect(result.content[0].text).toContain("+0.01");
    expect(result.content[0].text).toContain("-0.005");
    expect(result.content[0].text).toContain("completed");
  });
});

// ---------------------------------------------------------------------------
// cb_get_spot_price
// ---------------------------------------------------------------------------

describe("cb_get_spot_price", () => {
  afterEach(() => { globalThis.fetch = originalFetch; });

  it("returns formatted spot price", async () => {
    stubFetchOk({ data: { base: "BTC", currency: "USD", amount: "65432.10" } });
    const result = await portfolioModule.handle("cb_get_spot_price", { currency_pair: "BTC-USD" });
    expect(result.isError).toBeFalsy();
    expect(result.content[0].text).toContain("65432.10");
    expect(result.content[0].text).toContain("BTC");
    expect(result.content[0].text).toContain("USD");
  });

  it("returns isError on HTTP failure", async () => {
    stubFetchError(404);
    const result = await portfolioModule.handle("cb_get_spot_price", { currency_pair: "INVALID-USD" });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("404");
  });
});

// ---------------------------------------------------------------------------
// cb_get_exchange_rates
// ---------------------------------------------------------------------------

describe("cb_get_exchange_rates", () => {
  afterEach(() => { globalThis.fetch = originalFetch; });

  it("returns exchange rates for the base currency", async () => {
    stubFetchOk({
      data: {
        currency: "USD",
        rates: { BTC: "0.000015", ETH: "0.00028", EUR: "0.93" },
      },
    });
    const result = await portfolioModule.handle("cb_get_exchange_rates", { currency: "USD" });
    expect(result.isError).toBeFalsy();
    expect(result.content[0].text).toContain("USD");
    expect(result.content[0].text).toContain("BTC");
    expect(result.content[0].text).toContain("ETH");
  });

  it("uses USD as default currency", async () => {
    const fetchMock = stubFetchOk({ data: { currency: "USD", rates: { BTC: "0.000015" } } });
    await portfolioModule.handle("cb_get_exchange_rates", {});
    expect((fetchMock.mock.calls[0][0] as string)).toContain("currency=USD");
  });

  it("returns isError on HTTP failure", async () => {
    stubFetchError(500);
    const result = await portfolioModule.handle("cb_get_exchange_rates", { currency: "USD" });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("500");
  });
});

// ---------------------------------------------------------------------------
// Unknown tool
// ---------------------------------------------------------------------------

describe("portfolio unknown tool", () => {
  it("returns error for unknown tool name", async () => {
    const result = await portfolioModule.handle("cb_nonexistent", {});
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Unknown portfolio tool");
  });
});
