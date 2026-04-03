import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { paymentsModule } from "./payments.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function stubCommerceOk(responseData: unknown): void {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(responseData),
    text: () => Promise.resolve(JSON.stringify(responseData)),
    status: 200,
    headers: { forEach: vi.fn() },
  }));
}

function stubCommerceError(status: number, body: string): void {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
    ok: false,
    status,
    text: () => Promise.resolve(body),
  }));
}

// ---------------------------------------------------------------------------
// Module structure
// ---------------------------------------------------------------------------

describe("paymentsModule structure", () => {
  it("exports definitions array with 7 tools", () => {
    expect(paymentsModule.definitions).toHaveLength(7);
  });

  it("every definition has name, description, and inputSchema", () => {
    for (const def of paymentsModule.definitions) {
      expect(typeof def.name).toBe("string");
      expect(typeof def.description).toBe("string");
      expect(def.inputSchema.type).toBe("object");
    }
  });

  it("tool names are unique", () => {
    const names = paymentsModule.definitions.map((d) => d.name);
    expect(new Set(names).size).toBe(names.length);
  });
});

// ---------------------------------------------------------------------------
// Missing COINBASE_COMMERCE_API_KEY
// ---------------------------------------------------------------------------

const commerceTools = [
  "pay_create_charge",
  "pay_get_charge",
  "pay_list_charges",
  "pay_create_checkout",
  "pay_resolve_charge",
  "pay_list_events",
];

describe("payments — missing COINBASE_COMMERCE_API_KEY", () => {
  beforeEach(() => { delete process.env.COINBASE_COMMERCE_API_KEY; });
  afterEach(() => { delete process.env.COINBASE_COMMERCE_API_KEY; vi.unstubAllGlobals(); });

  for (const toolName of commerceTools) {
    it(`${toolName} returns isError`, async () => {
      const result = await paymentsModule.handle(toolName, {
        name: "test", description: "desc", amount: "10.00",
        charge_id: "abc123", action: "resolve", code: "CODE1", redirect_uri: "https://ex.com",
      });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("COINBASE_COMMERCE_API_KEY");
    });
  }
});

// ---------------------------------------------------------------------------
// pay_create_charge — happy path
// ---------------------------------------------------------------------------

describe("pay_create_charge", () => {
  beforeEach(() => {
    process.env.COINBASE_COMMERCE_API_KEY = "test-commerce-key";
    stubCommerceOk({
      data: {
        id: "charge-001",
        code: "ABC123",
        hosted_url: "https://commerce.coinbase.com/charges/ABC123",
        timeline: [{ status: "NEW", time: "2024-01-01T00:00:00Z" }],
      },
    });
  });

  afterEach(() => {
    delete process.env.COINBASE_COMMERCE_API_KEY;
    vi.unstubAllGlobals();
  });

  it("returns charge id, code, and hosted url", async () => {
    const result = await paymentsModule.handle("pay_create_charge", {
      name: "Premium Plan",
      description: "Monthly subscription",
      amount: "29.99",
      currency: "USD",
    });
    expect(result.isError).toBeFalsy();
    expect(result.content[0].text).toContain("charge-001");
    expect(result.content[0].text).toContain("ABC123");
    expect(result.content[0].text).toContain("https://commerce.coinbase.com/charges/ABC123");
  });

  it("includes redirect_url and cancel_url when provided", async () => {
    await paymentsModule.handle("pay_create_charge", {
      name: "Plan",
      description: "Plan description",
      amount: "9.99",
      redirect_url: "https://myapp.com/success",
      cancel_url: "https://myapp.com/cancel",
    });
    const fetchMock = vi.mocked(global.fetch);
    const bodyArg = JSON.parse(fetchMock.mock.calls[0][1]?.body as string);
    expect(bodyArg.redirect_url).toBe("https://myapp.com/success");
    expect(bodyArg.cancel_url).toBe("https://myapp.com/cancel");
  });

  it("attaches metadata when provided", async () => {
    await paymentsModule.handle("pay_create_charge", {
      name: "Plan",
      description: "desc",
      amount: "5.00",
      metadata: { user_id: "u123" },
    });
    const fetchMock = vi.mocked(global.fetch);
    const bodyArg = JSON.parse(fetchMock.mock.calls[0][1]?.body as string);
    expect(bodyArg.metadata).toEqual({ user_id: "u123" });
  });
});

