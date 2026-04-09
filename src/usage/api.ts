/**
 * Tavily Usage API Client
 *
 * Fetches usage data from the Tavily usage endpoint.
 * @see https://docs.tavily.com/documentation/api-reference/endpoint/usage
 */

const TAVILY_USAGE_API_URL = "https://api.tavily.com/usage";

/** Default retry-after duration in milliseconds (5 minutes) */
export const DEFAULT_RETRY_AFTER_MS = 300_000;

// ============================================================================
// Errors
// ============================================================================

/** Error thrown when the Tavily usage API rate limit is exceeded */
export class RateLimitError extends Error {
  readonly retryAfterMs: number;

  constructor(retryAfterMs: number) {
    super(`Tavily usage API rate limited; retry after ${retryAfterMs}ms`);
    this.name = "RateLimitError";
    this.retryAfterMs = retryAfterMs;
  }
}

// ============================================================================
// Utilities
// ============================================================================

/**
 * Parse the HTTP Retry-After header to milliseconds.
 * Tavily returns the value as decimal integer seconds (e.g., "60").
 */
function parseRetryAfter(retryAfterHeader: string | null): number {
  if (!retryAfterHeader) {
    return DEFAULT_RETRY_AFTER_MS;
  }

  const seconds = parseInt(retryAfterHeader.trim(), 10);
  return isNaN(seconds) ? DEFAULT_RETRY_AFTER_MS : Math.max(seconds * 1000, 0);
}

// ============================================================================
// API Types
// ============================================================================

export interface TavilyUsageKeySection {
  usage: number;
  limit: number;
  search_usage: number;
  extract_usage: number;
  crawl_usage: number;
  map_usage: number;
  research_usage: number;
}

export interface TavilyUsageAccountSection {
  current_plan?: string;
  plan_usage: number;
  plan_limit: number;
  paygo_usage: number;
  paygo_limit: number;
  search_usage: number;
  extract_usage: number;
  crawl_usage: number;
  map_usage: number;
  research_usage: number;
}

export interface TavilyUsageResponse {
  key: TavilyUsageKeySection;
  account: TavilyUsageAccountSection;
}

export interface TavilyUsageData {
  /** Total usage as percentage of combined plan + PAYGO limit (0–100+) */
  percentage: number;
  /** Plan credits used */
  planUsage: number;
  /** Plan credits available */
  planLimit: number;
  /** Pay-as-you-go credits used */
  paygoUsage: number;
  /** Pay-as-you-go credits available */
  paygoLimit: number;
  /** Per-API key usage */
  keyUsage: number;
  /** Per-API key limit */
  keyLimit: number;
}

// ============================================================================
// API Client
// ============================================================================

/**
 * Fetch Tavily usage data from the API
 * @throws {Error} If the API key is missing, the request fails, or the response is malformed
 */
export async function getTavilyUsage(apiKey: string): Promise<TavilyUsageData> {
  if (!apiKey) {
    throw new Error(
      "TAVILY_API_KEY is not set. " + 'Please set it with: export TAVILY_API_KEY="your-api-key"'
    );
  }

  const response = await fetch(TAVILY_USAGE_API_URL, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });

  if (!response.ok) {
    if (response.status === 429) {
      const retryAfterHeader = response.headers.get("retry-after");
      const retryAfterMs = parseRetryAfter(retryAfterHeader);
      throw new RateLimitError(retryAfterMs);
    }
    throw new Error(`Tavily usage API request failed with status ${response.status}`);
  }

  const data = (await response.json()) as TavilyUsageResponse;

  if (!data.account || typeof data.account.plan_usage !== "number") {
    throw new Error("Unexpected Tavily usage API response: missing account usage data");
  }

  if (typeof data.account.plan_limit !== "number") {
    throw new Error("Unexpected Tavily usage API response: missing account plan limit");
  }

  const totalUsage = data.account.plan_usage;
  const totalLimit = data.account.plan_limit + (data.account.paygo_limit ?? 0);
  const percentage = (totalUsage / (totalLimit || 1)) * 100;

  return {
    percentage,
    planUsage: data.account.plan_usage,
    planLimit: data.account.plan_limit,
    paygoUsage: data.account.paygo_usage ?? 0,
    paygoLimit: data.account.paygo_limit ?? 0,
    keyUsage: data.key?.usage ?? 0,
    keyLimit: data.key?.limit ?? 0,
  };
}
