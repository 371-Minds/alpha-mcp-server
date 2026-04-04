import { describe, it, expect, mock, afterEach } from "bun:test";
import { docsModule } from "./docs.js";
const originalFetch = globalThis.fetch;
// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function stubFetchText(status, body) {
    const m = mock().mockResolvedValue({
        ok: status >= 200 && status < 300,
        status,
        text: () => Promise.resolve(body),
    });
    globalThis.fetch = m;
    return m;
}
// ---------------------------------------------------------------------------
// Module structure
// ---------------------------------------------------------------------------
describe("docsModule structure", () => {
    it("exports one definition (docs_fetch)", () => {
        expect(docsModule.definitions).toHaveLength(1);
        expect(docsModule.definitions[0].name).toBe("docs_fetch");
    });
    it("docs_fetch definition has required 'topic' field", () => {
        const schema = docsModule.definitions[0].inputSchema;
        expect(schema.required).toContain("topic");
        expect(schema.properties.topic).toBeDefined();
    });
});
// ---------------------------------------------------------------------------
// Unknown topic
// ---------------------------------------------------------------------------
describe("docs_fetch — unknown topic", () => {
    it("returns isError for unrecognised topic", async () => {
        const result = await docsModule.handle("docs_fetch", { topic: "nonexistent-topic" });
        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain("Unknown topic");
        expect(result.content[0].text).toContain("nonexistent-topic");
    });
    it("lists valid topics in the error message", async () => {
        const result = await docsModule.handle("docs_fetch", { topic: "bad" });
        expect(result.content[0].text).toContain("x402");
    });
});
// ---------------------------------------------------------------------------
// HTTP error from upstream
// ---------------------------------------------------------------------------
describe("docs_fetch — upstream HTTP error", () => {
    afterEach(() => { globalThis.fetch = originalFetch; });
    it("returns isError when upstream returns non-ok status", async () => {
        stubFetchText(503, "Service Unavailable");
        const result = await docsModule.handle("docs_fetch", { topic: "x402-payment-identifier" });
        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain("503");
    });
});
// ---------------------------------------------------------------------------
// Fetch error (network failure)
// ---------------------------------------------------------------------------
describe("docs_fetch — network failure", () => {
    afterEach(() => { globalThis.fetch = originalFetch; });
    it("returns isError on fetch exception", async () => {
        globalThis.fetch = mock().mockRejectedValue(new Error("ECONNREFUSED"));
        const result = await docsModule.handle("docs_fetch", { topic: "x402-payment-identifier" });
        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain("ECONNREFUSED");
    });
});
// ---------------------------------------------------------------------------
// Successful fetch
// ---------------------------------------------------------------------------
describe("docs_fetch — happy path", () => {
    afterEach(() => { globalThis.fetch = originalFetch; });
    it("returns topic title and source URL in output", async () => {
        stubFetchText(200, "<html><body><h1>Payment Identifier</h1><p>Some spec content.</p></body></html>");
        const result = await docsModule.handle("docs_fetch", { topic: "x402-payment-identifier" });
        expect(result.isError).toBeFalsy();
        expect(result.content[0].text).toContain("x402 Payment Identifier");
        expect(result.content[0].text).toContain("docs.x402.org");
    });
    it("strips HTML tags from response body", async () => {
        stubFetchText(200, "<div class='main'><p>Hello <b>world</b></p></div>");
        const result = await docsModule.handle("docs_fetch", { topic: "x402-offer-receipt" });
        expect(result.content[0].text).not.toContain("<div");
        expect(result.content[0].text).not.toContain("<p>");
        expect(result.content[0].text).toContain("Hello");
        expect(result.content[0].text).toContain("world");
    });
    it("truncates very long content with [truncated] marker", async () => {
        // Create content longer than 20000 chars
        const longContent = "A".repeat(25000);
        stubFetchText(200, longContent);
        const result = await docsModule.handle("docs_fetch", { topic: "farcaster-miniapps-llms-full" });
        expect(result.content[0].text).toContain("[truncated]");
        // Should not exceed MAX_DOC_LENGTH by much (plus header text)
        expect(result.content[0].text.length).toBeLessThan(22000);
    });
    it("does not truncate content within limit", async () => {
        const shortContent = "Short content.";
        stubFetchText(200, shortContent);
        const result = await docsModule.handle("docs_fetch", { topic: "x402-eip2612-gas-sponsoring" });
        expect(result.content[0].text).not.toContain("[truncated]");
        expect(result.content[0].text).toContain("Short content");
    });
});
// ---------------------------------------------------------------------------
// All valid topics are accessible
// ---------------------------------------------------------------------------
describe("docs_fetch — all valid topics resolve to a URL", () => {
    afterEach(() => { globalThis.fetch = originalFetch; });
    const validTopics = [
        "x402-payment-identifier",
        "x402-offer-receipt",
        "x402-eip2612-gas-sponsoring",
        "x402-erc20-approval-gas-sponsoring",
        "farcaster-miniapps-agents-checklist",
        "farcaster-miniapps-llms-full",
    ];
    for (const topic of validTopics) {
        it(`topic '${topic}' fetches from a valid URL`, async () => {
            const fetchMock = stubFetchText(200, "content");
            const result = await docsModule.handle("docs_fetch", { topic });
            expect(result.isError).toBeFalsy();
            const calledUrl = fetchMock.mock.calls[0][0];
            expect(calledUrl).toMatch(/^https?:\/\//);
        });
    }
});
// ---------------------------------------------------------------------------
// Unknown tool name
// ---------------------------------------------------------------------------
describe("docs unknown tool", () => {
    it("throws for unknown tool name", async () => {
        await expect(docsModule.handle("docs_nonexistent", {})).rejects.toThrow("Unknown docs tool");
    });
});
//# sourceMappingURL=docs.test.js.map