// ---------------------------------------------------------------------------
// pay_get_charge — output formatting
// ---------------------------------------------------------------------------

describe("pay_get_charge", () => {
  beforeEach(() => {
    process.env.COINBASE_COMMERCE_API_KEY = "test-commerce-key";
    stubCommerceOk({
      data: {
        id: "charge-abc",
        name: "Widget",
        description: "A widget",
        hosted_url: "https://commerce.coinbase.com/charges/charge-abc",
        expires_at: "2024-12-31T00:00:00Z",
        pricing: { local: { amount: "10.00", currency: "USD" } },
        timeline: [
          { status: "NEW", time: "2024-01-01T00:00:00Z" },
          { status: "COMPLETED", time: "2024-01-02T00:00:00Z" },
        ],
      },
    });
  });

  afterEach(() => {
    delete process.env.COINBASE_COMMERCE_API_KEY;
    vi.unstubAllGlobals();
  });

  it("shows status, price, and timeline", async () => {
    const result = await paymentsModule.handle("pay_get_charge", { charge_id: "charge-abc" });
    expect(result.isError).toBeFalsy();
    expect(result.content[0].text).toContain("COMPLETED");
    expect(result.content[0].text).toContain("10.00 USD");
    expect(result.content[0].text).toContain("NEW");
  });
});

// ---------------------------------------------------------------------------
// pay_list_charges — empty and non-empty
// ---------------------------------------------------------------------------

describe("pay_list_charges", () => {
  afterEach(() => {
    delete process.env.COINBASE_COMMERCE_API_KEY;
    vi.unstubAllGlobals();
  });

  it("returns 'No charges found' when list is empty", async () => {
    process.env.COINBASE_COMMERCE_API_KEY = "test-key";
    stubCommerceOk({ data: [] });
    const result = await paymentsModule.handle("pay_list_charges", {});
    expect(result.content[0].text).toContain("No charges found");
  });

  it("lists charges with status and price", async () => {
    process.env.COINBASE_COMMERCE_API_KEY = "test-key";
    stubCommerceOk({
      data: [
        {
          id: "c1",
          code: "C1CODE",
          name: "Item 1",
          pricing: { local: { amount: "5.00", currency: "USD" } },
          timeline: [{ status: "COMPLETED" }],
        },
      ],
    });
    const result = await paymentsModule.handle("pay_list_charges", {});
    expect(result.content[0].text).toContain("c1");
    expect(result.content[0].text).toContain("COMPLETED");
    expect(result.content[0].text).toContain("5.00");
  });
});

// ---------------------------------------------------------------------------
// pay_create_checkout — output formatting
// ---------------------------------------------------------------------------

describe("pay_create_checkout", () => {
  beforeEach(() => {
    process.env.COINBASE_COMMERCE_API_KEY = "test-key";
    stubCommerceOk({
      data: { id: "checkout-xyz", name: "My Product" },
    });
  });

  afterEach(() => {
    delete process.env.COINBASE_COMMERCE_API_KEY;
    vi.unstubAllGlobals();
  });

  it("returns checkout id and hosted url", async () => {
    const result = await paymentsModule.handle("pay_create_checkout", {
      name: "My Product",
      description: "Great product",
      amount: "19.99",
    });
    expect(result.isError).toBeFalsy();
    expect(result.content[0].text).toContain("checkout-xyz");
    expect(result.content[0].text).toContain("https://commerce.coinbase.com/checkout/checkout-xyz");
  });
});

// ---------------------------------------------------------------------------
// pay_resolve_charge
// ---------------------------------------------------------------------------

