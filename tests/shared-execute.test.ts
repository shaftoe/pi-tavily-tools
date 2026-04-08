/**
 * Unit tests for shared execute helpers
 */

import type {
  AgentToolUpdateCallback,
  ExtensionContext,
  SessionEntry,
  TruncationResult,
} from "@mariozechner/pi-coding-agent";
import { describe, expect, mock, test } from "bun:test";
import { buildToolResult, raceAbort, sendProgress } from "../src/tools/shared/execute.js";

describe("raceAbort", () => {
  test("resolves with promise value when no signal", async () => {
    const result = await raceAbort(Promise.resolve(42), undefined);
    expect(result).toBe(42);
  });

  test("resolves with promise value when signal not aborted", async () => {
    const controller = new AbortController();
    const result = await raceAbort(Promise.resolve("ok"), controller.signal);
    expect(result).toBe("ok");
  });

  test("rejects immediately when signal already aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(raceAbort(Promise.resolve("ok"), controller.signal)).rejects.toThrow(
      "Tool call aborted"
    );
  });

  test("rejects when signal is aborted after call starts", async () => {
    const controller = new AbortController();
    const never = new Promise<string>(() => {});
    const race = raceAbort(never, controller.signal);
    controller.abort();
    await expect(race).rejects.toThrow("Tool call aborted");
  });

  test("propagates underlying promise rejection", async () => {
    const result = raceAbort(Promise.reject(new Error("API error")), undefined);
    await expect(result).rejects.toThrow("API error");
  });
});

describe("sendProgress", () => {
  test("calls onUpdate with progress message", () => {
    const onUpdate = mock((_update: unknown) => {}) as AgentToolUpdateCallback;

    sendProgress(onUpdate, "Processing request...");

    expect(onUpdate).toHaveBeenCalledTimes(1);
    expect(onUpdate).toHaveBeenCalledWith({
      content: [{ type: "text", text: "Processing request..." }],
      details: {},
    });
  });

  test("does nothing when onUpdate is undefined", () => {
    // Should not throw
    expect(() => sendProgress(undefined, "Test message")).not.toThrow();
  });

  test("handles empty progress message", () => {
    const onUpdate = mock((_update: unknown) => {}) as AgentToolUpdateCallback;

    sendProgress(onUpdate, "");

    expect(onUpdate).toHaveBeenCalledWith({
      content: [{ type: "text", text: "" }],
      details: {},
    });
  });

  test("handles long progress message", () => {
    const onUpdate = mock((_update: unknown) => {}) as AgentToolUpdateCallback;
    const longMessage = "A".repeat(1000);

    sendProgress(onUpdate, longMessage);

    expect(onUpdate).toHaveBeenCalledWith({
      content: [{ type: "text", text: longMessage }],
      details: {},
    });
  });
});

