/**
 * Unit tests for details builder
 */

import type { TruncationResult } from "@mariozechner/pi-coding-agent";
import type { TavilyExtractOptions, TavilySearchOptions } from "@tavily/core";
import { describe, expect, test } from "bun:test";
import { buildExtractSuccessDetails, buildSuccessDetails } from "../src/tools/tavily/details.js";
import type { ExtractFailedResult, ExtractResult, SearchResult } from "../src/tools/tavily/types.js";

// ============================================================================
// Helpers
// ============================================================================

function makeResults(overrides: Partial<SearchResult>[] = []): SearchResult[] {
  return overrides.map((r, i) => ({
    title: r.title ?? `Result ${i + 1}`,
    url: r.url ?? `https://example.com/${i + 1}`,
    score: r.score ?? 0.5,
    ...r,
  }));
}

function defaultOptions(): TavilySearchOptions {
  return {
    maxResults: 5,
    searchDepth: "basic",
    includeAnswer: true,
    includeImages: false,
    includeRawContent: false,
  };
}

function makeInput(overrides: Record<string, unknown> = {}) {
  return {
    query: "test query",
    options: defaultOptions(),
    answer: null as string | null,
    results: [] as SearchResult[],
    ...overrides,
  };
}

// ============================================================================
// Tests
// ============================================================================

describe("buildSuccessDetails", () => {
  test("returns minimal details with defaults", () => {
    const details = buildSuccessDetails(makeInput());

    expect(details.query).toBe("test query");
    expect(details.maxResults).toBe(5);
    expect(details.searchDepth).toBe("basic");
    expect(details.includeAnswer).toBe(true);
    expect(details.includeRawContent).toBe(false);
    expect(details.includeImages).toBe(false);
    expect(details.resultCount).toBe(0);
    expect(details.sources).toEqual([]);
    expect(details.answer).toBeUndefined();
    expect(details.days).toBeUndefined();
    expect(details.truncation).toBeUndefined();
    expect(details.fullOutputPath).toBeUndefined();
  });

  test("maps results to sources with title, url, score", () => {
    const results = makeResults([
      { title: "First", url: "https://a.com", score: 0.95 },
      { title: "Second", url: "https://b.com", score: 0.8 },
    ]);

    const details = buildSuccessDetails(makeInput({ results }));

    expect(details.resultCount).toBe(2);
    expect(details.sources).toEqual([
      { title: "First", url: "https://a.com", score: 0.95 },
      { title: "Second", url: "https://b.com", score: 0.8 },
    ]);
  });

  test("includes answer when provided", () => {
    const details = buildSuccessDetails(makeInput({ answer: "AI says hello" }));
    expect(details.answer).toBe("AI says hello");
  });

  test("omits answer when null", () => {
    const details = buildSuccessDetails(makeInput({ answer: null }));
    expect(details.answer).toBeUndefined();
  });

  test("passes through days from options", () => {
    const details = buildSuccessDetails(makeInput({ options: { ...defaultOptions(), days: 7 } }));
    expect(details.days).toBe(7);
  });

  test("passes through truncation and fullOutputPath", () => {
    const truncation = {
      content: "truncated",
      truncated: true,
      truncatedBy: "lines" as const,
      outputLines: 10,
      totalLines: 100,
      outputBytes: 500,
      totalBytes: 5000,
      maxLines: 2000,
      maxBytes: 51200,
      lastLinePartial: false,
      firstLineExceedsLimit: false,
    } satisfies TruncationResult;

    const details = buildSuccessDetails(
      makeInput({ truncation, fullOutputPath: "/tmp/search-123.txt" })
    );
    expect(details.truncation).toBe(truncation);
    expect(details.fullOutputPath).toBe("/tmp/search-123.txt");
  });

  // optionDefaults coverage
  test("uses default maxResults of 5 when undefined", () => {
    const details = buildSuccessDetails(
      makeInput({ options: { ...defaultOptions(), maxResults: undefined } })
    );
    expect(details.maxResults).toBe(5);
  });

  test("uses provided maxResults", () => {
    const details = buildSuccessDetails(
      makeInput({ options: { ...defaultOptions(), maxResults: 15 } })
    );
    expect(details.maxResults).toBe(15);
  });

  test("uses default searchDepth 'basic' when undefined", () => {
    const details = buildSuccessDetails(
      makeInput({ options: { ...defaultOptions(), searchDepth: undefined } })
    );
    expect(details.searchDepth).toBe("basic");
  });

  test("converts advanced searchDepth to string", () => {
    const details = buildSuccessDetails(
      makeInput({ options: { ...defaultOptions(), searchDepth: "advanced" } })
    );
    expect(details.searchDepth).toBe("advanced");
  });

  test("includeAnswer defaults to true when undefined", () => {
    const details = buildSuccessDetails(
      makeInput({ options: { ...defaultOptions(), includeAnswer: undefined } })
    );
    expect(details.includeAnswer).toBe(true);
  });

  test("includeAnswer is false when explicitly false", () => {
    const details = buildSuccessDetails(
      makeInput({ options: { ...defaultOptions(), includeAnswer: false } })
    );
    expect(details.includeAnswer).toBe(false);
  });

  test("includeImages defaults to false when undefined", () => {
    const details = buildSuccessDetails(
      makeInput({ options: { ...defaultOptions(), includeImages: undefined } })
    );
    expect(details.includeImages).toBe(false);
  });

  test("includeRawContent is true when set to 'markdown' string", () => {
    const details = buildSuccessDetails(
      makeInput({ options: { ...defaultOptions(), includeRawContent: "markdown" } })
    );
    expect(details.includeRawContent).toBe(true);
  });

  test("includeRawContent is false when set to boolean false", () => {
    const details = buildSuccessDetails(
      makeInput({ options: { ...defaultOptions(), includeRawContent: false } })
    );
    expect(details.includeRawContent).toBe(false);
  });

  test("excludes content/rawContent from sources", () => {
    const results = makeResults([
      { title: "Rich", url: "https://c.com", score: 0.9, content: "snippet", rawContent: "full" },
    ]);

    const details = buildSuccessDetails(makeInput({ results }));

    expect(details.sources[0]).toEqual({
      title: "Rich",
      url: "https://c.com",
      score: 0.9,
    });
  });
});

