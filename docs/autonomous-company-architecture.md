# Autonomous Company Architecture

> A metasystemic design for an AI-native company: a master orchestrator with infinite memory, on-chain transaction agents, and an infinite pool of AgentKit subagents for off-chain tasks — all wired together through the alpha-mcp-server capability layer.

---

## Overview

This architecture describes an autonomous company where:

- A **master orchestrator** (llama.cpp-backed LLM) holds the company's identity, memory, and decision-making
- **On-chain agents** execute transactions directly via CDP wallets using tools in this MCP server
- **Off-chain subagents** are spawned on-demand via AgentKit to handle discrete tasks (research, data enrichment, API calls, document generation, etc.)
- **Infinite memory** persists context across all agent lifetimes and task histories
- **Infinite agent spawning** allows the company to scale horizontally by creating purpose-built agents per task

```
┌─────────────────────────────────────────────────────────────────┐
│                    MASTER ORCHESTRATOR                          │
│                  (llama.cpp / llamanet)                         │
│                                                                 │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────────────┐  │
│  │ Backstory   │  │ Voice Dataset│  │  Memory Layer (~1 GB) │  │
│  │ MD files    │  │ (TTS/STT)    │  │  1M memories, vector  │  │
│  └─────────────┘  └──────────────┘  └───────────────────────┘  │
│                                                                 │
│  System prompt = backstory + retrieved memories + task context  │
└────────────────────────┬────────────────────────────────────────┘
                         │ MCP client (stdio or HTTP/SSE)
         ┌───────────────┴──────────────────────┐
         │                                      │
         ▼                                      ▼
┌─────────────────────┐            ┌─────────────────────────────┐
│  alpha-mcp-server   │            │   AgentKit Subagent Pool    │
│  (this repo)        │            │   (spawned per task)        │
│                     │            │                             │
│  • GPU/AI inference │            │  subagent-research          │
│  • CDP wallets      │            │  subagent-dataenrich        │
│  • DeFi (Morpho,   │            │  subagent-comms             │
│    Pyth, Across)    │            │  subagent-N (infinite)      │
│  • Payments (x402,  │            │                             │
│    Commerce)        │            │  Each: AgentKit instance +  │
│  • Portfolio        │            │  @coinbase/agentkit-mcp     │
│  • Markets          │            │  wrapped as MCP server      │
│  • Docs             │            │                             │
└─────────────────────┘            └─────────────────────────────┘
```

---

## Components

### 1. Master Orchestrator

The master is a persistent process running a local LLM (llama.cpp or llamanet) that acts as the company's executive decision-maker.

**Responsibilities:**
- Holds the company identity via backstory markdown files injected into the system prompt on startup
- Retrieves relevant memories from the memory layer for each decision cycle
- Decides when to execute on-chain transactions vs. spawn off-chain subagents
- Manages the agent spawner process pool
- Routes tool calls to the alpha-mcp-server capability layer via MCP client

**Composition:**
```
master-agent/
  ├── llama.cpp (HTTP server, /v1/chat/completions with tools)
  ├── backstory/
  │   ├── identity.md         ← who the company is
  │   ├── mission.md          ← goals and constraints
  │   ├── playbooks/          ← decision patterns per scenario
  │   └── relationships.md    ← known entities, partners, wallets
  ├── memory/
  │   ├── store.db            ← vector-indexed SQLite (~1 GB for 1M memories)
  │   └── retriever.ts        ← semantic search over memories
  ├── voice/
  │   └── training-dataset/   ← TTS/STT voice identity
  └── agent-spawner.ts        ← Bun.spawn() pool manager
```

**Memory layer:**
- ~1 GB for 1 million memories (approximately 1 KB per memory entry)
- Memories are embedded at write-time and stored alongside their vector
- At inference time, top-K semantically similar memories are injected into context
- Memory writes happen after every completed task (task outcome, decisions made, new entities encountered)

---

### 2. alpha-mcp-server — Capability Layer

This repository serves as the **onchain and AI capability layer** for the master orchestrator. It is consumed via the Model Context Protocol (MCP) and requires no modification to work in this architecture.

**Role:** Provides 48 tools the master can call directly, including all on-chain transaction capabilities.

**On-chain tools used for transaction-capable agents:**

