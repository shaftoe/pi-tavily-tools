/**
 * Web Search Tool - Provides web search capabilities using Tavily SDK
 *
 * Features:
 * - Search the web using Tavily's search API
 * - Configurable search depth (basic/advanced)
 * - Time-limited searches with days parameter
 * - AI-generated answers
 * - Proper output truncation (50KB / 2000 lines)
 * - Custom TUI rendering
 * - Robust error handling
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import type { TavilyClient } from "@tavily/core";

import { applyTruncation } from "./shared/truncation.js";
import { buildSearchOptions, validateQuery } from "./tavily/client.js";
import { buildSuccessDetails } from "./tavily/details.js";
import { extractSearchResults, formatWebSearchResponse } from "./tavily/formatters.js";
import { renderWebSearchCall, renderWebSearchResult } from "./tavily/renderers.js";
import { WebSearchParamsSchema } from "./tavily/schemas.js";

// ============================================================================
// Web Search Tool Registration
// ============================================================================

export function registerWebSearchTool(pi: ExtensionAPI, client: TavilyClient): void {
  pi.registerTool({
    name: "web_search",
    label: "Web Search",
    description:
      `Searches the web for current information using Tavily. ` +
      `Output is truncated to 2000 lines or 50KB (whichever is hit first). ` +
      `Useful for finding recent news, documentation, or any time-sensitive information.`,

    promptSnippet:
      "Search the web for current information, news, documentation, or time-sensitive data.",
    promptGuidelines: [
      "Use this tool when the user asks for recent news, current events, or up-to-date information.",
      "Use this tool to search for documentation, APIs, or technical information.",
      "Use this tool to verify facts or find current statistics.",
      "Use the days parameter to limit results to recent timeframes (e.g., 7 for last week).",
      "Use include_images to find relevant images for your search.",
      "Use include_raw_content to get more detailed page content.",
      "Use search_depth advanced for deeper, more comprehensive searches.",
    ],

    parameters: WebSearchParamsSchema,

    // Pi catches thrown errors and reports them to the LLM with isError: true
    async execute(_toolCallId, params, _signal, onUpdate, ctx) {
      const query = validateQuery(params.query);
      const searchOptions = buildSearchOptions(params);

      onUpdate?.({
        content: [{ type: "text", text: `Searching for: ${query}` }],
        details: {},
      });

      const response = await client.search(query, searchOptions);
      const { answer, results, images } = extractSearchResults(response);
      const fullOutput = formatWebSearchResponse(
        answer,
        results,
        images,
        searchOptions.includeImages
      );
      const { content, truncation, fullOutputPath } = await applyTruncation(
        fullOutput,
        ctx.cwd,
        "search"
      );

      return {
        content: [{ type: "text", text: content }],
        details: buildSuccessDetails({
          query,
          options: searchOptions,
          answer,
          results,
          truncation,
          fullOutputPath,
        }),
      };
    },

    renderCall(args, theme) {
      return renderWebSearchCall(args, theme as Parameters<typeof renderWebSearchCall>[1]);
    },

    renderResult(result, state, theme) {
      return renderWebSearchResult(
        result,
        state,
        theme as Parameters<typeof renderWebSearchResult>[2]
      );
    },
  });
}