// ============================================================================
// buildExtractSuccessDetails tests
// ============================================================================

describe("buildExtractSuccessDetails", () => {
  function makeExtractResults(overrides: Partial<ExtractResult>[] = []): ExtractResult[] {
    return overrides.map((r, i) => ({
      url: r.url ?? `https://example.com/${i + 1}`,
      title: r.title ?? `Extract ${i + 1}`,
      rawContent: r.rawContent ?? "Sample content",
      images: r.images,
      ...r,
    }));
  }

  function makeFailedResults(overrides: Partial<ExtractFailedResult>[] = []): ExtractFailedResult[] {
    return overrides.map((f, i) => ({
      url: f.url ?? `https://failed-${i + 1}.com`,
      error: f.error ?? "Extraction failed",
      ...f,
    }));
  }

  function defaultExtractOptions(): TavilyExtractOptions {
    return {
      extractDepth: "basic",
      includeImages: false,
      format: "markdown",
      urls: ["https://example.com"],
    };
  }

  function makeExtractInput(overrides: Record<string, unknown> = {}) {
    return {
      urlCount: 1,
      options: defaultExtractOptions(),
      results: [] as ExtractResult[],
      failedResults: [] as ExtractFailedResult[],
      ...overrides,
    };
  }

  // Extract option defaults
  test("uses default extractDepth 'basic' when undefined", () => {
    const details = buildExtractSuccessDetails(
      makeExtractInput({ options: { ...defaultExtractOptions(), extractDepth: undefined } })
    );
    expect(details.extractDepth).toBe("basic");
  });

  test("uses provided extractDepth 'advanced'", () => {
    const details = buildExtractSuccessDetails(
      makeExtractInput({ options: { ...defaultExtractOptions(), extractDepth: "advanced" } })
    );
    expect(details.extractDepth).toBe("advanced");
  });

  test("includesImages defaults to false when undefined", () => {
    const details = buildExtractSuccessDetails(
      makeExtractInput({ options: { ...defaultExtractOptions(), includeImages: undefined } })
    );
    expect(details.includeImages).toBe(false);
  });

  test("uses provided includeImages true", () => {
    const details = buildExtractSuccessDetails(
      makeExtractInput({ options: { ...defaultExtractOptions(), includeImages: true } })
    );
    expect(details.includeImages).toBe(true);
  });

  test("format defaults to 'markdown' when undefined", () => {
    const details = buildExtractSuccessDetails(
      makeExtractInput({ options: { ...defaultExtractOptions(), format: undefined } })
    );
    expect(details.format).toBe("markdown");
  });

  test("uses provided format 'text'", () => {
    const details = buildExtractSuccessDetails(
      makeExtractInput({ options: { ...defaultExtractOptions(), format: "text" } })
    );
    expect(details.format).toBe("text");
  });

  // Success/failure count mapping
  test("maps success count from results array length", () => {
    const results = makeExtractResults([
      { url: "https://a.com" },
      { url: "https://b.com" },
      { url: "https://c.com" },
    ]);
    const details = buildExtractSuccessDetails(makeExtractInput({ results }));
    expect(details.successCount).toBe(3);
  });

  test("maps failure count from failedResults array length", () => {
    const failedResults = makeFailedResults([
      { url: "https://fail1.com", error: "Error 1" },
      { url: "https://fail2.com", error: "Error 2" },
    ]);
    const details = buildExtractSuccessDetails(makeExtractInput({ failedResults }));
    expect(details.failureCount).toBe(2);
  });

  test("handles zero success and failure counts", () => {
    const details = buildExtractSuccessDetails(makeExtractInput());
    expect(details.successCount).toBe(0);
    expect(details.failureCount).toBe(0);
  });

  // Truncation and fullOutputPath handling
  test("passes through truncation metadata", () => {
    const truncation = {
      content: "truncated",
      truncated: true,
      truncatedBy: "lines" as const,
      outputLines: 10,
      totalLines: 100,
      outputBytes: 500,
      totalBytes: 5000,
      maxLines: 2000,
      maxBytes: 51200,
      lastLinePartial: false,
      firstLineExceedsLimit: false,
    } satisfies TruncationResult;
    const details = buildExtractSuccessDetails(makeExtractInput({ truncation }));
    expect(details.truncation).toBe(truncation);
  });

  test("passes through fullOutputPath", () => {
    const details = buildExtractSuccessDetails(
      makeExtractInput({ fullOutputPath: "/tmp/extract-123.txt" })
    );
    expect(details.fullOutputPath).toBe("/tmp/extract-123.txt");
  });

  // Query parameter handling
  test("includes query from options when provided", () => {
    const details = buildExtractSuccessDetails(
      makeExtractInput({ options: { ...defaultExtractOptions(), query: "search terms" } })
    );
    expect(details.query).toBe("search terms");
  });

  test("handles missing query as undefined", () => {
    const details = buildExtractSuccessDetails(
      makeExtractInput({ options: { ...defaultExtractOptions(), query: undefined } })
    );
    expect(details.query).toBeUndefined();
  });

  // Other fields
  test("includes urlCount from input", () => {
    const details = buildExtractSuccessDetails(makeExtractInput({ urlCount: 5 }));
    expect(details.urlCount).toBe(5);
  });

  test("includes results array from input", () => {
    const results = makeExtractResults([
      { url: "https://a.com", rawContent: "Content A" },
      { url: "https://b.com", rawContent: "Content B" },
    ]);
    const details = buildExtractSuccessDetails(makeExtractInput({ results }));
    expect(details.results).toEqual(results);
  });

  test("includes failedResults array from input", () => {
    const failedResults = makeFailedResults([
      { url: "https://fail1.com", error: "Error 1" },
      { url: "https://fail2.com", error: "Error 2" },
    ]);
    const details = buildExtractSuccessDetails(makeExtractInput({ failedResults }));
    expect(details.failedResults).toEqual(failedResults);
  });

  // Empty arrays and edge cases
  test("handles empty results array", () => {
    const details = buildExtractSuccessDetails(makeExtractInput({ results: [] }));
    expect(details.results).toEqual([]);
    expect(details.successCount).toBe(0);
  });

  test("handles empty failedResults array", () => {
    const details = buildExtractSuccessDetails(makeExtractInput({ failedResults: [] }));
    expect(details.failedResults).toEqual([]);
    expect(details.failureCount).toBe(0);
  });
});
