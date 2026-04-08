/**
 * Pi Tavily Web Search Extension
 *
 * Provides web search capabilities to Pi using Tavily's search API.
 * Adds a `web_search` tool that the LLM can use to find current
 * information, recent news, documentation, and time-sensitive data.
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import {
  cleanupTempDir,
  createTavilyClient,
  registerWebExtractTool,
  registerWebSearchTool,
  resultCache,
} from "./tools/index.js";
import { UsageCache } from "./usage/index.js";

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
  const apiKey = process.env.TAVILY_API_KEY?.trim();
  if (!apiKey) {
    pi.on("session_start", (_event, ctx) => {
      ctx.ui.notify("Web Search · TAVILY_API_KEY not set. Get a free key at tavily.com", "warning");
    });
    return;
  }

  let registered = false;
  const usageCache = new UsageCache(apiKey);

  pi.on("session_start", async (_event, ctx) => {
    resultCache.clear();

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

  pi.on("session_shutdown", async (_event, ctx) => {
    usageCache.clear(ctx);
    await cleanupTempDir(ctx.cwd).catch(() => {}); // best-effort
  });
}
