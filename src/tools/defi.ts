// DeFi tools — Pyth price feeds, Messari research, Farcaster social, Morpho vaults, x402 Bazaar
// Uses AgentKit action providers and direct protocol integrations
import { PythActionProvider, MessariActionProvider, FarcasterActionProvider, MorphoActionProvider, CdpEvmWalletProvider } from "@coinbase/agentkit";
import type { Chain } from "viem";
import type { ToolModule, ToolDef, McpResult } from "../types.js";
import { ok, err, missingEnv } from "../types.js";

// Lazily instantiated providers
let _pyth: PythActionProvider | null = null;
function getPyth(): PythActionProvider {
  if (!_pyth) _pyth = new PythActionProvider();
  return _pyth;
}

function getMessari(): MessariActionProvider {
  return new MessariActionProvider({ apiKey: process.env.MESSARI_API_KEY });
}

function getFarcaster(): FarcasterActionProvider {
  return new FarcasterActionProvider({
    neynarApiKey: process.env.NEYNAR_API_KEY,
    signerUuid: process.env.NEYNAR_SIGNER_UUID,
    agentFid: process.env.FARCASTER_AGENT_FID,
  });
}

async function getCdpWalletProvider(): Promise<CdpEvmWalletProvider | null> {
  const apiKeyId = process.env.CDP_API_KEY_ID;
  const apiKeySecret = process.env.CDP_API_KEY_SECRET;
  if (!apiKeyId || !apiKeySecret) return null;
  return CdpEvmWalletProvider.configureWithWallet({
    apiKeyId,
    apiKeySecret,
    walletSecret: process.env.CDP_WALLET_SECRET,
    networkId: process.env.CDP_NETWORK_ID || "base-mainnet",
  });
}

// x402 Bazaar base URL
const BAZAAR_URL = "https://bazaar.x402.org";

const definitions: ToolDef[] = [
  {
    name: "defi_pyth_price_feed",
    description:
      "Fetch the Pyth Network price feed ID for a given token symbol (e.g. BTC, ETH, SOL). Returns the on-chain feed ID used by Pyth oracles.",
    inputSchema: {
      type: "object",
      properties: {
        token_symbol: {
          type: "string",
          description: "Token symbol to look up (e.g. BTC, ETH, SOL, USDC)",
        },
      },
      required: ["token_symbol"],
    },
  },
  {
    name: "defi_pyth_price",
    description:
      "Fetch the current real-time price from Pyth Network for a given Pyth price feed ID. Use defi_pyth_price_feed to get the feed ID first.",
    inputSchema: {
      type: "object",
      properties: {
        price_feed_id: {
          type: "string",
          description: "The Pyth price feed ID (hex string, e.g. 0xe62df6c8b4a85fe...)",
        },
      },
      required: ["price_feed_id"],
    },
  },
  {
    name: "defi_messari_research",
    description:
      "Ask a research question about crypto markets, protocols, tokens, or DeFi trends using Messari AI. Requires MESSARI_API_KEY env var.",
    inputSchema: {
      type: "object",
      properties: {
        question: {
          type: "string",
          description: "Your crypto research question (e.g. 'What is the TVL trend for Aave on Base?')",
        },
      },
      required: ["question"],
    },
  },
  {
    name: "defi_farcaster_post",
    description:
      "Post a cast (message) to Farcaster social network. Requires NEYNAR_API_KEY and NEYNAR_SIGNER_UUID env vars.",
    inputSchema: {
      type: "object",
      properties: {
        message: { type: "string", description: "The cast text to post (max 320 characters)" },
        channel: { type: "string", description: "Optional Farcaster channel to post in (e.g. 'defi', 'base')" },
      },
      required: ["message"],
    },
  },
  {
    name: "defi_farcaster_profile",
    description: "Get Farcaster account details for the configured agent. Requires NEYNAR_API_KEY and FARCASTER_AGENT_FID.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "defi_morpho_deposit",
    description:
      "Deposit assets into a Morpho vault to earn yield. Requires CDP_API_KEY_ID, CDP_API_KEY_SECRET env vars (CDP wallet).",
    inputSchema: {
      type: "object",
      properties: {
        vault_address: { type: "string", description: "The Morpho vault contract address (0x...)" },
        assets: { type: "string", description: "Amount of assets to deposit in the token's smallest unit" },
        receiver: { type: "string", description: "Address to receive vault shares" },
        token_address: { type: "string", description: "The ERC-20 token contract address to deposit" },
      },
      required: ["vault_address", "assets", "receiver", "token_address"],
    },
  },
  {
    name: "defi_morpho_withdraw",
    description:
      "Withdraw assets from a Morpho vault. Requires CDP_API_KEY_ID and CDP_API_KEY_SECRET env vars.",
    inputSchema: {
      type: "object",
      properties: {
        vault_address: { type: "string", description: "The Morpho vault contract address (0x...)" },
        assets: { type: "string", description: "Amount of assets to withdraw in the token's smallest unit" },
        receiver: { type: "string", description: "Address to receive withdrawn assets" },
      },
      required: ["vault_address", "assets", "receiver"],
    },
  },
  {
    name: "defi_across_bridge",
    description:
      "Get a bridge quote and initiate a cross-chain token transfer using the Across Protocol. Queries the Across API for fees and routes.",
    inputSchema: {
      type: "object",
      properties: {
        origin_chain_id: { type: "number", description: "Source chain ID (e.g. 8453 for Base, 1 for Ethereum)" },
        destination_chain_id: { type: "number", description: "Destination chain ID" },
        token: { type: "string", description: "Token symbol to bridge (e.g. ETH, USDC)" },
        amount: { type: "string", description: "Amount to bridge in the token's smallest unit" },
        recipient: { type: "string", description: "Recipient address on destination chain" },
      },
      required: ["origin_chain_id", "destination_chain_id", "token", "amount"],
    },
  },
  {
    name: "bazaar_list",
    description:
      "Browse registered x402-enabled services in the x402 Bazaar marketplace. Returns a list of APIs that accept autonomous micropayments.",
    inputSchema: {
      type: "object",
      properties: {
        category: { type: "string", description: "Filter by service category (e.g. 'ai', 'data', 'compute')" },
        limit: { type: "number", description: "Maximum number of results to return. Default: 20", default: 20 },
      },
    },
  },
  {
    name: "bazaar_call",
    description:
      "Call any x402-enabled service from the Bazaar with automatic USDC micropayment. Requires GPUBRIDGE_WALLET_KEY (EVM private key) for payment. The service URL must be x402-compatible.",
    inputSchema: {
      type: "object",
      properties: {
        url: { type: "string", description: "The x402 service endpoint URL" },
        method: {
          type: "string",
          enum: ["GET", "POST"],
          description: "HTTP method. Default: GET",
          default: "GET",
        },
        body: { type: "object", description: "Optional request body for POST requests" },
        chain: {
          type: "string",
          enum: ["base", "base-sepolia", "ethereum", "optimism", "arbitrum", "polygon"],
          description: "Payment chain for x402. Default: base",
          default: "base",
        },
      },
      required: ["url"],
    },
  },
];

