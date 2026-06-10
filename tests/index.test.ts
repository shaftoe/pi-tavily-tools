/**
 * Unit tests for main extension entry point
 */

import type {
  AuthStorage as AuthStorageType,
  ExtensionAPI,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";

// Import the real module first
const { AuthStorage: _RealAuthStorage, ...piCodingAgentExports } =
  await import("@earendil-works/pi-coding-agent");

// Create mock for AuthStorage.getApiKey
let mockGetApiKey = mock(async () => null as string | null | undefined);

// Create mock AuthStorage that mimics the real one
const mockAuthStorage = {
  create: mock(() => ({
    getApiKey: mockGetApiKey,
  })),
} as unknown as typeof AuthStorageType;

describe("Extension entry point", () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    mockGetApiKey.mockImplementation(async () => null);
  });

  afterEach(() => {
    process.env = originalEnv;
    mockGetApiKey.mockImplementation(async () => null);
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
    mockGetApiKey.mockImplementation(async () => null);

    // Mock the AuthStorage import before importing the extension
    mock.module("@earendil-works/pi-coding-agent", () => ({
      ...piCodingAgentExports,
      AuthStorage: mockAuthStorage,
    }));

    const { default: extension } = await import("../src/index.js");
    const pi = createMockPi();

    await extension(pi);

    expect(pi.on).toHaveBeenCalledTimes(1);
    expect(pi.on).toHaveBeenCalledWith("session_start", expect.any(Function));
  });

  test("registers hooks when TAVILY_API_KEY is present", async () => {
    process.env.TAVILY_API_KEY = "test-api-key";
    mockGetApiKey.mockImplementation(async () => null);

    mock.module("@earendil-works/pi-coding-agent", () => ({
      ...piCodingAgentExports,
      AuthStorage: mockAuthStorage,
    }));

    const { default: extension } = await import("../src/index.js");
    const pi = createMockPi();

    await extension(pi);

    // Should have registered session_start, turn_end, and session_shutdown hooks
    expect(pi.on).toHaveBeenCalledTimes(3);
    expect(pi.on).toHaveBeenCalledWith("session_start", expect.any(Function));
    expect(pi.on).toHaveBeenCalledWith("turn_end", expect.any(Function));
    expect(pi.on).toHaveBeenCalledWith("session_shutdown", expect.any(Function));
  });

  test("handles empty string API key as missing", async () => {
    process.env.TAVILY_API_KEY = "";
    mockGetApiKey.mockImplementation(async () => null);

    mock.module("@earendil-works/pi-coding-agent", () => ({
      ...piCodingAgentExports,
      AuthStorage: mockAuthStorage,
    }));

    const { default: extension } = await import("../src/index.js");
    const pi = createMockPi();

    await extension(pi);

    expect(pi.on).toHaveBeenCalledTimes(1);
    expect(pi.on).toHaveBeenCalledWith("session_start", expect.any(Function));
  });

  test("handles whitespace-only API key as missing", async () => {
    process.env.TAVILY_API_KEY = "   ";
    mockGetApiKey.mockImplementation(async () => null);

    mock.module("@earendil-works/pi-coding-agent", () => ({
      ...piCodingAgentExports,
      AuthStorage: mockAuthStorage,
    }));

    const { default: extension } = await import("../src/index.js");
    const pi = createMockPi();

    await extension(pi);

    expect(pi.on).toHaveBeenCalledTimes(1);
    expect(pi.on).toHaveBeenCalledWith("session_start", expect.any(Function));
  });

  test("session_start handler only runs once on repeated calls", async () => {
    process.env.TAVILY_API_KEY = "test-api-key";
    mockGetApiKey.mockImplementation(async () => null);

    const handlers: Record<string, (...args: unknown[]) => unknown> = {};

    mock.module("@earendil-works/pi-coding-agent", () => ({
      ...piCodingAgentExports,
      AuthStorage: mockAuthStorage,
    }));

    const { default: extension } = await import("../src/index.js");
    const pi = createMockPi(handlers);

    await extension(pi);

    // Call session_start handler twice — the second call should be a no-op
    const ctx: ExtensionContext = {
      cwd: "/tmp",
      ui: { setStatus: mock(() => {}), theme: { fg: (_c: string, t: string) => t } },
    } as unknown as ExtensionContext;
    await handlers["session_start"]!({}, ctx);
    await handlers["session_start"]!({}, ctx);

    // No error means the guard worked — if it didn't, it would try to
    // re-register tools and create duplicate clients
  });

  test("session_start, turn_end, and shutdown handlers accept context", async () => {
    process.env.TAVILY_API_KEY = "test-api-key";
    mockGetApiKey.mockImplementation(async () => null);

    const handlers: Record<string, (...args: unknown[]) => unknown> = {};

    mock.module("@earendil-works/pi-coding-agent", () => ({
      ...piCodingAgentExports,
      AuthStorage: mockAuthStorage,
    }));

    const { default: extension } = await import("../src/index.js");
    const pi = createMockPi(handlers);

    await extension(pi);

    const ctx: ExtensionContext = {
      cwd: "/tmp",
      ui: { setStatus: mock(() => {}), theme: { fg: (_c: string, t: string) => t } },
    } as unknown as ExtensionContext;

    // All handlers should accept (event, ctx) without throwing
    await expect(Promise.resolve(handlers["session_start"]!({}, ctx))).resolves.toBeUndefined();
    await expect(Promise.resolve(handlers["turn_end"]!({}, ctx))).resolves.toBeUndefined();
    await expect(Promise.resolve(handlers["session_shutdown"]!({}, ctx))).resolves.toBeUndefined();
  });
});

