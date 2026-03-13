# GPU-Bridge MCP Server

> **26 GPU-powered AI services as MCP tools** — LLMs, image generation, audio, video, embeddings & more.  
> **x402 native** for autonomous agents: pay per request on-chain with USDC on Base L2. No API keys. No accounts.

[![npm version](https://img.shields.io/npm/v/@gpu-bridge/mcp-server.svg)](https://www.npmjs.com/package/@gpu-bridge/mcp-server)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![MCP Compatible](https://img.shields.io/badge/MCP-Compatible-blue.svg)](https://modelcontextprotocol.io)

## What is GPU-Bridge?

[GPU-Bridge](https://gpubridge.xyz) is the first GPU inference API with **native x402 support** — the open payment protocol that allows AI agents to autonomously pay for compute with USDC on Base L2. No API keys, no accounts, no human intervention required.

This MCP server exposes all 26 GPU-Bridge services as Model Context Protocol tools, giving Claude (and any MCP-compatible AI) direct access to GPU inference for images, audio, video, and language tasks.

---

## 🚀 Install in Claude Desktop (2 minutes)

### 1. Get your API key (or use x402 for autonomous agents)

Visit [gpubridge.xyz](https://gpubridge.xyz) and grab a free API key, or use the x402 protocol for keyless agent payments.

### 2. Add to `claude_desktop_config.json`

**macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`  
**Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

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

### 3. Restart Claude Desktop

That's it. Claude now has access to 26 GPU-powered AI services.

---

## 🛠️ MCP Tools

### `gpu_run`
Run any GPU-Bridge service. The primary tool for executing AI tasks.

```
Parameters:
  service  (string)  — Service ID (e.g., "llm-4090", "flux-schnell", "whisper-l4")
  input    (object)  — Service-specific input parameters
  options  (object)  — Optional: priority, timeout, payment_method
```

**Example:** Generate an image with FLUX Schnell
```json
{
  "service": "flux-schnell",
  "input": {
    "prompt": "A futuristic city at night, neon lights reflecting on wet streets",
    "width": 1024,
    "height": 1024,
    "steps": 4
  }
}
```

---

### `gpu_catalog`
Get the full catalog of available GPU-Bridge services with pricing and capabilities.

```
Parameters:
  category  (string, optional)  — Filter by: "llm", "image", "audio", "video", "embedding", "vision"
```

---

### `gpu_estimate`
Estimate cost and latency before running a service.

```
Parameters:
  service  (string)  — Service ID
  input    (object)  — Input parameters to estimate
```

---

### `gpu_status`
Check GPU-Bridge API status and service availability.

```
Parameters: none
```

---

### `gpu_balance`
Check your current GPU-Bridge balance (API key or x402 wallet).

```
Parameters:
  address  (string, optional)  — x402 wallet address (if using x402 payments)
```

---

## 📋 26 Available Services

### 🤖 Language Models (LLMs)
| Service ID | Model | GPU | Notes |
|-----------|-------|-----|-------|
| `llm-4090` | Llama 3.1 70B | RTX 4090 | Fast, general purpose |
| `llm-a100` | Llama 3.1 405B | A100 | Maximum capability |
| `llm-l4` | Mistral 7B | L4 | Ultra-fast, low cost |
| `code-4090` | DeepSeek Coder 33B | RTX 4090 | Code generation |
| `llm-stream` | Llama 3.1 70B | RTX 4090 | Streaming responses |

### 🖼️ Image Generation
| Service ID | Model | GPU | Notes |
|-----------|-------|-----|-------|
| `flux-schnell` | FLUX.1 Schnell | A100 | Fast, 4-step generation |
| `flux-dev` | FLUX.1 Dev | A100 | High quality |
| `sdxl-4090` | Stable Diffusion XL | RTX 4090 | Versatile |
| `sd35-l4` | Stable Diffusion 3.5 | L4 | Latest SD model |
| `img2img-4090` | SDXL img2img | RTX 4090 | Image-to-image |

### 👁️ Vision & Image Analysis
| Service ID | Model | GPU | Notes |
|-----------|-------|-----|-------|
| `llava-4090` | LLaVA 1.6 34B | RTX 4090 | Visual Q&A |
| `ocr-l4` | Surya OCR | L4 | Text extraction |
| `rembg-l4` | RemBG | L4 | Background removal |
| `caption-4090` | BLIP-2 | RTX 4090 | Image captioning |

### 🎤 Speech-to-Text (STT)
| Service ID | Model | GPU | Notes |
|-----------|-------|-----|-------|
| `whisper-l4` | Whisper Large v3 | L4 | Fast transcription |
| `whisper-a100` | Whisper Large v3 | A100 | High accuracy |
| `diarize-l4` | WhisperX | L4 | Speaker diarization |

### 🗣️ Text-to-Speech (TTS)
| Service ID | Model | GPU | Notes |
|-----------|-------|-----|-------|
| `tts-l4` | XTTS v2 | L4 | Voice cloning |
| `tts-fast` | Kokoro TTS | L4 | Ultra-fast synthesis |
| `bark-4090` | Bark | RTX 4090 | Expressive TTS |

### 🎵 Audio Generation
| Service ID | Model | GPU | Notes |
|-----------|-------|-----|-------|
| `musicgen-l4` | MusicGen Large | L4 | Music generation |
| `audiogen-l4` | AudioGen | L4 | Sound effects |

### 📐 Embeddings
| Service ID | Model | GPU | Notes |
|-----------|-------|-----|-------|
| `embed-l4` | BGE-M3 | L4 | Multilingual embeddings |
| `embed-code` | CodeBERT | L4 | Code embeddings |

### 🎬 Video
| Service ID | Model | GPU | Notes |
|-----------|-------|-----|-------|
| `animatediff` | AnimateDiff | A100 | Text-to-video |
| `video-enhance` | ESRGAN | L4 | Video upscaling |

---

## 🤖 x402: For Autonomous AI Agents

GPU-Bridge is the **first GPU inference API** to support the [x402 payment protocol](https://x402.org), enabling truly autonomous AI agents to pay for compute without human intervention.

### How x402 Works

```
Agent Request → GPU-Bridge returns HTTP 402 Payment Required
      ↓
Agent pays USDC on Base L2 (gas < $0.01, settles in 2s)
      ↓
Agent retries request with payment proof
      ↓
GPU-Bridge executes and returns result
```

### Python Example with x402

```python
from x402.client import PaymentClient
import anthropic

# Initialize x402 client with your Base L2 wallet
client = PaymentClient(
    private_key="0x...",  # Your wallet private key
    chain="base"
)

# Call GPU-Bridge — no API key needed!
response = client.request(
    "POST",
    "https://api.gpubridge.xyz/v1/run",
    json={
        "service": "flux-schnell",
        "input": {"prompt": "A robot painting on a canvas", "steps": 4}
    }
)
# x402 client automatically handles the HTTP 402 → pay → retry flow
print(response.json())
```

### Why Base L2?
- **Gas fees:** < $0.01 per transaction
- **Settlement:** ~2 seconds
- **Native USDC:** No wrapped tokens
- **EVM compatible:** Works with any Ethereum wallet

### Use Cases for Autonomous Agents
- 🤖 **AI agents** that generate images/audio as part of their workflow
- 🔄 **Pipelines** that process thousands of requests without human oversight
- 🌐 **dApps** that need GPU compute on-demand
- 🧪 **Research** agents that run experiments 24/7

---

## 💰 Pricing

| Category | Starting From |
|----------|--------------|
| LLMs | $0.003/1K tokens |
| Image Generation | $0.01/image |
| Speech-to-Text | $0.005/minute |
| Text-to-Speech | $0.005/1K chars |
| Embeddings | $0.0001/1K tokens |

All prices in USD. x402 payments in USDC on Base L2.

---

## 🔗 Links

- **Website:** [gpubridge.xyz](https://gpubridge.xyz)
- **Docs:** [gpubridge.xyz/docs](https://gpubridge.xyz/docs)
- **GitHub Org:** [github.com/gpu-bridge](https://github.com/gpu-bridge)
- **npm:** [@gpu-bridge/mcp-server](https://www.npmjs.com/package/@gpu-bridge/mcp-server)
- **Support:** hello@gpubridge.xyz

---

## 📄 License

MIT © [GPU-Bridge](https://gpubridge.xyz)
