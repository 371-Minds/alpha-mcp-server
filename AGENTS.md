# AGENTS.md

## Repository overview

- Runtime entrypoint: `dist/server.js`
- Source: `src/`
- Build output in `dist/` is committed to the repo
- Primary package scripts:
  - `npm run build` → TypeScript compile via `tsc`
  - `npm test` → `bun test`

## Tooling notes

- This MCP server currently runs over stdio.
- Most implementation lives in `src/tools/*.ts`.
- Each tool module exports `definitions` and `handle`.
- `src/server.ts` aggregates tool modules and routes tool calls.

## Editing guidance

- Keep changes small and focused.
- If you change TypeScript source, rebuild so `dist/` stays in sync.
- Update `README.md` when changing user-facing behavior, setup, or configuration.
- Do not commit secrets or example values that look like real credentials.

## Validation

- Run `npm run build` after code changes.
- Install Bun before running `npm test`, since the repository test script is `bun test`.
- If Bun is unavailable in the environment, note that limitation in your handoff.
