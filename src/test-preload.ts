/**
 * Bun test preload — patches child_process.execFile with a mock before any module
 * loads. This is necessary because bun's mock.module() cannot intercept built-in
 * module imports that are captured at module-evaluation time (e.g., promisify).
 *
 * The mock is exposed via globalThis.__execFileMock so opencli.test.ts can
 * configure it per-test without re-importing child_process.
 */
import { mock } from "bun:test";

const cp = require("child_process") as typeof import("child_process");
const execFileMock = mock();
(cp as any).execFile = execFileMock;
(globalThis as any).__execFileMock = execFileMock;
