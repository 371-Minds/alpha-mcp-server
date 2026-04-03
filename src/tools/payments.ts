// Coinbase Commerce + x402 payment tools
import type { ToolModule, ToolDef, McpResult } from "../types.js";
import { ok, err, missingEnv } from "../types.js";

const COMMERCE_API_BASE = "https://api.commerce.coinbase.com";
const COMMERCE_API_VERSION = "2018-03-22";

async function commerceCall(
  endpoint: string,
  method: string,
  body?: unknown
): Promise<Record<string, unknown>> {
  const apiKey = process.env.COINBASE_COMMERCE_API_KEY;
  if (!apiKey) throw new Error("COINBASE_COMMERCE_API_KEY is not set");
  const res = await fetch(`${COMMERCE_API_BASE}${endpoint}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "X-CC-Api-Key": apiKey,
      "X-CC-Version": COMMERCE_API_VERSION,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Commerce API error ${res.status}: ${text}`);
  }
  return res.json() as Promise<Record<string, unknown>>;
}

const definitions: ToolDef[] = [
  {
    name: "pay_create_charge",
    description:
      "Create a Coinbase Commerce payment charge (invoice). Returns a hosted payment URL that customers can visit to pay with crypto. Requires COINBASE_COMMERCE_API_KEY env var.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Product or service name (e.g. 'Premium Subscription')" },
        description: { type: "string", description: "Description of what the customer is paying for" },
        amount: { type: "string", description: "Price amount as a decimal string (e.g. '10.00')" },
        currency: {
          type: "string",
          description: "Pricing currency code (e.g. USD, EUR, USDC). Default: USD",
          default: "USD",
        },
        redirect_url: { type: "string", description: "Optional URL to redirect after successful payment" },
        cancel_url: { type: "string", description: "Optional URL to redirect on cancelled payment" },
        metadata: { type: "object", description: "Optional key-value metadata to attach to the charge" },
      },
      required: ["name", "description", "amount"],
    },
  },
  {
    name: "pay_get_charge",
    description:
      "Get the status and details of a Coinbase Commerce charge by its ID. Requires COINBASE_COMMERCE_API_KEY.",
    inputSchema: {
      type: "object",
      properties: {
        charge_id: { type: "string", description: "The charge ID returned by pay_create_charge" },
      },
      required: ["charge_id"],
    },
  },
  {
    name: "pay_list_charges",
    description: "List recent Coinbase Commerce charges with their status. Requires COINBASE_COMMERCE_API_KEY.",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "number", description: "Maximum number of charges to return (1-100). Default: 25" },
        order: {
          type: "string",
          enum: ["asc", "desc"],
          description: "Sort order. Default: desc (newest first)",
          default: "desc",
        },
      },
    },
  },
  {
    name: "pay_create_checkout",
    description:
      "Create a Coinbase Commerce checkout session (reusable payment page). Requires COINBASE_COMMERCE_API_KEY.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Product or service name" },
        description: { type: "string", description: "Description of the product or service" },
        amount: { type: "string", description: "Price as a decimal string (e.g. '29.99')" },
        currency: { type: "string", description: "Currency code (e.g. USD, USDC). Default: USD", default: "USD" },
        pricing_type: {
          type: "string",
          enum: ["fixed_price", "no_price"],
          description: "fixed_price for exact amount, no_price for open donations. Default: fixed_price",
          default: "fixed_price",
        },
      },
      required: ["name", "description"],
    },
  },
  {
    name: "pay_resolve_charge",
    description:
      "Resolve (manually mark as complete) or void (cancel) an unresolved Coinbase Commerce charge. Requires COINBASE_COMMERCE_API_KEY.",
    inputSchema: {
      type: "object",
      properties: {
        charge_id: { type: "string", description: "The charge ID" },
        action: {
          type: "string",
          enum: ["resolve", "void"],
          description: "'resolve' to mark as complete, 'void' to cancel",
        },
      },
      required: ["charge_id", "action"],
    },
  },
  {
    name: "pay_x402_check",
    description:
      "Check whether a URL supports x402 autonomous payments by sending a probe request and inspecting the 402 Payment Required response headers.",
    inputSchema: {
      type: "object",
      properties: {
        url: { type: "string", description: "The URL to check for x402 payment support" },
      },
      required: ["url"],
    },
  },
  {
    name: "pay_list_events",
    description: "List Coinbase Commerce webhook events (payment received, confirmed, etc.). Requires COINBASE_COMMERCE_API_KEY.",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "number", description: "Maximum number of events to return. Default: 25" },
        order: { type: "string", enum: ["asc", "desc"], description: "Sort order. Default: desc" },
      },
    },
  },
];

