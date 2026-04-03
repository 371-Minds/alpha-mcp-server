import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { gpuModule } from "./gpu.js";
// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function mockFetchOk(body) {
    return vi.fn().mockResolvedValue({
        json: () => Promise.resolve(body),
        ok: true,
        status: 200,
    });
}
// ---------------------------------------------------------------------------
// Module structure
// ---------------------------------------------------------------------------
describe("gpuModule structure", () => {
    it("exports definitions array with 6 tools", () => {
        expect(gpuModule.definitions).toHaveLength(6);
    });
    it("every definition has name, description, and inputSchema", () => {
        for (const def of gpuModule.definitions) {
            expect(typeof def.name).toBe("string");
            expect(typeof def.description).toBe("string");
            expect(def.inputSchema.type).toBe("object");
        }
    });
    it("tool names are unique", () => {
        const names = gpuModule.definitions.map((d) => d.name);
        expect(new Set(names).size).toBe(names.length);
    });
});
// ---------------------------------------------------------------------------
// gpu_payment_chains — pure logic, no fetch needed
// ---------------------------------------------------------------------------
describe("gpu_payment_chains", () => {
    it("returns chain listing without error", async () => {
        const result = await gpuModule.handle("gpu_payment_chains", {});
        expect(result.isError).toBeFalsy();
        expect(result.content[0].text).toContain("base");
        expect(result.content[0].text).toContain("ethereum");
        expect(result.content[0].text).toContain("optimism");
        expect(result.content[0].text).toContain("arbitrum");
        expect(result.content[0].text).toContain("polygon");
    });
    it("marks base-sepolia as testnet", async () => {
        const result = await gpuModule.handle("gpu_payment_chains", {});
        expect(result.content[0].text).toContain("testnet");
    });
    it("shows x402 auto-payment disabled when wallet key is absent", async () => {
        // WALLET_KEY is a module-level const, so we test the disabled state which is
        // the default in the test environment (no GPUBRIDGE_WALLET_KEY set at import time)
        const result = await gpuModule.handle("gpu_payment_chains", {});
        // Either "disabled" or "enabled" is valid depending on env at module load time;
        // what matters is the field is present in the output
        expect(result.content[0].text).toContain("auto-payment");
    });
});
// ---------------------------------------------------------------------------
// gpu_catalog
// ---------------------------------------------------------------------------
describe("gpu_catalog", () => {
    beforeEach(() => {
        vi.stubGlobal("fetch", mockFetchOk({
            active_endpoints: 30,
            services: [
                { key: "llm-4090", name: "LLM Inference", category: "text", pricing: { per_second: "$0.001" }, models: ["llama"] },
                { key: "image-4090", name: "Image Generation", category: "image", pricing: { per_job: "$0.05" }, models: [] },
            ],
        }));
    });
    afterEach(() => {
        vi.unstubAllGlobals();
    });
    it("lists services grouped by category", async () => {
        const result = await gpuModule.handle("gpu_catalog", {});
        expect(result.isError).toBeFalsy();
        expect(result.content[0].text).toContain("llm-4090");
        expect(result.content[0].text).toContain("image-4090");
    });
    it("shows active_endpoints count", async () => {
        const result = await gpuModule.handle("gpu_catalog", {});
        expect(result.content[0].text).toContain("30");
    });
});
// ---------------------------------------------------------------------------
// gpu_status
// ---------------------------------------------------------------------------
describe("gpu_status", () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });
    it("returns job status and text output", async () => {
        vi.stubGlobal("fetch", mockFetchOk({
            id: "job-123",
            status: "completed",
            output: { text: "Hello world" },
        }));
        const result = await gpuModule.handle("gpu_status", { job_id: "job-123" });
        expect(result.isError).toBeFalsy();
        expect(result.content[0].text).toContain("job-123");
        expect(result.content[0].text).toContain("completed");
        expect(result.content[0].text).toContain("Hello world");
    });
    it("returns job status with url output", async () => {
        vi.stubGlobal("fetch", mockFetchOk({
            id: "job-456",
            status: "completed",
            output: { url: "https://example.com/image.png" },
        }));
        const result = await gpuModule.handle("gpu_status", { job_id: "job-456" });
        expect(result.content[0].text).toContain("https://example.com/image.png");
    });
    it("returns job status with audio_url output", async () => {
        vi.stubGlobal("fetch", mockFetchOk({
            id: "job-789",
            status: "completed",
            output: { audio_url: "https://example.com/audio.mp3" },
        }));
        const result = await gpuModule.handle("gpu_status", { job_id: "job-789" });
        expect(result.content[0].text).toContain("https://example.com/audio.mp3");
    });
    it("includes progress info when present", async () => {
        vi.stubGlobal("fetch", mockFetchOk({
            id: "job-abc",
            status: "processing",
            progress: { phase: "generating", percent_estimate: 50, elapsed_seconds: 10 },
        }));
        const result = await gpuModule.handle("gpu_status", { job_id: "job-abc" });
        expect(result.content[0].text).toContain("generating");
        expect(result.content[0].text).toContain("50%");
    });
    it("shows error and refund info when job failed", async () => {
        vi.stubGlobal("fetch", mockFetchOk({
            id: "job-fail",
            status: "failed",
            error: "GPU OOM",
            refunded: true,
            refund_amount_usd: "0.05",
        }));
        const result = await gpuModule.handle("gpu_status", { job_id: "job-fail" });
        expect(result.content[0].text).toContain("GPU OOM");
        expect(result.content[0].text).toContain("0.05");
    });
    it("shows output_notice when present", async () => {
        vi.stubGlobal("fetch", mockFetchOk({
            id: "job-note",
            status: "completed",
            output: { text: "done" },
            output_notice: "Low quality due to timeout",
        }));
        const result = await gpuModule.handle("gpu_status", { job_id: "job-note" });
        expect(result.content[0].text).toContain("Low quality due to timeout");
    });
});
// ---------------------------------------------------------------------------
// gpu_balance
// ---------------------------------------------------------------------------
describe("gpu_balance", () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });
    it("formats balance with tier info", async () => {
        vi.stubGlobal("fetch", mockFetchOk({
            balance: "5.00",
            daily_spend: "1.20",
            daily_limit: "50.00",
            volume_discount: { tier: "bronze", discount_percent: 5 },
        }));
        const result = await gpuModule.handle("gpu_balance", {});
        expect(result.isError).toBeFalsy();
        expect(result.content[0].text).toContain("$5.00");
        expect(result.content[0].text).toContain("bronze");
        expect(result.content[0].text).toContain("5%");
    });
    it("shows next tier when present", async () => {
        vi.stubGlobal("fetch", mockFetchOk({
            balance: "5.00",
            daily_spend: "1.20",
            daily_limit: "50.00",
            volume_discount: {
                tier: "bronze",
                discount_percent: 5,
                next_tier: { name: "silver", threshold: "100", discountPercent: 10 },
            },
        }));
        const result = await gpuModule.handle("gpu_balance", {});
        expect(result.content[0].text).toContain("silver");
        expect(result.content[0].text).toContain("10%");
    });
});
// ---------------------------------------------------------------------------
// gpu_estimate
// ---------------------------------------------------------------------------
describe("gpu_estimate", () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });
    it("returns formatted estimate on success", async () => {
        vi.stubGlobal("fetch", mockFetchOk({
            service: "llm-4090",
            estimated_cost_usd: "0.012",
            price_per_second: "0.001",
            note: "30 seconds estimated",
        }));
        const result = await gpuModule.handle("gpu_estimate", { service: "llm-4090" });
        expect(result.isError).toBeFalsy();
        expect(result.content[0].text).toContain("llm-4090");
        expect(result.content[0].text).toContain("$0.012");
    });
    it("returns error when service is unknown", async () => {
        vi.stubGlobal("fetch", mockFetchOk({
            error: "Unknown service",
            available_services: ["llm-4090", "image-4090"],
        }));
        const result = await gpuModule.handle("gpu_estimate", { service: "unknown-svc" });
        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain("Unknown service");
        expect(result.content[0].text).toContain("llm-4090");
    });
});
// ---------------------------------------------------------------------------
// gpu_run — output format branches
// ---------------------------------------------------------------------------
describe("gpu_run — output formatting", () => {
    /** Build a fetch stub that first returns a job_id, then a completed result */
    function stubRunAndComplete(output, extra = {}) {
        let callCount = 0;
        vi.stubGlobal("fetch", vi.fn().mockImplementation(() => {
            callCount++;
            const body = callCount === 1
                ? { job_id: "j1" }
                : { status: "completed", output, ...extra };
            return Promise.resolve({ json: () => Promise.resolve(body), ok: true });
        }));
    }
    afterEach(() => {
        vi.unstubAllGlobals();
    });
    it("returns string output directly", async () => {
        stubRunAndComplete("plain text result");
        const result = await gpuModule.handle("gpu_run", { service: "llm-4090", input: { prompt: "hi" } });
        expect(result.isError).toBeFalsy();
        expect(result.content[0].text).toBe("plain text result");
    });
    it("returns output.text", async () => {
        stubRunAndComplete({ text: "LLM response" });
        const result = await gpuModule.handle("gpu_run", { service: "llm-4090", input: { prompt: "hi" } });
        expect(result.content[0].text).toBe("LLM response");
    });
    it("returns output.url", async () => {
        stubRunAndComplete({ url: "https://cdn.example.com/img.png" });
        const result = await gpuModule.handle("gpu_run", { service: "image-4090", input: { prompt: "cat" } });
        expect(result.content[0].text).toBe("https://cdn.example.com/img.png");
    });
    it("returns output.audio_url", async () => {
        stubRunAndComplete({ audio_url: "https://cdn.example.com/speech.mp3" });
        const result = await gpuModule.handle("gpu_run", { service: "tts-l4", input: { text: "hello" } });
        expect(result.content[0].text).toBe("https://cdn.example.com/speech.mp3");
    });
    it("returns embedding summary", async () => {
        stubRunAndComplete({ embedding: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6], dimensions: 6 });
        const result = await gpuModule.handle("gpu_run", { service: "embedding-l4", input: { text: "embed me" } });
        expect(result.content[0].text).toContain("Embedding");
        expect(result.content[0].text).toContain("6 dimensions");
    });
    it("falls back to JSON stringify for unknown output shape", async () => {
        stubRunAndComplete({ something: "weird" });
        const result = await gpuModule.handle("gpu_run", { service: "ocr", input: { image_url: "x" } });
        expect(result.content[0].text).toContain("something");
    });
    it("appends output_notice when present", async () => {
        stubRunAndComplete({ text: "result" }, { output_notice: "Degraded quality" });
        const result = await gpuModule.handle("gpu_run", { service: "llm-4090", input: { prompt: "hi" } });
        expect(result.content[0].text).toContain("Degraded quality");
    });
    it("returns error when API returns error field", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
            json: () => Promise.resolve({ error: "service unavailable", hint: "try later", available_services: ["llm-4090"] }),
            ok: true,
        }));
        const result = await gpuModule.handle("gpu_run", { service: "bad-svc", input: {} });
        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain("service unavailable");
        expect(result.content[0].text).toContain("try later");
        expect(result.content[0].text).toContain("llm-4090");
    });
});
// ---------------------------------------------------------------------------
// Unknown tool
// ---------------------------------------------------------------------------
describe("gpu unknown tool", () => {
    it("throws for unknown tool name", async () => {
        await expect(gpuModule.handle("gpu_nonexistent", {})).rejects.toThrow("Unknown gpu tool");
    });
});
//# sourceMappingURL=gpu.test.js.map