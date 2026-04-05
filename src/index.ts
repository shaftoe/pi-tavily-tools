/**
 * Pi Tavily Web Search Extension
 *
 * Provides web search capabilities to Pi using Tavily's search API.
 * Adds a `web_search` tool that the LLM can use to find current
 * information, recent news, documentation, and time-sensitive data.
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { createTavilyClient } from "./tools/tavily/client.js";
import { registerWebExtractTool } from "./tools/web-extract.js";
import { registerWebSearchTool } from "./tools/web-search.js";
import { TavilyUsageCache } from "./usage/status.js";

/**
 * Main extension entry point.
 *
 * Requires TAVILY_API_KEY to be set — if missing, no hooks are registered
 * and the extension is effectively a no-op.
 *
 * Defers tool registration to `session_start` so Pi can start
 * even if the TAVILY_API_KEY is missing. The tool is registered only
 * once on the first agent run and persists across sessions.
 */
export default function (pi: ExtensionAPI): void {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) return;

  let registered = false;
  const usageCache = new TavilyUsageCache(apiKey);

  pi.on("session_start", async (_event, ctx) => {
    if (registered) return;
    registered = true;

    const client = createTavilyClient(apiKey);
    registerWebSearchTool(pi, client);
    registerWebExtractTool(pi, client);

    await usageCache.updateStatus(ctx);
  });

  pi.on("turn_end", async (_event, ctx) => {
    await usageCache.updateStatus(ctx);
  });

  pi.on("session_shutdown", (_event, ctx) => {
    usageCache.clear(ctx);
  });
}
