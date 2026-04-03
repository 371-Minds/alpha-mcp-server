// GPU-Bridge tools — ported from original index.js
import { createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base, baseSepolia, mainnet, optimism, arbitrum, polygon } from "viem/chains";
import { wrapFetchWithPayment } from "x402-fetch";
import { ok, err } from "../types.js";
const API_BASE = process.env.GPUBRIDGE_URL || "https://api.gpubridge.io";
const API_KEY = process.env.GPUBRIDGE_API_KEY || "";
const WALLET_KEY = process.env.GPUBRIDGE_WALLET_KEY || "";
const DEFAULT_CHAIN = process.env.GPUBRIDGE_CHAIN || "base";
const SUPPORTED_CHAINS = {
    "base": { viemChain: base, id: 8453, name: "Base", token: "USDC", rpc: "https://mainnet.base.org", explorer: "https://basescan.org", network: "mainnet" },
    "base-sepolia": { viemChain: baseSepolia, id: 84532, name: "Base Sepolia", token: "USDC", rpc: "https://sepolia.base.org", explorer: "https://sepolia.basescan.org", network: "testnet" },
    "ethereum": { viemChain: mainnet, id: 1, name: "Ethereum", token: "USDC", rpc: "https://cloudflare-eth.com", explorer: "https://etherscan.io", network: "mainnet" },
    "optimism": { viemChain: optimism, id: 10, name: "Optimism", token: "USDC", rpc: "https://mainnet.optimism.io", explorer: "https://optimistic.etherscan.io", network: "mainnet" },
    "arbitrum": { viemChain: arbitrum, id: 42161, name: "Arbitrum One", token: "USDC", rpc: "https://arb1.arbitrum.io/rpc", explorer: "https://arbiscan.io", network: "mainnet" },
    "polygon": { viemChain: polygon, id: 137, name: "Polygon", token: "USDC", rpc: "https://polygon-rpc.com", explorer: "https://polygonscan.com", network: "mainnet" },
};
function resolveChain(chainName) {
    return SUPPORTED_CHAINS[chainName || DEFAULT_CHAIN] || SUPPORTED_CHAINS["base"];
}
function buildFetch(chainName) {
    if (!WALLET_KEY)
        return fetch;
    if (!/^0x[0-9a-fA-F]{64}$/.test(WALLET_KEY)) {
        throw new Error("GPUBRIDGE_WALLET_KEY must be a 32-byte hex private key with 0x prefix");
    }
    const chain = resolveChain(chainName || DEFAULT_CHAIN);
    const account = privateKeyToAccount(WALLET_KEY);
    const client = createWalletClient({ account, transport: http(chain.rpc), chain: chain.viemChain });
    return wrapFetchWithPayment(fetch, client);
}
async function apiCall(endpoint, method, body, headers, fetchFn) {
    const fn = fetchFn || fetch;
    const h = { "Content-Type": "application/json", ...headers };
    if (API_KEY)
        h["Authorization"] = `Bearer ${API_KEY}`;
    const res = await fn(`${API_BASE}${endpoint}`, {
        method,
        headers: h,
        ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return res.json();
}
async function pollJob(jobId, maxWait = 300000, fetchFn) {
    const start = Date.now();
    while (Date.now() - start < maxWait) {
        const status = await apiCall(`/status/${jobId}`, "GET", undefined, {}, fetchFn);
        if (status.status === "completed")
            return status;
        if (status.status === "failed") {
            const msg = status.error || "Job failed";
            const refund = status.refunded ? ` (refunded $${status.refund_amount_usd})` : "";
            throw new Error(`${msg}${refund}`);
        }
        const elapsed = Date.now() - start;
        await new Promise((r) => setTimeout(r, elapsed < 10000 ? 1000 : 3000));
    }
    throw new Error("Job timed out waiting for result");
}
const definitions = [
    {
        name: "gpu_run",
        description: "Run any GPU-Bridge AI service. 30 services available: LLM inference (sub-second), image generation (FLUX, SD3.5), video generation, video enhancement (up to 4K), speech-to-text (Whisper, <1s), TTS (40+ voices), music generation, voice cloning, embeddings, document reranking (Jina), OCR, PDF/document parsing, NSFW detection, image captioning, visual Q&A, background removal, face restoration, upscaling, stickers, and more. Use gpu_catalog to see all available services.",
        inputSchema: {
            type: "object",
            properties: {
                service: {
                    type: "string",
                    description: 'Service key. Common ones: llm-4090 (text), image-4090 (image), video (video), whisper-l4 (speech-to-text), tts-l4 (text-to-speech), embedding-l4 (embeddings), rembg-l4 (bg removal), upscale-l4 (upscale), ocr (text extraction), caption (image caption), face-restore, musicgen-l4, llava-4090 (visual Q&A), sticker, whisperx (diarized STT), bark (expressive TTS), voice-clone, photomaker, ad-inpaint, animate, image-variation, inpaint, controlnet, clip, segmentation, rerank (document reranking), nsfw-detect (content moderation), video-enhance (video upscaling), pdf-parse (document parsing)',
                },
                input: {
                    type: "object",
                    description: 'Service-specific input. Examples: LLM {"prompt":"...","max_tokens":512,"model":"llama-3.3-70b-versatile"}, Image {"prompt":"..."}, Whisper {"audio_url":"https://..."}, TTS {"text":"...","voice":"af_alloy"}, Embedding {"text":"..."}, OCR/Rembg/Upscale/Caption {"image_url":"https://..."}',
                },
                priority: {
                    type: "string",
                    enum: ["fast", "cheap"],
                    description: '"fast" = lowest latency (default), "cheap" = lowest cost.',
                },
                chain: {
                    type: "string",
                    enum: ["base", "base-sepolia", "ethereum", "optimism", "arbitrum", "polygon"],
                    description: "Payment chain for x402 autonomous payments. Overrides GPUBRIDGE_CHAIN env var.",
                },
            },
            required: ["service", "input"],
        },
    },
    {
        name: "gpu_catalog",
        description: "List all available GPU-Bridge services with pricing and model info. No authentication required.",
        inputSchema: { type: "object", properties: {} },
    },
    {
        name: "gpu_status",
        description: "Check the status of a GPU-Bridge job and retrieve results.",
        inputSchema: {
            type: "object",
            properties: {
                job_id: { type: "string", description: "The job ID returned by gpu_run" },
            },
            required: ["job_id"],
        },
    },
    {
        name: "gpu_balance",
        description: "Check GPU-Bridge credit balance, daily spend, volume discount tier, and job history.",
        inputSchema: { type: "object", properties: {} },
    },
    {
        name: "gpu_estimate",
        description: "Estimate the cost of a GPU-Bridge service before running it. No authentication required.",
        inputSchema: {
            type: "object",
            properties: {
                service: { type: "string", description: "Service key (e.g. llm-4090, image-4090)" },
                seconds: { type: "number", description: "Estimated runtime in seconds (optional)" },
            },
            required: ["service"],
        },
    },
    {
        name: "gpu_payment_chains",
        description: "List all supported payment chains for x402 autonomous payments. Returns chain IDs, tokens, RPCs, and network types.",
        inputSchema: { type: "object", properties: {} },
    },
];
async function handle(name, args) {
    switch (name) {
        case "gpu_run": {
            const { service, input, priority, chain } = args;
            const fetchFn = buildFetch(chain);
            const headers = {};
            if (priority)
                headers["X-Priority"] = priority;
            const job = (await apiCall("/run", "POST", { service, input }, headers, fetchFn));
            if (job.error) {
                const available = job.available_services?.join(", ");
                return err(`Error: ${job.error}${job.hint ? `\nHint: ${job.hint}` : ""}${available ? `\nAvailable: ${available}` : ""}`);
            }
            const result = await pollJob(job.job_id, 300000, fetchFn);
            const output = result.output;
            let text;
            if (typeof output === "string") {
                text = output;
            }
            else if (output?.text) {
                text = output.text;
            }
            else if (output?.url) {
                text = output.url;
            }
            else if (output?.audio_url) {
                text = output.audio_url;
            }
            else if (output?.embedding) {
                const emb = output.embedding;
                text = `Embedding (${output.dimensions} dimensions): [${emb.slice(0, 5).map((n) => n.toFixed(4)).join(", ")}...]`;
            }
            else {
                text = JSON.stringify(output, null, 2);
            }
            if (result.output_notice)
                text += `\n\nNote: ${result.output_notice}`;
            return ok(text);
        }
        case "gpu_catalog": {
            const catalog = (await apiCall("/catalog", "GET"));
            const services = catalog.services || [];
            const byCategory = {};
            for (const s of services) {
                const cat = s.category || "other";
                if (!byCategory[cat])
                    byCategory[cat] = [];
                const pricing = Object.values(s.pricing || {})[0] || `$${s.default_cost_usd}`;
                const models = (s.models || []).length;
                byCategory[cat].push(`  ${s.key} — ${s.name} (${pricing}${models ? `, ${models} models` : ""})`);
            }
            let text = `GPU-Bridge: ${catalog.active_endpoints} services available\n\n`;
            for (const [cat, items] of Object.entries(byCategory)) {
                text += `${cat.toUpperCase()}:\n${items.join("\n")}\n\n`;
            }
            text += `Use gpu_run with service key and input to run any service.\nUse gpu_estimate to check cost before running.`;
            return ok(text);
        }
        case "gpu_status": {
            const { job_id } = args;
            const status = (await apiCall(`/status/${job_id}`, "GET"));
            let text = `Job ${status.id}: ${status.status}`;
            const progress = status.progress;
            if (progress) {
                text += `\nProgress: ${progress.phase} (${progress.percent_estimate}%, ${progress.elapsed_seconds}s elapsed)`;
            }
            const o = status.output;
            if (o) {
                if (o.text)
                    text += `\nOutput: ${o.text}`;
                else if (o.url)
                    text += `\nOutput: ${o.url}`;
                else if (o.audio_url)
                    text += `\nOutput: ${o.audio_url}`;
                else
                    text += `\nOutput: ${JSON.stringify(o)}`;
            }
            if (status.error) {
                text += `\nError: ${status.error}`;
                if (status.refunded)
                    text += ` (refunded $${status.refund_amount_usd})`;
            }
            if (status.output_notice)
                text += `\nNote: ${status.output_notice}`;
            return ok(text);
        }
        case "gpu_balance": {
            const balance = (await apiCall("/account/balance", "GET"));
            const vd = balance.volume_discount || {};
            const nextTier = vd.next_tier;
            let text = `Balance: $${balance.balance}\nDaily spend: $${balance.daily_spend}/$${balance.daily_limit}\nTier: ${vd.tier} (${vd.discount_percent}% discount)`;
            if (nextTier) {
                text += `\nNext tier: ${nextTier.name} at $${nextTier.threshold} spent (${nextTier.discountPercent}% discount)`;
            }
            return ok(text);
        }
        case "gpu_estimate": {
            const { service, seconds } = args;
            const qs = seconds ? `&seconds=${seconds}` : "";
            const est = (await apiCall(`/catalog/estimate?service=${service}${qs}`, "GET"));
            if (est.error) {
                const available = est.available_services?.join(", ");
                return err(`Error: ${est.error}${available ? `\nAvailable: ${available}` : ""}`);
            }
            return ok(`Service: ${est.service}\nEstimated cost: $${est.estimated_cost_usd}\nRate: $${est.price_per_second}/sec\n${est.note}`);
        }
        case "gpu_payment_chains": {
            const walletConfigured = !!WALLET_KEY;
            const keyWidth = Math.max(...Object.keys(SUPPORTED_CHAINS).map((k) => k.length)) + 2;
            const nameWidth = Math.max(...Object.values(SUPPORTED_CHAINS).map((c) => c.name.length)) + 2;
            let text = `GPU-Bridge x402 Payment Chains\n`;
            text += `x402 auto-payment: ${walletConfigured ? "enabled (GPUBRIDGE_WALLET_KEY is set)" : "disabled (set GPUBRIDGE_WALLET_KEY to enable)"}\n`;
            text += `Active chain: ${DEFAULT_CHAIN} (set GPUBRIDGE_CHAIN to change default)\n\n`;
            text += `SUPPORTED CHAINS:\n`;
            for (const [key, c] of Object.entries(SUPPORTED_CHAINS)) {
                const marker = key === DEFAULT_CHAIN ? " ◀ active" : "";
                const networkLabel = c.network === "testnet" ? " [testnet]" : "";
                text += `  ${key.padEnd(keyWidth)}— ${c.name.padEnd(nameWidth)}(chain ID ${c.id}, ${c.token}, ${c.network})${networkLabel}${marker}\n`;
            }
            text += `\nUsage:\n`;
            text += `  • Set GPUBRIDGE_WALLET_KEY=0x<64-hex-chars> to enable keyless x402 auto-payment\n`;
            text += `  • Set GPUBRIDGE_CHAIN=<chain> to set the default payment chain\n`;
            text += `  • Pass chain="<chain>" in gpu_run to override per request\n`;
            text += `\nNote: base-sepolia is a testnet chain for development only.\nSupported tokens: USDC on all chains.`;
            return ok(text);
        }
        default:
            throw new Error(`Unknown gpu tool: ${name}`);
    }
}
export const gpuModule = { definitions, handle };
//# sourceMappingURL=gpu.js.map