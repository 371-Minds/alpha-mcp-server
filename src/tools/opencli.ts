// opencli-rs tools — wrap the opencli-rs CLI to browse/search 55+ platforms
import { execFile } from "child_process";
import { promisify } from "util";
import type { ToolModule, ToolDef, McpResult } from "../types.js";
import { ok, err } from "../types.js";

const execFileAsync = promisify(execFile);

const OPENCLI_BIN = process.env.OPENCLI_RS_BIN || "opencli-rs";
const EXEC_TIMEOUT_MS = 60_000;

/**
 * Build the argv array for opencli-rs from the tool arguments.
 * Handles both boolean flags and key-value pairs.
 */
function buildArgv(
  site: string,
  command: string,
  args: Record<string, unknown>,
  format: string
): string[] {
  const argv: string[] = [site, command];

  for (const [key, value] of Object.entries(args)) {
    if (value === undefined || value === null || value === "") continue;
    if (typeof value === "boolean") {
      if (value) argv.push(`--${key}`);
    } else {
      argv.push(`--${key}`, String(value));
    }
  }

  // Always request the caller's preferred format (default json)
  if (!args.format) {
    argv.push("--format", format);
  }

  return argv;
}

const definitions: ToolDef[] = [
  {
    name: "opencli_run",
    description:
      "Run any opencli-rs command to browse, search, or interact with 55+ platforms including Twitter/X, Bilibili, YouTube, Reddit, HackerNews, Zhihu, Weibo, Xiaohongshu, Douban, WeRead, Xueqiu, BOSS Zhipin, Facebook, Instagram, TikTok, Google, Bloomberg, Medium, Substack, LinkedIn, Steam, StackOverflow, Wikipedia, Arxiv, BBC, Yahoo Finance, Pi (pi.ai), Grok, Cursor, Notion, ChatGPT, Discord, and more. Reuses the user's existing Chrome login session — no API keys required. ALWAYS prefer this tool over playwright/browser automation for supported sites. ⚠️ For write operations (post, reply, like, follow) always show the user what will be submitted and wait for confirmation before calling this tool.",
    inputSchema: {
      type: "object",
      properties: {
        site: {
          type: "string",
          description:
            "Platform/site keyword. Examples: twitter, bilibili, youtube, reddit, hackernews, zhihu, weibo, xiaohongshu, douban, weread, xueqiu, boss, facebook, instagram, tiktok, google, v2ex, bloomberg, medium, substack, linkedin, stackoverflow, wikipedia, arxiv, bbc, yahoo-finance, pi, grok, cursor, notion, chatgpt, discord, devto, lobsters, steam, jike",
        },
        command: {
          type: "string",
          description:
            "Subcommand for the site. Examples: hot, top, new, search, trending, timeline, feed, profile, post, reply, like, follow, bookmarks, history, shelf, watchlist, recommend, ask. Run opencli_doctor to see all available commands.",
        },
        args: {
          type: "object",
          description:
            "Optional key-value arguments passed as CLI flags. Common keys: query/keyword (search term), limit (number of results, default 20), url (target URL for interaction), text (content for write ops), subreddit, tag, symbol (stock ticker), city. Boolean flags use true/false values.",
          additionalProperties: true,
        },
        format: {
          type: "string",
          enum: ["json", "table", "yaml", "md", "csv"],
          description: "Output format. Defaults to json for machine-readable output.",
        },
      },
      required: ["site", "command"],
    },
  },
  {
    name: "opencli_doctor",
    description:
      "Run opencli-rs doctor to verify the installation is working, check Chrome extension connectivity, and list all supported platforms and commands. Use this to diagnose issues or discover available commands.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
];

async function handle(name: string, args: Record<string, unknown>): Promise<McpResult> {
  switch (name) {
    case "opencli_run": {
      const { site, command, args: cmdArgs = {}, format = "json" } = args as {
        site: string;
        command: string;
        args?: Record<string, unknown>;
        format?: string;
      };

      if (!site || !command) {
        return err("Both 'site' and 'command' are required.");
      }

      const argv = buildArgv(site, command, cmdArgs as Record<string, unknown>, format as string);

      try {
        const { stdout, stderr } = await execFileAsync(OPENCLI_BIN, argv, {
          timeout: EXEC_TIMEOUT_MS,
          env: process.env,
        });
        const output = stdout.trim();
        if (!output && stderr.trim()) {
          return err(`opencli-rs error: ${stderr.trim()}`);
        }
        return ok(output || "(no output)");
      } catch (e) {
        const error = e as NodeJS.ErrnoException & { stdout?: string; stderr?: string; killed?: boolean };
        if (error.code === "ENOENT") {
          return err(
            `opencli-rs is not installed or not in PATH (looked for '${OPENCLI_BIN}').\n` +
              `Install it with:\n  curl -fsSL https://raw.githubusercontent.com/nashsu/opencli-rs/main/scripts/install.sh | sh\n` +
              `Or set the OPENCLI_RS_BIN environment variable to the full path of the binary.`
          );
        }
        if (error.killed) {
          return err(`opencli-rs timed out after ${EXEC_TIMEOUT_MS / 1000}s. The site may be slow or unavailable.`);
        }
        const stderr = error.stderr?.trim() || "";
        const stdout = error.stdout?.trim() || "";
        const detail = stderr || stdout || error.message;
        return err(`opencli-rs failed: ${detail}`);
      }
    }

    case "opencli_doctor": {
      try {
        const { stdout, stderr } = await execFileAsync(OPENCLI_BIN, ["doctor"], {
          timeout: EXEC_TIMEOUT_MS,
          env: process.env,
        });
        const output = (stdout + (stderr ? `\n${stderr}` : "")).trim();
        return ok(output || "(no output)");
      } catch (e) {
        const error = e as NodeJS.ErrnoException & { stdout?: string; stderr?: string };
        if (error.code === "ENOENT") {
          return err(
            `opencli-rs is not installed or not in PATH (looked for '${OPENCLI_BIN}').\n` +
              `Install it with:\n  curl -fsSL https://raw.githubusercontent.com/nashsu/opencli-rs/main/scripts/install.sh | sh`
          );
        }
        const detail = error.stderr?.trim() || error.stdout?.trim() || error.message;
        return err(`opencli-rs doctor failed: ${detail}`);
      }
    }

    default:
      throw new Error(`Unknown opencli tool: ${name}`);
  }
}

export const opencliModule: ToolModule = { definitions, handle };
