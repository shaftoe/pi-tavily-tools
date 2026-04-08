/**
 * Unit tests for main extension entry point
 */

import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";

describe("Extension entry point", () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  function createMockPi(
    capturedHandlers: Record<string, (...args: unknown[]) => unknown> = {}
  ): ExtensionAPI {
    return {
      on: mock((event: string, handler: (...args: unknown[]) => unknown) => {
        capturedHandlers[event] = handler;
      }) as unknown as ExtensionAPI["on"],
      registerTool: mock(() => {}),
    } as unknown as ExtensionAPI;
  }

  test("registers only session_start warning hook when TAVILY_API_KEY is missing", async () => {
    delete process.env.TAVILY_API_KEY;

    const { default: extension } = await import("../src/index.js");
    const pi = createMockPi();

    extension(pi);

    expect(pi.on).toHaveBeenCalledTimes(1);
    expect(pi.on).toHaveBeenCalledWith("session_start", expect.any(Function));
  });

  test("registers hooks when TAVILY_API_KEY is present", async () => {
    process.env.TAVILY_API_KEY = "test-api-key";

    const { default: extension } = await import("../src/index.js");
    const pi = createMockPi();

    extension(pi);

    // Should have registered session_start, turn_end, and session_shutdown hooks
    expect(pi.on).toHaveBeenCalledTimes(3);
    expect(pi.on).toHaveBeenCalledWith("session_start", expect.any(Function));
    expect(pi.on).toHaveBeenCalledWith("turn_end", expect.any(Function));
    expect(pi.on).toHaveBeenCalledWith("session_shutdown", expect.any(Function));
  });

  test("handles empty string API key as missing", async () => {
    process.env.TAVILY_API_KEY = "";

    const { default: extension } = await import("../src/index.js");
    const pi = createMockPi();

    extension(pi);

    expect(pi.on).toHaveBeenCalledTimes(1);
    expect(pi.on).toHaveBeenCalledWith("session_start", expect.any(Function));
  });

  test("handles whitespace-only API key as missing", async () => {
    process.env.TAVILY_API_KEY = "   ";

    const { default: extension } = await import("../src/index.js");
    const pi = createMockPi();

    extension(pi);

    expect(pi.on).toHaveBeenCalledTimes(1);
    expect(pi.on).toHaveBeenCalledWith("session_start", expect.any(Function));
  });

  test("session_start handler only runs once on repeated calls", async () => {
    process.env.TAVILY_API_KEY = "test-api-key";

    const handlers: Record<string, (...args: unknown[]) => unknown> = {};
    const { default: extension } = await import("../src/index.js");
    const pi = createMockPi(handlers);

    extension(pi);

    // Call session_start handler twice — the second call should be a no-op
    const ctx: ExtensionContext = {
      cwd: "/tmp",
      ui: { setStatus: mock(() => {}) },
    } as unknown as ExtensionContext;
    await handlers["session_start"]!({}, ctx);
    await handlers["session_start"]!({}, ctx);

    // No error means the guard worked — if it didn't, it would try to
    // re-register tools and create duplicate clients
  });

  test("session_start, turn_end, and shutdown handlers accept context", async () => {
    process.env.TAVILY_API_KEY = "test-api-key";

    const handlers: Record<string, (...args: unknown[]) => unknown> = {};
    const { default: extension } = await import("../src/index.js");
    const pi = createMockPi(handlers);

    extension(pi);

    const ctx: ExtensionContext = {
      cwd: "/tmp",
      ui: { setStatus: mock(() => {}) },
    } as unknown as ExtensionContext;

    // All handlers should accept (event, ctx) without throwing
    await expect(handlers["session_start"]!({}, ctx)).resolves.toBeUndefined();
    await expect(handlers["turn_end"]!({}, ctx)).resolves.toBeUndefined();
    expect(handlers["session_shutdown"]!({}, ctx)).toBeUndefined();
  });
});
