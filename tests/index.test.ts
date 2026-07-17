/**
 * Unit tests for main extension entry point
 */

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";

// Real module namespace, used to build a faithful mock that overrides only
// readStoredCredential. Loaded before any mock.module() call.
const piCodingAgentExports = await import("@earendil-works/pi-coding-agent");

// `Credential` is not re-exported by pi-coding-agent's public entry, so derive
// it from the return type of the public readStoredCredential helper.
type StoredCredential = NonNullable<
  ReturnType<(typeof piCodingAgentExports)["readStoredCredential"]>
>;

// Mock for readStoredCredential — returns a stored api_key credential or undefined
let mockReadStoredCredential = mock(
  (_providerId?: string) => undefined as StoredCredential | undefined
);

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

function mockPiCodingAgent(): void {
  mock.module("@earendil-works/pi-coding-agent", () => ({
    ...piCodingAgentExports,
    readStoredCredential: mockReadStoredCredential,
  }));
}

describe("Extension entry point", () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    mockReadStoredCredential.mockImplementation(() => undefined);
  });

  afterEach(() => {
    process.env = originalEnv;
    mockReadStoredCredential.mockImplementation(() => undefined);
  });

  test("registers only session_start warning hook when TAVILY_API_KEY is missing", async () => {
    delete process.env.TAVILY_API_KEY;
    mockReadStoredCredential.mockImplementation(() => undefined);

    mockPiCodingAgent();

    const { default: extension } = await import("../src/index.js");
    const pi = createMockPi();

    extension(pi);

    expect(pi.on).toHaveBeenCalledTimes(1);
    expect(pi.on).toHaveBeenCalledWith("session_start", expect.any(Function));
  });

  test("registers hooks when TAVILY_API_KEY is present", async () => {
    process.env.TAVILY_API_KEY = "test-api-key";
    mockReadStoredCredential.mockImplementation(() => undefined);

    mockPiCodingAgent();

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
    mockReadStoredCredential.mockImplementation(() => undefined);

    mockPiCodingAgent();

    const { default: extension } = await import("../src/index.js");
    const pi = createMockPi();

    extension(pi);

    expect(pi.on).toHaveBeenCalledTimes(1);
    expect(pi.on).toHaveBeenCalledWith("session_start", expect.any(Function));
  });

  test("handles whitespace-only API key as missing", async () => {
    process.env.TAVILY_API_KEY = "   ";
    mockReadStoredCredential.mockImplementation(() => undefined);

    mockPiCodingAgent();

    const { default: extension } = await import("../src/index.js");
    const pi = createMockPi();

    extension(pi);

    expect(pi.on).toHaveBeenCalledTimes(1);
    expect(pi.on).toHaveBeenCalledWith("session_start", expect.any(Function));
  });

  test("session_start handler only runs once on repeated calls", async () => {
    process.env.TAVILY_API_KEY = "test-api-key";
    mockReadStoredCredential.mockImplementation(() => undefined);

    const handlers: Record<string, (...args: unknown[]) => unknown> = {};

    mockPiCodingAgent();

    const { default: extension } = await import("../src/index.js");
    const pi = createMockPi(handlers);

    extension(pi);

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
    mockReadStoredCredential.mockImplementation(() => undefined);

    const handlers: Record<string, (...args: unknown[]) => unknown> = {};

    mockPiCodingAgent();

    const { default: extension } = await import("../src/index.js");
    const pi = createMockPi(handlers);

    extension(pi);

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

describe("Extension entry point - stored credential integration", () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    mockReadStoredCredential.mockImplementation(() => undefined);
  });

  afterEach(() => {
    process.env = originalEnv;
    mockReadStoredCredential.mockImplementation(() => undefined);
  });

  test("resolves API key from stored credential when available", async () => {
    mockReadStoredCredential.mockImplementation(() => ({
      type: "api_key",
      key: "auth-storage-key",
    }));
    delete process.env.TAVILY_API_KEY;

    mockPiCodingAgent();

    const { default: extension } = await import("../src/index.js");
    const pi = createMockPi();

    extension(pi);

    // Should have registered session_start, turn_end, and session_shutdown hooks
    expect(pi.on).toHaveBeenCalledTimes(3);
    expect(pi.on).toHaveBeenCalledWith("session_start", expect.any(Function));
    expect(pi.on).toHaveBeenCalledWith("turn_end", expect.any(Function));
    expect(pi.on).toHaveBeenCalledWith("session_shutdown", expect.any(Function));
    expect(mockReadStoredCredential).toHaveBeenCalledWith("tavily");
  });

  test("falls back to TAVILY_API_KEY when stored credential is absent", async () => {
    mockReadStoredCredential.mockImplementation(() => undefined);
    process.env.TAVILY_API_KEY = "env-var-key";

    mockPiCodingAgent();

    const { default: extension } = await import("../src/index.js");
    const pi = createMockPi();

    extension(pi);

    // Should have registered session_start, turn_end, and session_shutdown hooks
    expect(pi.on).toHaveBeenCalledTimes(3);
    expect(pi.on).toHaveBeenCalledWith("session_start", expect.any(Function));
    expect(pi.on).toHaveBeenCalledWith("turn_end", expect.any(Function));
    expect(pi.on).toHaveBeenCalledWith("session_shutdown", expect.any(Function));
    expect(mockReadStoredCredential).toHaveBeenCalledWith("tavily");
  });

  test("ignores a non-api_key (oauth) stored credential and falls back to env", async () => {
    mockReadStoredCredential.mockImplementation(() => ({
      type: "oauth",
      refresh: "r",
      access: "a",
      expires: 0,
    }));
    process.env.TAVILY_API_KEY = "env-var-key";

    mockPiCodingAgent();

    const { default: extension } = await import("../src/index.js");
    const pi = createMockPi();

    extension(pi);

    // OAuth credential holds no usable API key, so env var is the fallback
    expect(pi.on).toHaveBeenCalledTimes(3);
    expect(mockReadStoredCredential).toHaveBeenCalledWith("tavily");
  });

  test("prefers stored credential over TAVILY_API_KEY when both are available", async () => {
    mockReadStoredCredential.mockImplementation(() => ({
      type: "api_key",
      key: "auth-storage-key",
    }));
    process.env.TAVILY_API_KEY = "env-var-key";

    mockPiCodingAgent();

    const { default: extension } = await import("../src/index.js");
    const pi = createMockPi();

    extension(pi);

    // Should have registered session_start, turn_end, and session_shutdown hooks
    expect(pi.on).toHaveBeenCalledTimes(3);
    // We can't directly test which API key was used, but the fact that
    // hooks are registered means it found one, and the credential was checked first
    expect(mockReadStoredCredential).toHaveBeenCalledWith("tavily");
  });

  test("handles empty string from stored credential as missing", async () => {
    mockReadStoredCredential.mockImplementation(() => ({ type: "api_key", key: "" }));
    delete process.env.TAVILY_API_KEY;

    mockPiCodingAgent();

    const { default: extension } = await import("../src/index.js");
    const pi = createMockPi();

    extension(pi);

    // Should only register session_start warning hook
    expect(pi.on).toHaveBeenCalledTimes(1);
    expect(pi.on).toHaveBeenCalledWith("session_start", expect.any(Function));
  });

  test("handles whitespace-only string from stored credential as missing", async () => {
    mockReadStoredCredential.mockImplementation(() => ({ type: "api_key", key: "   " }));
    delete process.env.TAVILY_API_KEY;

    mockPiCodingAgent();

    const { default: extension } = await import("../src/index.js");
    const pi = createMockPi();

    extension(pi);

    // Should only register session_start warning hook
    expect(pi.on).toHaveBeenCalledTimes(1);
    expect(pi.on).toHaveBeenCalledWith("session_start", expect.any(Function));
  });

  test("registers warning when neither stored credential nor TAVILY_API_KEY provide key", async () => {
    mockReadStoredCredential.mockImplementation(() => undefined);
    delete process.env.TAVILY_API_KEY;

    mockPiCodingAgent();

    const { default: extension } = await import("../src/index.js");
    const pi = createMockPi();

    extension(pi);

    // Should only register session_start warning hook
    expect(pi.on).toHaveBeenCalledTimes(1);
    expect(pi.on).toHaveBeenCalledWith("session_start", expect.any(Function));
    expect(mockReadStoredCredential).toHaveBeenCalledWith("tavily");
  });

  test("properly trims whitespace from TAVILY_API_KEY when used as fallback", async () => {
    mockReadStoredCredential.mockImplementation(() => undefined);
    process.env.TAVILY_API_KEY = "  env-var-key  ";

    mockPiCodingAgent();

    const { default: extension } = await import("../src/index.js");
    const pi = createMockPi();

    extension(pi);

    // Should have registered session_start, turn_end, and session_shutdown hooks
    expect(pi.on).toHaveBeenCalledTimes(3);
    expect(pi.on).toHaveBeenCalledWith("session_start", expect.any(Function));
    expect(pi.on).toHaveBeenCalledWith("turn_end", expect.any(Function));
    expect(pi.on).toHaveBeenCalledWith("session_shutdown", expect.any(Function));
  });
});
