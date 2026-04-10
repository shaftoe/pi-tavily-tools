/**
 * Web Extract Tool - Provides content extraction capabilities using Tavily SDK
 *
 * Features:
 * - Extract raw content from one or more URLs
 * - Configurable extraction depth (basic/advanced)
 * - Optional image extraction
 * - Multiple output formats (markdown/text)
 * - Query-based content filtering
 * - Proper output truncation (50KB / 2000 lines)
 * - Custom TUI rendering
 * - Robust error handling
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import type { TavilyClient } from "@tavily/core";

import { resultCache } from "./shared/cache.js";
import {
  buildToolResult,
  raceAbort,
  sanitizeError,
  sendProgress,
  withRetry,
} from "./shared/execute.js";
import { buildExtractOptions, validateUrls } from "./tavily/client.js";
import { buildExtractSuccessDetails } from "./tavily/details.js";
import { extractExtractResults, formatExtractResponse } from "./tavily/formatters.js";
import { renderExtractCall, renderExtractResult } from "./tavily/renderers.js";
import { WebExtractParamsSchema } from "./tavily/schemas.js";

// ============================================================================
// Web Extract Tool Registration
// ============================================================================

export function registerWebExtractTool(pi: ExtensionAPI, client: TavilyClient): void {
  pi.registerTool({
    name: "web_extract",
    label: "Web Extract",
    description:
      `Extracts raw content from one or more URLs using Tavily. ` +
      `Output is truncated to 2000 lines or 50KB (whichever is hit first). ` +
      `Useful for reading full content from specific pages, data collection, or content analysis.`,

    promptSnippet: "Extract raw content from one or more web pages.",
    promptGuidelines: [
      "Use this tool when you need to read the full content of specific web pages.",
      "Use this tool after web_search to get detailed content from specific URLs.",
      "Use this tool for data collection and content analysis tasks.",
      "Use extract_depth advanced for more comprehensive extraction.",
      "Use include_images to also extract images from pages.",
      "Use format text if you need plain text instead of markdown.",
      "Use query to focus extraction on specific content within pages.",
      "Provide up to 20 URLs in a single request for batch extraction.",
    ],

    parameters: WebExtractParamsSchema,

    // Pi catches thrown errors and reports them to the LLM with isError: true
    async execute(_toolCallId, params, signal, onUpdate, ctx) {
      const urls = validateUrls(params.urls);
      const extractOptions = buildExtractOptions(params);

      const urlCount = urls.length;
      const urlText = urlCount === 1 ? "URL" : "URLs";

      sendProgress(onUpdate, `Extracting content from ${urlCount} ${urlText}...`);

      // Check cache for single-URL requests — avoids a redundant API call when
      // the URL was already returned with content in a prior web_search result.
      if (urlCount === 1 && !extractOptions.query) {
        const cached = resultCache.get(urls[0]!);
        if (cached) {
          return buildToolResult(cached.rawContent, ctx, "extract", (truncation, fullOutputPath) =>
            buildExtractSuccessDetails({
              urlCount,
              options: extractOptions,
              results: [cached],
              failedResults: [],
              truncation,
              fullOutputPath,
            })
          );
        }
      }

      let response;
      try {
        response = await raceAbort(
          withRetry(() => client.extract(urls, extractOptions), {
            maxRetries: 3,
            baseDelayMs: 1000,
            maxDelayMs: 10000,
          }),
          signal
        );
      } catch (error) {
        throw sanitizeError(error);
      }
      const { results, failedResults } = extractExtractResults(response);
      const fullOutput = formatExtractResponse(
        results,
        failedResults,
        extractOptions.includeImages ?? false
      );
      return buildToolResult(fullOutput, ctx, "extract", (truncation, fullOutputPath) =>
        buildExtractSuccessDetails({
          urlCount,
          options: extractOptions,
          results,
          failedResults,
          truncation,
          fullOutputPath,
        })
      );
    },

    renderCall(args, theme) {
      return renderExtractCall(args, theme as Parameters<typeof renderExtractCall>[1]);
    },

    renderResult(result, state, theme) {
      return renderExtractResult(result, state, theme as Parameters<typeof renderExtractResult>[2]);
    },
  });
}
