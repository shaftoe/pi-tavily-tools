/**
 * Unit tests for registerWebSearchTool and execute
 *
 * Uses a mocked Tavily client to test the orchestration logic
 * without making real API calls.
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { beforeEach, describe, expect, test } from "bun:test";
import { resultCache } from "../src/tools/shared/cache.js";
import { registerWebSearchTool } from "../src/tools/web-search.js";

// ============================================================================
// Mock helpers
// ============================================================================

type CapturedTool = {
  name: string;
  execute: (
    toolCallId: string,
    params: Record<string, unknown>,
    signal: AbortSignal | undefined,
    onUpdate: ((update: { content: unknown; details: unknown }) => void) | undefined,
    ctx: { cwd: string }
  ) => Promise<unknown>;
};

function createMockAPI(): { api: ExtensionAPI; getTool: () => CapturedTool } {
  let captured: CapturedTool | undefined;

  return {
    api: {
      registerTool: (config: CapturedTool) => {
        captured = config;
      },
    } as unknown as ExtensionAPI,
    getTool: () => {
      if (!captured) throw new Error("Tool not registered");
      return captured;
    },
  };
}

function createMockClient(response: unknown) {
  return {
    search: async () => response,
  } as unknown as import("@tavily/core").TavilyClient;
}

// Standard mock response
function mockResponse(overrides: Record<string, unknown> = {}) {
  return {
    answer: "AI answer",
    results: [
      {
        title: "Test Result",
        url: "https://example.com",
        score: 0.95,
        content: "Some content here",
      },
    ],
    images: [],
    ...overrides,
  };
}

// ============================================================================
// Tests
// ============================================================================

beforeEach(() => {
  resultCache.clear();
});

describe("registerWebSearchTool", () => {
  test("registers tool with correct name and label", () => {
    const { api, getTool } = createMockAPI();
    registerWebSearchTool(api, createMockClient(mockResponse()));
    const tool = getTool();
    expect(tool.name).toBe("web_search");
  });
});

describe("execute", () => {
  test("returns formatted content and details on success", async () => {
    const { api, getTool } = createMockAPI();
    registerWebSearchTool(api, createMockClient(mockResponse()));
    const tool = getTool();

    const result = (await tool.execute("call-1", { query: "test query" }, undefined, undefined, {
      cwd: "/tmp",
    })) as {
      content: Array<{ type: string; text: string }>;
      details: Record<string, unknown>;
    };

    expect(result.content).toHaveLength(1);
    expect(result.content[0]!.type).toBe("text");
    expect(result.content[0]!.text).toContain("Test Result");
    expect(result.content[0]!.text).toContain("https://example.com");
    expect(result.details.query).toBe("test query");
    expect(result.details.resultCount).toBe(1);
    expect(result.details.sources).toEqual([
      { title: "Test Result", url: "https://example.com", score: 0.95 },
    ]);
  });

  test("includes AI answer in details when present", async () => {
    const { api, getTool } = createMockAPI();
    registerWebSearchTool(api, createMockClient(mockResponse({ answer: "42" })));
    const tool = getTool();

    const result = (await tool.execute(
      "call-2",
      { query: "meaning of life" },
      undefined,
      undefined,
      { cwd: "/tmp" }
    )) as { details: Record<string, unknown> };

    expect(result.details.answer).toBe("42");
  });

  test("omits answer from details when null", async () => {
    const { api, getTool } = createMockAPI();
    registerWebSearchTool(api, createMockClient(mockResponse({ answer: null })));
    const tool = getTool();

    const result = (await tool.execute("call-3", { query: "test" }, undefined, undefined, {
      cwd: "/tmp",
    })) as { details: Record<string, unknown> };

    expect(result.details.answer).toBeUndefined();
  });

  test("passes search options to client", async () => {
    let capturedOptions: unknown;
    const client = {
      search: async (_q: string, opts: unknown) => {
        capturedOptions = opts;
        return mockResponse();
      },
    } as unknown as import("@tavily/core").TavilyClient;

    const { api, getTool } = createMockAPI();
    registerWebSearchTool(api, client);
    const tool = getTool();

    await tool.execute(
      "call-4",
      { query: "test", max_results: 10, search_depth: "advanced", include_images: true },
      undefined,
      undefined,
      { cwd: "/tmp" }
    );

    expect(capturedOptions).toBeDefined();
    const opts = capturedOptions as Record<string, unknown>;
    expect(opts.maxResults).toBe(10);
    expect(opts.searchDepth).toBe("advanced");
    expect(opts.includeImages).toBe(true);
  });

  test("calls onUpdate with searching message", async () => {
    const { api, getTool } = createMockAPI();
    registerWebSearchTool(api, createMockClient(mockResponse()));
    const tool = getTool();

    const updates: unknown[] = [];
    await tool.execute("call-5", { query: "test" }, undefined, (u) => updates.push(u), {
      cwd: "/tmp",
    });

    expect(updates).toHaveLength(1);
    const update = updates[0] as { content: Array<{ type: string; text: string }> };
    expect(update.content[0]!.text).toBe("Searching for: test");
  });

  test("throws on empty query", async () => {
    const { api, getTool } = createMockAPI();
    registerWebSearchTool(api, createMockClient(mockResponse()));
    const tool = getTool();

    expect(
      tool.execute("call-6", { query: "   " }, undefined, undefined, { cwd: "/tmp" })
    ).rejects.toThrow("Query cannot be empty");
  });

  test("throws when client.search fails", async () => {
    const client = {
      search: async () => {
        throw new Error("API rate limit exceeded");
      },
    } as unknown as import("@tavily/core").TavilyClient;

    const { api, getTool } = createMockAPI();
    registerWebSearchTool(api, client);
    const tool = getTool();

    expect(
      tool.execute("call-7", { query: "test" }, undefined, undefined, { cwd: "/tmp" })
    ).rejects.toThrow("API rate limit exceeded");
  });

  test("handles empty results gracefully", async () => {
    const { api, getTool } = createMockAPI();
    registerWebSearchTool(api, createMockClient(mockResponse({ results: [], answer: null })));
    const tool = getTool();

    const result = (await tool.execute("call-8", { query: "obscure query" }, undefined, undefined, {
      cwd: "/tmp",
    })) as {
      content: Array<{ type: string; text: string }>;
      details: Record<string, unknown>;
    };

    expect(result.content[0]!.text).toContain("No results found");
    expect(result.details.resultCount).toBe(0);
    expect(result.details.sources).toEqual([]);
  });

  test("includes images in output when includeImages is true", async () => {
    const { api, getTool } = createMockAPI();
    registerWebSearchTool(
      api,
      createMockClient(
        mockResponse({
          images: [{ url: "https://img.com/1.jpg", description: "An image" }],
        })
      )
    );
    const tool = getTool();

    const result = (await tool.execute(
      "call-9",
      { query: "test", include_images: true },
      undefined,
      undefined,
      { cwd: "/tmp" }
    )) as {
      content: Array<{ type: string; text: string }>;
      details: Record<string, unknown>;
    };

    expect(result.content[0]!.text).toContain("https://img.com/1.jpg");
    expect(result.details.includeImages).toBe(true);
  });

  test("trims query whitespace before searching", async () => {
    let capturedQuery: string | undefined;
    const client = {
      search: async (q: string) => {
        capturedQuery = q;
        return mockResponse();
      },
    } as unknown as import("@tavily/core").TavilyClient;

    const { api, getTool } = createMockAPI();
    registerWebSearchTool(api, client);
    const tool = getTool();

    await tool.execute("call-10", { query: "  padded query  " }, undefined, undefined, {
      cwd: "/tmp",
    });

    expect(capturedQuery).toBe("padded query");
  });
});
