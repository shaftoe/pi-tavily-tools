/**
 * Unit tests for main extension entry point
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";

// Mock the dependencies
mock.module("../src/tools/tavily/client.js", () => ({
  createTavilyClient: mock(() => ({ search: mock(), extract: mock() })),
}));

mock.module("../src/tools/web-search.js", () => ({
  registerWebSearchTool: mock(() => {}),
}));

mock.module("../src/tools/web-extract.js", () => ({
  registerWebExtractTool: mock(() => {}),
}));

mock.module("../src/usage/status.js", () => ({
  TavilyUsageCache: mock(function (apiKey: string) {
    return {
      updateStatus: mock(async () => {}),
      clear: mock(() => {}),
    };
  }),
}));

describe("Extension entry point", () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  function createMockPi(): ExtensionAPI {
    return {
      on: mock((event: string, handler: () => void) => {}),
    } as unknown as ExtensionAPI;
  }

  test("does not register hooks when TAVILY_API_KEY is missing", () => {
    delete process.env.TAVILY_API_KEY;

    const extension = await import("../src/index.js");
    const pi = createMockPi();

    // @ts-expect-error - default is the default export
    extension.default(pi);

    // Should have called on() zero times since API key is missing
    expect(pi.on).toHaveBeenCalledTimes(0);
  });

  test("registers hooks when TAVILY_API_KEY is present", async () => {
    process.env.TAVILY_API_KEY = "test-api-key";

    const extension = await import("../src/index.js");
    const pi = createMockPi();

    // @ts-expect-error - default is the default export
    extension.default(pi);

    // Should have registered session_start, turn_end, and session_shutdown hooks
    expect(pi.on).toHaveBeenCalledTimes(3);
    expect(pi.on).toHaveBeenCalledWith("session_start", expect.any(Function));
    expect(pi.on).toHaveBeenCalledWith("turn_end", expect.any(Function));
    expect(pi.on).toHaveBeenCalledWith("session_shutdown", expect.any(Function));
  });

  test("handles empty string API key as missing", async () => {
    process.env.TAVILY_API_KEY = "";

    const extension = await import("../src/index.js");
    const pi = createMockPi();

    // @ts-expect-error - default is the default export
    extension.default(pi);

    expect(pi.on).toHaveBeenCalledTimes(0);
  });

  test("handles whitespace-only API key as missing", async () => {
    process.env.TAVILY_API_KEY = "   ";

    const extension = await import("../src/index.js");
    const pi = createMockPi();

    // @ts-expect-error - default is the default export
    extension.default(pi);

    expect(pi.on).toHaveBeenCalledTimes(0);
  });

  test("session_start handler registers tools only once", async () => {
    process.env.TAVILY_API_KEY = "test-api-key";

    const { createTavilyClient } = await import("../src/tools/tavily/client.js");
    const { registerWebSearchTool } = await import("../src/tools/web-search.js");
    const { registerWebExtractTool } = await import("../src/tools/web-extract.js");
    const { TavilyUsageCache } = await import("../src/usage/status.js");

    const extension = await import("../src/index.js");
    const pi = createMockPi();
    const sessionStartHandler = mock();
    const turnEndHandler = mock();
    const shutdownHandler = mock();

    pi.on = mock((event: string, handler: any) => {
      if (event === "session_start") sessionStartHandler.mockImplementation(handler);
      if (event === "turn_end") turnEndHandler.mockImplementation(handler);
      if (event === "session_shutdown") shutdownHandler.mockImplementation(handler);
    });

    // @ts-expect-error - default is the default export
    extension.default(pi);

    // Call session_start twice
    await sessionStartHandler({}, { cwd: "/tmp" });
    await sessionStartHandler({}, { cwd: "/tmp" });

    // Tools should only be registered once
    expect(createTavilyClient).toHaveBeenCalledTimes(1);
    expect(registerWebSearchTool).toHaveBeenCalledTimes(1);
    expect(registerWebExtractTool).toHaveBeenCalledTimes(1);
  });

  test("session_start handler updates usage cache", async () => {
    process.env.TAVILY_API_KEY = "test-api-key";

    const extension = await import("../src/index.js");
    const pi = createMockPi();
    const sessionStartHandler = mock();
    const mockCtx = { cwd: "/tmp" };
    let updateStatusMock: ReturnType<typeof mock>;

    pi.on = mock((event: string, handler: any) => {
      if (event === "session_start") {
        const { TavilyUsageCache } = require("../src/usage/status.js");
        const mockCache = {
          updateStatus: mock(async () => {}),
          clear: mock(() => {}),
        };
        updateStatusMock = mockCache.updateStatus;

        // Override the TavilyUsageCache constructor to return our mock
        // @ts-expect-error - mocking
        TavilyUsageCache.mockImplementation(() => mockCache);

        sessionStartHandler.mockImplementation(handler);
      }
    });

    // @ts-expect-error - default is the default export
    extension.default(pi);

    await sessionStartHandler({}, mockCtx);

    expect(updateStatusMock).toHaveBeenCalledWith(mockCtx);
  });

  test("turn_end handler updates usage cache", async () => {
    process.env.TAVILY_API_KEY = "test-api-key";

    const extension = await import("../src/index.js");
    const pi = createMockPi();
    const turnEndHandler = mock();
    const mockCtx = { cwd: "/tmp" };
    let updateStatusMock: ReturnType<typeof mock>;

    pi.on = mock((event: string, handler: any) => {
      if (event === "turn_end") {
        const { TavilyUsageCache } = require("../src/usage/status.js");
        const mockCache = {
          updateStatus: mock(async () => {}),
          clear: mock(() => {}),
        };
        updateStatusMock = mockCache.updateStatus;

        // Override the TavilyUsageCache constructor to return our mock
        // @ts-expect-error - mocking
        TavilyUsageCache.mockImplementation(() => mockCache);

        turnEndHandler.mockImplementation(handler);
      }
    });

    // @ts-expect-error - default is the default export
    extension.default(pi);

    await turnEndHandler({}, mockCtx);

    expect(updateStatusMock).toHaveBeenCalledWith(mockCtx);
  });

  test("session_shutdown handler clears usage cache", async () => {
    process.env.TAVILY_API_KEY = "test-api-key";

    const extension = await import("../src/index.js");
    const pi = createMockPi();
    const shutdownHandler = mock();
    const mockCtx = { cwd: "/tmp" };
    let clearMock: ReturnType<typeof mock>;

    pi.on = mock((event: string, handler: any) => {
      if (event === "session_shutdown") {
        const { TavilyUsageCache } = require("../src/usage/status.js");
        const mockCache = {
          updateStatus: mock(async () => {}),
          clear: mock(() => {}),
        };
        clearMock = mockCache.clear;

        // Override the TavilyUsageCache constructor to return our mock
        // @ts-expect-error - mocking
        TavilyUsageCache.mockImplementation(() => mockCache);

        shutdownHandler.mockImplementation(handler);
      }
    });

    // @ts-expect-error - default is the default export
    extension.default(pi);

    shutdownHandler({}, mockCtx);

    expect(clearMock).toHaveBeenCalledWith(mockCtx);
  });

  test("usage cache is initialized with API key", async () => {
    process.env.TAVILY_API_KEY = "test-api-key";

    const extension = await import("../src/index.js");
    const pi = createMockPi();

    pi.on = mock(() => {});

    // @ts-expect-error - default is the default export
    extension.default(pi);

    const { TavilyUsageCache } = await import("../src/usage/status.js");

    // The cache should be instantiated with the API key
    expect(TavilyUsageCache).toHaveBeenCalledWith("test-api-key");
  });
});
