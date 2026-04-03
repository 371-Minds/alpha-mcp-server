import { describe, it, expect } from "vitest";
import { ok, err, missingEnv } from "../src/types.js";

describe("ok", () => {
  it("returns content array with the supplied text", () => {
    const result = ok("hello");
    expect(result.content).toEqual([{ type: "text", text: "hello" }]);
  });

  it("does not set isError", () => {
    const result = ok("hello");
    expect(result.isError).toBeUndefined();
  });
});

describe("err", () => {
  it("returns content array with the supplied text", () => {
    const result = err("oops");
    expect(result.content).toEqual([{ type: "text", text: "oops" }]);
  });

  it("sets isError to true", () => {
    const result = err("oops");
    expect(result.isError).toBe(true);
  });
});

describe("missingEnv", () => {
  it("includes each variable name in the message", () => {
    const result = missingEnv("FOO", "BAR");
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("FOO");
    expect(result.content[0].text).toContain("BAR");
  });

  it("mentions 'environment variable' in the message", () => {
    const result = missingEnv("MY_VAR");
    expect(result.content[0].text).toMatch(/environment variable/i);
  });

  it("works with a single variable", () => {
    const result = missingEnv("SINGLE");
    expect(result.content[0].text).toContain("SINGLE");
  });
});
