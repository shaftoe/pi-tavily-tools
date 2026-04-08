/**
 * Integration tests for web_search tool
 *
 * These tests run the actual web_search tool with real Tavily API calls.
 * Tests are skipped if TAVILY_API_KEY is not set.
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { beforeAll, describe, expect, test } from "bun:test";
import { createTavilyClient } from "../../src/tools/tavily/client.js";
import { registerWebSearchTool } from "../../src/tools/web-search.js";

// ============================================================================
// Test Setup
// ============================================================================

// Evaluate API key at module load time for describe.skipIf()
const apiKey = process.env.TAVILY_API_KEY ?? "";
const hasApiKey = Boolean(apiKey && apiKey.trim() !== "");

beforeAll(() => {
  if (!hasApiKey) {
    console.warn("\n⚠️  TAVILY_API_KEY not set - skipping integration tests");
    console.warn(
      "   Set it with: export TAVILY_API_KEY='your-key' or get a free key from https://tavily.com"
    );
  }
});

// ============================================================================
// Mock Extension API
// ============================================================================

type ToolExecuteResult = {
  content: Array<{ type: string; text: string }>;
  details: {
    query: string;
    maxResults: number;
    searchDepth: string;
    includeAnswer: boolean;
    includeRawContent: boolean;
    includeImages: boolean;
    days?: number;
    answer?: string;
    resultCount: number;
    sources: Array<{ title: string; url: string; score: number }>;
    truncation?: unknown;
    fullOutputPath?: string;
    error?: string;
  };
};

function createMockExtensionAPI() {
  const toolRegistrations: {
    name: string;
    label: string;
    description: string;
    promptSnippet: string;
    promptGuidelines: string[];
    parameters: unknown;
    execute: (
      toolCallId: string,
      params: Record<string, unknown>,
      signal: AbortSignal | undefined,
      onUpdate: ((update: { content: unknown; details: unknown }) => void) | undefined,
      ctx: { cwd: string }
    ) => Promise<ToolExecuteResult>;
    renderCall: (args: Record<string, unknown>, theme: unknown) => unknown;
    renderResult: (
      result: unknown,
      state: { expanded: boolean; isPartial: boolean },
      theme: unknown
    ) => unknown;
  }[] = [];

  return {
    registerTool: (config: (typeof toolRegistrations)[0]) => {
      toolRegistrations.push(config);
      return config;
    },
    getTools: () => toolRegistrations,
  };
}

type MockExtensionAPI = ReturnType<typeof createMockExtensionAPI>;

// ============================================================================
// Integration Tests
// ============================================================================

describe("web_search integration tests", () => {
  describe.skipIf(!hasApiKey)("with real Tavily API", () => {
    let client: Awaited<ReturnType<typeof createTavilyClient>>;
    let mockAPI: MockExtensionAPI;

    beforeAll(() => {
      // Create real client
      client = createTavilyClient(apiKey);
      mockAPI = createMockExtensionAPI();
      registerWebSearchTool(mockAPI as unknown as ExtensionAPI, client);
    });

    test("registers tool with correct configuration", () => {
      const tools = mockAPI.getTools();
      expect(tools).toHaveLength(1);

      const webSearchTool = tools[0];
      if (!webSearchTool) throw new Error("Tool not registered");

      expect(webSearchTool.name).toBe("web_search");
      expect(webSearchTool.label).toBe("Web Search");
      expect(webSearchTool.description).toContain("Tavily");
      expect(webSearchTool.description).toContain("2000 lines");
      expect(webSearchTool.description).toContain("50KB");
    });

    test("has correct prompt snippet and guidelines", () => {
      const tools = mockAPI.getTools();
      const webSearchTool = tools[0];
      if (!webSearchTool) throw new Error("Tool not registered");

      expect(webSearchTool.promptSnippet).toContain("current information");
      expect(webSearchTool.promptGuidelines).toBeDefined();
      expect(Array.isArray(webSearchTool.promptGuidelines)).toBe(true);
      expect(webSearchTool.promptGuidelines.length).toBeGreaterThan(0);
    });

    test("has parameters schema", () => {
      const tools = mockAPI.getTools();
      const webSearchTool = tools[0];
      if (!webSearchTool) throw new Error("Tool not registered");

      expect(webSearchTool.parameters).toBeDefined();
      expect((webSearchTool.parameters as { type: string }).type).toBe("object");
    });

    test("has execute function", () => {
      const tools = mockAPI.getTools();
      const webSearchTool = tools[0];
      if (!webSearchTool) throw new Error("Tool not registered");

      expect(typeof webSearchTool.execute).toBe("function");
    });

    test("has renderCall function", () => {
      const tools = mockAPI.getTools();
      const webSearchTool = tools[0];
      if (!webSearchTool) throw new Error("Tool not registered");

      expect(typeof webSearchTool.renderCall).toBe("function");
    });

    test("has renderResult function", () => {
      const tools = mockAPI.getTools();
      const webSearchTool = tools[0];
      if (!webSearchTool) throw new Error("Tool not registered");

      expect(typeof webSearchTool.renderResult).toBe("function");
    });

    describe("execute function", () => {
      test("successfully performs a basic search", async () => {
        const tools = mockAPI.getTools();
        const webSearchTool = tools[0];
        if (!webSearchTool) throw new Error("Tool not registered");

        const result = await webSearchTool.execute(
          "test-call-1",
          { query: "TypeScript programming language" },
          undefined,
          undefined,
          { cwd: "/tmp" }
        );

        expect(result).toBeDefined();
        expect(result.content).toBeDefined();
        expect(Array.isArray(result.content)).toBe(true);
        expect(result.content[0]!).toHaveProperty("type", "text");
        expect(result.content[0]!).toHaveProperty("text");
        expect(typeof result.content[0]!.text).toBe("string");

        // Check details
        expect(result.details).toBeDefined();
        expect(result.details.query).toBe("TypeScript programming language");
        expect(typeof result.details.resultCount).toBe("number");
        expect(result.details.resultCount).toBeGreaterThan(0);
        expect(Array.isArray(result.details.sources)).toBe(true);
      });

      test("returns sources with expected structure", async () => {
        const tools = mockAPI.getTools();
        const webSearchTool = tools[0];
        if (!webSearchTool) throw new Error("Tool not registered");

        const result = await webSearchTool.execute(
          "test-call-2",
          { query: "Paris capital city" },
          undefined,
          undefined,
          { cwd: "/tmp" }
        );

        const sources = result.details.sources;

        expect(sources.length).toBeGreaterThan(0);

        // Check first source structure
        const firstSource = sources[0];
        if (!firstSource) throw new Error("No sources returned");

        expect(firstSource).toHaveProperty("title");
        expect(firstSource).toHaveProperty("url");
        expect(firstSource).toHaveProperty("score");
        expect(typeof firstSource.title).toBe("string");
        expect(typeof firstSource.url).toBe("string");
        expect(typeof firstSource.score).toBe("number");
        expect(firstSource.score).toBeGreaterThanOrEqual(0);
        expect(firstSource.score).toBeLessThanOrEqual(1);
      });

      test("includes AI answer when enabled", async () => {
        const tools = mockAPI.getTools();
        const webSearchTool = tools[0];
        if (!webSearchTool) throw new Error("Tool not registered");

        const result = await webSearchTool.execute(
          "test-call-3",
          { query: "What is 2+2?", include_answer: true },
          undefined,
          undefined,
          { cwd: "/tmp" }
        );

        // Answer may or may not be present depending on query type
        if (result.details.answer) {
          expect(typeof result.details.answer).toBe("string");
          expect(result.details.answer.length).toBeGreaterThan(0);
        }
      });

      test("respects max_results parameter", async () => {
        const tools = mockAPI.getTools();
        const webSearchTool = tools[0];
        if (!webSearchTool) throw new Error("Tool not registered");

        const result = await webSearchTool.execute(
          "test-call-4",
          { query: "JavaScript", max_results: 3 },
          undefined,
          undefined,
          { cwd: "/tmp" }
        );

        expect(result.details.resultCount).toBeLessThanOrEqual(3);
      });

      test("respects search_depth parameter", async () => {
        const tools = mockAPI.getTools();
        const webSearchTool = tools[0];
        if (!webSearchTool) throw new Error("Tool not registered");

        const result1 = await webSearchTool.execute(
          "test-call-5a",
          { query: "Python programming", search_depth: "basic" },
          undefined,
          undefined,
          { cwd: "/tmp" }
        );

        const result2 = await webSearchTool.execute(
          "test-call-5b",
          { query: "Python programming", search_depth: "advanced" },
          undefined,
          undefined,
          { cwd: "/tmp" }
        );

        expect(result1.details.searchDepth).toBe("basic");
        expect(result2.details.searchDepth).toBe("advanced");
      });

      test("handles days parameter for time-limited search", async () => {
        const tools = mockAPI.getTools();
        const webSearchTool = tools[0];
        if (!webSearchTool) throw new Error("Tool not registered");

        const result = await webSearchTool.execute(
          "test-call-7",
          { query: "latest tech news", days: 7 },
          undefined,
          undefined,
          { cwd: "/tmp" }
        );

        expect(result.details.days).toBe(7);
      });

      test("handles complex multi-word queries", async () => {
        const tools = mockAPI.getTools();
        const webSearchTool = tools[0];
        if (!webSearchTool) throw new Error("Tool not registered");

        const result = await webSearchTool.execute(
          "test-call-8",
          { query: "best practices for TypeScript error handling" },
          undefined,
          undefined,
          { cwd: "/tmp" }
        );

        expect(result.details.query).toBe("best practices for TypeScript error handling");
        expect(result.details.resultCount).toBeGreaterThan(0);
      });

      test("handles queries with special characters", async () => {
        const tools = mockAPI.getTools();
        const webSearchTool = tools[0];
        if (!webSearchTool) throw new Error("Tool not registered");

        const result = await webSearchTool.execute(
          "test-call-9",
          { query: "C++ vs Rust performance" },
          undefined,
          undefined,
          { cwd: "/tmp" }
        );

        expect(result.details.query).toBe("C++ vs Rust performance");
        expect(result.details.resultCount).toBeGreaterThan(0);
      });

      test("handles queries with numbers", async () => {
        const tools = mockAPI.getTools();
        const webSearchTool = tools[0];
        if (!webSearchTool) throw new Error("Tool not registered");

        const result = await webSearchTool.execute(
          "test-call-10",
          { query: "ISO 8601 date format" },
          undefined,
          undefined,
          { cwd: "/tmp" }
        );

        expect(result.details.query).toBe("ISO 8601 date format");
        expect(result.details.resultCount).toBeGreaterThan(0);
      });

      test("returns valid URL in sources", async () => {
        const tools = mockAPI.getTools();
        const webSearchTool = tools[0];
        if (!webSearchTool) throw new Error("Tool not registered");

        const result = await webSearchTool.execute(
          "test-call-11",
          { query: "open source projects" },
          undefined,
          undefined,
          { cwd: "/tmp" }
        );

        const sources = result.details.sources;

        for (const source of sources) {
          expect(source.url).toMatch(/^https?:\/\//);
        }
      });

      test("content is a non-empty string", async () => {
        const tools = mockAPI.getTools();
        const webSearchTool = tools[0];
        if (!webSearchTool) throw new Error("Tool not registered");

        const result = await webSearchTool.execute(
          "test-call-12",
          { query: "test query" },
          undefined,
          undefined,
          { cwd: "/tmp" }
        );

        expect(result.content[0]!.text.length).toBeGreaterThan(0);
      });
    });

    describe("error handling", () => {
      test("handles empty query by throwing", async () => {
        const tools = mockAPI.getTools();
        const webSearchTool = tools[0];
        if (!webSearchTool) throw new Error("Tool not registered");

        expect(
          webSearchTool.execute("test-error-1", { query: "   " }, undefined, undefined, {
            cwd: "/tmp",
          })
        ).rejects.toThrow("Query cannot be empty");
      });

      test("handles invalid search depth by throwing", async () => {
        const tools = mockAPI.getTools();
        const webSearchTool = tools[0];
        if (!webSearchTool) throw new Error("Tool not registered");

        expect(
          webSearchTool.execute(
            "test-error-2",
            { query: "test", search_depth: "invalid" as unknown as "basic" },
            undefined,
            undefined,
            { cwd: "/tmp" }
          )
        ).rejects.toThrow("Invalid search depth");
      });
    });
  });

  test("throws error when creating client without API key", () => {
    // Temporarily remove API key for this test
    const originalKey = process.env.TAVILY_API_KEY;
    delete process.env.TAVILY_API_KEY;

    try {
      expect(() => createTavilyClient()).toThrow("TAVILY_API_KEY environment variable is not set");
    } finally {
      // Restore original key
      if (originalKey !== undefined) {
        process.env.TAVILY_API_KEY = originalKey;
      }
    }
  });
});
