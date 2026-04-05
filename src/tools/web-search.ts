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
import type { WebSearchDetails } from "./tavily/types.js";

import { applyTruncation, createErrorOutput } from "./shared/truncation.js";
import { buildSearchOptions, validateQuery } from "./tavily/client.js";
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

    async execute(_toolCallId, params, _signal, onUpdate, ctx) {
      try {
        // Validate and normalize parameters
        const query = validateQuery(params.query);
        const searchOptions = buildSearchOptions(params);

        // Notify user we're searching
        onUpdate?.({
          content: [{ type: "text", text: `Searching for: ${query}` }],
          details: {},
        });

        // Perform search using the provided client
        const response = await client.search(query, searchOptions);

        // Extract and format search results
        const { answer, results, images } = extractSearchResults(response);
        const fullOutput = formatWebSearchResponse(
          answer,
          results,
          images,
          searchOptions.includeImages
        );

        // Apply truncation
        const { content, truncation, fullOutputPath } = await applyTruncation(
          fullOutput,
          ctx.cwd,
          "search"
        );

        // Build details with proper defaults
        const maxResults = searchOptions.maxResults ?? 5;
        const searchDepth = String(searchOptions.searchDepth ?? "basic");
        const includeImages = searchOptions.includeImages ?? false;
        const days = searchOptions.days;

        const details: WebSearchDetails = {
          query,
          maxResults,
          searchDepth,
          includeAnswer: searchOptions.includeAnswer !== false,
          includeRawContent: typeof searchOptions.includeRawContent === "string",
          includeImages,
          days,
          answer: answer ?? undefined,
          resultCount: results.length,
          sources: results.map((r) => ({
            title: r.title,
            url: r.url,
            score: r.score,
          })),
          truncation,
          fullOutputPath,
        };

        return {
          content: [{ type: "text", text: content }],
          details,
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const errorOutput = createErrorOutput(errorMessage, {
          query: params.query,
          maxResults: params.max_results ?? 5,
          searchDepth: params.search_depth ?? "basic",
          includeAnswer: params.include_answer ?? true,
          includeRawContent: params.include_raw_content ?? false,
          includeImages: params.include_images ?? false,
          days: params.days,
        });

        return {
          content: [{ type: "text", text: errorOutput.content }],
          details: {
            query: params.query,
            maxResults: params.max_results ?? 5,
            searchDepth: params.search_depth ?? "basic",
            includeAnswer: params.include_answer ?? true,
            includeRawContent: params.include_raw_content ?? false,
            includeImages: params.include_images ?? false,
            days: params.days,
            resultCount: 0,
            sources: [],
            error: errorMessage,
          } as WebSearchDetails,
        };
      }
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
