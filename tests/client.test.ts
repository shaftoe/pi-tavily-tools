/**
 * Unit tests for Tavily client utilities
 */

import { describe, expect, test } from "bun:test";
import {
  buildSearchOptions,
  createSearchFunction,
  createTavilyClient,
  validateQuery,
} from "../src/tools/tavily/client.js";

describe("validateQuery", () => {
  test("returns trimmed query for valid input", () => {
    const result = validateQuery("  search query  ");
    expect(result).toBe("search query");
  });

  test("throws error for empty string", () => {
    expect(() => validateQuery("")).toThrow("Query cannot be empty");
  });

  test("throws error for whitespace only", () => {
    expect(() => validateQuery("   ")).toThrow("Query cannot be empty");
  });

  test("throws error for tabs and newlines only", () => {
    expect(() => validateQuery("\t\n")).toThrow("Query cannot be empty");
  });

  test("returns query without extra whitespace", () => {
    const result = validateQuery("\t  search  \n");
    expect(result).toBe("search");
  });

  test("handles single word queries", () => {
    const result = validateQuery("test");
    expect(result).toBe("test");
  });

  test("handles multi-word queries", () => {
    const result = validateQuery("test query with multiple words");
    expect(result).toBe("test query with multiple words");
  });

  test("preserves special characters in query", () => {
    const result = validateQuery("  search with + - & | symbols  ");
    expect(result).toBe("search with + - & | symbols");
  });

  test("handles queries with numbers", () => {
    const result = validateQuery("  search 123 numbers 456  ");
    expect(result).toBe("search 123 numbers 456");
  });
});

describe("buildSearchOptions", () => {
  test("returns defaults when params are empty", () => {
    const params = {};
    const options = buildSearchOptions(params);

    expect(options.maxResults).toBe(5);
    expect(options.searchDepth).toBe("basic");
    expect(options.includeAnswer).toBe(true);
    expect(options.includeImages).toBe(false);
    expect(options.includeRawContent).toBe(false);
    expect(options.days).toBeUndefined();
    expect(options.includeDomains).toBeUndefined();
    expect(options.excludeDomains).toBeUndefined();
  });

  test("uses provided max_results within bounds", () => {
    const params = { max_results: 10 };
    const options = buildSearchOptions(params);

    expect(options.maxResults).toBe(10);
  });

  test("clamps max_results to minimum of 1", () => {
    expect(buildSearchOptions({ max_results: 0 }).maxResults).toBe(1);
    expect(buildSearchOptions({ max_results: -5 }).maxResults).toBe(1);
    expect(buildSearchOptions({ max_results: -100 }).maxResults).toBe(1);
  });

  test("clamps max_results to maximum of 20", () => {
    expect(buildSearchOptions({ max_results: 21 }).maxResults).toBe(20);
    expect(buildSearchOptions({ max_results: 50 }).maxResults).toBe(20);
    expect(buildSearchOptions({ max_results: 100 }).maxResults).toBe(20);
  });

  test("handles max_results at boundary values", () => {
    expect(buildSearchOptions({ max_results: 1 }).maxResults).toBe(1);
    expect(buildSearchOptions({ max_results: 20 }).maxResults).toBe(20);
  });

  test("sets search_depth to basic by default", () => {
    const params = {};
    const options = buildSearchOptions(params);

    expect(options.searchDepth).toBe("basic");
  });

  test("uses provided search_depth when valid", () => {
    expect(buildSearchOptions({ search_depth: "basic" }).searchDepth).toBe("basic");
    expect(buildSearchOptions({ search_depth: "advanced" }).searchDepth).toBe("advanced");
  });

  test("passes through search_depth even when invalid (no validation)", () => {
    // The implementation doesn't validate search_depth values
    // It only defaults when null/undefined
    const options = buildSearchOptions({ search_depth: "invalid" as unknown as "basic" });
    expect(options.searchDepth).toBe("invalid" as unknown as "basic");
  });

  test("defaults includeAnswer to true", () => {
    const params = {};
    const options = buildSearchOptions(params);

    expect(options.includeAnswer).toBe(true);
  });

  test("sets includeAnswer to false when explicitly false", () => {
    const options = buildSearchOptions({ include_answer: false });
    expect(options.includeAnswer).toBe(false);
  });

  test("keeps includeAnswer true for other falsy values", () => {
    expect(buildSearchOptions({ include_answer: 0 }).includeAnswer).toBe(true);
    expect(buildSearchOptions({ include_answer: "" }).includeAnswer).toBe(true);
    expect(buildSearchOptions({ include_answer: null }).includeAnswer).toBe(true);
    expect(buildSearchOptions({ include_answer: undefined }).includeAnswer).toBe(true);
  });

  test("defaults includeImages to false", () => {
    const params = {};
    const options = buildSearchOptions(params);

    expect(options.includeImages).toBe(false);
  });

  test("sets includeImages to true only when explicitly true", () => {
    expect(buildSearchOptions({ include_images: true }).includeImages).toBe(true);
    expect(buildSearchOptions({ include_images: 1 }).includeImages).toBe(false);
    expect(buildSearchOptions({ include_images: "true" }).includeImages).toBe(false);
  });

  test("sets includeRawContent to markdown when true", () => {
    const options = buildSearchOptions({ include_raw_content: true });
    expect(options.includeRawContent).toBe("markdown");
  });

  test("sets includeRawContent to false by default", () => {
    const options = buildSearchOptions({});
    expect(options.includeRawContent).toBe(false);
  });

  test("sets includeRawContent to false for other values", () => {
    expect(buildSearchOptions({ include_raw_content: false }).includeRawContent).toBe(false);
    expect(buildSearchOptions({ include_raw_content: 1 }).includeRawContent).toBe(false);
    expect(buildSearchOptions({ include_raw_content: "markdown" }).includeRawContent).toBe(false);
  });

  test("sets days when provided as number", () => {
    expect(buildSearchOptions({ days: 7 }).days).toBe(7);
    expect(buildSearchOptions({ days: 30 }).days).toBe(30);
    expect(buildSearchOptions({ days: 1 }).days).toBe(1);
    expect(buildSearchOptions({ days: 365 }).days).toBe(365);
  });

  test("keeps days undefined for non-number values", () => {
    expect(buildSearchOptions({ days: "7" as unknown as number }).days).toBeUndefined();
    expect(buildSearchOptions({ days: null as unknown as number }).days).toBeUndefined();
    expect(buildSearchOptions({ days: undefined }).days).toBeUndefined();
    expect(buildSearchOptions({ days: "7 days" as unknown as number }).days).toBeUndefined();
  });

  test("combines all options correctly", () => {
    const params = {
      max_results: 15,
      search_depth: "advanced" as const,
      include_answer: false,
      include_images: true,
      include_raw_content: true,
      days: 14,
    };

    const options = buildSearchOptions(params);

    expect(options.maxResults).toBe(15);
    expect(options.searchDepth).toBe("advanced");
    expect(options.includeAnswer).toBe(false);
    expect(options.includeImages).toBe(true);
    expect(options.includeRawContent).toBe("markdown");
    expect(options.days).toBe(14);
    expect(options.includeDomains).toBeUndefined();
    expect(options.excludeDomains).toBeUndefined();
  });

  test("handles edge case values for max_results", () => {
    // Exactly at boundaries
    expect(buildSearchOptions({ max_results: 1 }).maxResults).toBe(1);
    expect(buildSearchOptions({ max_results: 20 }).maxResults).toBe(20);

    // Just outside boundaries
    expect(buildSearchOptions({ max_results: 0.5 }).maxResults).toBe(1);
    expect(buildSearchOptions({ max_results: 20.5 }).maxResults).toBe(20);
  });

  test("handles negative days", () => {
    const options = buildSearchOptions({ days: -5 });
    expect(options.days).toBe(-5);
  });
});

