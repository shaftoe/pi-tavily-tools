/**
 * Tavily Usage API Client
 *
 * Fetches usage data from the Tavily usage endpoint.
 * @see https://docs.tavily.com/documentation/api-reference/endpoint/usage
 */

const TAVILY_USAGE_API_URL = "https://api.tavily.com/usage";

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
  /** Plan usage as percentage of plan limit (0–100) */
  percentage: number;
  /** Total plan credits used */
  planUsage: number;
  /** Total plan credits available */
  planLimit: number;
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
    throw new Error(`Tavily usage API request failed with status ${response.status}`);
  }

  const data = (await response.json()) as TavilyUsageResponse;

  if (!data.account || typeof data.account.plan_usage !== "number") {
    throw new Error("Unexpected Tavily usage API response: missing account usage data");
  }

  if (typeof data.account.plan_limit !== "number") {
    throw new Error("Unexpected Tavily usage API response: missing account plan limit");
  }

  const planLimit = data.account.plan_limit || 1; // avoid division by zero
  const percentage = (data.account.plan_usage / planLimit) * 100;

  return {
    percentage,
    planUsage: data.account.plan_usage,
    planLimit: data.account.plan_limit,
    keyUsage: data.key?.usage ?? 0,
    keyLimit: data.key?.limit ?? 0,
  };
}
