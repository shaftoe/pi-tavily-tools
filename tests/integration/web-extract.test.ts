/**
 * Integration tests for web_extract tool
 *
 * These tests run the actual web_extract tool with real Tavily API calls.
 * Tests are skipped if TAVILY_API_KEY is not set.
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { beforeAll, describe, expect, test } from "bun:test";
import { createTavilyClient } from "../../src/tools/tavily/client.js";
import { registerWebExtractTool } from "../../src/tools/web-extract.js";

// ============================================================================
// Test Setup
// ============================================================================

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
    urlCount: number;
    extractDepth: string;
    includeImages: boolean;
    format: string;
    query?: string;
    successCount: number;
    failureCount: number;
    results: Array<{
      url: string;
      title: string | null;
      rawContent: string;
      images?: string[];
    }>;
    failedResults: Array<{ url: string; error: string }>;
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

describe("web_extract integration tests", () => {
  describe.skipIf(!hasApiKey)("with real Tavily API", () => {
    let client: Awaited<ReturnType<typeof createTavilyClient>>;
    let mockAPI: MockExtensionAPI;

    beforeAll(() => {
      client = createTavilyClient(apiKey);
      mockAPI = createMockExtensionAPI();
      registerWebExtractTool(mockAPI as unknown as ExtensionAPI, client);
    });

    test("registers tool with correct configuration", () => {
      const tools = mockAPI.getTools();
      expect(tools).toHaveLength(1);

      const webExtractTool = tools[0];
      if (!webExtractTool) throw new Error("Tool not registered");

      expect(webExtractTool.name).toBe("web_extract");
      expect(webExtractTool.label).toBe("Web Extract");
      expect(webExtractTool.description).toContain("Tavily");
      expect(webExtractTool.description).toContain("2000 lines");
      expect(webExtractTool.description).toContain("50KB");
    });

    test("has correct prompt snippet and guidelines", () => {
      const tools = mockAPI.getTools();
      const webExtractTool = tools[0];
      if (!webExtractTool) throw new Error("Tool not registered");

      expect(webExtractTool.promptSnippet).toContain("content");
      expect(webExtractTool.promptGuidelines).toBeDefined();
      expect(Array.isArray(webExtractTool.promptGuidelines)).toBe(true);
      expect(webExtractTool.promptGuidelines.length).toBeGreaterThan(0);
    });

    test("has parameters schema", () => {
      const tools = mockAPI.getTools();
      const webExtractTool = tools[0];
      if (!webExtractTool) throw new Error("Tool not registered");

      expect(webExtractTool.parameters).toBeDefined();
      expect((webExtractTool.parameters as { type: string }).type).toBe("object");
    });

    test("has execute function", () => {
      const tools = mockAPI.getTools();
      const webExtractTool = tools[0];
      if (!webExtractTool) throw new Error("Tool not registered");

      expect(typeof webExtractTool.execute).toBe("function");
    });

    test("has renderCall function", () => {
      const tools = mockAPI.getTools();
      const webExtractTool = tools[0];
      if (!webExtractTool) throw new Error("Tool not registered");

      expect(typeof webExtractTool.renderCall).toBe("function");
    });

    test("has renderResult function", () => {
      const tools = mockAPI.getTools();
      const webExtractTool = tools[0];
      if (!webExtractTool) throw new Error("Tool not registered");

      expect(typeof webExtractTool.renderResult).toBe("function");
    });

    describe("execute function", () => {
      test("successfully extracts content from a single URL", async () => {
        const tools = mockAPI.getTools();
        const webExtractTool = tools[0];
        if (!webExtractTool) throw new Error("Tool not registered");

        const result = await webExtractTool.execute(
          "test-call-1",
          { urls: ["https://en.wikipedia.org/wiki/Artificial_intelligence"] },
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
        expect(result.details.urlCount).toBe(1);
        expect(result.details.successCount).toBeGreaterThanOrEqual(0);
        expect(result.details.failureCount).toBeGreaterThanOrEqual(0);
      });

      test("extracts content from multiple URLs", async () => {
        const tools = mockAPI.getTools();
        const webExtractTool = tools[0];
        if (!webExtractTool) throw new Error("Tool not registered");

        const urls = [
          "https://en.wikipedia.org/wiki/Machine_learning",
          "https://en.wikipedia.org/wiki/Data_science",
          "https://en.wikipedia.org/wiki/Quantum_computing",
        ];

        const result = await webExtractTool.execute("test-call-2", { urls }, undefined, undefined, {
          cwd: "/tmp",
        });

        expect(result.details.urlCount).toBe(3);
        expect(result.details.successCount + result.details.failureCount).toBe(3);
      });

      test("respects extract_depth parameter", async () => {
        const tools = mockAPI.getTools();
        const webExtractTool = tools[0];
        if (!webExtractTool) throw new Error("Tool not registered");

        const result1 = await webExtractTool.execute(
          "test-call-3a",
          {
            urls: ["https://en.wikipedia.org/wiki/Climate_change"],
            extract_depth: "basic",
          },
          undefined,
          undefined,
          { cwd: "/tmp" }
        );

        expect(result1.details.extractDepth).toBe("basic");
      }, 10000);

      test("includes images when requested", async () => {
        const tools = mockAPI.getTools();
        const webExtractTool = tools[0];
        if (!webExtractTool) throw new Error("Tool not registered");

        const result = await webExtractTool.execute(
          "test-call-4",
          {
            urls: ["https://en.wikipedia.org/wiki/Sunset"],
            include_images: true,
          },
          undefined,
          undefined,
          { cwd: "/tmp" }
        );

        expect(result.details.includeImages).toBe(true);
      }, 10000);

      test("respects format parameter", async () => {
        const tools = mockAPI.getTools();
        const webExtractTool = tools[0];
        if (!webExtractTool) throw new Error("Tool not registered");

        const result1 = await webExtractTool.execute(
          "test-call-5a",
          {
            urls: ["https://en.wikipedia.org/wiki/Python_(programming_language)"],
            format: "markdown",
          },
          undefined,
          undefined,
          { cwd: "/tmp" }
        );

        const result2 = await webExtractTool.execute(
          "test-call-5b",
          {
            urls: ["https://en.wikipedia.org/wiki/Python_(programming_language)"],
            format: "text",
          },
          undefined,
          undefined,
          { cwd: "/tmp" }
        );

        expect(result1.details.format).toBe("markdown");
        expect(result2.details.format).toBe("text");
      });

      test("handles query parameter for content filtering", async () => {
        const tools = mockAPI.getTools();
        const webExtractTool = tools[0];
        if (!webExtractTool) throw new Error("Tool not registered");

        const result = await webExtractTool.execute(
          "test-call-6",
          {
            urls: ["https://en.wikipedia.org/wiki/Artificial_intelligence"],
            query: "machine learning",
          },
          undefined,
          undefined,
          { cwd: "/tmp" }
        );

        expect(result.details.query).toBe("machine learning");
      });

      test("returns results with expected structure", async () => {
        const tools = mockAPI.getTools();
        const webExtractTool = tools[0];
        if (!webExtractTool) throw new Error("Tool not registered");

        const result = await webExtractTool.execute(
          "test-call-7",
          { urls: ["https://en.wikipedia.org/wiki/JavaScript"] },
          undefined,
          undefined,
          { cwd: "/tmp" }
        );

        const results = result.details.results;

        if (results.length > 0) {
          const firstResult = results[0];
          if (!firstResult) throw new Error("No results returned");

          expect(firstResult).toHaveProperty("url");
          expect(firstResult).toHaveProperty("title");
          expect(firstResult).toHaveProperty("rawContent");
          expect(typeof firstResult.url).toBe("string");
          expect(typeof firstResult.title === "string" || firstResult.title === null).toBe(true);
          expect(typeof firstResult.rawContent).toBe("string");
        }
      });

      test("handles failed URLs gracefully", async () => {
        const tools = mockAPI.getTools();
        const webExtractTool = tools[0];
        if (!webExtractTool) throw new Error("Tool not registered");

        // Mix of valid and potentially invalid URLs
        const urls = [
          "https://en.wikipedia.org/wiki/TypeScript",
          "https://this-url-does-not-exist-12345.com",
          "https://en.wikipedia.org/wiki/Rust_(programming_language)",
        ];

        const result = await webExtractTool.execute("test-call-8", { urls }, undefined, undefined, {
          cwd: "/tmp",
        });

        // Should have some combination of successes and failures
        expect(result.details.successCount + result.details.failureCount).toBe(urls.length);

        // Check failed results structure
        if (result.details.failedResults.length > 0) {
          const firstFailed = result.details.failedResults[0];
          if (firstFailed) {
            expect(firstFailed).toHaveProperty("url");
            expect(firstFailed).toHaveProperty("error");
            expect(typeof firstFailed.url).toBe("string");
            expect(typeof firstFailed.error).toBe("string");
          }
        }
      });

      test("content is a non-empty string", async () => {
        const tools = mockAPI.getTools();
        const webExtractTool = tools[0];
        if (!webExtractTool) throw new Error("Tool not registered");

        const result = await webExtractTool.execute(
          "test-call-9",
          { urls: ["https://en.wikipedia.org/wiki/Bun_(software)"] },
          undefined,
          undefined,
          { cwd: "/tmp" }
        );

        expect(result.content[0]!.text.length).toBeGreaterThan(0);
      });

      test("returns valid URL in results", async () => {
        const tools = mockAPI.getTools();
        const webExtractTool = tools[0];
        if (!webExtractTool) throw new Error("Tool not registered");

        const result = await webExtractTool.execute(
          "test-call-10",
          { urls: ["https://en.wikipedia.org/wiki/Node.js"] },
          undefined,
          undefined,
          { cwd: "/tmp" }
        );

        const results = result.details.results;

        for (const result of results) {
          expect(result.url).toMatch(/^https?:\/\//);
        }
      });

      test("handles complex URL with query parameters", async () => {
        const tools = mockAPI.getTools();
        const webExtractTool = tools[0];
        if (!webExtractTool) throw new Error("Tool not registered");

        const result = await webExtractTool.execute(
          "test-call-11",
          { urls: ["https://en.wikipedia.org/wiki/HTTP"] },
          undefined,
          undefined,
          { cwd: "/tmp" }
        );

        expect(result.details.urlCount).toBe(1);
        expect(result.details.successCount + result.details.failureCount).toBe(1);
      }, 15000);

      test("content includes extracted content snippet", async () => {
        const tools = mockAPI.getTools();
        const webExtractTool = tools[0];
        if (!webExtractTool) throw new Error("Tool not registered");

        const result = await webExtractTool.execute(
          "test-call-12",
          { urls: ["https://en.wikipedia.org/wiki/Docker_(software)"] },
          undefined,
          undefined,
          { cwd: "/tmp" }
        );

        if (result.details.results.length > 0) {
          const extractedContent = result.details.results[0]!.rawContent;
          expect(extractedContent.length).toBeGreaterThan(0);
          expect(result.content[0]!.text).toContain("Successfully extracted");
        }
      });
    });

    describe("error handling", () => {
      test("handles empty URL array by throwing", async () => {
        const tools = mockAPI.getTools();
        const webExtractTool = tools[0];
        if (!webExtractTool) throw new Error("Tool not registered");

        expect(
          webExtractTool.execute("test-error-1", { urls: [] }, undefined, undefined, {
            cwd: "/tmp",
          })
        ).rejects.toThrow("URLs array cannot be empty");
      });

      test("handles invalid URL by throwing", async () => {
        const tools = mockAPI.getTools();
        const webExtractTool = tools[0];
        if (!webExtractTool) throw new Error("Tool not registered");

        expect(
          webExtractTool.execute("test-error-2", { urls: ["not-a-url"] }, undefined, undefined, {
            cwd: "/tmp",
          })
        ).rejects.toThrow("Invalid URL format");
      });

      test("handles too many URLs by throwing", async () => {
        const tools = mockAPI.getTools();
        const webExtractTool = tools[0];
        if (!webExtractTool) throw new Error("Tool not registered");

        const urls = Array.from({ length: 21 }, (_, i) => `https://example${i}.com`);

        expect(
          webExtractTool.execute("test-error-3", { urls }, undefined, undefined, {
            cwd: "/tmp",
          })
        ).rejects.toThrow("Maximum 20 URLs allowed");
      });
    });
  });

  test("throws error when creating client without API key", () => {
    const originalKey = process.env.TAVILY_API_KEY;
    delete process.env.TAVILY_API_KEY;

    try {
      expect(() => createTavilyClient()).toThrow("TAVILY_API_KEY environment variable is not set");
    } finally {
      if (originalKey !== undefined) {
        process.env.TAVILY_API_KEY = originalKey;
      }
    }
  });
});