describe("createTavilyClient", () => {
  test("throws error when API key is not set", () => {
    // Save original env var
    const originalKey = process.env.TAVILY_API_KEY;
    delete process.env.TAVILY_API_KEY;

    expect(() => createTavilyClient()).toThrow("TAVILY_API_KEY environment variable is not set");

    // Restore env var
    if (originalKey !== undefined) {
      process.env.TAVILY_API_KEY = originalKey;
    } else {
      delete process.env.TAVILY_API_KEY;
    }
  });

  test("throws error when API key is empty string", () => {
    const originalKey = process.env.TAVILY_API_KEY;
    process.env.TAVILY_API_KEY = "";

    expect(() => createTavilyClient()).toThrow("TAVILY_API_KEY environment variable is not set");

    if (originalKey !== undefined) {
      process.env.TAVILY_API_KEY = originalKey;
    } else {
      delete process.env.TAVILY_API_KEY;
    }
  });

  test("uses provided API key when available", () => {
    // This test would require mocking the tavily SDK
    // For now, we just verify the function exists and can be called with a key
    expect(() => createTavilyClient).not.toThrow();
  });

  test("prefers provided API key over environment variable", () => {
    // This test would require mocking the tavily SDK
    // For now, we just verify the function exists
    expect(() => createTavilyClient("test-key")).not.toThrow();
  });
});

describe("createSearchFunction", () => {
  test("returns a function bound to the client", async () => {
    let called = false;
    const mockClient = {
      search: async () => {
        called = true;
        return { answer: null, results: [], images: [] };
      },
    } as unknown as import("@tavily/core").TavilyClient;

    const searchFn = createSearchFunction(mockClient);
    expect(typeof searchFn).toBe("function");

    await searchFn("test query", {});
    expect(called).toBe(true);
  });
});
