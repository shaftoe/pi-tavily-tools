/**
 * Unit tests for Tavily TUI renderers
 */

import type { Text } from "@mariozechner/pi-tui";
import { describe, expect, test } from "bun:test";
import { renderWebSearchCall, renderWebSearchResult } from "../src/tools/tavily/renderers.js";

// Helper to access private text property for testing
function getText(text: Text): string {
  return (text as unknown as { text: string }).text;
}

describe("renderWebSearchCall", () => {
  const mockTheme = {
    fg: (color: string, text: string) => `[${color}:${text}]`,
    bold: (text: string) => `**${text}**`,
  };

  test("renders basic search call", () => {
    const args = { query: "test query" };

    const result = renderWebSearchCall(args, mockTheme);

    expect(getText(result)).toContain("toolTitle:**web_search **");
    expect(getText(result)).toContain('accent:"test query"');
  });

  test("includes max_results when not default", () => {
    const args = { query: "test", max_results: 10 };

    const result = renderWebSearchCall(args, mockTheme);

    expect(getText(result)).toContain("max=10");
  });

  test("does not include max_results when it is default (5)", () => {
    const args = { query: "test", max_results: 5 };

    const result = renderWebSearchCall(args, mockTheme);

    expect(getText(result)).not.toContain("max=5");
  });

  test("includes advanced search depth", () => {
    const args = { query: "test", search_depth: "advanced" };

    const result = renderWebSearchCall(args, mockTheme);

    expect(getText(result)).toContain("advanced");
  });

  test("does not include basic search depth", () => {
    const args = { query: "test", search_depth: "basic" };

    const result = renderWebSearchCall(args, mockTheme);

    expect(getText(result)).not.toContain("basic");
  });

  test("includes no-answer when include_answer is false", () => {
    const args = { query: "test", include_answer: false };

    const result = renderWebSearchCall(args, mockTheme);

    expect(getText(result)).toContain("no-answer");
  });

  test("does not include answer option when include_answer is true (default)", () => {
    const args = { query: "test", include_answer: true };

    const result = renderWebSearchCall(args, mockTheme);

    expect(getText(result)).not.toContain("answer");
  });

  test("includes raw-content when include_raw_content is true", () => {
    const args = { query: "test", include_raw_content: true };

    const result = renderWebSearchCall(args, mockTheme);

    expect(getText(result)).toContain("raw-content");
  });

  test("includes images when include_images is true", () => {
    const args = { query: "test", include_images: true };

    const result = renderWebSearchCall(args, mockTheme);

    expect(getText(result)).toContain("images");
  });

  test("includes days filter", () => {
    const args = { query: "test", days: 7 };

    const result = renderWebSearchCall(args, mockTheme);

    expect(getText(result)).toContain("7d");
  });

  test("includes multiple options in correct order", () => {
    const args = {
      query: "test",
      max_results: 10,
      search_depth: "advanced",
      include_images: true,
      days: 7,
    };

    const result = renderWebSearchCall(args, mockTheme);

    const text = getText(result);
    expect(text).toContain("max=10");
    expect(text).toContain("advanced");
    expect(text).toContain("images");
    expect(text).toContain("7d");
  });

  test("formats options with brackets when present", () => {
    const args = { query: "test", max_results: 10 };

    const result = renderWebSearchCall(args, mockTheme);

    const text = getText(result);
    expect(text).toContain("dim:[");
    expect(text).toContain("]");
  });

  test("does not show brackets when no options", () => {
    const args = { query: "test" };

    const result = renderWebSearchCall(args, mockTheme);

    const text = getText(result);
    expect(text).not.toContain("dim:[");
  });
});

