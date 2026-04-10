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
import { Temporal } from "temporal-polyfill";
import {
  buildToolResult,
  isRateLimitError,
  raceAbort,
  sanitizeError,
  sendProgress,
  withRetry,
} from "../src/tools/shared/execute.js";

describe("sanitizeError", () => {
  test("redacts Tavily API key in error message", () => {
    const error = new Error("Request failed: tvly-abc123XYZ-secretkey");
    expect(sanitizeError(error).message).toBe("Request failed: [REDACTED]");
  });

  test("redacts Authorization header value", () => {
    const error = new Error("Failed: Authorization: Bearer tvly-secret");
    expect(sanitizeError(error).message).toBe("Failed: Authorization: [REDACTED]");
  });

  test("redacts x-api-key header value", () => {
    const error = new Error("x-api-key: tvly-secret caused failure");
    expect(sanitizeError(error).message).toBe("x-api-key: [REDACTED]");
  });

  test("leaves unrelated error messages unchanged", () => {
    const error = new Error("Network timeout");
    expect(sanitizeError(error).message).toBe("Network timeout");
  });

  test("handles non-Error values", () => {
    expect(sanitizeError("something went wrong").message).toBe("something went wrong");
    expect(sanitizeError(42).message).toBe("42");
  });

  test("returns an Error instance", () => {
    expect(sanitizeError(new Error("test"))).toBeInstanceOf(Error);
  });
});

describe("isRateLimitError", () => {
  test("detects 429 at start of message", () => {
    const error = new Error("429 Error: rate limit exceeded");
    expect(isRateLimitError(error)).toBe(true);
  });

  test("detects 429 anywhere in message", () => {
    const error = new Error("The service returned 429 status");
    expect(isRateLimitError(error)).toBe(true);
  });

  test("returns false for non-429 errors", () => {
    const error = new Error("500 Internal Server Error");
    expect(isRateLimitError(error)).toBe(false);
  });

  test("returns false for non-Error values", () => {
    expect(isRateLimitError("429 error")).toBe(false);
    expect(isRateLimitError(null)).toBe(false);
    expect(isRateLimitError(undefined)).toBe(false);
  });

  test("returns false for generic errors without 429", () => {
    const error = new Error("Network timeout");
    expect(isRateLimitError(error)).toBe(false);
  });
});

describe("withRetry", () => {
  test("returns result on first success", async () => {
    const fn = mock(() => Promise.resolve("success"));
    const result = await withRetry(fn);
    expect(result).toBe("success");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  test("retries on 429 errors and eventually succeeds", async () => {
    let attempts = 0;
    const fn = mock(() => {
      attempts++;
      if (attempts < 3) {
        return Promise.reject(new Error("429 Error: rate limit"));
      }
      return Promise.resolve("success after retries");
    });

    const result = await withRetry(fn, { maxRetries: 3 });
    expect(result).toBe("success after retries");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  test("propagates non-429 errors immediately", async () => {
    const error = new Error("500 Internal Server Error");
    const fn = mock(() => Promise.reject(error));

    await expect(withRetry(fn)).rejects.toThrow("500 Internal Server Error");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  test("throws last error after exhausting retries", async () => {
    const fn = mock(() => Promise.reject(new Error("429 Error: rate limit")));

    await expect(withRetry(fn, { maxRetries: 2 })).rejects.toThrow("429 Error: rate limit");
    expect(fn).toHaveBeenCalledTimes(3); // Initial + 2 retries
  });

  test("respects custom maxRetries", async () => {
    const fn = mock(() => Promise.reject(new Error("429 Error: rate limit")));

    await expect(
      withRetry(fn, {
        maxRetries: 2,
        baseDelayMs: 50,
        maxDelayMs: 100,
      })
    ).rejects.toThrow();
    expect(fn).toHaveBeenCalledTimes(3); // Initial + 2 retries
  });

  test("uses exponential backoff between retries", async () => {
    let attempts = 0;
    const timestamps: number[] = [];

    const fn = mock(async () => {
      timestamps.push(Date.now());
      attempts++;
      if (attempts < 3) {
        return Promise.reject(new Error("429 Error: rate limit"));
      }
      return Promise.resolve("success");
    });

    await withRetry(fn, { maxRetries: 3, baseDelayMs: 50, maxDelayMs: 500 });

    expect(timestamps).toHaveLength(3);
    const delay1 = timestamps[1]! - timestamps[0]!;
    const delay2 = timestamps[2]! - timestamps[1]!;

    expect(delay1).toBeGreaterThan(40); // Around 50ms with jitter
    expect(delay2).toBeGreaterThan(80); // Around 100ms with jitter (2x)
  });

  test("respects maxDelayMs", async () => {
    const fn = mock(() => Promise.reject(new Error("429 Error: rate limit")));
    const start = Date.now();

    await expect(
      withRetry(fn, {
        maxRetries: 5,
        baseDelayMs: 100,
        maxDelayMs: 200,
      })
    ).rejects.toThrow();

    const elapsed = Date.now() - start;
    // With 5 retries and exponential backoff, total should be roughly:
    // 100 + 200 + 200 (capped) + 200 (capped) + 200 (capped) = ~900ms
    // But with maxDelayMs=200, it shouldn't exceed ~1100ms
    expect(elapsed).toBeGreaterThan(0);
    expect(elapsed).toBeLessThan(1500);
  });

  test("handles successful retry with different error messages", async () => {
    let attempts = 0;
    const fn = mock(() => {
      attempts++;
      if (attempts === 1) {
        return Promise.reject(new Error("429 The service may be temporarily overloaded"));
      }
      if (attempts === 2) {
        return Promise.reject(new Error("429 please try again later"));
      }
      return Promise.resolve("success");
    });

    const result = await withRetry(fn);
    expect(result).toBe("success");
    expect(fn).toHaveBeenCalledTimes(3);
  });
});

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
      timestamp: Temporal.Now.instant().epochMilliseconds,
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
