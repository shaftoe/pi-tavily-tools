/**
 * Unit tests for registerWebExtractTool and execute
 *
 * Uses a mocked Tavily client to test the orchestration logic
 * without making real API calls.
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { beforeEach, describe, expect, test } from "bun:test";
import { resultCache } from "../src/tools/shared/cache.js";
import { registerWebExtractTool } from "../src/tools/web-extract.js";

// ============================================================================
// Mock helpers
// ============================================================================

type CapturedTool = {
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
  ) => Promise<unknown>;
  renderCall: (args: Record<string, unknown>, theme: unknown) => unknown;
  renderResult: (
    result: unknown,
    state: { expanded: boolean; isPartial: boolean },
    theme: unknown
  ) => unknown;
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
    extract: async () => response,
  } as unknown as import("@tavily/core").TavilyClient;
}

// Standard mock response
function mockResponse(overrides: Record<string, unknown> = {}) {
  return {
    results: [
      {
        url: "https://example.com/article",
        title: "Test Article",
        rawContent: "This is the content of the article...",
        images: ["https://example.com/image1.jpg", "https://example.com/image2.jpg"],
      },
    ],
    failedResults: [],
    ...overrides,
  };
}

// ============================================================================
// Tests
// ============================================================================

beforeEach(() => {
  resultCache.clear();
});

describe("registerWebExtractTool", () => {
  test("registers tool with correct name and label", () => {
    const { api, getTool } = createMockAPI();
    registerWebExtractTool(api, createMockClient(mockResponse()));
    const tool = getTool();
    expect(tool.name).toBe("web_extract");
  });

  test("registers tool with correct label", () => {
    const { api, getTool } = createMockAPI();
    registerWebExtractTool(api, createMockClient(mockResponse()));
    const tool = getTool();
    expect(tool.label).toBe("Web Extract");
  });
});

describe("execute", () => {
  test("returns formatted content and details on success", async () => {
    const { api, getTool } = createMockAPI();
    registerWebExtractTool(api, createMockClient(mockResponse()));
    const tool = getTool();

    const result = (await tool.execute(
      "call-1",
      { urls: ["https://example.com/article"] },
      undefined,
      undefined,
      { cwd: "/tmp" }
    )) as {
      content: Array<{ type: string; text: string }>;
      details: Record<string, unknown>;
    };

    expect(result.content).toHaveLength(1);
    expect(result.content[0]!.type).toBe("text");
    expect(result.content[0]!.text).toContain("Test Article");
    expect(result.content[0]!.text).toContain("https://example.com/article");
    expect(result.details.urlCount).toBe(1);
    expect(result.details.successCount).toBe(1);
    expect(result.details.failureCount).toBe(0);
  });

  test("includes failed results in details", async () => {
    const { api, getTool } = createMockAPI();
    registerWebExtractTool(
      api,
      createMockClient(
        mockResponse({
          failedResults: [
            {
              url: "https://failed.com/page",
              error: "Failed to extract content",
            },
          ],
        })
      )
    );
    const tool = getTool();

    const result = (await tool.execute(
      "call-2",
      { urls: ["https://example.com/article", "https://failed.com/page"] },
      undefined,
      undefined,
      { cwd: "/tmp" }
    )) as { details: Record<string, unknown> };

    expect(result.details.failureCount).toBe(1);
    expect(result.details.failedResults).toEqual([
      { url: "https://failed.com/page", error: "Failed to extract content" },
    ]);
  });

  test("passes extract options to client", async () => {
    let capturedUrls: string[] | undefined;
    let capturedOptions: unknown;
    const client = {
      extract: async (urls: string[], opts: unknown) => {
        capturedUrls = urls;
        capturedOptions = opts;
        return mockResponse();
      },
    } as unknown as import("@tavily/core").TavilyClient;

    const { api, getTool } = createMockAPI();
    registerWebExtractTool(api, client);
    const tool = getTool();

    await tool.execute(
      "call-3",
      {
        urls: ["https://example.com"],
        extract_depth: "advanced",
        include_images: true,
        format: "text",
      },
      undefined,
      undefined,
      { cwd: "/tmp" }
    );

    expect(capturedUrls).toEqual(["https://example.com"]);
    expect(capturedOptions).toBeDefined();
    const opts = capturedOptions as Record<string, unknown>;
    expect(opts.extractDepth).toBe("advanced");
    expect(opts.includeImages).toBe(true);
    expect(opts.format).toBe("text");
  });

  test("calls onUpdate with extracting message", async () => {
    const { api, getTool } = createMockAPI();
    registerWebExtractTool(api, createMockClient(mockResponse()));
    const tool = getTool();

    const updates: unknown[] = [];
    await tool.execute(
      "call-4",
      { urls: ["https://example.com"] },
      undefined,
      (u) => updates.push(u),
      { cwd: "/tmp" }
    );

    expect(updates).toHaveLength(1);
    const update = updates[0] as { content: Array<{ type: string; text: string }> };
    expect(update.content[0]!.text).toContain("Extracting content from 1 URL");
  });

  test("throws on empty URL array", async () => {
    const { api, getTool } = createMockAPI();
    registerWebExtractTool(api, createMockClient(mockResponse()));
    const tool = getTool();

    expect(
      tool.execute("call-5", { urls: [] }, undefined, undefined, { cwd: "/tmp" })
    ).rejects.toThrow("URLs array cannot be empty");
  });

  test("throws when URLs array is not an array", async () => {
    const { api, getTool } = createMockAPI();
    registerWebExtractTool(api, createMockClient(mockResponse()));
    const tool = getTool();

    expect(
      tool.execute("call-6", { urls: "not-an-array" as unknown as [] }, undefined, undefined, {
        cwd: "/tmp",
      })
    ).rejects.toThrow("URLs must be an array");
  });

  test("throws when URL is invalid", async () => {
    const { api, getTool } = createMockAPI();
    registerWebExtractTool(api, createMockClient(mockResponse()));
    const tool = getTool();

    expect(
      tool.execute("call-7", { urls: ["not-a-valid-url"] }, undefined, undefined, {
        cwd: "/tmp",
      })
    ).rejects.toThrow("Invalid URL format");
  });

  test("throws when URL exceeds max count", async () => {
    const { api, getTool } = createMockAPI();
    registerWebExtractTool(api, createMockClient(mockResponse()));
    const tool = getTool();

    const urls = Array.from({ length: 21 }, (_, i) => `https://example${i}.com`);

    expect(tool.execute("call-8", { urls }, undefined, undefined, { cwd: "/tmp" })).rejects.toThrow(
      "Maximum 20 URLs allowed"
    );
  });

  test("handles multiple URLs", async () => {
    const { api, getTool } = createMockAPI();
    registerWebExtractTool(
      api,
      createMockClient({
        results: [
          {
            url: "https://example1.com",
            title: "Article 1",
            rawContent: "Content 1",
          },
          {
            url: "https://example2.com",
            title: "Article 2",
            rawContent: "Content 2",
          },
          {
            url: "https://example3.com",
            title: "Article 3",
            rawContent: "Content 3",
          },
        ],
        failedResults: [],
      })
    );
    const tool = getTool();

    const result = (await tool.execute(
      "call-9",
      { urls: ["https://example1.com", "https://example2.com", "https://example3.com"] },
      undefined,
      undefined,
      { cwd: "/tmp" }
    )) as { details: Record<string, unknown> };

    expect(result.details.urlCount).toBe(3);
    expect(result.details.successCount).toBe(3);
    expect(result.details.failureCount).toBe(0);
    expect(result.details.results).toHaveLength(3);
  });

  test("handles empty results", async () => {
    const { api, getTool } = createMockAPI();
    registerWebExtractTool(
      api,
      createMockClient({
        results: [],
        failedResults: [
          {
            url: "https://failed.com",
            error: "Failed to extract",
          },
        ],
      })
    );
    const tool = getTool();

    const result = (await tool.execute(
      "call-10",
      { urls: ["https://failed.com"] },
      undefined,
      undefined,
      { cwd: "/tmp" }
    )) as {
      content: Array<{ type: string; text: string }>;
      details: Record<string, unknown>;
    };

    expect(result.details.successCount).toBe(0);
    expect(result.details.failureCount).toBe(1);
    expect(result.content[0]!.text).toContain("No content was extracted successfully");
  });

  test("includes images when requested", async () => {
    const { api, getTool } = createMockAPI();
    registerWebExtractTool(api, createMockClient(mockResponse()));
    const tool = getTool();

    const result = (await tool.execute(
      "call-11",
      { urls: ["https://example.com"], include_images: true },
      undefined,
      undefined,
      { cwd: "/tmp" }
    )) as { details: Record<string, unknown> };

    expect(result.details.includeImages).toBe(true);
  });

  test("handles text format", async () => {
    const { api, getTool } = createMockAPI();
    registerWebExtractTool(api, createMockClient(mockResponse()));
    const tool = getTool();

    const result = (await tool.execute(
      "call-12",
      { urls: ["https://example.com"], format: "text" },
      undefined,
      undefined,
      { cwd: "/tmp" }
    )) as { details: Record<string, unknown> };

    expect(result.details.format).toBe("text");
  });

  test("handles query parameter", async () => {
    const { api, getTool } = createMockAPI();
    registerWebExtractTool(api, createMockClient(mockResponse()));
    const tool = getTool();

    const result = (await tool.execute(
      "call-13",
      { urls: ["https://example.com"], query: "find specific content" },
      undefined,
      undefined,
      { cwd: "/tmp" }
    )) as { details: Record<string, unknown> };

    expect(result.details.query).toBe("find specific content");
  });

  test("has correct tool description", () => {
    const { api, getTool } = createMockAPI();
    registerWebExtractTool(api, createMockClient(mockResponse()));
    const tool = getTool();

    expect(tool.description).toContain("Tavily");
    expect(tool.description).toContain("2000 lines");
    expect(tool.description).toContain("50KB");
  });

  test("has prompt snippet and guidelines", () => {
    const { api, getTool } = createMockAPI();
    registerWebExtractTool(api, createMockClient(mockResponse()));
    const tool = getTool();

    expect(tool.promptSnippet).toContain("content");
    expect(tool.promptGuidelines).toBeDefined();
    expect(Array.isArray(tool.promptGuidelines)).toBe(true);
    expect(tool.promptGuidelines.length).toBeGreaterThan(0);
  });

  test("has parameters schema", () => {
    const { api, getTool } = createMockAPI();
    registerWebExtractTool(api, createMockClient(mockResponse()));
    const tool = getTool();

    expect(tool.parameters).toBeDefined();
    expect((tool.parameters as { type: string }).type).toBe("object");
  });

  test("has execute function", () => {
    const { api, getTool } = createMockAPI();
    registerWebExtractTool(api, createMockClient(mockResponse()));
    const tool = getTool();

    expect(typeof tool.execute).toBe("function");
  });

  test("has renderCall function", () => {
    const { api, getTool } = createMockAPI();
    registerWebExtractTool(api, createMockClient(mockResponse()));
    const tool = getTool();

    expect(typeof tool.renderCall).toBe("function");
  });

  test("has renderResult function", () => {
    const { api, getTool } = createMockAPI();
    registerWebExtractTool(api, createMockClient(mockResponse()));
    const tool = getTool();

    expect(typeof tool.renderResult).toBe("function");
  });

  test("throws when client.extract fails", async () => {
    const client = {
      extract: async () => {
        throw new Error("API rate limit exceeded");
      },
    } as unknown as import("@tavily/core").TavilyClient;

    const { api, getTool } = createMockAPI();
    registerWebExtractTool(api, client);
    const tool = getTool();

    expect(
      tool.execute("call-14", { urls: ["https://example.com"] }, undefined, undefined, {
        cwd: "/tmp",
      })
    ).rejects.toThrow("API rate limit exceeded");
  });

  test("truncates large content and saves full output to temp file", async () => {
    // Generate >50KB content to trigger truncation
    const bigContent = "X".repeat(60000);
    const { api, getTool } = createMockAPI();
    const testCwd = "/tmp/test-truncation-pipeline";
    registerWebExtractTool(
      api,
      createMockClient({
        results: [
          {
            url: "https://example.com/big-page",
            title: "Big Page",
            rawContent: bigContent,
          },
        ],
        failedResults: [],
      })
    );
    const tool = getTool();

    const result = (await tool.execute(
      "call-truncation",
      { urls: ["https://example.com/big-page"] },
      undefined,
      undefined,
      { cwd: testCwd }
    )) as {
      content: Array<{ type: string; text: string }>;
      details: Record<string, unknown>;
    };

    // Output should be truncated
    expect(result.content[0]!.text).toContain("[Output truncated:");

    // Notice should instruct agent to use read tool
    expect(result.content[0]!.text).toContain(
      "Use the read tool to read the full output from this file."
    );

    // Details should have truncation info
    expect(result.details.truncation).toBeDefined();
    expect((result.details.truncation as { truncated: boolean }).truncated).toBe(true);

    // Full output path should be set
    expect(result.details.fullOutputPath).toBeDefined();
    expect(typeof result.details.fullOutputPath).toBe("string");

    // Verify temp file exists and contains the full content
    const tempFile = result.details.fullOutputPath as string;
    const fileContent = await Bun.file(tempFile).text();
    expect(fileContent).toContain(bigContent);
  });
});
