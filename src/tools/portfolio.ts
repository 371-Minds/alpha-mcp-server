// Coinbase App API v2 — OAuth2 portfolio, accounts, transactions, spot prices
import type { ToolModule, ToolDef, McpResult } from "../types.js";
import { ok, err, missingEnv } from "../types.js";

const CB_API_BASE = "https://api.coinbase.com/v2";
const CB_OAUTH_URL = "https://www.coinbase.com/oauth/authorize";
const CB_TOKEN_URL = "https://api.coinbase.com/oauth/token";

async function cbCall(
  endpoint: string,
  method: string,
  token: string,
  body?: unknown
): Promise<Record<string, unknown>> {
  const res = await fetch(`${CB_API_BASE}${endpoint}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "CB-VERSION": "2024-01-01",
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Coinbase API error ${res.status}: ${text}`);
  }
  return res.json() as Promise<Record<string, unknown>>;
}

function getOAuthToken(): string | null {
  return process.env.COINBASE_OAUTH_TOKEN || null;
}

const definitions: ToolDef[] = [
  {
    name: "cb_oauth_url",
    description:
      "Generate a Coinbase OAuth2 authorization URL. Direct the user to this URL to grant access to their Coinbase account. Requires COINBASE_CLIENT_ID env var.",
    inputSchema: {
      type: "object",
      properties: {
        redirect_uri: {
          type: "string",
          description: "Your OAuth2 redirect URI (must match what is registered in the Coinbase Developer Portal)",
        },
        scopes: {
          type: "array",
          items: { type: "string" },
          description:
            "OAuth2 scopes to request. Common: wallet:accounts:read, wallet:transactions:read, wallet:buys:create. Default: wallet:accounts:read,wallet:transactions:read",
        },
        state: {
          type: "string",
          description: "Optional random state string for CSRF protection",
        },
      },
      required: ["redirect_uri"],
    },
  },
  {
    name: "cb_exchange_token",
    description:
      "Exchange a Coinbase OAuth2 authorization code for an access token. Store the returned access token as COINBASE_OAUTH_TOKEN. Requires COINBASE_CLIENT_ID and COINBASE_CLIENT_SECRET.",
    inputSchema: {
      type: "object",
      properties: {
        code: { type: "string", description: "The authorization code from the OAuth2 callback" },
        redirect_uri: { type: "string", description: "The redirect URI used in the authorization request" },
      },
      required: ["code", "redirect_uri"],
    },
  },
  {
    name: "cb_get_user",
    description:
      "Get the authenticated Coinbase user's profile (name, email, country, native currency). Requires COINBASE_OAUTH_TOKEN.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "cb_get_accounts",
    description:
      "List all Coinbase wallet accounts with their balances (BTC, ETH, USDC, and all supported assets). Requires COINBASE_OAUTH_TOKEN.",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "number", description: "Maximum accounts to return (1-100). Default: 100" },
      },
    },
  },
  {
    name: "cb_get_transactions",
    description:
      "Get transaction history for a specific Coinbase account. Requires COINBASE_OAUTH_TOKEN.",
    inputSchema: {
      type: "object",
      properties: {
        account_id: { type: "string", description: "The Coinbase account ID (get from cb_get_accounts)" },
        limit: { type: "number", description: "Maximum transactions to return (1-100). Default: 25" },
      },
      required: ["account_id"],
    },
  },
  {
    name: "cb_get_spot_price",
    description:
      "Get the current spot price for a crypto/fiat currency pair from Coinbase. No authentication required.",
    inputSchema: {
      type: "object",
      properties: {
        currency_pair: {
          type: "string",
          description: "Currency pair in format BASE-QUOTE (e.g. BTC-USD, ETH-EUR, SOL-USDC)",
        },
      },
      required: ["currency_pair"],
    },
  },
  {
    name: "cb_get_exchange_rates",
    description:
      "Get exchange rates for a base currency against all supported fiat and crypto currencies. No authentication required.",
    inputSchema: {
      type: "object",
      properties: {
        currency: {
          type: "string",
          description: "The base currency code (e.g. USD, BTC, ETH). Default: USD",
          default: "USD",
        },
      },
    },
  },
];