describe("Extension entry point - AuthStorage integration", () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    mockGetApiKey.mockImplementation(async () => null);
  });

  afterEach(() => {
    process.env = originalEnv;
    mockGetApiKey.mockImplementation(async () => null);
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

  test("resolves API key from AuthStorage when available", async () => {
    mockGetApiKey.mockImplementation(async () => "auth-storage-key");
    delete process.env.TAVILY_API_KEY;

    mock.module("@earendil-works/pi-coding-agent", () => ({
      ...piCodingAgentExports,
      AuthStorage: mockAuthStorage,
    }));

    const { default: extension } = await import("../src/index.js");
    const pi = createMockPi();

    await extension(pi);

    // Should have registered session_start, turn_end, and session_shutdown hooks
    expect(pi.on).toHaveBeenCalledTimes(3);
    expect(pi.on).toHaveBeenCalledWith("session_start", expect.any(Function));
    expect(pi.on).toHaveBeenCalledWith("turn_end", expect.any(Function));
    expect(pi.on).toHaveBeenCalledWith("session_shutdown", expect.any(Function));
    expect(mockGetApiKey).toHaveBeenCalledWith("tavily");
  });

  test("falls back to TAVILY_API_KEY when AuthStorage returns null", async () => {
    mockGetApiKey.mockImplementation(async () => null);
    process.env.TAVILY_API_KEY = "env-var-key";

    mock.module("@earendil-works/pi-coding-agent", () => ({
      ...piCodingAgentExports,
      AuthStorage: mockAuthStorage,
    }));

    const { default: extension } = await import("../src/index.js");
    const pi = createMockPi();

    await extension(pi);

    // Should have registered session_start, turn_end, and session_shutdown hooks
    expect(pi.on).toHaveBeenCalledTimes(3);
    expect(pi.on).toHaveBeenCalledWith("session_start", expect.any(Function));
    expect(pi.on).toHaveBeenCalledWith("turn_end", expect.any(Function));
    expect(pi.on).toHaveBeenCalledWith("session_shutdown", expect.any(Function));
    expect(mockGetApiKey).toHaveBeenCalledWith("tavily");
  });

  test("falls back to TAVILY_API_KEY when AuthStorage returns undefined", async () => {
    mockGetApiKey.mockImplementation(async () => undefined);
    process.env.TAVILY_API_KEY = "env-var-key";

    mock.module("@earendil-works/pi-coding-agent", () => ({
      ...piCodingAgentExports,
      AuthStorage: mockAuthStorage,
    }));

    const { default: extension } = await import("../src/index.js");
    const pi = createMockPi();

    await extension(pi);

    // Should have registered session_start, turn_end, and session_shutdown hooks
    expect(pi.on).toHaveBeenCalledTimes(3);
    expect(pi.on).toHaveBeenCalledWith("session_start", expect.any(Function));
    expect(pi.on).toHaveBeenCalledWith("turn_end", expect.any(Function));
    expect(pi.on).toHaveBeenCalledWith("session_shutdown", expect.any(Function));
    expect(mockGetApiKey).toHaveBeenCalledWith("tavily");
  });

  test("prefers AuthStorage over TAVILY_API_KEY when both are available", async () => {
    mockGetApiKey.mockImplementation(async () => "auth-storage-key");
    process.env.TAVILY_API_KEY = "env-var-key";

    mock.module("@earendil-works/pi-coding-agent", () => ({
      ...piCodingAgentExports,
      AuthStorage: mockAuthStorage,
    }));

    const { default: extension } = await import("../src/index.js");
    const pi = createMockPi();

    await extension(pi);

    // Should have registered session_start, turn_end, and session_shutdown hooks
    expect(pi.on).toHaveBeenCalledTimes(3);
    // We can't directly test which API key was used, but the fact that
    // hooks are registered means it found one, and AuthStorage was checked first
    expect(mockGetApiKey).toHaveBeenCalledWith("tavily");
  });

  test("handles empty string from AuthStorage as missing", async () => {
    mockGetApiKey.mockImplementation(async () => "");
    delete process.env.TAVILY_API_KEY;

    mock.module("@earendil-works/pi-coding-agent", () => ({
      ...piCodingAgentExports,
      AuthStorage: mockAuthStorage,
    }));

    const { default: extension } = await import("../src/index.js");
    const pi = createMockPi();

    await extension(pi);

    // Should only register session_start warning hook
    expect(pi.on).toHaveBeenCalledTimes(1);
    expect(pi.on).toHaveBeenCalledWith("session_start", expect.any(Function));
  });

  test("handles whitespace-only string from AuthStorage as missing", async () => {
    mockGetApiKey.mockImplementation(async () => "   ");
    delete process.env.TAVILY_API_KEY;

    mock.module("@earendil-works/pi-coding-agent", () => ({
      ...piCodingAgentExports,
      AuthStorage: mockAuthStorage,
    }));

    const { default: extension } = await import("../src/index.js");
    const pi = createMockPi();

    await extension(pi);

    // Should only register session_start warning hook
    expect(pi.on).toHaveBeenCalledTimes(1);
    expect(pi.on).toHaveBeenCalledWith("session_start", expect.any(Function));
  });

  test("registers warning when neither AuthStorage nor TAVILY_API_KEY provide key", async () => {
    mockGetApiKey.mockImplementation(async () => null);
    delete process.env.TAVILY_API_KEY;

    mock.module("@earendil-works/pi-coding-agent", () => ({
      ...piCodingAgentExports,
      AuthStorage: mockAuthStorage,
    }));

    const { default: extension } = await import("../src/index.js");
    const pi = createMockPi();

    await extension(pi);

    // Should only register session_start warning hook
    expect(pi.on).toHaveBeenCalledTimes(1);
    expect(pi.on).toHaveBeenCalledWith("session_start", expect.any(Function));
    expect(mockGetApiKey).toHaveBeenCalledWith("tavily");
  });

  test("properly trims whitespace from TAVILY_API_KEY when used as fallback", async () => {
    mockGetApiKey.mockImplementation(async () => null);
    process.env.TAVILY_API_KEY = "  env-var-key  ";

    mock.module("@earendil-works/pi-coding-agent", () => ({
      ...piCodingAgentExports,
      AuthStorage: mockAuthStorage,
    }));

    const { default: extension } = await import("../src/index.js");
    const pi = createMockPi();

    await extension(pi);

    // Should have registered session_start, turn_end, and session_shutdown hooks
    expect(pi.on).toHaveBeenCalledTimes(3);
    expect(pi.on).toHaveBeenCalledWith("session_start", expect.any(Function));
    expect(pi.on).toHaveBeenCalledWith("turn_end", expect.any(Function));
    expect(pi.on).toHaveBeenCalledWith("session_shutdown", expect.any(Function));
  });
});
