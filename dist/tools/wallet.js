// CDP SDK v2 wallet tools — create accounts, transfer assets, sign messages, swap tokens
import { CdpClient } from "@coinbase/cdp-sdk";
import { parseEther } from "viem";
import { ok, err, missingEnv } from "../types.js";
function getCdpClient() {
    const apiKeyId = process.env.CDP_API_KEY_ID;
    const apiKeySecret = process.env.CDP_API_KEY_SECRET;
    if (!apiKeyId || !apiKeySecret)
        return null;
    return new CdpClient({
        apiKeyId,
        apiKeySecret,
        walletSecret: process.env.CDP_WALLET_SECRET,
    });
}
const definitions = [
    {
        name: "cdp_create_account",
        description: "Create a new EVM account (MPC wallet) on Coinbase Developer Platform. Returns the account address. Requires CDP_API_KEY_ID and CDP_API_KEY_SECRET env vars.",
        inputSchema: {
            type: "object",
            properties: {
                name: { type: "string", description: "Optional name for the account (e.g. 'my-agent-wallet')" },
            },
        },
    },
    {
        name: "cdp_get_account",
        description: "Retrieve an existing CDP EVM account by name or address. Requires CDP_API_KEY_ID and CDP_API_KEY_SECRET.",
        inputSchema: {
            type: "object",
            properties: {
                name: { type: "string", description: "Account name to look up" },
                address: { type: "string", description: "Account address (0x...) to look up" },
            },
        },
    },
    {
        name: "cdp_list_balances",
        description: "List all token balances (ETH, USDC, ERC-20s) for a CDP account address on a specific network. Requires CDP_API_KEY_ID and CDP_API_KEY_SECRET.",
        inputSchema: {
            type: "object",
            properties: {
                address: { type: "string", description: "The EVM account address (0x...)" },
                network: {
                    type: "string",
                    description: "Network to query. Examples: base-mainnet, base-sepolia, ethereum-mainnet, optimism-mainnet, arbitrum-mainnet, polygon-mainnet",
                    default: "base-mainnet",
                },
            },
            required: ["address"],
        },
    },
    {
        name: "cdp_send_transaction",
        description: "Send an EVM transaction (ETH transfer or contract call) from a CDP account. Requires CDP_API_KEY_ID, CDP_API_KEY_SECRET, and CDP_WALLET_SECRET.",
        inputSchema: {
            type: "object",
            properties: {
                address: { type: "string", description: "Sender account address (0x...)" },
                to: { type: "string", description: "Recipient address (0x...)" },
                value_eth: { type: "string", description: "Amount of ETH to send as a decimal string (e.g. '0.01')" },
                data: { type: "string", description: "Optional hex-encoded calldata for contract calls" },
                network: {
                    type: "string",
                    description: "Network. Examples: base-mainnet, base-sepolia, ethereum-mainnet",
                    default: "base-mainnet",
                },
            },
            required: ["address", "to", "network"],
        },
    },
    {
        name: "cdp_sign_message",
        description: "Sign an arbitrary message with a CDP EVM account (EIP-191 personal_sign). Requires CDP_API_KEY_ID, CDP_API_KEY_SECRET, and CDP_WALLET_SECRET.",
        inputSchema: {
            type: "object",
            properties: {
                address: { type: "string", description: "The signing account address (0x...)" },
                message: { type: "string", description: "The message to sign" },
                network: {
                    type: "string",
                    description: "Network for the account. Default: base-mainnet",
                    default: "base-mainnet",
                },
            },
            required: ["address", "message"],
        },
    },
    {
        name: "cdp_export_account",
        description: "Export the private key for a CDP EVM account. Use with caution — store the key securely. Requires CDP_API_KEY_ID, CDP_API_KEY_SECRET, and CDP_WALLET_SECRET.",
        inputSchema: {
            type: "object",
            properties: {
                address: { type: "string", description: "Account address to export" },
                name: { type: "string", description: "Account name to export (alternative to address)" },
            },
        },
    },
    {
        name: "cdp_request_faucet",
        description: "Request testnet funds from the Coinbase faucet for a CDP account address (base-sepolia or ethereum-sepolia only). Requires CDP_API_KEY_ID and CDP_API_KEY_SECRET.",
        inputSchema: {
            type: "object",
            properties: {
                address: { type: "string", description: "The account address to fund" },
                network: {
                    type: "string",
                    enum: ["base-sepolia", "ethereum-sepolia"],
                    description: "Testnet network. Default: base-sepolia",
                    default: "base-sepolia",
                },
                token: {
                    type: "string",
                    enum: ["eth", "usdc", "eurc", "cbbtc"],
                    description: "Token to request. Default: eth",
                    default: "eth",
                },
            },
            required: ["address"],
        },
    },
    {
        name: "cdp_get_swap_price",
        description: "Get an indicative swap price between two ERC-20 tokens on a CDP-supported network (no execution). Requires CDP_API_KEY_ID and CDP_API_KEY_SECRET.",
        inputSchema: {
            type: "object",
            properties: {
                network: {
                    type: "string",
                    description: "Network for the swap. Currently supports base-mainnet",
                    default: "base-mainnet",
                },
                from_token: { type: "string", description: "Source token contract address (0x...)" },
                to_token: { type: "string", description: "Destination token contract address (0x...)" },
                from_amount: { type: "string", description: "Amount to sell in the token's smallest unit (wei for ETH)" },
                taker_address: { type: "string", description: "The address that will perform the swap (0x...)" },
            },
            required: ["from_token", "to_token", "from_amount", "taker_address"],
        },
    },
    {
        name: "cdp_create_swap",
        description: "Create a swap quote and execute a token swap via CDP's DEX aggregator on Base. Requires CDP_API_KEY_ID, CDP_API_KEY_SECRET, and CDP_WALLET_SECRET.",
        inputSchema: {
            type: "object",
            properties: {
                taker_address: { type: "string", description: "Address of the account executing the swap (0x...)" },
                from_token: { type: "string", description: "Source token contract address (0x...)" },
                to_token: { type: "string", description: "Destination token contract address (0x...)" },
                from_amount: { type: "string", description: "Amount to sell in the token's smallest unit" },
                slippage_bps: { type: "number", description: "Slippage tolerance in basis points (0-10000). Default: 50 (0.5%)" },
                network: {
                    type: "string",
                    description: "Network for the swap. Currently supports base-mainnet",
                    default: "base-mainnet",
                },
            },
            required: ["taker_address", "from_token", "to_token", "from_amount"],
        },
    },
];
async function handle(name, args) {
    const cdp = getCdpClient();
    if (!cdp)
        return missingEnv("CDP_API_KEY_ID", "CDP_API_KEY_SECRET");
    try {
        switch (name) {
            case "cdp_create_account": {
                const { name: accountName } = args;
                const account = await cdp.evm.createAccount(accountName ? { name: accountName } : undefined);
                return ok(`Created EVM account:\nAddress: ${account.address}\nName: ${account.name || "(none)"}`);
            }
            case "cdp_get_account": {
                const { name: accountName, address } = args;
                if (!accountName && !address)
                    return err("Provide either 'name' or 'address'");
                const account = accountName
                    ? await cdp.evm.getAccount({ name: accountName })
                    : await cdp.evm.getAccount({ address: address });
                return ok(`EVM account:\nAddress: ${account.address}\nName: ${account.name || "(none)"}`);
            }
            case "cdp_list_balances": {
                const { address, network = "base-mainnet" } = args;
                const result = await cdp.evm.listTokenBalances({
                    address: address,
                    network: network,
                });
                if (!result.balances || result.balances.length === 0) {
                    return ok(`No token balances found for ${address} on ${network}`);
                }
                const lines = result.balances.map((b) => {
                    const symbol = b.token.symbol || b.token.contractAddress;
                    // Use BigInt arithmetic to avoid precision loss for large token amounts
                    const rawAmount = b.amount.amount;
                    const decimals = b.amount.decimals;
                    const divisor = BigInt(10) ** BigInt(decimals);
                    const whole = rawAmount / divisor;
                    const fraction = rawAmount % divisor;
                    const fractionStr = fraction.toString().padStart(decimals, "0").slice(0, 6);
                    const amount = `${whole}.${fractionStr}`;
                    return `  ${symbol}: ${amount}`;
                });
                return ok(`Token balances for ${address} on ${network}:\n${lines.join("\n")}`);
            }
            case "cdp_send_transaction": {
                const { address, to, value_eth, data, network = "base-mainnet", } = args;
                if (!process.env.CDP_WALLET_SECRET)
                    return missingEnv("CDP_WALLET_SECRET");
                // Use parseEther from viem for exact BigInt conversion (no floating-point rounding)
                const valueWei = value_eth ? parseEther(value_eth) : undefined;
                const result = await cdp.evm.sendTransaction({
                    address: address,
                    network: network,
                    transaction: {
                        to: to,
                        ...(valueWei !== undefined && { value: valueWei }),
                        ...(data && { data: data }),
                    },
                });
                return ok(`Transaction submitted!\nHash: ${result.transactionHash}\nNetwork: ${network}`);
            }
            case "cdp_sign_message": {
                const { address, message } = args;
                if (!process.env.CDP_WALLET_SECRET)
                    return missingEnv("CDP_WALLET_SECRET");
                const result = await cdp.evm.signMessage({
                    address: address,
                    message,
                });
                return ok(`Message signed!\nSignature: ${result.signature}`);
            }
            case "cdp_export_account": {
                const { address, name: accountName } = args;
                if (!process.env.CDP_WALLET_SECRET)
                    return missingEnv("CDP_WALLET_SECRET");
                if (!address && !accountName)
                    return err("Provide either 'address' or 'name'");
                const privateKey = address
                    ? await cdp.evm.exportAccount({ address: address })
                    : await cdp.evm.exportAccount({ name: accountName });
                return ok(`Exported private key:\n${privateKey}\n\n⚠️ Store this securely and never share it.`);
            }
            case "cdp_request_faucet": {
                const { address, network = "base-sepolia", token = "eth" } = args;
                const result = await cdp.evm.requestFaucet({
                    address,
                    network: network,
                    token: token,
                });
                return ok(`Faucet request submitted!\nTransaction hash: ${result.transactionHash}\nNetwork: ${network}\nToken: ${token}`);
            }
            case "cdp_get_swap_price": {
                const { from_token, to_token, from_amount, taker_address, network = "base-mainnet" } = args;
                if (!taker_address)
                    return err("taker_address is required for swap price (the address performing the swap)");
                const result = await cdp.evm.getSwapPrice({
                    network: network,
                    fromToken: from_token,
                    toToken: to_token,
                    fromAmount: BigInt(from_amount),
                    taker: taker_address,
                });
                if (!result.liquidityAvailable)
                    return err(`No liquidity available for this swap on ${network}`);
                return ok(`Swap price on ${network}:\nFrom: ${from_token}\nTo: ${to_token}\nInput amount: ${from_amount}\nExpected output: ${result.toAmount}\nMin output (after slippage): ${result.minToAmount}`);
            }
            case "cdp_create_swap": {
                const { taker_address, from_token, to_token, from_amount, slippage_bps = 50, network = "base-mainnet", } = args;
                if (!process.env.CDP_WALLET_SECRET)
                    return missingEnv("CDP_WALLET_SECRET");
                const quote = await cdp.evm.createSwapQuote({
                    network: network,
                    taker: taker_address,
                    fromToken: from_token,
                    toToken: to_token,
                    fromAmount: BigInt(from_amount),
                    slippageBps: slippage_bps,
                });
                if (!quote.liquidityAvailable)
                    return err("No liquidity available for this swap");
                if (!quote.transaction)
                    return err("Swap quote has no transaction data");
                const swapTx = quote.transaction;
                const txResult = await cdp.evm.sendTransaction({
                    address: taker_address,
                    network: network,
                    transaction: swapTx,
                });
                return ok(`Swap executed!\nTransaction hash: ${txResult.transactionHash}\nFrom: ${from_token}\nTo: ${to_token}\nAmount in: ${from_amount}`);
            }
            default:
                throw new Error(`Unknown wallet tool: ${name}`);
        }
    }
    catch (e) {
        return err(`Error: ${e.message}`);
    }
}
export const walletModule = { definitions, handle };
//# sourceMappingURL=wallet.js.map