async function handle(name: string, args: Record<string, unknown>): Promise<McpResult> {
  try {
    switch (name) {
      case "cb_oauth_url": {
        const clientId = process.env.COINBASE_CLIENT_ID;
        if (!clientId) return missingEnv("COINBASE_CLIENT_ID");
        const { redirect_uri, scopes, state } = args as {
          redirect_uri: string;
          scopes?: string[];
          state?: string;
        };
        const defaultScopes = ["wallet:accounts:read", "wallet:transactions:read"];
        const scopeList = (scopes && scopes.length > 0 ? scopes : defaultScopes).join(",");
        const params = new URLSearchParams({
          response_type: "code",
          client_id: clientId,
          redirect_uri,
          scope: scopeList,
        });
        if (state) params.set("state", state);
        const url = `${CB_OAUTH_URL}?${params.toString()}`;
        return ok(
          `Coinbase OAuth2 Authorization URL:\n${url}\n\nDirect the user to this URL. After authorization, they will be redirected to:\n${redirect_uri}?code=<auth_code>\n\nUse cb_exchange_token with the authorization code to get an access token.`
        );
      }

      case "cb_exchange_token": {
        const clientId = process.env.COINBASE_CLIENT_ID;
        const clientSecret = process.env.COINBASE_CLIENT_SECRET;
        if (!clientId) return missingEnv("COINBASE_CLIENT_ID");
        if (!clientSecret) return missingEnv("COINBASE_CLIENT_SECRET");
        const { code, redirect_uri } = args as { code: string; redirect_uri: string };
        const res = await fetch(CB_TOKEN_URL, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            grant_type: "authorization_code",
            code,
            client_id: clientId,
            client_secret: clientSecret,
            redirect_uri,
          }).toString(),
        });
        if (!res.ok) {
          const text = await res.text();
          return err(`Token exchange failed (${res.status}): ${text}`);
        }
        const token = await res.json() as Record<string, unknown>;
        return ok(
          `OAuth2 token exchange successful!\nAccess token: ${token.access_token}\nToken type: ${token.token_type}\nExpires in: ${token.expires_in}s\nScope: ${token.scope}\n\n⚠️ Set COINBASE_OAUTH_TOKEN=${token.access_token} to use portfolio tools.`
        );
      }

      case "cb_get_user": {
        const token = getOAuthToken();
        if (!token) return missingEnv("COINBASE_OAUTH_TOKEN");
        const resp = await cbCall("/user", "GET", token);
        const user = resp.data as Record<string, unknown>;
        return ok(
          `Coinbase User:\nID: ${user.id}\nName: ${user.name}\nEmail: ${user.email || "(private)"}\nUsername: ${user.username || "(none)"}\nCountry: ${(user.country as Record<string, string> | undefined)?.name || "—"}\nNative currency: ${(user.native_currency as string) || "USD"}\nCreated: ${user.created_at}`
        );
      }

      case "cb_get_accounts": {
        const token = getOAuthToken();
        if (!token) return missingEnv("COINBASE_OAUTH_TOKEN");
        const { limit = 100 } = args as { limit?: number };
        const resp = await cbCall(`/accounts?limit=${limit}`, "GET", token);
        const accounts = (resp.data as Array<Record<string, unknown>>) || [];
        if (accounts.length === 0) return ok("No accounts found.");
        const lines = accounts
          .filter((a) => {
            const bal = a.balance as Record<string, string> | undefined;
            return parseFloat(bal?.amount || "0") > 0;
          })
          .map((a) => {
            const bal = a.balance as Record<string, string>;
            const nativeBal = a.native_balance as Record<string, string> | undefined;
            const nativeStr = nativeBal ? ` (≈ ${nativeBal.amount} ${nativeBal.currency})` : "";
            return `  ${a.name}: ${bal.amount} ${bal.currency}${nativeStr} [ID: ${a.id}]`;
          });
        const totalAccounts = accounts.length;
        const withBalance = lines.length;
        let text = `Coinbase accounts (${totalAccounts} total, ${withBalance} with balance):\n`;
        if (lines.length > 0) text += lines.join("\n");
        else text += "  All accounts have zero balance.";
        return ok(text);
      }

      case "cb_get_transactions": {
        const token = getOAuthToken();
        if (!token) return missingEnv("COINBASE_OAUTH_TOKEN");
        const { account_id, limit = 25 } = args as { account_id: string; limit?: number };
        const resp = await cbCall(`/accounts/${account_id}/transactions?limit=${limit}`, "GET", token);
        const txns = (resp.data as Array<Record<string, unknown>>) || [];
        if (txns.length === 0) return ok("No transactions found for this account.");
        const lines = txns.map((t) => {
          const amount = t.amount as Record<string, string>;
          const native = t.native_amount as Record<string, string> | undefined;
          const nativeStr = native ? ` (${native.amount} ${native.currency})` : "";
          const sign = parseFloat(amount.amount) > 0 ? "+" : "";
          return `  ${t.created_at} | ${t.type} | ${sign}${amount.amount} ${amount.currency}${nativeStr} | ${t.status}`;
        });
        return ok(`Transactions for account ${account_id} (${txns.length}):\n${lines.join("\n")}`);
      }

      case "cb_get_spot_price": {
        const { currency_pair } = args as { currency_pair: string };
        const resp = await fetch(`${CB_API_BASE}/prices/${currency_pair}/spot`, {
          headers: { "CB-VERSION": "2024-01-01", Accept: "application/json" },
        });
        if (!resp.ok) return err(`Failed to get spot price (${resp.status})`);
        const data = ((await resp.json()) as Record<string, unknown>).data as Record<string, string>;
        return ok(`Spot price for ${data.base}-${data.currency}:\n$${data.amount} ${data.currency}`);
      }

      case "cb_get_exchange_rates": {
        const { currency = "USD" } = args as { currency?: string };
        const resp = await fetch(`${CB_API_BASE}/exchange-rates?currency=${currency}`, {
          headers: { "CB-VERSION": "2024-01-01", Accept: "application/json" },
        });
        if (!resp.ok) return err(`Failed to get exchange rates (${resp.status})`);
        const data = ((await resp.json()) as Record<string, unknown>).data as Record<string, unknown>;
        const rates = data.rates as Record<string, string>;
        const cryptoRates = Object.entries(rates)
          .filter(([, v]) => parseFloat(v) !== 0)
          .slice(0, 20)
          .map(([k, v]) => `  ${k}: ${v}`)
          .join("\n");
        return ok(`Exchange rates (base: ${data.currency}):\n${cryptoRates}\n...and more`);
      }

      default:
        throw new Error(`Unknown portfolio tool: ${name}`);
    }
  } catch (e) {
    return err(`Error: ${(e as Error).message}`);
  }
}

export const portfolioModule: ToolModule = { definitions, handle };
