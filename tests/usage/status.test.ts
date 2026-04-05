/**
 * Unit tests for src/usage/status.ts
 */

import { describe, expect, mock, test } from "bun:test";
import type { TavilyUsageData } from "../../src/usage/api.js";
import { TavilyUsageCache } from "../../src/usage/status.js";

// ============================================================================
// Helpers
// ============================================================================

const createMockContext = () =>
  ({
    ui: {
      setStatus: mock(() => {}),
      theme: {
        fg: (color: string, text: string) => `${color}:${text}`,
      },
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }) as any;

const createMockFetchUsage = (data: TavilyUsageData) =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mock(() => Promise.resolve(data)) as any;

const createThrowingFetchUsage = (errorMessage: string) =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mock(() => Promise.reject(new Error(errorMessage))) as any;

// ============================================================================
// Tests
// ============================================================================

describe("TavilyUsageCache", () => {
  describe("fresh API call scenarios", () => {
    test("should set status with usage percentage from fresh API call", async () => {
      const mockCtx = createMockContext();
      const mockFetch = createMockFetchUsage({
        percentage: 3.3,
        planUsage: 500,
        planLimit: 15000,
        keyUsage: 150,
        keyLimit: 1000,
      });
      const cache = new TavilyUsageCache("test-api-key");

      await cache.updateStatus(mockCtx, mockFetch);

      expect(mockCtx.ui.setStatus).toHaveBeenCalledWith("tavily-usage", "muted:Tavily:accent:3.3%");
    });

    test("should handle 0% usage", async () => {
      const mockCtx = createMockContext();
      const mockFetch = createMockFetchUsage({
        percentage: 0,
        planUsage: 0,
        planLimit: 15000,
        keyUsage: 0,
        keyLimit: 1000,
      });
      const cache = new TavilyUsageCache("test-api-key");

      await cache.updateStatus(mockCtx, mockFetch);

      expect(mockCtx.ui.setStatus).toHaveBeenCalledWith("tavily-usage", "muted:Tavily:accent:0%");
    });

    test("should handle 100% usage", async () => {
      const mockCtx = createMockContext();
      const mockFetch = createMockFetchUsage({
        percentage: 100,
        planUsage: 15000,
        planLimit: 15000,
        keyUsage: 1000,
        keyLimit: 1000,
      });
      const cache = new TavilyUsageCache("test-api-key");

      await cache.updateStatus(mockCtx, mockFetch);

      expect(mockCtx.ui.setStatus).toHaveBeenCalledWith("tavily-usage", "muted:Tavily:accent:100%");
    });

    test("should round percentage to 1 decimal place", async () => {
      const mockCtx = createMockContext();
      const mockFetch = createMockFetchUsage({
        percentage: 42.567,
        planUsage: 425,
        planLimit: 1000,
        keyUsage: 10,
        keyLimit: 100,
      });
      const cache = new TavilyUsageCache("test-api-key");

      await cache.updateStatus(mockCtx, mockFetch);

      expect(mockCtx.ui.setStatus).toHaveBeenCalledWith(
        "tavily-usage",
        "muted:Tavily:accent:42.6%"
      );
    });

    test("should clear status on fetch error", async () => {
      const mockCtx = createMockContext();
      const mockFetch = createThrowingFetchUsage("API error");
      const cache = new TavilyUsageCache("test-api-key");

      await cache.updateStatus(mockCtx, mockFetch);

      expect(mockCtx.ui.setStatus).toHaveBeenCalledWith("tavily-usage", undefined);
    });
  });

  describe("caching scenarios", () => {
    test("should use cached data when within cooldown period", async () => {
      const mockCtx = createMockContext();
      const mockFetch = createMockFetchUsage({
        percentage: 3.3,
        planUsage: 500,
        planLimit: 15000,
        keyUsage: 150,
        keyLimit: 1000,
      });
      const cache = new TavilyUsageCache("test-api-key");

      // First call — should fetch
      await cache.updateStatus(mockCtx, mockFetch);
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Second call immediately — should use cache
      await cache.updateStatus(mockCtx, mockFetch);
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Both calls set the same status
      expect(mockCtx.ui.setStatus).toHaveBeenCalledTimes(2);
      expect(mockCtx.ui.setStatus).toHaveBeenNthCalledWith(
        2,
        "tavily-usage",
        "muted:Tavily:accent:3.3%"
      );
    });

    test("should use cached data when within cooldown period (no plan name)", async () => {
      const mockCtx = createMockContext();
      const mockFetch = createMockFetchUsage({
        percentage: 30,
        planUsage: 300,
        planLimit: 1000,
        keyUsage: 10,
        keyLimit: 100,
      });
      const cache = new TavilyUsageCache("test-api-key");

      await cache.updateStatus(mockCtx, mockFetch);
      await cache.updateStatus(mockCtx, mockFetch);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockCtx.ui.setStatus).toHaveBeenNthCalledWith(
        2,
        "tavily-usage",
        "muted:Tavily:accent:30%"
      );
    });
  });

  describe("theme formatting", () => {
    test("should use theme colors for formatting", async () => {
      const mockCtx = createMockContext();
      const mockFetch = createMockFetchUsage({
        percentage: 50,
        planUsage: 500,
        planLimit: 1000,
        keyUsage: 10,
        keyLimit: 100,
      });
      const cache = new TavilyUsageCache("test-api-key");

      await cache.updateStatus(mockCtx, mockFetch);

      const statusCall = mockCtx.ui.setStatus.mock.calls[0];
      expect(statusCall).toBeDefined();
      expect(statusCall[0]).toBe("tavily-usage");
      expect(statusCall[1]).toContain("muted:");
      expect(statusCall[1]).toContain("accent:");
    });
  });

  describe("error scenarios", () => {
    test("should clear status on network error", async () => {
      const mockCtx = createMockContext();
      const mockFetch = createThrowingFetchUsage("Network error");
      const cache = new TavilyUsageCache("test-api-key");

      await cache.updateStatus(mockCtx, mockFetch);

      expect(mockCtx.ui.setStatus).toHaveBeenCalledWith("tavily-usage", undefined);
    });

    test("should clear status on API returning 401", async () => {
      const mockCtx = createMockContext();
      const mockFetch = createThrowingFetchUsage("Tavily usage API request failed with status 401");
      const cache = new TavilyUsageCache("test-api-key");

      await cache.updateStatus(mockCtx, mockFetch);

      expect(mockCtx.ui.setStatus).toHaveBeenCalledWith("tavily-usage", undefined);
    });

    test("should not throw errors — catch them silently", async () => {
      const mockCtx = createMockContext();
      const mockFetch = createThrowingFetchUsage("Some error");
      const cache = new TavilyUsageCache("test-api-key");

      const result = await cache.updateStatus(mockCtx, mockFetch);
      expect(result).toBeUndefined();
    });

    test("should log error to console on fetch error", async () => {
      const mockCtx = createMockContext();
      const mockFetch = createThrowingFetchUsage("API request failed");
      const cache = new TavilyUsageCache("test-api-key");
      const mockConsoleError = mock(() => {});
      const originalConsoleError = console.error;

      console.error = mockConsoleError;

      try {
        await cache.updateStatus(mockCtx, mockFetch);

        expect(mockConsoleError).toHaveBeenCalledTimes(1);
        const calls = mockConsoleError.mock.calls as Array<unknown[]>;
        const errorMessage = String(calls[0]?.[0] ?? "");
        expect(errorMessage).toContain("Error updating Tavily usage:");
        expect(errorMessage).toContain("API request failed");
      } finally {
        console.error = originalConsoleError;
      }
    });
  });
});

describe("TavilyUsageCache.clear", () => {
  test("should clear tavily-usage status", () => {
    const mockCtx = createMockContext();
    const cache = new TavilyUsageCache("test-api-key");

    cache.clear(mockCtx);

    expect(mockCtx.ui.setStatus).toHaveBeenCalledWith("tavily-usage", undefined);
  });
});
