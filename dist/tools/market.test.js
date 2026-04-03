import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { marketModule } from "./market.js";
// ---------------------------------------------------------------------------
// Mock node:crypto so generateJWT never tries to sign with a real PEM key
// ---------------------------------------------------------------------------
vi.mock("node:crypto", async (importOriginal) => {
    const actual = await importOriginal();
    return {
        ...actual,
        createSign: vi.fn().mockReturnValue({
            update: vi.fn().mockReturnThis(),
            sign: vi.fn().mockReturnValue(Buffer.from("fakesignature")),
        }),
        randomBytes: vi.fn().mockReturnValue(Buffer.from("deadbeefdeadbeef", "hex")),
    };
});
// A placeholder key string — generateJWT will use it but crypto is mocked
const FAKE_SECRET = "-----BEGIN EC PRIVATE KEY-----\nMHQCAQEEIMockKey\n-----END EC PRIVATE KEY-----";
// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function stubFetchOk(body) {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(body),
        status: 200,
    }));
}
function stubFetchError(status, body = "API Error") {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
        ok: false,
        status,
        text: () => Promise.resolve(body),
    }));
}
// ---------------------------------------------------------------------------
// Module structure
// ---------------------------------------------------------------------------
describe("marketModule structure", () => {
    it("exports definitions array with 9 tools", () => {
        expect(marketModule.definitions).toHaveLength(9);
    });
    it("every definition has name, description, and inputSchema", () => {
        for (const def of marketModule.definitions) {
            expect(typeof def.name).toBe("string");
            expect(typeof def.description).toBe("string");
            expect(def.inputSchema.type).toBe("object");
        }
    });
    it("tool names are unique", () => {
        const names = marketModule.definitions.map((d) => d.name);
        expect(new Set(names).size).toBe(names.length);
    });
});
// ---------------------------------------------------------------------------
// Credential-protected tools return missingEnv when creds absent
// ---------------------------------------------------------------------------
const credProtectedTools = [
    "market_create_order",
    "market_get_order",
    "market_list_orders",
    "market_cancel_orders",
    "market_get_fills",
];
describe("marketModule — missing credentials", () => {
    beforeEach(() => {
        delete process.env.COINBASE_ADV_TRADE_API_KEY;
        delete process.env.COINBASE_ADV_TRADE_SECRET;
    });
    afterEach(() => {
        delete process.env.COINBASE_ADV_TRADE_API_KEY;
        delete process.env.COINBASE_ADV_TRADE_SECRET;
        vi.unstubAllGlobals();
    });
    for (const toolName of credProtectedTools) {
        it(`${toolName} returns isError when creds absent`, async () => {
            const result = await marketModule.handle(toolName, {
                product_id: "BTC-USD",
                side: "BUY",
                order_type: "market",
                order_ids: ["oid-1"],
                order_id: "oid-1",
            });
            expect(result.isError).toBe(true);
            expect(result.content[0].text).toContain("COINBASE_ADV_TRADE_API_KEY");
        });
    }
});
// ---------------------------------------------------------------------------
// market_create_order — input validation
// ---------------------------------------------------------------------------
describe("market_create_order — input validation", () => {
    beforeEach(() => {
        process.env.COINBASE_ADV_TRADE_API_KEY = "test-key";
        process.env.COINBASE_ADV_TRADE_SECRET = FAKE_SECRET;
        stubFetchError(400, "Bad request");
    });
    afterEach(() => {
        delete process.env.COINBASE_ADV_TRADE_API_KEY;
        delete process.env.COINBASE_ADV_TRADE_SECRET;
        vi.unstubAllGlobals();
    });
    it("returns error when limit_price is missing for limit orders", async () => {
        const result = await marketModule.handle("market_create_order", {
            product_id: "BTC-USD",
            side: "BUY",
            order_type: "limit",
            base_size: "0.001",
        });
        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain("limit_price");
    });
    it("returns error when base_size is missing for limit orders", async () => {
        const result = await marketModule.handle("market_create_order", {
            product_id: "BTC-USD",
            side: "BUY",
            order_type: "limit",
            limit_price: "45000",
        });
        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain("base_size");
    });
});
// ---------------------------------------------------------------------------
// Public market data tools (no auth needed)
// ---------------------------------------------------------------------------
describe("market_get_product", () => {
    afterEach(() => {
        delete process.env.COINBASE_ADV_TRADE_API_KEY;
        delete process.env.COINBASE_ADV_TRADE_SECRET;
        vi.unstubAllGlobals();
    });
    it("formats product info correctly", async () => {
        process.env.COINBASE_ADV_TRADE_API_KEY = "test-key";
        process.env.COINBASE_ADV_TRADE_SECRET = FAKE_SECRET;
        stubFetchOk({
            product_id: "BTC-USD",
            status: "online",
            price: "65000.00",
            price_percentage_change_24h: "2.5",
            volume_24h: "12345.67",
            base_currency_id: "BTC",
            quote_currency_id: "USD",
            best_bid: "64990.00",
            best_ask: "65010.00",
        });
        const result = await marketModule.handle("market_get_product", { product_id: "BTC-USD" });
        expect(result.isError).toBeFalsy();
        expect(result.content[0].text).toContain("BTC-USD");
        expect(result.content[0].text).toContain("65000.00");
        expect(result.content[0].text).toContain("2.5%");
        expect(result.content[0].text).toContain("64990.00");
        expect(result.content[0].text).toContain("65010.00");
    });
    it("propagates API error", async () => {
        process.env.COINBASE_ADV_TRADE_API_KEY = "test-key";
        process.env.COINBASE_ADV_TRADE_SECRET = FAKE_SECRET;
        stubFetchError(404, "Product not found");
        const result = await marketModule.handle("market_get_product", { product_id: "INVALID-USD" });
        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain("404");
    });
});
describe("market_list_products", () => {
    afterEach(() => {
        delete process.env.COINBASE_ADV_TRADE_API_KEY;
        delete process.env.COINBASE_ADV_TRADE_SECRET;
        vi.unstubAllGlobals();
    });
    it("formats product list", async () => {
        process.env.COINBASE_ADV_TRADE_API_KEY = "test-key";
        process.env.COINBASE_ADV_TRADE_SECRET = FAKE_SECRET;
        stubFetchOk({
            products: [
                { product_id: "BTC-USD", price: "65000.00", status: "online" },
                { product_id: "ETH-USD", price: "3500.00", status: "online" },
            ],
        });
        const result = await marketModule.handle("market_list_products", {});
        expect(result.isError).toBeFalsy();
        expect(result.content[0].text).toContain("BTC-USD");
        expect(result.content[0].text).toContain("ETH-USD");
        expect(result.content[0].text).toContain("65000.00");
    });
});
describe("market_get_candles", () => {
    afterEach(() => {
        delete process.env.COINBASE_ADV_TRADE_API_KEY;
        delete process.env.COINBASE_ADV_TRADE_SECRET;
        vi.unstubAllGlobals();
    });
    it("returns 'No candle data' when empty array returned", async () => {
        process.env.COINBASE_ADV_TRADE_API_KEY = "test-key";
        process.env.COINBASE_ADV_TRADE_SECRET = FAKE_SECRET;
        stubFetchOk({ candles: [] });
        const result = await marketModule.handle("market_get_candles", { product_id: "BTC-USD" });
        expect(result.content[0].text).toContain("No candle data");
    });
    it("formats candle data with OHLCV", async () => {
        process.env.COINBASE_ADV_TRADE_API_KEY = "test-key";
        process.env.COINBASE_ADV_TRADE_SECRET = FAKE_SECRET;
        const now = Math.floor(Date.now() / 1000);
        stubFetchOk({
            candles: [
                { start: String(now), open: "65000", high: "66000", low: "64000", close: "65500", volume: "100" },
                { start: String(now - 3600), open: "64500", high: "65200", low: "64100", close: "65000", volume: "80" },
            ],
        });
        const result = await marketModule.handle("market_get_candles", {
            product_id: "BTC-USD",
            granularity: "ONE_HOUR",
        });
        expect(result.isError).toBeFalsy();
        expect(result.content[0].text).toContain("65000");
        expect(result.content[0].text).toContain("66000");
        expect(result.content[0].text).toContain("ONE_HOUR");
    });
});
describe("market_get_orderbook", () => {
    afterEach(() => {
        delete process.env.COINBASE_ADV_TRADE_API_KEY;
        delete process.env.COINBASE_ADV_TRADE_SECRET;
        vi.unstubAllGlobals();
    });
    it("formats bids and asks", async () => {
        process.env.COINBASE_ADV_TRADE_API_KEY = "test-key";
        process.env.COINBASE_ADV_TRADE_SECRET = FAKE_SECRET;
        stubFetchOk({
            pricebook: {
                bids: [{ price: "64990", size: "0.5" }, { price: "64980", size: "1.0" }],
                asks: [{ price: "65010", size: "0.3" }, { price: "65020", size: "0.8" }],
            },
        });
        const result = await marketModule.handle("market_get_orderbook", { product_id: "BTC-USD" });
        expect(result.isError).toBeFalsy();
        expect(result.content[0].text).toContain("64990");
        expect(result.content[0].text).toContain("65010");
        expect(result.content[0].text).toContain("BIDS");
        expect(result.content[0].text).toContain("ASKS");
    });
});
// ---------------------------------------------------------------------------
// Authenticated tools with valid creds
// ---------------------------------------------------------------------------
describe("market_list_orders", () => {
    afterEach(() => {
        delete process.env.COINBASE_ADV_TRADE_API_KEY;
        delete process.env.COINBASE_ADV_TRADE_SECRET;
        vi.unstubAllGlobals();
    });
    it("returns 'No orders found' when empty", async () => {
        process.env.COINBASE_ADV_TRADE_API_KEY = "test-key";
        process.env.COINBASE_ADV_TRADE_SECRET = FAKE_SECRET;
        stubFetchOk({ orders: [] });
        const result = await marketModule.handle("market_list_orders", {});
        expect(result.content[0].text).toContain("No orders found");
    });
    it("lists open orders", async () => {
        process.env.COINBASE_ADV_TRADE_API_KEY = "test-key";
        process.env.COINBASE_ADV_TRADE_SECRET = FAKE_SECRET;
        stubFetchOk({
            orders: [
                { order_id: "ord-001", product_id: "BTC-USD", side: "BUY", status: "OPEN", base_size: "0.001", filled_size: "0" },
            ],
        });
        const result = await marketModule.handle("market_list_orders", {});
        expect(result.content[0].text).toContain("ord-001");
        expect(result.content[0].text).toContain("OPEN");
    });
});
describe("market_cancel_orders", () => {
    afterEach(() => {
        delete process.env.COINBASE_ADV_TRADE_API_KEY;
        delete process.env.COINBASE_ADV_TRADE_SECRET;
        vi.unstubAllGlobals();
    });
    it("shows cancellation results", async () => {
        process.env.COINBASE_ADV_TRADE_API_KEY = "test-key";
        process.env.COINBASE_ADV_TRADE_SECRET = FAKE_SECRET;
        stubFetchOk({
            results: [
                { order_id: "ord-001", success: true },
                { order_id: "ord-002", success: false, failure_reason: "Order already filled" },
            ],
        });
        const result = await marketModule.handle("market_cancel_orders", { order_ids: ["ord-001", "ord-002"] });
        expect(result.isError).toBeFalsy();
        expect(result.content[0].text).toContain("✓ cancelled");
        expect(result.content[0].text).toContain("Order already filled");
    });
});
describe("market_get_fills", () => {
    afterEach(() => {
        delete process.env.COINBASE_ADV_TRADE_API_KEY;
        delete process.env.COINBASE_ADV_TRADE_SECRET;
        vi.unstubAllGlobals();
    });
    it("returns 'No fills found' when empty", async () => {
        process.env.COINBASE_ADV_TRADE_API_KEY = "test-key";
        process.env.COINBASE_ADV_TRADE_SECRET = FAKE_SECRET;
        stubFetchOk({ fills: [] });
        const result = await marketModule.handle("market_get_fills", {});
        expect(result.content[0].text).toContain("No fills found");
    });
    it("lists fills with trade details", async () => {
        process.env.COINBASE_ADV_TRADE_API_KEY = "test-key";
        process.env.COINBASE_ADV_TRADE_SECRET = FAKE_SECRET;
        stubFetchOk({
            fills: [
                { trade_time: "2024-01-01T12:00:00Z", product_id: "BTC-USD", side: "BUY", size: "0.001", price: "65000.00", commission: "0.65" },
            ],
        });
        const result = await marketModule.handle("market_get_fills", {});
        expect(result.content[0].text).toContain("BTC-USD");
        expect(result.content[0].text).toContain("65000.00");
        expect(result.content[0].text).toContain("0.65");
    });
});
// ---------------------------------------------------------------------------
// market_create_order — success path
// ---------------------------------------------------------------------------
describe("market_create_order — success", () => {
    afterEach(() => {
        delete process.env.COINBASE_ADV_TRADE_API_KEY;
        delete process.env.COINBASE_ADV_TRADE_SECRET;
        vi.unstubAllGlobals();
    });
    it("returns order details on success", async () => {
        process.env.COINBASE_ADV_TRADE_API_KEY = "test-key";
        process.env.COINBASE_ADV_TRADE_SECRET = FAKE_SECRET;
        stubFetchOk({
            success_response: {
                order_id: "ord-new-001",
                client_order_id: "client-123",
            },
        });
        const result = await marketModule.handle("market_create_order", {
            product_id: "BTC-USD",
            side: "BUY",
            order_type: "market",
            quote_size: "100",
        });
        expect(result.isError).toBeFalsy();
        expect(result.content[0].text).toContain("ord-new-001");
        expect(result.content[0].text).toContain("BTC-USD");
    });
    it("returns error when API returns error_response", async () => {
        process.env.COINBASE_ADV_TRADE_API_KEY = "test-key";
        process.env.COINBASE_ADV_TRADE_SECRET = FAKE_SECRET;
        stubFetchOk({
            error_response: { message: "Insufficient funds" },
        });
        const result = await marketModule.handle("market_create_order", {
            product_id: "BTC-USD",
            side: "BUY",
            order_type: "market",
            base_size: "1000",
        });
        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain("Insufficient funds");
    });
});
// ---------------------------------------------------------------------------
// market_get_order — happy path
// ---------------------------------------------------------------------------
describe("market_get_order", () => {
    afterEach(() => {
        delete process.env.COINBASE_ADV_TRADE_API_KEY;
        delete process.env.COINBASE_ADV_TRADE_SECRET;
        vi.unstubAllGlobals();
    });
    it("returns order details", async () => {
        process.env.COINBASE_ADV_TRADE_API_KEY = "test-key";
        process.env.COINBASE_ADV_TRADE_SECRET = FAKE_SECRET;
        stubFetchOk({
            order: {
                order_id: "ord-abc",
                product_id: "ETH-USD",
                side: "SELL",
                status: "FILLED",
                created_time: "2024-01-01T12:00:00Z",
                filled_size: "1.0",
                base_size: "1.0",
            },
        });
        const result = await marketModule.handle("market_get_order", { order_id: "ord-abc" });
        expect(result.isError).toBeFalsy();
        expect(result.content[0].text).toContain("ord-abc");
        expect(result.content[0].text).toContain("FILLED");
        expect(result.content[0].text).toContain("ETH-USD");
    });
});
// ---------------------------------------------------------------------------
// Unknown tool
// ---------------------------------------------------------------------------
describe("market unknown tool", () => {
    it("returns error for unknown tool name", async () => {
        const result = await marketModule.handle("market_nonexistent", {});
        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain("Unknown market tool");
    });
});
//# sourceMappingURL=market.test.js.map