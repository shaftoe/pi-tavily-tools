/**
 * Details builder for Tavily tool results
 *
 * Constructs WebSearchDetails for the success path,
 * centralizing the default-value logic so execute() stays clean.
 *
 * Error handling is delegated to Pi — thrown errors are caught by the
 * framework and reported to the LLM with isError: true.
 */

import type { TruncationResult } from "@mariozechner/pi-coding-agent";
import type { TavilySearchOptions } from "@tavily/core";
import type { SearchResult, WebSearchDetails } from "./types.js";

// ============================================================================
// Option normalization
// ============================================================================

/**
 * Read normalized param defaults from TavilySearchOptions.
 */
function optionDefaults(options: TavilySearchOptions) {
  return {
    maxResults: options.maxResults ?? 5,
    searchDepth: String(options.searchDepth ?? "basic"),
    includeImages: options.includeImages ?? false,
    includeAnswer: options.includeAnswer !== false,
    includeRawContent: typeof options.includeRawContent === "string",
  };
}

// ============================================================================
// Success details
// ============================================================================

export interface SuccessDetailsInput {
  query: string;
  options: TavilySearchOptions;
  answer: string | null;
  results: SearchResult[];
  truncation?: TruncationResult;
  fullOutputPath?: string;
}

/**
 * Build WebSearchDetails for a successful search.
 */
export function buildSuccessDetails(input: SuccessDetailsInput): WebSearchDetails {
  const defaults = optionDefaults(input.options);

  return {
    query: input.query,
    maxResults: defaults.maxResults,
    searchDepth: defaults.searchDepth,
    includeAnswer: defaults.includeAnswer,
    includeRawContent: defaults.includeRawContent,
    includeImages: defaults.includeImages,
    days: input.options.days,
    answer: input.answer ?? undefined,
    resultCount: input.results.length,
    sources: input.results.map((r) => ({
      title: r.title,
      url: r.url,
      score: r.score,
    })),
    truncation: input.truncation,
    fullOutputPath: input.fullOutputPath,
  };
}
