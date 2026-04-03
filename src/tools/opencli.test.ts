import { describe, it, expect, vi, afterEach } from "vitest";
import { opencliModule } from "./opencli.js";

// ---------------------------------------------------------------------------
// vi.hoisted — hoist mock variables so they are available inside vi.mock()
// ---------------------------------------------------------------------------
const { mockExecFile } = vi.hoisted(() => ({
  mockExecFile: vi.fn(),
}));

vi.mock("child_process", () => ({
  execFile: mockExecFile,
}));

// execFileAsync (promisify wrapper) calls execFile with a callback; we simulate
// the promisified version by resolving / rejecting according to mockExecFile.
function stubExecSuccess(stdout: string, stderr = ""): void {
  mockExecFile.mockImplementation(
    (_bin: string, _argv: string[], _opts: unknown, cb: (err: null, result: { stdout: string; stderr: string }) => void) => {
      cb(null, { stdout, stderr });
    }
  );
}

function stubExecError(errObj: Partial<NodeJS.ErrnoException & { stdout?: string; stderr?: string; killed?: boolean }>): void {
  mockExecFile.mockImplementation(
    (_bin: string, _argv: string[], _opts: unknown, cb: (err: Error) => void) => {
      cb(Object.assign(new Error(errObj.message || "exec error"), errObj));
    }
  );
}

// ---------------------------------------------------------------------------
// Module structure
// ---------------------------------------------------------------------------

describe("opencliModule structure", () => {
  it("exports two definitions", () => {
    expect(opencliModule.definitions).toHaveLength(2);
  });

  it("tool names are opencli_run and opencli_doctor", () => {
    const names = opencliModule.definitions.map((d) => d.name);
    expect(names).toContain("opencli_run");
    expect(names).toContain("opencli_doctor");
  });

  it("every definition has name, description, and inputSchema", () => {
    for (const def of opencliModule.definitions) {
      expect(typeof def.name).toBe("string");
      expect(typeof def.description).toBe("string");
      expect(def.inputSchema.type).toBe("object");
    }
  });

  it("opencli_run requires site and command", () => {
    const def = opencliModule.definitions.find((d) => d.name === "opencli_run")!;
    expect(def.inputSchema.required).toContain("site");
    expect(def.inputSchema.required).toContain("command");
  });
});

// ---------------------------------------------------------------------------
// opencli_run — happy paths
// ---------------------------------------------------------------------------

describe("opencli_run — success", () => {
  afterEach(() => { mockExecFile.mockReset(); });

  it("returns stdout on success", async () => {
    stubExecSuccess('[{"title":"Test Story"}]');
    const result = await opencliModule.handle("opencli_run", { site: "hackernews", command: "top" });
    expect(result.isError).toBeFalsy();
    expect(result.content[0].text).toContain("Test Story");
  });

  it("passes --format json by default", async () => {
    stubExecSuccess("[]");
    await opencliModule.handle("opencli_run", { site: "hackernews", command: "top" });
    const calledArgv: string[] = mockExecFile.mock.calls[0][1];
    expect(calledArgv).toContain("--format");
    expect(calledArgv).toContain("json");
  });

  it("respects explicit format override", async () => {
    stubExecSuccess("title | url");
    await opencliModule.handle("opencli_run", { site: "hackernews", command: "top", format: "table" });
    const calledArgv: string[] = mockExecFile.mock.calls[0][1];
    expect(calledArgv).toContain("table");
  });

  it("passes string args as --key value pairs", async () => {
    stubExecSuccess("[]");
    await opencliModule.handle("opencli_run", {
      site: "reddit",
      command: "hot",
      args: { subreddit: "MachineLearning", limit: 10 },
    });
    const calledArgv: string[] = mockExecFile.mock.calls[0][1];
    expect(calledArgv).toContain("--subreddit");
    expect(calledArgv).toContain("MachineLearning");
    expect(calledArgv).toContain("--limit");
    expect(calledArgv).toContain("10");
  });

  it("omits boolean false flags", async () => {
    stubExecSuccess("[]");
    await opencliModule.handle("opencli_run", {
      site: "twitter",
      command: "timeline",
      args: { verbose: false },
    });
    const calledArgv: string[] = mockExecFile.mock.calls[0][1];
    expect(calledArgv).not.toContain("--verbose");
  });

  it("includes boolean true flags without value", async () => {
    stubExecSuccess("[]");
    await opencliModule.handle("opencli_run", {
      site: "twitter",
      command: "timeline",
      args: { verbose: true },
    });
    const calledArgv: string[] = mockExecFile.mock.calls[0][1];
    expect(calledArgv).toContain("--verbose");
  });

  it("skips null/undefined/empty args", async () => {
    stubExecSuccess("[]");
    await opencliModule.handle("opencli_run", {
      site: "bilibili",
      command: "hot",
      args: { keyword: null, extra: undefined, blank: "" },
    });
    const calledArgv: string[] = mockExecFile.mock.calls[0][1];
    expect(calledArgv).not.toContain("--keyword");
    expect(calledArgv).not.toContain("--extra");
    expect(calledArgv).not.toContain("--blank");
  });

  it("returns (no output) when stdout is empty", async () => {
    stubExecSuccess("  ");
    const result = await opencliModule.handle("opencli_run", { site: "bilibili", command: "hot" });
    expect(result.isError).toBeFalsy();
    expect(result.content[0].text).toBe("(no output)");
  });
});

