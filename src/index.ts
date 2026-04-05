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

/**
 * Main extension entry point.
 *
 * Defers tool registration to `session_start` so Pi can start
 * even if the TAVILY_API_KEY is missing. The tool is registered only
 * once on the first agent run and persists across sessions.
 */
export default function (pi: ExtensionAPI): void {
  let registered = false;

  pi.on("session_start", (_event, ctx) => {
    if (registered) return;
    registered = true;

    try {
      const client = createTavilyClient();
      registerWebSearchTool(pi, client);
      registerWebExtractTool(pi, client);
    } catch (error) {
      if (error instanceof Error) {
        ctx.ui.notify(`[pi-tavily-tools] ${error.message}`, "error");
      } else {
        // Re-throw non-Error types (shouldn't happen, but be safe)
        throw error;
      }
    }
  });
}
