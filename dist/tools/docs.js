import { ok, err } from "../types.js";
const MAX_DOC_LENGTH = 20000;
const DOC_PAGES = {
    "x402-payment-identifier": {
        url: "https://docs.x402.org/extensions/payment-identifier",
        title: "x402 Payment Identifier (Idempotency)",
    },
    "x402-offer-receipt": {
        url: "https://docs.x402.org/extensions/offer-receipt",
        title: "x402 Signed Offers & Receipts",
    },
    "x402-eip2612-gas-sponsoring": {
        url: "https://docs.x402.org/extensions/eip2612-gas-sponsoring",
        title: "x402 EIP-2612 Gas Sponsoring",
    },
    "x402-erc20-approval-gas-sponsoring": {
        url: "https://docs.x402.org/extensions/erc20-approval-gas-sponsoring",
        title: "x402 ERC20 Approval Gas Sponsoring",
    },
    "farcaster-miniapps-agents-checklist": {
        url: "https://miniapps.farcaster.xyz/docs/guides/agents-checklist",
        title: "Farcaster Mini Apps — AI Agents & LLMs Checklist",
    },
    "farcaster-miniapps-llms-full": {
        url: "https://miniapps.farcaster.xyz/llms-full.txt",
        title: "Farcaster Mini Apps — Full LLMs Documentation",
    },
};
const definitions = [
    {
        name: "docs_fetch",
        description: "Fetch reference documentation for x402 protocol extensions or Farcaster Mini Apps. Use this to look up the latest specs for x402 payment idempotency, signed offers/receipts, gas sponsoring extensions, or Farcaster Mini Apps agent guidance and full LLM documentation.",
        inputSchema: {
            type: "object",
            properties: {
                topic: {
                    type: "string",
                    enum: Object.keys(DOC_PAGES),
                    description: "Documentation topic to fetch. Options: " +
                        Object.entries(DOC_PAGES)
                            .map(([k, v]) => `'${k}' (${v.title})`)
                            .join(", "),
                },
            },
            required: ["topic"],
        },
    },
];
async function handle(name, args) {
    if (name !== "docs_fetch")
        throw new Error(`Unknown docs tool: ${name}`);
    const { topic } = args;
    const page = DOC_PAGES[topic];
    if (!page) {
        return err(`Unknown topic '${topic}'. Valid topics: ${Object.keys(DOC_PAGES).join(", ")}`);
    }
    try {
        const res = await fetch(page.url, {
            headers: { "User-Agent": "alpha-mcp-server/docs-fetcher" },
        });
        if (!res.ok) {
            return err(`Failed to fetch ${page.url}: HTTP ${res.status}`);
        }
        const body = await res.text();
        // Strip HTML tags for plain-text extraction
        const cleaned = body
            .replace(/<[^>]+>/g, " ")
            .replace(/\s{3,}/g, "\n\n")
            .trim();
        const content = cleaned.length > MAX_DOC_LENGTH ? cleaned.slice(0, MAX_DOC_LENGTH) + "\n\n[truncated]" : cleaned;
        return ok(`# ${page.title}\nSource: ${page.url}\n\n${content}`);
    }
    catch (e) {
        return err(`Error fetching docs: ${e.message}`);
    }
}
export const docsModule = { definitions, handle };
//# sourceMappingURL=docs.js.map