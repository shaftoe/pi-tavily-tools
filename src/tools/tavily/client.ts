/**
 * Tavily Client Management
 *
 * Creates Tavily client instances with proper initialization.
 */

import {
  tavily,
  type TavilyClient,
  type TavilyExtractOptions,
  type TavilySearchOptions,
} from "@tavily/core";

// ============================================================================
// Constants
// ============================================================================

/** Default number of search results when max_results is not specified. */
export const DEFAULT_MAX_RESULTS = 8;

// ============================================================================
// Client Creation
// ============================================================================

/**
 * Create a new Tavily client instance
 * @throws {Error} If TAVILY_API_KEY is not set or client initialization fails
 */
export function createTavilyClient(apiKey?: string): TavilyClient {
  const key = apiKey ?? process.env.TAVILY_API_KEY;
  if (!key) {
    throw new Error(
      "TAVILY_API_KEY environment variable is not set. " +
        'Please set it with: export TAVILY_API_KEY="your-api-key" ' +
        "or get a free key from https://tavily.com"
    );
  }

  try {
    return tavily({ apiKey: key });
  } catch (error) {
    throw new Error(
      `Failed to initialize Tavily client: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Build Tavily search options from parameters
 */
export function buildSearchOptions(params: Record<string, unknown>): TavilySearchOptions {
  return {
    maxResults:
      typeof params.max_results === "number"
        ? Math.max(1, Math.min(20, params.max_results))
        : DEFAULT_MAX_RESULTS,
    searchDepth: (params.search_depth as "basic" | "advanced") ?? "basic",
    includeAnswer: params.include_answer !== false,
    includeImages: params.include_images === true,
    includeRawContent: params.include_raw_content === true ? "markdown" : false,
    days: typeof params.days === "number" ? params.days : undefined,
    includeDomains: undefined,
    excludeDomains: undefined,
  };
}

/**
 * Create a search function pre-bound with a client
 * @param client Tavily client instance
 * @returns Search function
 */
export function createSearchFunction(client: TavilyClient) {
  return client.search.bind(client);
}

/**
 * Validate search query
 * @throws {Error} If query is empty or whitespace only
 */
export function validateQuery(query: string): string {
  const trimmed = query.trim();
  if (!trimmed) {
    throw new Error("Query cannot be empty");
  }
  return trimmed;
}

// ============================================================================
// Extract Helpers
// ============================================================================

/**
 * Build Tavily extract options from parameters
 */
export function buildExtractOptions(params: Record<string, unknown>): TavilyExtractOptions {
  return {
    extractDepth: (params.extract_depth as "basic" | "advanced") ?? "basic",
    includeImages: params.include_images === true,
    format: (params.format as "markdown" | "text") ?? "markdown",
    query: typeof params.query === "string" ? params.query : undefined,
  };
}

/**
 * Validate URLs array
 * @throws {Error} If URLs array is empty, exceeds max count, or contains invalid URLs
 */
export function validateUrls(urls: unknown[]): string[] {
  if (!Array.isArray(urls)) {
    throw new Error("URLs must be an array");
  }

  if (urls.length === 0) {
    throw new Error("URLs array cannot be empty");
  }

  if (urls.length > 20) {
    throw new Error("Maximum 20 URLs allowed, got " + urls.length);
  }

  const validatedUrls: string[] = [];
  for (const url of urls) {
    if (typeof url !== "string") {
      throw new Error("All URLs must be strings");
    }

    const trimmed = url.trim();
    if (!trimmed) {
      throw new Error("URLs cannot be empty strings");
    }

    // Basic URL validation - must start with http:// or https://
    if (!trimmed.match(/^https?:\/\//i)) {
      throw new Error(`Invalid URL format: ${trimmed}. URLs must start with http:// or https://`);
    }

    validatedUrls.push(trimmed);
  }

  return validatedUrls;
}
