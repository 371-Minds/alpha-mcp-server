# GPU-Bridge MCP Server

> **30 GPU-powered AI services as MCP tools** — LLMs, image generation, audio, video, embeddings, reranking, PDF parsing, NSFW detection & more.
> **x402 native** for autonomous AI agents: pay per request on-chain with USDC across 6 EVM chains. No API keys. No accounts.

[![npm version](https://img.shields.io/npm/v/@gpu-bridge/mcp-server.svg)](https://www.npmjs.com/package/@gpu-bridge/mcp-server)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![MCP Compatible](https://img.shields.io/badge/MCP-Compatible-blue.svg)](https://modelcontextprotocol.io)

## What is GPU-Bridge?

[GPU-Bridge](https://gpubridge.io) is a unified GPU inference API with **native x402 support** — the open payment protocol that allows AI agents to autonomously pay for compute with USDC on any supported EVM chain. No API keys, no accounts, no human intervention required.

This MCP server exposes all 30 GPU-Bridge services as Model Context Protocol tools, giving Claude (and any MCP-compatible AI) direct access to GPU inference.

---

## Install in Claude Desktop (2 minutes)

### 1. Choose your auth mode

**Option A — API key (simplest):** Visit [gpubridge.io](https://gpubridge.io) and grab a free API key.

**Option B — x402 autonomous payments (keyless):** Fund a wallet with USDC on any supported chain and provide the private key via `GPUBRIDGE_WALLET_KEY`. The MCP server automatically handles HTTP 402 payment flows — no human needed.

### 2. Add to `claude_desktop_config.json`

**macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

**API key mode:**
```json
{
  "mcpServers": {
    "gpu-bridge": {
      "command": "npx",
      "args": ["-y", "@gpu-bridge/mcp-server"],
      "env": {
        "GPUBRIDGE_API_KEY": "your_api_key_here"
      }
    }
  }
}
```

**x402 autonomous payment mode:**
```json
{
  "mcpServers": {
    "gpu-bridge": {
      "command": "npx",
      "args": ["-y", "@gpu-bridge/mcp-server"],
      "env": {
        "GPUBRIDGE_WALLET_KEY": "0x<your-64-hex-char-private-key>",
        "GPUBRIDGE_CHAIN": "base"
      }
    }
  }
}
```

### 3. Restart Claude Desktop

That's it. Claude now has access to 30 GPU-powered AI services.

---

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `GPUBRIDGE_API_KEY` | API key for credit-based auth | — |
| `GPUBRIDGE_WALLET_KEY` | EVM private key (`0x…`) for x402 auto-payment | — |
| `GPUBRIDGE_CHAIN` | Default payment chain for x402 | `base` |
| `GPUBRIDGE_URL` | API base URL override | `https://api.gpubridge.io` |

> **Security note:** Store `GPUBRIDGE_WALLET_KEY` in your system's secret manager or environment, never in source code.

---

## MCP Tools

### `gpu_run`
Run any GPU-Bridge service. The primary tool for executing AI tasks.

```
Parameters:
  service  (string)  — Service key (e.g., "llm-4090", "flux-schnell", "whisper-l4")
  input    (object)  — Service-specific input parameters
  priority (string)  — Optional: "fast" (lowest latency) or "cheap" (lowest cost)
  chain    (string)  — Optional: payment chain override for x402 (e.g., "base", "optimism")
```

### `gpu_catalog`
Get the full catalog of available services with pricing and capabilities.

### `gpu_estimate`
Estimate cost before running a service. No authentication required.

### `gpu_status`
Check the status of a job and retrieve results.

### `gpu_balance`
Check your current balance, daily spend, and volume discount tier.

### `gpu_payment_chains`
List all supported payment chains for x402 autonomous payments. Returns chain names, IDs, tokens, RPC endpoints, and which chain is currently active. Call this to inspect or choose a chain before using `gpu_run`.

---

## 30 Available Services

### Language Models (LLMs)
| Service ID | Description | Notes |
|-----------|-------------|-------|
| `llm-4090` | General purpose LLM | Sub-second via Groq |
| `llm-a100` | Maximum capability LLM | Largest models |
| `llm-l4` | Ultra-fast, low cost LLM | Budget option |
| `code-4090` | Code generation | Optimized for code |
| `llm-stream` | Streaming LLM responses | Real-time output |

### Image Generation
| Service ID | Description | Notes |
|-----------|-------------|-------|
| `flux-schnell` | FLUX.1 Schnell | Fast, 4-step generation |
| `flux-dev` | FLUX.1 Dev | High quality |
| `sdxl-4090` | Stable Diffusion XL | Versatile |
| `sd35-l4` | Stable Diffusion 3.5 | Latest SD model |
| `img2img-4090` | Image-to-image | Style transfer, editing |

### Vision & Image Analysis
| Service ID | Description | Notes |
|-----------|-------------|-------|
| `llava-4090` | Visual Q&A | Image understanding |
| `ocr-l4` | Text extraction (OCR) | Multi-language |
| `rembg-l4` | Background removal | Instant |
| `caption-4090` | Image captioning | Auto-describe images |
| `nsfw-detect` | Content moderation | NSFW classification |

### Speech-to-Text
| Service ID | Description | Notes |
|-----------|-------------|-------|
| `whisper-l4` | Fast transcription | Sub-second |
| `whisper-a100` | High accuracy transcription | Large files |
| `diarize-l4` | Speaker diarization | Who said what |

### Text-to-Speech
| Service ID | Description | Notes |
|-----------|-------------|-------|
| `tts-l4` | Voice cloning TTS | 40+ voices |
| `tts-fast` | Ultra-fast TTS | Lowest latency |
| `bark-4090` | Expressive TTS | Emotion, laughter |

### Audio Generation
| Service ID | Description | Notes |
|-----------|-------------|-------|
| `musicgen-l4` | Music generation | Text-to-music |
| `audiogen-l4` | Sound effects | Text-to-SFX |

### Embeddings & Search
| Service ID | Description | Notes |
|-----------|-------------|-------|
| `embed-l4` | Text embeddings | Multilingual |
| `embed-code` | Code embeddings | For code search |
| `rerank` | Document reranking | Jina, sub-second |

### Video
| Service ID | Description | Notes |
|-----------|-------------|-------|
| `animatediff` | Text-to-video | AnimateDiff |
| `video-enhance` | Video upscaling | Up to 4K |

### Utilities
| Service ID | Description | Notes |
|-----------|-------------|-------|
| `pdf-parse` | Document parsing | PDF/DOCX to text |

---

## x402: For Autonomous AI Agents

GPU-Bridge supports the [x402 payment protocol](https://x402.org), enabling truly autonomous AI agents to pay for compute without human intervention — across **6 EVM chains**.

```
Agent Request → GPU-Bridge returns HTTP 402 Payment Required
      ↓
MCP server signs & submits USDC payment on chosen chain (gas < $0.01, settles in 2s)
      ↓
MCP server retries with payment proof → GPU-Bridge executes and returns result
```

The MCP server handles the full x402 payment loop automatically when `GPUBRIDGE_WALLET_KEY` is set. No external tooling or manual signing required.

### Supported Payment Chains

| Chain key | Chain | Chain ID | Token | Network |
|-----------|-------|----------|-------|---------|
| `base` *(default)* | Base | 8453 | USDC | mainnet |
| `base-sepolia` | Base Sepolia | 84532 | USDC | testnet |
| `ethereum` | Ethereum | 1 | USDC | mainnet |
| `optimism` | Optimism | 10 | USDC | mainnet |
| `arbitrum` | Arbitrum One | 42161 | USDC | mainnet |
| `polygon` | Polygon | 137 | USDC | mainnet |

Use the `gpu_payment_chains` tool at runtime to see chain status and which chain is active.

### Per-Request Chain Selection

Pass `chain` in `gpu_run` to override the default for a single request:

```json
{
  "service": "llm-4090",
  "input": { "prompt": "Hello!" },
  "chain": "optimism"
}
```

### Python Example with x402 (external client)

```python
from x402.client import PaymentClient

client = PaymentClient(private_key="0x...", chain="base")

response = client.request(
    "POST",
    "https://api.gpubridge.io/v1/run",
    json={
        "service": "flux-schnell",
        "input": {"prompt": "A robot painting on a canvas", "steps": 4}
    }
)
print(response.json())
```

---

## Pricing

| Category | Starting From |
|----------|--------------|
| LLMs | $0.003/1K tokens |
| Image Generation | $0.01/image |
| Speech-to-Text | $0.005/minute |
| Text-to-Speech | $0.005/1K chars |
| Embeddings | $0.0001/1K tokens |
| Reranking | $0.001/query |
| PDF Parsing | $0.005/document |

All prices in USD. x402 payments in USDC on any supported chain (Base, Ethereum, Optimism, Arbitrum, Polygon).

---

## Links

- **Website:** [gpubridge.io](https://gpubridge.io)
- **Docs:** [gpubridge.io/docs](https://gpubridge.io/docs)
- **Catalog:** [gpubridge.io/catalog](https://gpubridge.io/catalog)
- **GitHub:** [github.com/gpu-bridge](https://github.com/gpu-bridge)
- **npm:** [@gpu-bridge/mcp-server](https://www.npmjs.com/package/@gpu-bridge/mcp-server)

---

## License

MIT © [Healthtech Capital LLC](https://gpubridge.io)
