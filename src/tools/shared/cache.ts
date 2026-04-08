/**
 * Session-level result cache
 *
 * Populated by web_search results that include content.
 * Checked by web_extract before making an API call.
 * Cleared on session_start to prevent stale data across sessions.
 */

import type { ExtractResult } from "../tavily/types.js";

const cache = new Map<string, ExtractResult>();

export const resultCache = {
  get(url: string): ExtractResult | undefined {
    return cache.get(url);
  },

  set(result: ExtractResult): void {
    cache.set(result.url, result);
  },

  clear(): void {
    cache.clear();
  },
};
