# Alpha MCP Server — Superintelligence Co-Pilot

> **48 tools in one MCP server**: GPU AI inference + Coinbase DeFi, CDP wallets, Commerce payments, portfolio management, institutional markets, and protocol reference docs.
> **x402 native** for autonomous agent payments with USDC on 6 EVM chains.

[![npm version](https://img.shields.io/npm/v/@371-minds/alpha-mcp-server.svg)](https://www.npmjs.com/package/@371-minds/alpha-mcp-server)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![MCP Compatible](https://img.shields.io/badge/MCP-Compatible-blue.svg)](https://modelcontextprotocol.io)

---

## What is Alpha MCP Server?

A full-stack AI co-pilot that gives Claude (and any MCP-compatible AI) direct access to:

- **30 GPU-Bridge AI services** — LLM, image, video, audio, embeddings, OCR, and more
- **9 CDP Wallet tools** — Create MPC wallets, transfer assets, sign messages, execute swaps
- **10 DeFi tools** — Pyth price feeds, Morpho vaults, Across bridge, Farcaster, x402 Bazaar
- **7 Payment tools** — Coinbase Commerce charges, checkouts, and x402 autonomous payments
- **7 Portfolio tools** — Coinbase App OAuth2 accounts, transactions, and spot prices
- **9 Market tools** — Coinbase Advanced Trade: order books, candles, place/cancel orders
- **1 Docs tool** — Fetch x402 extension specs and Farcaster Mini Apps documentation

---

## Quick Start (2 minutes)

### Option A — GPU AI Only (no crypto credentials needed)

```json
{
  "mcpServers": {
    "alpha": {
      "command": "npx",
      "args": ["-y", "@371-minds/alpha-mcp-server"],
      "env": {
        "GPUBRIDGE_API_KEY": "your_gpubridge_api_key"
      }
    }
  }
}
```

### Option B — GPU + Coinbase Wallet + DeFi (full co-pilot)

```json
{
  "mcpServers": {
    "alpha": {
      "command": "npx",
      "args": ["-y", "@371-minds/alpha-mcp-server"],
      "env": {
        "GPUBRIDGE_API_KEY": "your_gpubridge_api_key",
        "CDP_API_KEY_ID": "your_cdp_api_key_id",
        "CDP_API_KEY_SECRET": "your_cdp_api_key_secret",
        "CDP_WALLET_SECRET": "your_cdp_wallet_secret",
        "COINBASE_COMMERCE_API_KEY": "your_commerce_api_key",
        "COINBASE_ADV_TRADE_API_KEY": "organizations/xxx/apiKeys/yyy",
        "COINBASE_ADV_TRADE_SECRET": "-----BEGIN EC PRIVATE KEY-----\n..."
      }
    }
  }
}
```

### Option C — x402 Autonomous Payments (keyless GPU)

```json
{
  "mcpServers": {
    "alpha": {
      "command": "npx",
      "args": ["-y", "@371-minds/alpha-mcp-server"],
      "env": {
        "GPUBRIDGE_WALLET_KEY": "0x<64-hex-char-private-key>",
        "GPUBRIDGE_CHAIN": "base"
      }
    }
  }
}
```

**macOS config path:** `~/Library/Application Support/Claude/claude_desktop_config.json`  
**Windows config path:** `%APPDATA%\Claude\claude_desktop_config.json`

---

## Environment Variables

### GPU-Bridge (AI Inference)

| Variable | Description | Required |
|----------|-------------|----------|
| `GPUBRIDGE_API_KEY` | API key for credit-based GPU auth | For API key mode |
| `GPUBRIDGE_WALLET_KEY` | EVM private key (`0x…`) for x402 auto-payment | For x402 mode |
| `GPUBRIDGE_CHAIN` | Default x402 payment chain (`base`, `optimism`, etc.) | No (default: `base`) |
| `GPUBRIDGE_URL` | API base URL override | No |

### CDP Wallet & DeFi

| Variable | Description | Required |
|----------|-------------|----------|
| `CDP_API_KEY_ID` | Coinbase Developer Platform API key ID | For CDP tools |
| `CDP_API_KEY_SECRET` | CDP API key secret | For CDP tools |
| `CDP_WALLET_SECRET` | CDP wallet secret (for signing/sending) | For send/sign/swap |
| `CDP_NETWORK_ID` | Default CDP network (`base-mainnet`, etc.) | No (default: `base-mainnet`) |

### DeFi & Social

| Variable | Description | Required |
|----------|-------------|----------|
| `MESSARI_API_KEY` | Messari AI research API key | For `defi_messari_research` |
| `NEYNAR_API_KEY` | Neynar API key for Farcaster | For Farcaster tools |
| `NEYNAR_SIGNER_UUID` | Neynar managed signer UUID | For `defi_farcaster_post` |
| `FARCASTER_AGENT_FID` | Farcaster agent FID | For `defi_farcaster_profile` |

### Payments

| Variable | Description | Required |
|----------|-------------|----------|
| `COINBASE_COMMERCE_API_KEY` | Coinbase Commerce API key | For payment tools |

### Portfolio (Coinbase App)

| Variable | Description | Required |
|----------|-------------|----------|
| `COINBASE_CLIENT_ID` | OAuth2 client ID from Coinbase Developer Portal | For OAuth2 tools |
| `COINBASE_CLIENT_SECRET` | OAuth2 client secret | For `cb_exchange_token` |
| `COINBASE_OAUTH_TOKEN` | Coinbase App access token (post-OAuth2) | For portfolio tools |

### Institutional Markets

| Variable | Description | Required |
|----------|-------------|----------|
| `COINBASE_ADV_TRADE_API_KEY` | Advanced Trade API key name (`organizations/…/apiKeys/…`) | For market tools |
| `COINBASE_ADV_TRADE_SECRET` | PEM-encoded EC private key for signing | For market tools |

---

## Tools Reference

### GPU-Bridge AI (6 tools)

| Tool | Description |
|------|-------------|
| `gpu_run` | Run any of 30 GPU services: LLM, image, video, audio, embeddings, OCR, and more |
| `gpu_catalog` | List all available services with pricing |
| `gpu_estimate` | Estimate cost before running |
| `gpu_status` | Check job status and retrieve results |
| `gpu_balance` | Check credits, daily spend, and tier |
| `gpu_payment_chains` | List x402 payment chains |

### CDP Wallet (9 tools)

| Tool | Description |
|------|-------------|
| `cdp_create_account` | Create a new EVM MPC wallet |
| `cdp_get_account` | Load existing account by name or address |
| `cdp_list_balances` | List token balances across networks |
| `cdp_send_transaction` | Send ETH or contract transaction |
| `cdp_sign_message` | Sign a message (EIP-191) |
| `cdp_export_account` | Export private key |
| `cdp_request_faucet` | Get testnet funds (base-sepolia, ethereum-sepolia) |
| `cdp_get_swap_price` | Get indicative swap price |
| `cdp_create_swap` | Execute token swap via CDP DEX aggregator |

### DeFi & x402 (10 tools)

| Tool | Description |
|------|-------------|
| `defi_pyth_price_feed` | Get Pyth price feed ID for a token symbol |
| `defi_pyth_price` | Fetch real-time price from Pyth oracle |
| `defi_messari_research` | Crypto market research via Messari AI |
| `defi_farcaster_post` | Post a cast to Farcaster |
| `defi_farcaster_profile` | Get Farcaster agent account details |
| `defi_morpho_deposit` | Deposit into Morpho yield vault |
| `defi_morpho_withdraw` | Withdraw from Morpho vault |
| `defi_across_bridge` | Get cross-chain bridge quote via Across Protocol |
| `bazaar_list` | Browse x402 Bazaar service marketplace |
| `bazaar_call` | Call any x402 service with auto-payment |

### Payments (7 tools)

| Tool | Description |
|------|-------------|
| `pay_create_charge` | Create Coinbase Commerce payment charge |
| `pay_get_charge` | Get charge status and details |
| `pay_list_charges` | List recent charges |
| `pay_create_checkout` | Create reusable checkout page |
| `pay_resolve_charge` | Resolve or void a charge |
| `pay_x402_check` | Probe a URL for x402 payment support |
| `pay_list_events` | List Commerce webhook events |

### Portfolio / Coinbase App (7 tools)

| Tool | Description |
|------|-------------|
| `cb_oauth_url` | Generate OAuth2 authorization URL |
| `cb_exchange_token` | Exchange auth code for access token |
| `cb_get_user` | Get Coinbase user profile |
| `cb_get_accounts` | List all accounts with balances |
| `cb_get_transactions` | Get transaction history |
| `cb_get_spot_price` | Current crypto spot price |
| `cb_get_exchange_rates` | Exchange rates for a currency |

### Institutional Markets (9 tools)

| Tool | Description |
|------|-------------|
| `market_get_product` | Get product info and current price |
| `market_list_products` | List all trading pairs |
| `market_get_candles` | OHLCV historical price data |
| `market_get_orderbook` | Level 2 order book |
| `market_create_order` | Place market or limit order |
| `market_get_order` | Get order details |
| `market_list_orders` | List open or historical orders |
| `market_cancel_orders` | Cancel orders by ID |
| `market_get_fills` | Trade execution history |

### Reference Docs (1 tool)

| Tool | Description |
|------|-------------|
| `docs_fetch` | Fetch latest x402 extension specs (payment-identifier, offer-receipt, eip2612-gas-sponsoring, erc20-approval-gas-sponsoring) or Farcaster Mini Apps docs (agents-checklist, llms-full) |

---

## x402: Autonomous Agent Payments

GPU-Bridge and x402 Bazaar services support the [x402 payment protocol](https://x402.org), enabling truly keyless AI agents to pay for compute with USDC on-chain.

```
Agent Request → Service returns HTTP 402 Payment Required
      ↓
MCP server signs & submits USDC payment on chosen chain (gas < $0.01, settles in 2s)
      ↓
MCP server retries with payment proof → Service executes and returns result
```

Set `GPUBRIDGE_WALLET_KEY=0x<private-key>` to enable x402 auto-payment for all GPU services.

### Supported Payment Chains

| Chain | Chain ID | Token | Network |
|-------|----------|-------|---------|
| `base` *(default)* | 8453 | USDC | mainnet |
| `base-sepolia` | 84532 | USDC | testnet |
| `ethereum` | 1 | USDC | mainnet |
| `optimism` | 10 | USDC | mainnet |
| `arbitrum` | 42161 | USDC | mainnet |
| `polygon` | 137 | USDC | mainnet |

---

## Building from Source

```bash
git clone https://github.com/371-Minds/alpha-mcp-server
cd alpha-mcp-server
npm install
npm run build
node dist/server.js
```

---

## Architecture

```
src/
  server.ts          # Main MCP server (aggregates all modules)
  types.ts           # Shared interfaces
  tools/
    gpu.ts           # GPU-Bridge AI services (30 services)
    wallet.ts        # CDP SDK v2 wallet operations
    defi.ts          # DeFi via AgentKit + x402 Bazaar
    payments.ts      # Coinbase Commerce + x402
    portfolio.ts     # Coinbase App OAuth2 + portfolio
    market.ts        # Advanced Trade API (JWT auth)
    docs.ts          # Reference docs: x402 extensions + Farcaster Mini Apps
```

Each tool module exports `{ definitions, handle }` and is independently testable.

---

## Security Notes

- **Never** commit private keys or API secrets to source code
- Store `CDP_WALLET_SECRET`, `GPUBRIDGE_WALLET_KEY`, and API keys in your OS secret manager or environment
- The CDP Wallet Secret is used for wallet signing — treat it like a private key
- x402 payments are made autonomously — ensure wallet is funded with only what the agent should spend

---

## Links

- **GPU-Bridge:** [gpubridge.io](https://gpubridge.io)
- **Coinbase CDP:** [docs.cdp.coinbase.com](https://docs.cdp.coinbase.com)
- **AgentKit:** [github.com/coinbase/agentkit](https://github.com/coinbase/agentkit)
- **x402 Protocol:** [x402.org](https://x402.org)
- **Coinbase Commerce:** [commerce.coinbase.com](https://commerce.coinbase.com)
- **Advanced Trade API:** [docs.cdp.coinbase.com](https://docs.cdp.coinbase.com/advanced-trade/docs/welcome)

---

## License

MIT © 371 Minds
