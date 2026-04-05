/**
 * Unit tests for details builder
 */

import type { TruncationResult } from "@mariozechner/pi-coding-agent";
import type { TavilySearchOptions } from "@tavily/core";
import { describe, expect, test } from "bun:test";
import { buildSuccessDetails } from "../src/tools/tavily/details.js";
import type { SearchResult } from "../src/tools/tavily/types.js";

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