async function handle(name: string, args: Record<string, unknown>): Promise<McpResult> {
  try {
    switch (name) {
      case "pay_create_charge": {
        if (!process.env.COINBASE_COMMERCE_API_KEY) return missingEnv("COINBASE_COMMERCE_API_KEY");
        const { name: chargeName, description, amount, currency = "USD", redirect_url, cancel_url, metadata } = args as {
          name: string;
          description: string;
          amount: string;
          currency?: string;
          redirect_url?: string;
          cancel_url?: string;
          metadata?: Record<string, string>;
        };
        const payload: Record<string, unknown> = {
          name: chargeName,
          description,
          pricing_type: "fixed_price",
          local_price: { amount, currency },
        };
        if (redirect_url) payload.redirect_url = redirect_url;
        if (cancel_url) payload.cancel_url = cancel_url;
        if (metadata) payload.metadata = metadata;
        const resp = await commerceCall("/charges", "POST", payload);
        const data = resp.data as Record<string, unknown>;
        const hosted = (data.hosted_url as string) || "";
        const chargeId = data.id as string;
        const code = data.code as string;
        return ok(
          `Charge created!\nID: ${chargeId}\nCode: ${code}\nHosted URL: ${hosted}\nAmount: ${amount} ${currency}\nStatus: ${(data.timeline as Array<Record<string, string>>)?.[0]?.status || "NEW"}`
        );
      }

      case "pay_get_charge": {
        if (!process.env.COINBASE_COMMERCE_API_KEY) return missingEnv("COINBASE_COMMERCE_API_KEY");
        const { charge_id } = args as { charge_id: string };
        const resp = await commerceCall(`/charges/${charge_id}`, "GET");
        const data = resp.data as Record<string, unknown>;
        const timeline = (data.timeline as Array<Record<string, string>>) || [];
        const latestStatus = timeline[timeline.length - 1]?.status || "UNKNOWN";
        const pricing = data.pricing as Record<string, Record<string, string>> | undefined;
        let text = `Charge ${charge_id}:\nName: ${data.name}\nStatus: ${latestStatus}\n`;
        text += `Description: ${data.description}\n`;
        if (pricing?.local) text += `Price: ${pricing.local.amount} ${pricing.local.currency}\n`;
        text += `Hosted URL: ${data.hosted_url}\n`;
        text += `Expires: ${data.expires_at}\n`;
        if (timeline.length > 0) {
          text += `\nTimeline:\n${timeline.map((t) => `  ${t.time}: ${t.status}`).join("\n")}`;
        }
        return ok(text);
      }

      case "pay_list_charges": {
        if (!process.env.COINBASE_COMMERCE_API_KEY) return missingEnv("COINBASE_COMMERCE_API_KEY");
        const { limit = 25, order = "desc" } = args as { limit?: number; order?: string };
        const resp = await commerceCall(`/charges?limit=${limit}&order=${order}`, "GET");
        const charges = (resp.data as Array<Record<string, unknown>>) || [];
        if (charges.length === 0) return ok("No charges found.");
        const lines = charges.map((c) => {
          const timeline = (c.timeline as Array<Record<string, string>>) || [];
          const status = timeline[timeline.length - 1]?.status || "NEW";
          const pricing = c.pricing as Record<string, Record<string, string>> | undefined;
          const price = pricing?.local ? `${pricing.local.amount} ${pricing.local.currency}` : "—";
          return `  ${c.id} | ${c.code} | ${status} | ${price} | ${c.name}`;
        });
        return ok(`Coinbase Commerce charges (${charges.length}):\n${lines.join("\n")}`);
      }

      case "pay_create_checkout": {
        if (!process.env.COINBASE_COMMERCE_API_KEY) return missingEnv("COINBASE_COMMERCE_API_KEY");
        const {
          name: checkoutName,
          description,
          amount,
          currency = "USD",
          pricing_type = "fixed_price",
        } = args as { name: string; description: string; amount?: string; currency?: string; pricing_type?: string };
        const payload: Record<string, unknown> = {
          name: checkoutName,
          description,
          pricing_type,
          requested_info: [],
        };
        if (pricing_type === "fixed_price" && amount) {
          payload.local_price = { amount, currency };
        }
        const resp = await commerceCall("/checkouts", "POST", payload);
        const data = resp.data as Record<string, unknown>;
        return ok(
          `Checkout created!\nID: ${data.id}\nName: ${data.name}\nHosted URL: https://commerce.coinbase.com/checkout/${data.id}`
        );
      }

      case "pay_resolve_charge": {
        if (!process.env.COINBASE_COMMERCE_API_KEY) return missingEnv("COINBASE_COMMERCE_API_KEY");
        const { charge_id, action } = args as { charge_id: string; action: string };
        const resp = await commerceCall(`/charges/${charge_id}/${action}`, "POST");
        const data = resp.data as Record<string, unknown>;
        const timeline = (data.timeline as Array<Record<string, string>>) || [];
        const status = timeline[timeline.length - 1]?.status || "UNKNOWN";
        return ok(`Charge ${charge_id} ${action}d successfully.\nCurrent status: ${status}`);
      }

      case "pay_x402_check": {
        const { url } = args as { url: string };
        // Send a GET request and check for 402 response with x402 headers
        const res = await fetch(url, {
          method: "GET",
          headers: { Accept: "application/json" },
        });
        if (res.status !== 402) {
          return ok(
            `URL: ${url}\nStatus: ${res.status} (not 402)\nx402 support: Not detected\n\nThis URL does not return HTTP 402 Payment Required.`
          );
        }
        const headers: Record<string, string> = {};
        res.headers.forEach((value, key) => {
          if (key.toLowerCase().startsWith("x-payment") || key.toLowerCase().includes("402") || key === "www-authenticate") {
            headers[key] = value;
          }
        });
        let text = await res.text().catch(() => "");
        return ok(
          `URL: ${url}\nStatus: 402 Payment Required\nx402 support: ✓ Detected\n\nPayment headers:\n${JSON.stringify(headers, null, 2)}\n\nBody:\n${text.slice(0, 500)}`
        );
      }

      case "pay_list_events": {
        if (!process.env.COINBASE_COMMERCE_API_KEY) return missingEnv("COINBASE_COMMERCE_API_KEY");
        const { limit = 25, order = "desc" } = args as { limit?: number; order?: string };
        const resp = await commerceCall(`/events?limit=${limit}&order=${order}`, "GET");
        const events = (resp.data as Array<Record<string, unknown>>) || [];
        if (events.length === 0) return ok("No events found.");
        const lines = events.map((e) => {
          const data = e.data as Record<string, unknown> | undefined;
          return `  ${e.created_at} | ${e.type} | charge: ${(data as Record<string, unknown> | undefined)?.id || "—"}`;
        });
        return ok(`Coinbase Commerce events (${events.length}):\n${lines.join("\n")}`);
      }

      default:
        throw new Error(`Unknown payment tool: ${name}`);
    }
  } catch (e) {
    return err(`Error: ${(e as Error).message}`);
  }
}

export const paymentsModule: ToolModule = { definitions, handle };