async function handle(name: string, args: Record<string, unknown>): Promise<McpResult> {
  try {
    switch (name) {
      case "defi_pyth_price_feed": {
        const { token_symbol } = args as { token_symbol: string };
        const result = await getPyth().fetchPriceFeed({
          tokenSymbol: token_symbol,
          quoteCurrency: "USD",
          assetType: "crypto",
        });
        return ok(result);
      }

      case "defi_pyth_price": {
        const { price_feed_id } = args as { price_feed_id: string };
        const result = await getPyth().fetchPrice({ priceFeedID: price_feed_id });
        return ok(result);
      }

      case "defi_messari_research": {
        if (!process.env.MESSARI_API_KEY) return missingEnv("MESSARI_API_KEY");
        const { question } = args as { question: string };
        const result = await getMessari().researchQuestion({ question });
        return ok(result);
      }

      case "defi_farcaster_post": {
        if (!process.env.NEYNAR_API_KEY) return missingEnv("NEYNAR_API_KEY");
        if (!process.env.NEYNAR_SIGNER_UUID) return missingEnv("NEYNAR_SIGNER_UUID");
        const { message, channel } = args as { message: string; channel?: string };
        const fc = getFarcaster();
        const castArgs: { castText: string; channelId?: string } = { castText: message };
        if (channel) castArgs.channelId = channel;
        const result = await fc.postCast(castArgs);
        return ok(result);
      }

      case "defi_farcaster_profile": {
        if (!process.env.NEYNAR_API_KEY) return missingEnv("NEYNAR_API_KEY");
        const fc = getFarcaster();
        const result = await fc.accountDetails({});
        return ok(result);
      }

      case "defi_morpho_deposit": {
        const walletProvider = await getCdpWalletProvider();
        if (!walletProvider) return missingEnv("CDP_API_KEY_ID", "CDP_API_KEY_SECRET");
        const { vault_address, assets, receiver, token_address } = args as {
          vault_address: string;
          assets: string;
          receiver: string;
          token_address: string;
        };
        const morpho = new MorphoActionProvider();
        const result = await morpho.deposit(walletProvider, {
          vaultAddress: vault_address,
          assets,
          receiver,
          tokenAddress: token_address,
        });
        return ok(result);
      }

      case "defi_morpho_withdraw": {
        const walletProvider = await getCdpWalletProvider();
        if (!walletProvider) return missingEnv("CDP_API_KEY_ID", "CDP_API_KEY_SECRET");
        const { vault_address, assets, receiver } = args as {
          vault_address: string;
          assets: string;
          receiver: string;
        };
        const morpho = new MorphoActionProvider();
        const result = await morpho.withdraw(walletProvider, {
          vaultAddress: vault_address,
          assets,
          receiver,
        });
        return ok(result);
      }

      case "defi_across_bridge": {
        const { origin_chain_id, destination_chain_id, token, amount, recipient } = args as {
          origin_chain_id: number;
          destination_chain_id: number;
          token: string;
          amount: string;
          recipient?: string;
        };
        // Query Across Protocol Suggested Fees API
        const acrossApiUrl = new URL("https://across.to/api/suggested-fees");
        acrossApiUrl.searchParams.set("originChainId", String(origin_chain_id));
        acrossApiUrl.searchParams.set("destinationChainId", String(destination_chain_id));
        acrossApiUrl.searchParams.set("token", token);
        acrossApiUrl.searchParams.set("amount", amount);
        const res = await fetch(acrossApiUrl.toString(), {
          headers: { Accept: "application/json" },
        });
        if (!res.ok) return err(`Across API error: ${res.statusText}`);
        const fees = await res.json() as Record<string, unknown>;
        let text = `Across Bridge Quote:\n`;
        text += `Route: Chain ${origin_chain_id} → Chain ${destination_chain_id}\n`;
        text += `Token: ${token}\nAmount: ${amount}\n`;
        if (recipient) text += `Recipient: ${recipient}\n`;
        text += `\nFees & Limits:\n${JSON.stringify(fees, null, 2)}`;
        return ok(text);
      }

      case "bazaar_list": {
        const { category, limit = 20 } = args as { category?: string; limit?: number };
        const url = new URL(`${BAZAAR_URL}/api/services`);
        if (category) url.searchParams.set("category", category);
        url.searchParams.set("limit", String(limit));
        const res = await fetch(url.toString(), { headers: { Accept: "application/json" } });
        if (!res.ok) {
          // Fallback: try the root endpoint
          const rootRes = await fetch(`${BAZAAR_URL}/`, { headers: { Accept: "application/json" } });
          if (!rootRes.ok) return err(`x402 Bazaar unavailable (${res.status}). Visit https://bazaar.x402.org to browse services.`);
          const data = await rootRes.json() as unknown;
          return ok(`x402 Bazaar services:\n${JSON.stringify(data, null, 2)}`);
        }
        const services = await res.json() as unknown;
        return ok(`x402 Bazaar services:\n${JSON.stringify(services, null, 2)}`);
      }

      case "bazaar_call": {
        const walletKey = process.env.GPUBRIDGE_WALLET_KEY;
        if (!walletKey) return missingEnv("GPUBRIDGE_WALLET_KEY");
        const { url, method = "GET", body, chain = "base" } = args as {
          url: string;
          method?: string;
          body?: Record<string, unknown>;
          chain?: string;
        };
        // Dynamically import x402-fetch and viem to build a payment-enabled fetch
        const { wrapFetchWithPayment } = await import("x402-fetch");
        const { createWalletClient, http } = await import("viem");
        const { privateKeyToAccount } = await import("viem/accounts");
        const chainMap: Record<string, unknown> = {
          base: (await import("viem/chains")).base,
          "base-sepolia": (await import("viem/chains")).baseSepolia,
          ethereum: (await import("viem/chains")).mainnet,
          optimism: (await import("viem/chains")).optimism,
          arbitrum: (await import("viem/chains")).arbitrum,
          polygon: (await import("viem/chains")).polygon,
        };
        const viemChain = chainMap[chain] as Chain;
        const account = privateKeyToAccount(walletKey as `0x${string}`);
        const client = createWalletClient({ account, chain: viemChain, transport: http() });
        const payFetch = wrapFetchWithPayment(fetch, client as Parameters<typeof wrapFetchWithPayment>[1]) as typeof fetch;
        const res = await payFetch(url, {
          method,
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          ...(body ? { body: JSON.stringify(body) } : {}),
        });
        const text = await res.text();
        return ok(`x402 Bazaar response (${res.status}):\n${text}`);
      }

      default:
        throw new Error(`Unknown defi tool: ${name}`);
    }
  } catch (e) {
    return err(`Error: ${(e as Error).message}`);
  }
}

export const defiModule: ToolModule = { definitions, handle };
