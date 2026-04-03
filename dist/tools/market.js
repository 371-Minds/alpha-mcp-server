// Coinbase Advanced Trade API — institutional market data and order management
// Uses JWT (ES256) authentication with the CDP API key
import { createSign, randomBytes } from "node:crypto";
import { ok, err, missingEnv } from "../types.js";
const ADV_TRADE_BASE = "https://api.coinbase.com";
/**
 * Generate a JWT for Coinbase Advanced Trade API (ES256 / ECDSA P-256).
 * The secret must be a PEM-encoded EC private key.
 */
function generateJWT(method, path) {
    const keyName = process.env.COINBASE_ADV_TRADE_API_KEY;
    const keySecret = process.env.COINBASE_ADV_TRADE_SECRET;
    if (!keyName || !keySecret) {
        throw new Error("COINBASE_ADV_TRADE_API_KEY and COINBASE_ADV_TRADE_SECRET must be set");
    }
    const now = Math.floor(Date.now() / 1000);
    const nonce = randomBytes(16).toString("hex");
    const header = { alg: "ES256", kid: keyName, nonce };
    const payload = {
        sub: keyName,
        iss: "cdp",
        nbf: now,
        exp: now + 120,
        uri: `${method} api.coinbase.com${path}`,
    };
    const b64url = (obj) => Buffer.from(JSON.stringify(obj)).toString("base64url");
    const signingInput = `${b64url(header)}.${b64url(payload)}`;
    const signer = createSign("SHA256");
    signer.update(signingInput);
    // IEEE P1363 format: r || s each 32 bytes, no DER wrapping — required for ES256
    const signature = signer.sign({ key: keySecret, dsaEncoding: "ieee-p1363" });
    return `${signingInput}.${signature.toString("base64url")}`;
}
async function advTradeCall(path, method, body) {
    const jwt = generateJWT(method, path);
    const res = await fetch(`${ADV_TRADE_BASE}${path}`, {
        method,
        headers: {
            Authorization: `Bearer ${jwt}`,
            "Content-Type": "application/json",
            Accept: "application/json",
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Advanced Trade API error ${res.status}: ${text}`);
    }
    return res.json();
}
function requireMarketCreds() {
    if (!process.env.COINBASE_ADV_TRADE_API_KEY || !process.env.COINBASE_ADV_TRADE_SECRET) {
        return missingEnv("COINBASE_ADV_TRADE_API_KEY", "COINBASE_ADV_TRADE_SECRET");
    }
    return null;
}
const definitions = [
    {
        name: "market_get_product",
        description: "Get trading pair info (price, 24h volume, bid/ask spread) for a Coinbase Advanced Trade product. No credentials needed for public data.",
        inputSchema: {
            type: "object",
            properties: {
                product_id: {
                    type: "string",
                    description: "Trading pair ID (e.g. BTC-USD, ETH-USDC, SOL-USD)",
                },
            },
            required: ["product_id"],
        },
    },
    {
        name: "market_list_products",
        description: "List all available trading products on Coinbase Advanced Trade with their current prices.",
        inputSchema: {
            type: "object",
            properties: {
                product_type: {
                    type: "string",
                    enum: ["SPOT", "FUTURE"],
                    description: "Filter by product type. Default: SPOT",
                    default: "SPOT",
                },
                limit: { type: "number", description: "Maximum products to return. Default: 50", default: 50 },
            },
        },
    },
    {
        name: "market_get_candles",
        description: "Get OHLCV (candlestick) historical price data for a trading product. Use for technical analysis and price charts.",
        inputSchema: {
            type: "object",
            properties: {
                product_id: { type: "string", description: "Trading pair ID (e.g. BTC-USD)" },
                granularity: {
                    type: "string",
                    enum: ["ONE_MINUTE", "FIVE_MINUTE", "FIFTEEN_MINUTE", "THIRTY_MINUTE", "ONE_HOUR", "TWO_HOUR", "SIX_HOUR", "ONE_DAY"],
                    description: "Candle interval. Default: ONE_HOUR",
                    default: "ONE_HOUR",
                },
                start: { type: "string", description: "Start time as Unix timestamp (seconds). Default: 24 hours ago" },
                end: { type: "string", description: "End time as Unix timestamp (seconds). Default: now" },
            },
            required: ["product_id"],
        },
    },
    {
        name: "market_get_orderbook",
        description: "Get the current Level 2 order book (bids and asks) for a trading product.",
        inputSchema: {
            type: "object",
            properties: {
                product_id: { type: "string", description: "Trading pair ID (e.g. BTC-USD)" },
                limit: { type: "number", description: "Number of bid/ask levels to return (1-5000). Default: 10", default: 10 },
            },
            required: ["product_id"],
        },
    },
    {
        name: "market_create_order",
        description: "Place a market or limit order on Coinbase Advanced Trade. Requires COINBASE_ADV_TRADE_API_KEY and COINBASE_ADV_TRADE_SECRET.",
        inputSchema: {
            type: "object",
            properties: {
                product_id: { type: "string", description: "Trading pair (e.g. BTC-USD)" },
                side: { type: "string", enum: ["BUY", "SELL"], description: "Order side" },
                order_type: {
                    type: "string",
                    enum: ["market", "limit"],
                    description: "market = execute at current price, limit = execute at specified price or better",
                },
                base_size: {
                    type: "string",
                    description: "Amount of base currency to buy/sell (e.g. '0.001' for 0.001 BTC)",
                },
                quote_size: {
                    type: "string",
                    description: "For market BUY orders: amount of quote currency to spend (e.g. '100' for $100 USD). Use instead of base_size.",
                },
                limit_price: {
                    type: "string",
                    description: "Required for limit orders: the price per unit (e.g. '45000' for $45,000 per BTC)",
                },
                client_order_id: {
                    type: "string",
                    description: "Optional unique client-side order identifier for idempotency",
                },
            },
            required: ["product_id", "side", "order_type"],
        },
    },
    {
        name: "market_get_order",
        description: "Get details of a specific order by ID. Requires COINBASE_ADV_TRADE_API_KEY and COINBASE_ADV_TRADE_SECRET.",
        inputSchema: {
            type: "object",
            properties: {
                order_id: { type: "string", description: "The order ID to look up" },
            },
            required: ["order_id"],
        },
    },
    {
        name: "market_list_orders",
        description: "List open or historical orders. Requires COINBASE_ADV_TRADE_API_KEY and COINBASE_ADV_TRADE_SECRET.",
        inputSchema: {
            type: "object",
            properties: {
                product_id: { type: "string", description: "Filter by trading pair (optional)" },
                order_status: {
                    type: "array",
                    items: { type: "string" },
                    description: "Filter by status. Values: OPEN, CANCELLED, EXPIRED, FAILED, FILLED, PENDING. Default: [OPEN]",
                },
                limit: { type: "number", description: "Max orders to return. Default: 25" },
            },
        },
    },
    {
        name: "market_cancel_orders",
        description: "Cancel one or more open orders by ID. Requires COINBASE_ADV_TRADE_API_KEY and COINBASE_ADV_TRADE_SECRET.",
        inputSchema: {
            type: "object",
            properties: {
                order_ids: {
                    type: "array",
                    items: { type: "string" },
                    description: "List of order IDs to cancel",
                },
            },
            required: ["order_ids"],
        },
    },
    {
        name: "market_get_fills",
        description: "Get trade execution history (fills) for your orders. Requires COINBASE_ADV_TRADE_API_KEY and COINBASE_ADV_TRADE_SECRET.",
        inputSchema: {
            type: "object",
            properties: {
                product_id: { type: "string", description: "Filter fills by trading pair (optional)" },
                order_id: { type: "string", description: "Filter fills for a specific order (optional)" },
                limit: { type: "number", description: "Max fills to return. Default: 25" },
            },
        },
    },
];
async function handle(name, args) {
    try {
        switch (name) {
            case "market_get_product": {
                const { product_id } = args;
                const data = await advTradeCall(`/api/v3/brokerage/products/${product_id}`, "GET");
                return ok(`Product: ${data.product_id}\nStatus: ${data.status}\nPrice: ${data.price}\n24h Change: ${data.price_percentage_change_24h}%\n24h Volume: ${data.volume_24h}\nBase: ${data.base_currency_id}\nQuote: ${data.quote_currency_id}\nBid: ${data.best_bid}\nAsk: ${data.best_ask}`);
            }
            case "market_list_products": {
                const { product_type = "SPOT", limit = 50 } = args;
                const data = await advTradeCall(`/api/v3/brokerage/products?product_type=${product_type}&limit=${limit}`, "GET");
                const products = data.products || [];
                const lines = products.map((p) => `  ${p.product_id.padEnd(12)} | ${String(p.price || "—").padStart(14)} | ${p.status}`);
                return ok(`Coinbase Advanced Trade products (${products.length}):\n${lines.join("\n")}`);
            }
            case "market_get_candles": {
                const { product_id, granularity = "ONE_HOUR", start, end, } = args;
                const now = Math.floor(Date.now() / 1000);
                const startTs = start || String(now - 86400);
                const endTs = end || String(now);
                const data = await advTradeCall(`/api/v3/brokerage/products/${product_id}/candles?granularity=${granularity}&start=${startTs}&end=${endTs}`, "GET");
                const candles = data.candles || [];
                if (candles.length === 0)
                    return ok("No candle data returned.");
                const first = candles[0];
                const last = candles[candles.length - 1];
                const fmtDate = (ts) => new Date(parseInt(ts) * 1000).toISOString();
                const fmtCandle = (c) => `  ${fmtDate(c.start).slice(0, 16)} O:${c.open} H:${c.high} L:${c.low} C:${c.close} V:${c.volume}`;
                let text = `${product_id} ${granularity} candles (${candles.length} bars)\n`;
                text += `Period: ${fmtDate(last.start)} → ${fmtDate(first.start)}\n\n`;
                text += `Latest candle:\n`;
                text += `  Open:  ${first.open}\n  High:  ${first.high}\n`;
                text += `  Low:   ${first.low}\n  Close: ${first.close}\n  Volume: ${first.volume}\n\n`;
                text += `Recent candles (newest first):\n`;
                text += candles.slice(0, 10).map(fmtCandle).join("\n");
                return ok(text);
            }
            case "market_get_orderbook": {
                const { product_id, limit = 10 } = args;
                const data = await advTradeCall(`/api/v3/brokerage/products/${product_id}/book?limit=${limit}`, "GET");
                const book = data.pricebook;
                const bids = book?.bids || [];
                const asks = book?.asks || [];
                let text = `Order book for ${product_id}:\n\nASKS (sell orders):\n`;
                text += asks
                    .slice(0, limit)
                    .map((a) => `  ${a.price.padStart(14)} | ${a.size} lots`)
                    .join("\n");
                text += `\n\nBIDS (buy orders):\n`;
                text += bids
                    .slice(0, limit)
                    .map((b) => `  ${b.price.padStart(14)} | ${b.size} lots`)
                    .join("\n");
                return ok(text);
            }
            case "market_create_order": {
                const credsErr = requireMarketCreds();
                if (credsErr)
                    return credsErr;
                const { product_id, side, order_type, base_size, quote_size, limit_price, client_order_id } = args;
                const clientOid = client_order_id || `mcp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
                let orderConfig;
                if (order_type === "market") {
                    orderConfig = side === "BUY" && quote_size
                        ? { market_market_ioc: { quote_size } }
                        : { market_market_ioc: { base_size: base_size || "0" } };
                }
                else {
                    if (!limit_price)
                        return err("limit_price is required for limit orders");
                    if (!base_size)
                        return err("base_size is required for limit orders");
                    orderConfig = {
                        limit_limit_gtc: {
                            base_size,
                            limit_price,
                            post_only: false,
                        },
                    };
                }
                const payload = {
                    client_order_id: clientOid,
                    product_id,
                    side,
                    order_configuration: orderConfig,
                };
                const data = await advTradeCall("/api/v3/brokerage/orders", "POST", payload);
                const order = data.success_response;
                if (!order) {
                    const errResp = data.error_response;
                    return err(`Order failed: ${errResp?.message || JSON.stringify(data)}`);
                }
                return ok(`Order placed!\nOrder ID: ${order.order_id}\nClient Order ID: ${order.client_order_id}\nProduct: ${product_id}\nSide: ${side}\nType: ${order_type}`);
            }
            case "market_get_order": {
                const credsErr = requireMarketCreds();
                if (credsErr)
                    return credsErr;
                const { order_id } = args;
                const data = await advTradeCall(`/api/v3/brokerage/orders/historical/${order_id}`, "GET");
                const order = data.order;
                return ok(`Order ${order.order_id}:\nProduct: ${order.product_id}\nSide: ${order.side}\nStatus: ${order.status}\nCreated: ${order.created_time}\nFilled: ${order.filled_size || "0"} / ${order.base_size || "—"}`);
            }
            case "market_list_orders": {
                const credsErr = requireMarketCreds();
                if (credsErr)
                    return credsErr;
                const { product_id, order_status = ["OPEN"], limit = 25 } = args;
                const statusParams = order_status.map((s) => `order_status=${s}`).join("&");
                const productParam = product_id ? `&product_id=${product_id}` : "";
                const data = await advTradeCall(`/api/v3/brokerage/orders/historical/batch?${statusParams}${productParam}&limit=${limit}`, "GET");
                const orders = data.orders || [];
                if (orders.length === 0)
                    return ok("No orders found.");
                const lines = orders.map((o) => `  ${o.order_id} | ${o.product_id} | ${o.side} | ${o.status} | size:${o.base_size || "—"} filled:${o.filled_size || "0"}`);
                return ok(`Orders (${orders.length}):\n${lines.join("\n")}`);
            }
            case "market_cancel_orders": {
                const credsErr = requireMarketCreds();
                if (credsErr)
                    return credsErr;
                const { order_ids } = args;
                const data = await advTradeCall("/api/v3/brokerage/orders/batch_cancel", "POST", {
                    order_ids,
                });
                const results = data.results || [];
                const lines = results.map((r) => `  ${r.order_id}: ${r.success ? "✓ cancelled" : `✗ failed — ${r.failure_reason}`}`);
                return ok(`Cancel results:\n${lines.join("\n")}`);
            }
            case "market_get_fills": {
                const credsErr = requireMarketCreds();
                if (credsErr)
                    return credsErr;
                const { product_id, order_id, limit = 25 } = args;
                const params = new URLSearchParams({ limit: String(limit) });
                if (product_id)
                    params.set("product_id", product_id);
                if (order_id)
                    params.set("order_id", order_id);
                const data = await advTradeCall(`/api/v3/brokerage/orders/historical/fills?${params.toString()}`, "GET");
                const fills = data.fills || [];
                if (fills.length === 0)
                    return ok("No fills found.");
                const lines = fills.map((f) => `  ${f.trade_time} | ${f.product_id} | ${f.side} | ${f.size} @ ${f.price} | fee:${f.commission}`);
                return ok(`Trade fills (${fills.length}):\n${lines.join("\n")}`);
            }
            default:
                throw new Error(`Unknown market tool: ${name}`);
        }
    }
    catch (e) {
        return err(`Error: ${e.message}`);
    }
}
export const marketModule = { definitions, handle };
//# sourceMappingURL=market.js.map