// ---------------------------------------------------------------------------
// opencli_run — missing required args
// ---------------------------------------------------------------------------

describe("opencli_run — missing required args", () => {
  it("returns error when site is missing", async () => {
    const result = await opencliModule.handle("opencli_run", { command: "top" });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("site");
  });

  it("returns error when command is missing", async () => {
    const result = await opencliModule.handle("opencli_run", { site: "hackernews" });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("command");
  });
});

// ---------------------------------------------------------------------------
// opencli_run — error paths
// ---------------------------------------------------------------------------

describe("opencli_run — errors", () => {
  afterEach(() => { mockExecFile.mockReset(); });

  it("returns install hint when binary is not found (ENOENT)", async () => {
    stubExecError({ code: "ENOENT", message: "spawn opencli-rs ENOENT" });
    const result = await opencliModule.handle("opencli_run", { site: "hackernews", command: "top" });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("not installed");
    expect(result.content[0].text).toContain("curl");
  });

  it("returns timeout message when process is killed", async () => {
    stubExecError({ killed: true, message: "Process timeout" });
    const result = await opencliModule.handle("opencli_run", { site: "twitter", command: "timeline" });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("timed out");
  });

  it("returns stderr content on non-zero exit", async () => {
    stubExecError({ stderr: "site not supported", message: "Command failed" });
    const result = await opencliModule.handle("opencli_run", { site: "unknown", command: "hot" });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("site not supported");
  });

  it("returns stderr over stdout when both present", async () => {
    stubExecError({ stderr: "critical error", stdout: "partial output", message: "fail" });
    const result = await opencliModule.handle("opencli_run", { site: "bilibili", command: "hot" });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("critical error");
  });

  it("falls back to error.message when stderr and stdout are empty", async () => {
    stubExecError({ message: "unknown failure" });
    const result = await opencliModule.handle("opencli_run", { site: "bilibili", command: "hot" });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("unknown failure");
  });

  it("returns stderr-only stderr content as error", async () => {
    stubExecSuccess("", "some warning");
    const result = await opencliModule.handle("opencli_run", { site: "bilibili", command: "hot" });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("some warning");
  });
});

// ---------------------------------------------------------------------------
// opencli_doctor — happy path
// ---------------------------------------------------------------------------

describe("opencli_doctor — success", () => {
  afterEach(() => { mockExecFile.mockReset(); });

  it("returns doctor output on success", async () => {
    stubExecSuccess("All checks passed. Chrome extension: connected.");
    const result = await opencliModule.handle("opencli_doctor", {});
    expect(result.isError).toBeFalsy();
    expect(result.content[0].text).toContain("All checks passed");
  });

  it("appends stderr to output when present", async () => {
    stubExecSuccess("doctor output", "warning: something");
    const result = await opencliModule.handle("opencli_doctor", {});
    expect(result.content[0].text).toContain("doctor output");
    expect(result.content[0].text).toContain("warning: something");
  });
});

// ---------------------------------------------------------------------------
// opencli_doctor — errors
// ---------------------------------------------------------------------------

describe("opencli_doctor — errors", () => {
  afterEach(() => { mockExecFile.mockReset(); });

  it("returns install hint when binary not found", async () => {
    stubExecError({ code: "ENOENT", message: "spawn ENOENT" });
    const result = await opencliModule.handle("opencli_doctor", {});
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("not installed");
  });

  it("returns error detail on general failure", async () => {
    stubExecError({ stderr: "connection refused", message: "fail" });
    const result = await opencliModule.handle("opencli_doctor", {});
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("connection refused");
  });
});

// ---------------------------------------------------------------------------
// Unknown tool name
// ---------------------------------------------------------------------------

describe("opencli unknown tool", () => {
  it("throws for unknown tool name", async () => {
    await expect(opencliModule.handle("opencli_nonexistent", {})).rejects.toThrow("Unknown opencli tool");
  });
});
