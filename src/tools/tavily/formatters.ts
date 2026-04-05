/**
 * Response formatters for Tavily tools
 */

import type { FormattedOutputParts, ImageResult, SearchResult } from "./types.js";

// ============================================================================
// Web Search Formatting
// ============================================================================

/**
 * Format Tavily search response into human-readable text
 */
export function formatWebSearchResponse(
  answer: string | null,
  results: SearchResult[],
  images: ImageResult[],
  includeImages: boolean | undefined
): string {
  const parts: string[] = [];

  // Add AI answer if available
  if (answer) {
    parts.push(`AI Answer: ${answer}\n`);
  }

  // Add sources
  if (results.length > 0) {
    parts.push("Sources:");
    results.forEach((result, index) => {
      parts.push(
        `\n${index + 1}. ${result.title}`,
        `   URL: ${result.url}`,
        `   Score: ${result.score.toFixed(2)}`
      );

      // Add content/snippet if available
      const contentToShow = result.rawContent || result.content;
      if (contentToShow) {
        const snippet = contentToShow.slice(0, 300);
        parts.push(`   Content: ${snippet}${contentToShow.length > 300 ? "..." : ""}`);
      }
    });
  } else {
    parts.push("No results found.");
  }

  // Add image results if available
  if (includeImages && images.length > 0) {
    parts.push("\nImages:");
    images.slice(0, 5).forEach((image, index) => {
      parts.push(`\n${index + 1}. ${image.url}`);
      if (image.description) {
        parts.push(`   ${image.description}`);
      }
    });
  }

  return parts.join("\n");
}

/**
 * Format Tavily search results into compact parts structure
 */
export function formatSearchResults(
  answer: string | null,
  results: SearchResult[],
  images: ImageResult[],
  includeImages: boolean
): FormattedOutputParts {
  const parts: FormattedOutputParts = {
    answer: answer ?? undefined,
    sources: [],
  };

  // Add sources
  results.forEach((result, index) => {
    parts.sources.push(
      `\n${index + 1}. ${result.title}`,
      `   URL: ${result.url}`,
      `   Score: ${result.score.toFixed(2)}`
    );

    const contentToShow = result.rawContent || result.content;
    if (contentToShow) {
      const snippet = contentToShow.slice(0, 300);
      parts.sources.push(`   Content: ${snippet}${contentToShow.length > 300 ? "..." : ""}`);
    }
  });

  // Add image results if available
  if (includeImages && images.length > 0) {
    parts.images = [];
    images.slice(0, 5).forEach((image, index) => {
      parts.images!.push(`\n${index + 1}. ${image.url}`);
      if (image.description) {
        parts.images!.push(`   ${image.description}`);
      }
    });
  }

  return parts;
}

/**
 * Extract and type-safe Tavily response data
 */
export function extractSearchResults(response: unknown): {
  answer: string | null;
  results: SearchResult[];
  images: ImageResult[];
} {
  const resp = response as {
    answer?: string;
    results?: unknown[];
    images?: unknown[];
  };

  // Extract results
  const results: SearchResult[] = (resp.results || [])
    .filter((r): r is object => r !== null && typeof r === "object")
    .map((r) => {
      const result = r as {
        title?: unknown;
        url?: unknown;
        score?: unknown;
        content?: string;
        rawContent?: string;
      };
      const scoreValue = typeof result.score === "number" ? result.score : Number(result.score);
      return {
        title: typeof result.title === "string" ? result.title : "Untitled",
        url: typeof result.url === "string" ? result.url : "",
        score: Number.isNaN(scoreValue) ? 0 : scoreValue,
        content: result.content,
        rawContent: result.rawContent,
      };
    });

  // Extract images
  const images: ImageResult[] = (resp.images || [])
    .filter((img): img is object => img !== null && typeof img === "object")
    .map((img) => {
      const image = img as { url?: unknown; description?: string };
      return {
        url: typeof image.url === "string" ? image.url : "",
        description: image.description,
      };
    });

  return {
    answer: resp.answer ?? null,
    results,
    images,
  };
}
