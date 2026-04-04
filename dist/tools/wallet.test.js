import { describe, it, expect, mock, beforeEach, afterEach } from "bun:test";
// ---------------------------------------------------------------------------
// Mock @coinbase/cdp-sdk so tests never hit the real API
// ---------------------------------------------------------------------------
mock.module("@coinbase/cdp-sdk", () => {
    const mockEvm = {
        createAccount: mock(),
        getAccount: mock(),
        listTokenBalances: mock(),
        sendTransaction: mock(),
        signMessage: mock(),
        exportAccount: mock(),
        requestFaucet: mock(),
        getSwapPrice: mock(),
        createSwapQuote: mock(),
    };
    const CdpClient = mock().mockImplementation(() => ({ evm: mockEvm }));
    return { CdpClient };
});
import { walletModule } from "./wallet.js";
import { CdpClient } from "@coinbase/cdp-sdk";
// ---------------------------------------------------------------------------
// Helpers to get the mocked evm object
// ---------------------------------------------------------------------------
function getMockEvm() {
    return new CdpClient().evm;
}
// ---------------------------------------------------------------------------
// Module structure
// ---------------------------------------------------------------------------
describe("walletModule structure", () => {
    it("exports definitions array with 9 tools", () => {
        expect(walletModule.definitions).toHaveLength(9);
    });
    it("every definition has name, description, and inputSchema", () => {
        for (const def of walletModule.definitions) {
            expect(typeof def.name).toBe("string");
            expect(typeof def.description).toBe("string");
            expect(def.inputSchema.type).toBe("object");
        }
    });
    it("tool names are unique", () => {
        const names = walletModule.definitions.map((d) => d.name);
        expect(new Set(names).size).toBe(names.length);
    });
});
// ---------------------------------------------------------------------------
// Missing CDP credentials — all tools return missingEnv
// ---------------------------------------------------------------------------
describe("walletModule — missing CDP credentials", () => {
    beforeEach(() => {
        delete process.env.CDP_API_KEY_ID;
        delete process.env.CDP_API_KEY_SECRET;
        CdpClient.mockClear();
    });
    afterEach(() => {
        delete process.env.CDP_API_KEY_ID;
        delete process.env.CDP_API_KEY_SECRET;
    });
    const toolNames = [
        "cdp_create_account",
        "cdp_get_account",
        "cdp_list_balances",
        "cdp_send_transaction",
        "cdp_sign_message",
        "cdp_export_account",
        "cdp_request_faucet",
        "cdp_get_swap_price",
        "cdp_create_swap",
    ];
    for (const toolName of toolNames) {
        it(`${toolName} returns isError when CDP_API_KEY_ID is absent`, async () => {
            const result = await walletModule.handle(toolName, {
                address: "0x1234", to: "0x5678", network: "base-mainnet",
                name: "test", message: "hi", from_token: "0xabc", to_token: "0xdef",
                from_amount: "1000", taker_address: "0x1234",
            });
            expect(result.isError).toBe(true);
            expect(result.content[0].text).toMatch(/CDP_API_KEY_ID/);
        });
    }
});
// ---------------------------------------------------------------------------
// Input validation
// ---------------------------------------------------------------------------
describe("cdp_get_account — input validation", () => {
    beforeEach(() => {
        process.env.CDP_API_KEY_ID = "test-id";
        process.env.CDP_API_KEY_SECRET = "test-secret";
        CdpClient.mockClear();
    });
    afterEach(() => {
        delete process.env.CDP_API_KEY_ID;
        delete process.env.CDP_API_KEY_SECRET;
    });
    it("returns error when neither name nor address provided", async () => {
        const result = await walletModule.handle("cdp_get_account", {});
        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain("name");
        expect(result.content[0].text).toContain("address");
    });
});
describe("cdp_export_account — input validation", () => {
    beforeEach(() => {
        process.env.CDP_API_KEY_ID = "test-id";
        process.env.CDP_API_KEY_SECRET = "test-secret";
        process.env.CDP_WALLET_SECRET = "test-wallet-secret";
        CdpClient.mockClear();
    });
    afterEach(() => {
        delete process.env.CDP_API_KEY_ID;
        delete process.env.CDP_API_KEY_SECRET;
        delete process.env.CDP_WALLET_SECRET;
    });
    it("returns error when neither address nor name provided", async () => {
        const result = await walletModule.handle("cdp_export_account", {});
        expect(result.isError).toBe(true);
    });
});
describe("cdp_get_swap_price — requires taker_address", () => {
    beforeEach(() => {
        process.env.CDP_API_KEY_ID = "test-id";
        process.env.CDP_API_KEY_SECRET = "test-secret";
        CdpClient.mockClear();
    });
    afterEach(() => {
        delete process.env.CDP_API_KEY_ID;
        delete process.env.CDP_API_KEY_SECRET;
    });
    it("returns error when taker_address is absent", async () => {
        const result = await walletModule.handle("cdp_get_swap_price", {
            from_token: "0xaaa",
            to_token: "0xbbb",
            from_amount: "1000",
        });
        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain("taker_address");
    });
});
// ---------------------------------------------------------------------------
// Missing CDP_WALLET_SECRET for operations that require it
// ---------------------------------------------------------------------------
describe("cdp_send_transaction — missing CDP_WALLET_SECRET", () => {
    beforeEach(() => {
        process.env.CDP_API_KEY_ID = "test-id";
        process.env.CDP_API_KEY_SECRET = "test-secret";
        delete process.env.CDP_WALLET_SECRET;
        CdpClient.mockClear();
    });
    afterEach(() => {
        delete process.env.CDP_API_KEY_ID;
        delete process.env.CDP_API_KEY_SECRET;
        delete process.env.CDP_WALLET_SECRET;
    });
    it("returns missingEnv for CDP_WALLET_SECRET", async () => {
        const result = await walletModule.handle("cdp_send_transaction", {
            address: "0x1234",
            to: "0x5678",
            network: "base-mainnet",
        });
        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain("CDP_WALLET_SECRET");
    });
});
describe("cdp_sign_message — missing CDP_WALLET_SECRET", () => {
    beforeEach(() => {
        process.env.CDP_API_KEY_ID = "test-id";
        process.env.CDP_API_KEY_SECRET = "test-secret";
        delete process.env.CDP_WALLET_SECRET;
        CdpClient.mockClear();
    });
    afterEach(() => {
        delete process.env.CDP_API_KEY_ID;
        delete process.env.CDP_API_KEY_SECRET;
        delete process.env.CDP_WALLET_SECRET;
    });
    it("returns missingEnv for CDP_WALLET_SECRET", async () => {
        const result = await walletModule.handle("cdp_sign_message", {
            address: "0x1234",
            message: "hello",
        });
        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain("CDP_WALLET_SECRET");
    });
});
// ---------------------------------------------------------------------------
// Happy-path output formatting
// ---------------------------------------------------------------------------
describe("cdp_create_account — output formatting", () => {
    beforeEach(() => {
        process.env.CDP_API_KEY_ID = "test-id";
        process.env.CDP_API_KEY_SECRET = "test-secret";
        CdpClient.mockClear();
        const evm = getMockEvm();
        evm.createAccount.mockResolvedValue({ address: "0xABCD", name: "my-wallet" });
    });
    afterEach(() => {
        delete process.env.CDP_API_KEY_ID;
        delete process.env.CDP_API_KEY_SECRET;
    });
    it("returns the new account address and name", async () => {
        const result = await walletModule.handle("cdp_create_account", { name: "my-wallet" });
        expect(result.isError).toBeFalsy();
        expect(result.content[0].text).toContain("0xABCD");
        expect(result.content[0].text).toContain("my-wallet");
    });
});
describe("cdp_list_balances — output formatting", () => {
    beforeEach(() => {
        process.env.CDP_API_KEY_ID = "test-id";
        process.env.CDP_API_KEY_SECRET = "test-secret";
        CdpClient.mockClear();
    });
    afterEach(() => {
        delete process.env.CDP_API_KEY_ID;
        delete process.env.CDP_API_KEY_SECRET;
    });
    it("returns empty message when no balances", async () => {
        const evm = getMockEvm();
        evm.listTokenBalances.mockResolvedValue({ balances: [] });
        const result = await walletModule.handle("cdp_list_balances", { address: "0x1234" });
        expect(result.isError).toBeFalsy();
        expect(result.content[0].text).toContain("No token balances");
    });
    it("formats balances correctly with symbol and amount", async () => {
        const evm = getMockEvm();
        evm.listTokenBalances.mockResolvedValue({
            balances: [
                {
                    token: { symbol: "ETH", contractAddress: "0x0000" },
                    amount: { amount: BigInt("1500000000000000000"), decimals: 18 },
                },
                {
                    token: { symbol: "USDC", contractAddress: "0xusdc" },
                    amount: { amount: BigInt("5000000"), decimals: 6 },
                },
            ],
        });
        const result = await walletModule.handle("cdp_list_balances", { address: "0x1234" });
        expect(result.isError).toBeFalsy();
        expect(result.content[0].text).toContain("ETH");
        expect(result.content[0].text).toContain("USDC");
        expect(result.content[0].text).toContain("1.");
        expect(result.content[0].text).toContain("5.");
    });
    it("falls back to contractAddress when symbol is absent", async () => {
        const evm = getMockEvm();
        evm.listTokenBalances.mockResolvedValue({
            balances: [
                {
                    token: { contractAddress: "0xdeadbeef" },
                    amount: { amount: BigInt("1000"), decimals: 0 },
                },
            ],
        });
        const result = await walletModule.handle("cdp_list_balances", { address: "0x1234" });
        expect(result.content[0].text).toContain("0xdeadbeef");
    });
});
describe("cdp_request_faucet — output formatting", () => {
    beforeEach(() => {
        process.env.CDP_API_KEY_ID = "test-id";
        process.env.CDP_API_KEY_SECRET = "test-secret";
        CdpClient.mockClear();
        const evm = getMockEvm();
        evm.requestFaucet.mockResolvedValue({ transactionHash: "0xhash123" });
    });
    afterEach(() => {
        delete process.env.CDP_API_KEY_ID;
        delete process.env.CDP_API_KEY_SECRET;
    });
    it("returns transaction hash and network info", async () => {
        const result = await walletModule.handle("cdp_request_faucet", { address: "0x1234" });
        expect(result.isError).toBeFalsy();
        expect(result.content[0].text).toContain("0xhash123");
        expect(result.content[0].text).toContain("base-sepolia");
    });
});
describe("cdp_get_swap_price — no liquidity available", () => {
    beforeEach(() => {
        process.env.CDP_API_KEY_ID = "test-id";
        process.env.CDP_API_KEY_SECRET = "test-secret";
        CdpClient.mockClear();
        const evm = getMockEvm();
        evm.getSwapPrice.mockResolvedValue({ liquidityAvailable: false });
    });
    afterEach(() => {
        delete process.env.CDP_API_KEY_ID;
        delete process.env.CDP_API_KEY_SECRET;
    });
    it("returns error when no liquidity", async () => {
        const result = await walletModule.handle("cdp_get_swap_price", {
            from_token: "0xaaa",
            to_token: "0xbbb",
            from_amount: "1000",
            taker_address: "0x1234",
        });
        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain("No liquidity");
    });
});
describe("cdp_get_swap_price — success", () => {
    beforeEach(() => {
        process.env.CDP_API_KEY_ID = "test-id";
        process.env.CDP_API_KEY_SECRET = "test-secret";
        CdpClient.mockClear();
        const evm = getMockEvm();
        evm.getSwapPrice.mockResolvedValue({
            liquidityAvailable: true,
            toAmount: "999000",
            minToAmount: "995000",
        });
    });
    afterEach(() => {
        delete process.env.CDP_API_KEY_ID;
        delete process.env.CDP_API_KEY_SECRET;
    });
    it("returns swap price details", async () => {
        const result = await walletModule.handle("cdp_get_swap_price", {
            from_token: "0xaaa",
            to_token: "0xbbb",
            from_amount: "1000",
            taker_address: "0x1234",
        });
        expect(result.isError).toBeFalsy();
        expect(result.content[0].text).toContain("999000");
        expect(result.content[0].text).toContain("995000");
    });
});
describe("cdp_create_swap — no liquidity available", () => {
    beforeEach(() => {
        process.env.CDP_API_KEY_ID = "test-id";
        process.env.CDP_API_KEY_SECRET = "test-secret";
        process.env.CDP_WALLET_SECRET = "test-wallet-secret";
        CdpClient.mockClear();
        const evm = getMockEvm();
        evm.createSwapQuote.mockResolvedValue({ liquidityAvailable: false });
    });
    afterEach(() => {
        delete process.env.CDP_API_KEY_ID;
        delete process.env.CDP_API_KEY_SECRET;
        delete process.env.CDP_WALLET_SECRET;
    });
    it("returns error when no liquidity", async () => {
        const result = await walletModule.handle("cdp_create_swap", {
            taker_address: "0x1234",
            from_token: "0xaaa",
            to_token: "0xbbb",
            from_amount: "1000",
        });
        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain("No liquidity");
    });
});
describe("cdp_create_swap — no transaction data in quote", () => {
    beforeEach(() => {
        process.env.CDP_API_KEY_ID = "test-id";
        process.env.CDP_API_KEY_SECRET = "test-secret";
        process.env.CDP_WALLET_SECRET = "test-wallet-secret";
        CdpClient.mockClear();
        const evm = getMockEvm();
        evm.createSwapQuote.mockResolvedValue({ liquidityAvailable: true, transaction: null });
    });
    afterEach(() => {
        delete process.env.CDP_API_KEY_ID;
        delete process.env.CDP_API_KEY_SECRET;
        delete process.env.CDP_WALLET_SECRET;
    });
    it("returns error when quote has no transaction data", async () => {
        const result = await walletModule.handle("cdp_create_swap", {
            taker_address: "0x1234",
            from_token: "0xaaa",
            to_token: "0xbbb",
            from_amount: "1000",
        });
        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain("no transaction data");
    });
});
// ---------------------------------------------------------------------------
// Unknown tool
// ---------------------------------------------------------------------------
describe("wallet unknown tool", () => {
    beforeEach(() => {
        process.env.CDP_API_KEY_ID = "test-id";
        process.env.CDP_API_KEY_SECRET = "test-secret";
        CdpClient.mockClear();
    });
    afterEach(() => {
        delete process.env.CDP_API_KEY_ID;
        delete process.env.CDP_API_KEY_SECRET;
    });
    it("returns error for unknown tool name", async () => {
        const result = await walletModule.handle("cdp_nonexistent", {});
        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain("Unknown wallet tool");
    });
});
//# sourceMappingURL=wallet.test.js.map