| Tool Group | Tools | Use Case |
|---|---|---|
| CDP Wallets | `cdp_create_account`, `cdp_transfer`, `cdp_swap_tokens` | Execute transactions, move assets |
| DeFi | `morpho_deposit`, `morpho_borrow`, `across_bridge` | Yield, leverage, cross-chain |
| Payments | `x402_pay`, `commerce_create_charge` | Pay for services, receive payments |
| Markets | `create_order`, `cancel_order` | Trading, treasury management |

**Connection from master:**
```jsonc
// MCP client config in master orchestrator
{
  "mcpServers": {
    "alpha": {
      "command": "npx",
      "args": ["-y", "@371-minds/alpha-mcp-server"],
      "env": {
        "GPUBRIDGE_API_KEY": "...",
        "CDP_API_KEY_ID": "...",
        "CDP_API_KEY_SECRET": "...",
        "CDP_WALLET_SECRET": "..."
      }
    }
  }
}
```

Or, using a `bun --compile` binary for faster cold-start (see [Bun Distribution](#bun-distribution)):
```jsonc
{
  "mcpServers": {
    "alpha": {
      "command": "/opt/agents/alpha-mcp-server",
      "args": [],
      "env": { "CDP_API_KEY_ID": "..." }
    }
  }
}
```

---

### 3. AgentKit Subagents — Off-Chain Task Pool

AgentKit subagents are spawned on-demand to handle **off-chain tasks** that the master delegates. In the initial phase, all spawned agents complete off-chain work only; on-chain capabilities remain the master's responsibility via the alpha-mcp-server.

**Off-chain task categories (initial phase):**
- Web research and data retrieval
- Document generation and summarization
- External API calls (CRMs, databases, notification services)
- Data enrichment and entity resolution
- Communication drafting (email, messages, reports)
- Code generation and execution
- File processing (PDFs, CSVs, images)

**Each subagent is:**
1. An AgentKit instance configured with a specific action provider set
2. Wrapped as an MCP server using `@coinbase/agentkit-model-context-protocol`
3. Spawned by the agent-spawner as a child process
4. Given a single task context and terminated on completion

**Subagent MCP server pattern:**
```typescript
// subagent-research.ts (example subagent)
import { AgentKit } from "@coinbase/agentkit";
import { AgentKitMcpServer } from "@coinbase/agentkit-model-context-protocol";

const agentkit = await AgentKit.from({
  // No wallet provider needed for off-chain tasks in initial phase
  actionProviders: [
    // web search, document tools, API call providers
  ],
});

const server = new AgentKitMcpServer(agentkit);
await server.start(); // exposes tools via stdio MCP
```

**Spawning from master (agent-spawner pattern):**
```typescript
// agent-spawner.ts
import { spawn } from "child_process"; // or Bun.spawn()

async function spawnOffchainAgent(taskType: string, taskContext: string) {
  const proc = spawn(`./subagents/${taskType}`, [], {
    stdio: ["pipe", "pipe", "pipe"],
    env: { ...process.env, TASK_CONTEXT: taskContext },
  });
  // Connect as MCP client to proc.stdin/stdout
  // Issue tool calls, collect result
  // Terminate proc on completion
  return result;
}
```

---

### 4. Infinite Agent Spawning

The spawner maintains a **process pool** of AgentKit subagents, creating new ones as work arrives and reaping them on completion.

**Design principles:**
- Each subagent is **stateless** — task context is passed at spawn time via environment or stdin
- Each subagent is **single-purpose** — typed by task category, not generic
- Memory is **externalized** — outcomes are written to the master's memory layer, not kept in the subagent
- Spawning is **cheap** — with Bun-compiled binaries, cold start is ~5ms

**Pool topology:**
```
agent-spawner
  ├── queue: PriorityQueue<Task>
  ├── running: Map<pid, SubagentHandle>
  ├── maxConcurrent: configurable (e.g. 10 for local, 100 for cloud)
  └── on task-complete:
        → write outcome to memory layer
        → kill process
        → dequeue next task
```

**Infinite memory integration:**
When a subagent completes a task, the result is embedded and written to the memory layer:
```
memory.write({
  type: "task-outcome",
  agent: "subagent-research",
  task: "...",
  result: "...",
  timestamp: Date.now(),
  embedding: embed(result),  // for future retrieval
})
```

This means every task ever completed is retrievable by semantic similarity, giving the master perpetual, searchable context over all company operations.

---

### 5. On-Chain Agent Execution (Transaction Agents)

On-chain work is executed by the master via the alpha-mcp-server tool calls — no separate on-chain agent process is needed in the initial architecture. The master holds the decision authority and the MCP server holds the execution capability.

**Transaction flow:**
```
Master decides to execute transaction
  → calls cdp_create_account (or reuses existing wallet from memory)
  → calls cdp_transfer / cdp_swap / morpho_deposit / etc.
  → receives transaction hash
  → writes transaction record to memory layer
  → continues decision loop
```

**Wallet pool for future multi-agent on-chain work:**

When the architecture expands to spawn on-chain capable subagents, a wallet pool is needed because `CdpClient` credentials are not multitenancy-aware (one set of API keys per instance):

```
wallet-pool.ts
  ├── Pool of pre-created CDP accounts (addresses stored in memory layer)
  ├── allocate(agentId) → assigns an idle wallet to a spawned agent
  ├── release(agentId) → returns wallet to pool on agent termination
  └── CDP_API_KEY_ID / CDP_API_KEY_SECRET shared across pool instances
      (one key pair per Coinbase project, many wallet addresses within)
```

---

## Data Flow Diagram

```
[External Event / User Request]
         │
         ▼
[Master Orchestrator]
  1. Retrieve top-K memories (semantic search)
  2. Build context: backstory + memories + request
  3. Call LLM (llama.cpp) with tools
  4. LLM decides: on-chain action OR spawn subagent
         │
    ┌────┴────────────────────────────────┐
    │ On-chain                            │ Off-chain
    ▼                                     ▼
[alpha-mcp-server tool call]      [Spawn AgentKit subagent]
  cdp_transfer, morpho_deposit,     subagent-research,
  x402_pay, create_order, etc.      subagent-enrich, etc.
    │                                     │
    ▼                                     ▼
[Transaction hash / result]       [Task result]
    │                                     │
    └────────────┬────────────────────────┘
                 │
                 ▼
        [Write to Memory Layer]
          embed(result) → store
                 │
                 ▼
        [Continue decision loop]
```

---

## Bun Distribution

For production deployment of this MCP server and subagent binaries, `bun build --compile` produces self-contained executables:

```bash
# Build alpha-mcp-server as a standalone binary
bun build --compile --minify src/server.ts --outfile dist/alpha-mcp-server-bin

# Build a subagent binary
bun build --compile --minify subagents/research.ts --outfile dist/subagent-research
```

**Size comparison:**

| Artifact | Node + npm install | Bun JS bundle | Bun compiled binary |
|---|---|---|---|
| Dependencies unpacked | ~32 MB | N/A | N/A |
| Distributable | 640 KB source | ~13 MB | ~68 MB |
| Runtime required | Node.js | Node.js or Bun | None |
| Cold start | ~120ms | ~120ms | ~5ms |
| Spawn cost (infinite agents) | High | Medium | Low |

The compiled binary is optimal for spawned subagents where cold-start latency compounds across thousands of spawn events.

---

## Phased Roadmap

### Phase 1 — Current (off-chain subagents only)
- Master orchestrator connects to alpha-mcp-server via MCP
- AgentKit subagents handle off-chain tasks only
- On-chain transactions executed by master directly via alpha-mcp-server
- Memory layer stores all task outcomes and decisions

### Phase 2 — On-chain subagents
- Wallet pool allocates CDP accounts to spawned agents
- Subagents can execute scoped on-chain transactions
- Master retains approval authority for high-value transactions

### Phase 3 — Autonomous company at scale
- Subagents spawn their own subagents (recursive spawning)
- Cross-agent memory sharing (shared memory namespace)
- Voice interface layer (TTS/STT via GPU tools in alpha-mcp-server)
- Multi-modal task handling (image, audio, video via GPU tools)

---

## Technology Stack

| Layer | Technology |
|---|---|
| Master LLM | llama.cpp / llamanet |
| Memory Layer | Vector-indexed SQLite (~1 GB / 1M memories) |
| Capability Layer | alpha-mcp-server (this repo) |
| On-chain Execution | Coinbase CDP SDK (via alpha-mcp-server) |
| Off-chain Subagents | AgentKit + @coinbase/agentkit-model-context-protocol |
| Agent Protocol | MCP (stdio or HTTP/SSE) |
| Spawning Runtime | Bun (`Bun.spawn()` or Node `child_process`) |
| Distribution | `bun build --compile` for subagent binaries |
| Identity | Backstory MD files + voice training dataset |
