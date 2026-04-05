/**
 * TUI renderers for Tavily tools
 */

import { Text, truncateToWidth } from "@mariozechner/pi-tui";
import type { SearchResponseDetails, WebSearchDetails } from "./types.js";

// ============================================================================
// Types
// ============================================================================

export type ToolCallResult = {
  details?: unknown;
  content: Array<{ type: string; text?: string }>;
};

type Theme = {
  fg: (color: string, text: string) => string;
  bold: (text: string) => string;
};

// ============================================================================
// Render Call (function invocation display)
// ============================================================================

/**
 * Render a web search tool call
 */
export function renderWebSearchCall(args: Record<string, unknown>, theme: Theme): Text {
  let text = theme.fg("toolTitle", theme.bold("web_search "));
  const query = typeof args.query === "string" ? args.query : "(no query)";
  text += theme.fg("accent", `"${query}"`);

  const options: string[] = [];
  if (typeof args.max_results === "number" && args.max_results !== 5) {
    options.push(`max=${args.max_results}`);
  }
  if (args.search_depth === "advanced") {
    options.push("advanced");
  }
  if (args.include_answer === false) {
    options.push("no-answer");
  }
  if (args.include_raw_content === true) {
    options.push("raw-content");
  }
  if (args.include_images === true) {
    options.push("images");
  }
  if (args.days && typeof args.days === "number") {
    options.push(`${args.days}d`);
  }

  if (options.length > 0) {
    text += ` ${theme.fg("dim", `[${options.join(", ")}]`)}`;
  }

  return new Text(truncateToWidth(text, 100), 0, 0);
}

/**
 * Render options badge for search tools
 */
function renderOptionsBadge(details: SearchResponseDetails, theme: Theme): string {
  const options: string[] = [];
  if (details.searchDepth === "advanced") {
    options.push("advanced");
  }
  if ("includeImages" in details && details.includeImages) {
    options.push("images");
  }
  if (details.days) {
    options.push(`${details.days}d`);
  }
  return options.length > 0 ? theme.fg("dim", ` (${options.join(", ")})`) : "";
}

// ============================================================================
// Render Result (outcome display)
// ============================================================================

/**
 * Render a web search tool result
 */
export function renderWebSearchResult(
  result: ToolCallResult,
  state: { expanded: boolean; isPartial: boolean },
  theme: Theme
): Text {
  const details = result.details as WebSearchDetails | undefined;

  // Show loading state
  if (state.isPartial) {
    return new Text(theme.fg("warning", "Searching..."), 0, 0);
  }

  // Show error state
  if (details?.error) {
    return new Text(theme.fg("error", `Error: ${details.error}`), 0, 0);
  }

  // Build result display
  return renderSearchResultCommon(details, state.expanded, theme, true);
}

/**
 * Common result renderer for search tools
 */
function renderSearchResultCommon(
  details: SearchResponseDetails | undefined,
  expanded: boolean,
  theme: Theme,
  includeAnswer: boolean
): Text {
  let text = "";

  if (details) {
    // Main summary
    text += theme.fg(
      "success",
      `${details.resultCount} result${details.resultCount !== 1 ? "s" : ""}`
    );

    // Show options
    text += renderOptionsBadge(details, theme as ExtendedTheme);

    // Show truncation warning
    if (details.truncation?.truncated) {
      text += " " + (theme as ExtendedTheme).fg("warning", "(truncated)");
    }

    // Expanded view: show sources
    if (expanded && details.sources.length > 0) {
      text += "\n\n";
      const displaySources = details.sources.slice(0, 5);

      for (let i = 0; i < displaySources.length; i++) {
        const source = displaySources[i];
        if (source) {
          text += `${(theme as ExtendedTheme).fg("accent", `${i + 1}.`)} ${source.title}\n`;
          text += `   ${(theme as ExtendedTheme).fg("dim", source.url)}\n`;
        }
      }

      if (details.sources.length > 5) {
        text += `\n${(theme as ExtendedTheme).fg("dim", `... ${details.sources.length - 5} more`)}`;
      }

      // Show temp file path if truncated
      if (details.fullOutputPath) {
        text += `\n\n${(theme as ExtendedTheme).fg("dim", `Full output: ${details.fullOutputPath}`)}`;
      }
    }

    // Show AI answer in expanded view if available
    if (expanded && includeAnswer && "answer" in details && details.answer) {
      text += "\n\n";
      text += (theme as ExtendedTheme).fg("accent", "AI Answer: ");
      text += (theme as ExtendedTheme).fg("text", details.answer);
    }
  }

  return new Text(text, 0, 0);
}

type ExtendedTheme = Theme & {
  accent: (text: string) => string;
  dim: (text: string) => string;
  success: (text: string) => string;
  warning: (text: string) => string;
  error: (text: string) => string;
  text: (text: string) => string;
};