describe("buildToolResult", () => {
  function mockCtx(): ExtensionContext {
    return {
      cwd: "/tmp",
      sessionManager: {
        getEntry: mock(() => undefined as SessionEntry | undefined),
        getAll: mock(() => ({})),
      },
    } as unknown as ExtensionContext;
  }

  test("builds tool result with content and details", async () => {
    const ctx = mockCtx();
    const fullOutput = "Full output content";
    const toolName = "test-tool";

    const result = await buildToolResult(
      fullOutput,
      ctx,
      toolName,
      (truncation, fullOutputPath) => ({
        message: "Details built",
        truncation,
        fullOutputPath,
      })
    );

    expect(result.content).toEqual([{ type: "text", text: fullOutput }]);
    expect(result.details).toEqual({
      message: "Details built",
      truncation: undefined,
      fullOutputPath: undefined,
    });
  });

  test("passes truncation result to buildDetails callback", async () => {
    const ctx = mockCtx();
    const fullOutput = "a".repeat(60000);
    const toolName = "test-tool";

    const result = await buildToolResult(
      fullOutput,
      ctx,
      toolName,
      (truncation, fullOutputPath) => ({
        truncation,
        fullOutputPath,
      })
    );

    expect(result.details.truncation).toBeDefined();
    expect(result.details.truncation?.truncated).toBe(true);
    expect(result.details.fullOutputPath).toBeDefined();
  });

  test("handles content that needs truncation", async () => {
    const ctx = mockCtx();
    const fullOutput = "a".repeat(60000); // Exceeds 50KB limit
    const toolName = "test-tool";

    const result = await buildToolResult(
      fullOutput,
      ctx,
      toolName,
      (truncation, fullOutputPath) => ({
        message: "Large content",
        truncation,
        fullOutputPath,
      })
    );

    expect(result.content).toHaveLength(1);
    expect(result.content[0]!.type).toBe("text");
    expect(result.details.truncation).toBeDefined();
    expect(result.details.truncation?.truncated).toBe(true);
    expect(result.details.fullOutputPath).toBeDefined();
  });

  test("handles content that does not need truncation", async () => {
    const ctx = mockCtx();
    const fullOutput = "Short content";
    const toolName = "test-tool";

    const result = await buildToolResult(
      fullOutput,
      ctx,
      toolName,
      (truncation, fullOutputPath) => ({
        message: "Small content",
        truncation,
        fullOutputPath,
      })
    );

    expect(result.content[0]!.text).toBe("Short content");
    expect(result.details.truncation).toBeUndefined();
    expect(result.details.fullOutputPath).toBeUndefined();
  });

  test("handles empty output", async () => {
    const ctx = mockCtx();
    const fullOutput = "";
    const toolName = "test-tool";

    const result = await buildToolResult(
      fullOutput,
      ctx,
      toolName,
      (truncation, fullOutputPath) => ({
        empty: true,
        truncation,
        fullOutputPath,
      })
    );

    expect(result.content[0]!.text).toBe("");
    expect(result.details.empty).toBe(true);
  });

  test("assembles content type correctly", async () => {
    const ctx = mockCtx();
    const fullOutput = "Test content";
    const toolName = "test-tool";

    const result = await buildToolResult(fullOutput, ctx, toolName, () => ({ key: "value" }));

    expect(Array.isArray(result.content)).toBe(true);
    expect(result.content).toHaveLength(1);
    expect(result.content[0]).toEqual({ type: "text", text: fullOutput });
  });

  test("buildDetails receives undefined for no truncation", async () => {
    const ctx = mockCtx();
    const fullOutput = "Short";
    const toolName = "test-tool";

    let receivedTruncation: TruncationResult | undefined;
    let receivedPath: string | undefined;

    await buildToolResult(fullOutput, ctx, toolName, (truncation, fullOutputPath) => {
      receivedTruncation = truncation;
      receivedPath = fullOutputPath;
      return {};
    });

    expect(receivedTruncation).toBeUndefined();
    expect(receivedPath).toBeUndefined();
  });

  test("buildDetails receives truncation and path when truncated", async () => {
    const ctx = mockCtx();
    const fullOutput = "a".repeat(60000);
    const toolName = "test-tool";

    let receivedTruncation: TruncationResult | undefined;
    let receivedPath: string | undefined;

    await buildToolResult(fullOutput, ctx, toolName, (truncation, fullOutputPath) => {
      receivedTruncation = truncation;
      receivedPath = fullOutputPath;
      return {};
    });

    expect(receivedTruncation).toBeDefined();
    expect(receivedTruncation?.truncated).toBe(true);
    expect(receivedPath).toBeDefined();
    expect(typeof receivedPath).toBe("string");
  });

  test("builds typed details correctly", async () => {
    const ctx = mockCtx();
    const fullOutput = "Content";
    const toolName = "test-tool";

    interface TestDetails {
      count: number;
      name: string;
      timestamp: number;
    }

    const result = await buildToolResult<TestDetails>(fullOutput, ctx, toolName, () => ({
      count: 42,
      name: "test",
      timestamp: Date.now(),
    }));

    expect(result.details.count).toBe(42);
    expect(result.details.name).toBe("test");
    expect(typeof result.details.timestamp).toBe("number");
  });

  test("uses tool name in output filename when truncated", async () => {
    const ctx = mockCtx();
    const fullOutput = "a".repeat(60000);
    const toolName = "my-custom-tool";

    const result = await buildToolResult(
      fullOutput,
      ctx,
      toolName,
      (_truncation, fullOutputPath) => ({
        toolName,
        fullOutputPath,
      })
    );

    expect(result.details.fullOutputPath).toContain("my-custom-tool");
    expect(result.details.fullOutputPath).toMatch(/\.txt$/);
  });

  test("handles Unicode content correctly", async () => {
    const ctx = mockCtx();
    const fullOutput = "Hello 世界 🌍 Привет مرحبا";
    const toolName = "test-tool";

    const result = await buildToolResult(fullOutput, ctx, toolName, (truncation) => ({
      originalLength: fullOutput.length,
      hasEmoji: fullOutput.includes("🌍"),
      truncation,
    }));

    expect(result.details.originalLength).toBeGreaterThan(0);
    expect(result.details.hasEmoji).toBe(true);
  });
});