describe("pay_resolve_charge", () => {
  beforeEach(() => {
    process.env.COINBASE_COMMERCE_API_KEY = "test-key";
    stubCommerceOk({
      data: {
        timeline: [{ status: "RESOLVED" }],
      },
    });
  });

  afterEach(() => {
    delete process.env.COINBASE_COMMERCE_API_KEY;
    vi.unstubAllGlobals();
  });

  it("confirms resolution with current status", async () => {
    const result = await paymentsModule.handle("pay_resolve_charge", {
      charge_id: "charge-abc",
      action: "resolve",
    });
    expect(result.isError).toBeFalsy();
    expect(result.content[0].text).toContain("RESOLVED");
  });
});

// ---------------------------------------------------------------------------
// pay_list_events
// ---------------------------------------------------------------------------

describe("pay_list_events", () => {
  afterEach(() => {
    delete process.env.COINBASE_COMMERCE_API_KEY;
    vi.unstubAllGlobals();
  });

  it("returns 'No events found' when empty", async () => {
    process.env.COINBASE_COMMERCE_API_KEY = "test-key";
    stubCommerceOk({ data: [] });
    const result = await paymentsModule.handle("pay_list_events", {});
    expect(result.content[0].text).toContain("No events found");
  });

  it("lists events with type and timestamp", async () => {
    process.env.COINBASE_COMMERCE_API_KEY = "test-key";
    stubCommerceOk({
      data: [
        { created_at: "2024-01-01T00:00:00Z", type: "charge:confirmed", data: { id: "charge-001" } },
      ],
    });
    const result = await paymentsModule.handle("pay_list_events", {});
    expect(result.content[0].text).toContain("charge:confirmed");
    expect(result.content[0].text).toContain("charge-001");
  });
});

// ---------------------------------------------------------------------------
// pay_x402_check
// ---------------------------------------------------------------------------

describe("pay_x402_check", () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  it("reports x402 not detected when status is 200", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
    }));
    const result = await paymentsModule.handle("pay_x402_check", { url: "https://example.com/api" });
    expect(result.isError).toBeFalsy();
    expect(result.content[0].text).toContain("Not detected");
    expect(result.content[0].text).toContain("200");
  });

  it("detects x402 when status is 402 and captures payment headers", async () => {
    const fakeHeaders = new Map([
      ["x-payment-terms", "USDC 1.00"],
      ["www-authenticate", "x402"],
    ]);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 402,
      headers: { forEach: (cb: (v: string, k: string) => void) => fakeHeaders.forEach((v, k) => cb(v, k)) },
      text: () => Promise.resolve('{"amount":"1.00","currency":"USDC"}'),
    }));
    const result = await paymentsModule.handle("pay_x402_check", { url: "https://api.example.com/svc" });
    expect(result.isError).toBeFalsy();
    expect(result.content[0].text).toContain("Detected");
    expect(result.content[0].text).toContain("x-payment-terms");
    expect(result.content[0].text).toContain("USDC 1.00");
  });

  it("handles fetch error gracefully", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Network error")));
    const result = await paymentsModule.handle("pay_x402_check", { url: "https://unreachable.invalid" });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Network error");
  });
});

// ---------------------------------------------------------------------------
// Commerce API HTTP errors
// ---------------------------------------------------------------------------

describe("pay_create_charge — commerce API error", () => {
  beforeEach(() => { process.env.COINBASE_COMMERCE_API_KEY = "test-key"; });
  afterEach(() => {
    delete process.env.COINBASE_COMMERCE_API_KEY;
    vi.unstubAllGlobals();
  });

  it("returns isError on Commerce API failure", async () => {
    stubCommerceError(422, "Unprocessable Entity");
    const result = await paymentsModule.handle("pay_create_charge", {
      name: "Plan", description: "desc", amount: "10.00",
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("422");
  });
});

// ---------------------------------------------------------------------------
// Unknown tool
// ---------------------------------------------------------------------------

describe("payments unknown tool", () => {
  it("returns error for unknown tool name", async () => {
    const result = await paymentsModule.handle("pay_nonexistent", {});
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Unknown payment tool");
  });
});