describe("renderWebSearchResult", () => {
  const mockTheme = {
    fg: (color: string, text: string) => `[${color}:${text}]`,
    bold: (text: string) => `**${text}**`,
    accent: (text: string) => `[accent:${text}]`,
    dim: (text: string) => `[dim:${text}]`,
    success: (text: string) => `[success:${text}]`,
    warning: (text: string) => `[warning:${text}]`,
    error: (text: string) => `[error:${text}]`,
    text: (text: string) => `[text:${text}]`,
  };

  test("shows loading state when isPartial is true", () => {
    const result = {
      content: [],
    };
    const state = { expanded: false, isPartial: true };

    const rendered = renderWebSearchResult(result, state, mockTheme);

    expect(getText(rendered)).toContain("warning:Searching...");
  });

  test("shows error state when details contains error", () => {
    const result = {
      details: { error: "API key missing" },
      content: [],
    };
    const state = { expanded: false, isPartial: false };

    const rendered = renderWebSearchResult(result, state, mockTheme);

    expect(getText(rendered)).toContain("error:Error: API key missing");
  });

  test("shows result count in non-expanded state", () => {
    const result = {
      details: {
        resultCount: 5,
        searchDepth: "basic",
        sources: [{ title: "Test", url: "https://example.com", score: 0.9 }],
        includeAnswer: false,
      },
      content: [],
    };
    const state = { expanded: false, isPartial: false };

    const rendered = renderWebSearchResult(result, state, mockTheme);

    expect(getText(rendered)).toContain("success:5 results");
  });

  test("shows singular result when count is 1", () => {
    const result = {
      details: {
        resultCount: 1,
        searchDepth: "basic",
        sources: [{ title: "Test", url: "https://example.com", score: 0.9 }],
        includeAnswer: false,
      },
      content: [],
    };
    const state = { expanded: false, isPartial: false };

    const rendered = renderWebSearchResult(result, state, mockTheme);

    expect(getText(rendered)).toContain("success:1 result");
    expect(getText(rendered)).not.toContain("1 results");
  });

  test("shows advanced search depth badge", () => {
    const result = {
      details: {
        resultCount: 3,
        searchDepth: "advanced",
        sources: [],
        includeAnswer: false,
      },
      content: [],
    };
    const state = { expanded: false, isPartial: false };

    const rendered = renderWebSearchResult(result, state, mockTheme);

    expect(getText(rendered)).toContain("(advanced)");
  });

  test("does not show basic search depth badge", () => {
    const result = {
      details: {
        resultCount: 3,
        searchDepth: "basic",
        sources: [],
        includeAnswer: false,
      },
      content: [],
    };
    const state = { expanded: false, isPartial: false };

    const rendered = renderWebSearchResult(result, state, mockTheme);

    expect(getText(rendered)).not.toContain("(basic)");
  });

  test("shows truncation warning when output is truncated", () => {
    const result = {
      details: {
        resultCount: 3,
        searchDepth: "basic",
        truncation: {
          truncated: true,
          outputLines: 10,
          totalLines: 100,
          outputBytes: 1000,
          totalBytes: 10000,
        },
        sources: [],
        includeAnswer: false,
      },
      content: [],
    };
    const state = { expanded: false, isPartial: false };

    const rendered = renderWebSearchResult(result, state, mockTheme);

    expect(getText(rendered)).toContain("warning:(truncated)");
  });

  test("shows sources in expanded state", () => {
    const result = {
      details: {
        resultCount: 2,
        searchDepth: "basic",
        sources: [
          { title: "Source 1", url: "https://example.com/1", score: 0.9 },
          { title: "Source 2", url: "https://example.com/2", score: 0.8 },
        ],
        includeAnswer: false,
      },
      content: [],
    };
    const state = { expanded: true, isPartial: false };

    const rendered = renderWebSearchResult(result, state, mockTheme);

    const text = getText(rendered);
    expect(text).toContain("Source 1");
    expect(text).toContain("Source 2");
    expect(text).toContain("https://example.com/1");
    expect(text).toContain("https://example.com/2");
  });

  test("limits sources to 5 in expanded view", () => {
    const sources = Array.from({ length: 10 }, (_, i) => ({
      title: `Source ${i}`,
      url: `https://example.com/${i}`,
      score: 0.9 - i * 0.1,
    }));

    const result = {
      details: {
        resultCount: 10,
        searchDepth: "basic",
        sources,
        includeAnswer: false,
      },
      content: [],
    };
    const state = { expanded: true, isPartial: false };

    const rendered = renderWebSearchResult(result, state, mockTheme);

    const text = getText(rendered);
    expect(text).toContain("Source 0");
    expect(text).toContain("Source 4");
    expect(text).toContain("... 5 more");
    expect(text).not.toContain("Source 5");
  });

  test("shows full output path when truncated", () => {
    const result = {
      details: {
        resultCount: 3,
        searchDepth: "basic",
        sources: [{ title: "Test", url: "https://example.com", score: 0.9 }],
        fullOutputPath: "/tmp/output.txt",
        truncation: {
          truncated: true,
          outputLines: 10,
          totalLines: 100,
          outputBytes: 1000,
          totalBytes: 10000,
        },
        includeAnswer: false,
      },
      content: [],
    };
    const state = { expanded: true, isPartial: false };

    const rendered = renderWebSearchResult(result, state, mockTheme);

    expect(getText(rendered)).toContain("/tmp/output.txt");
  });

  test("shows AI answer in expanded view when includeAnswer is true", () => {
    const result = {
      details: {
        resultCount: 3,
        searchDepth: "basic",
        sources: [],
        answer: "Paris is the capital of France",
        includeAnswer: true,
      },
      content: [],
    };
    const state = { expanded: true, isPartial: false };

    const rendered = renderWebSearchResult(result, state, mockTheme);

    const text = getText(rendered);
    expect(text).toContain("AI Answer:");
    expect(text).toContain("Paris is the capital of France");
  });

  test("shows AI answer when present (includeAnswer is hardcoded to true in renderWebSearchResult)", () => {
    const result = {
      details: {
        resultCount: 3,
        searchDepth: "basic",
        sources: [],
        answer: "Paris is the capital of France",
        includeAnswer: false, // Note: this is ignored by renderWebSearchResult
      },
      content: [],
    };
    const state = { expanded: true, isPartial: false };

    const rendered = renderWebSearchResult(result, state, mockTheme);

    // The function hardcodes includeAnswer: true, so answer is shown
    expect(getText(rendered)).toContain("AI Answer:");
    expect(getText(rendered)).toContain("Paris is the capital of France");
  });

  test("does not show AI answer when answer is not present in details", () => {
    const result = {
      details: {
        resultCount: 3,
        searchDepth: "basic",
        sources: [],
      },
      content: [],
    };
    const state = { expanded: true, isPartial: false };

    const rendered = renderWebSearchResult(result, state, mockTheme);

    expect(getText(rendered)).not.toContain("AI Answer:");
  });

  test("shows days badge when days is set", () => {
    const result = {
      details: {
        resultCount: 3,
        searchDepth: "basic",
        days: 7,
        sources: [],
        includeAnswer: false,
      },
      content: [],
    };
    const state = { expanded: false, isPartial: false };

    const rendered = renderWebSearchResult(result, state, mockTheme);

    expect(getText(rendered)).toContain("(7d)");
  });

  test("handles undefined details gracefully", () => {
    const result = { content: [] };
    const state = { expanded: true, isPartial: false };

    const rendered = renderWebSearchResult(result, state, mockTheme);

    expect(getText(rendered)).toBeDefined();
  });
});
