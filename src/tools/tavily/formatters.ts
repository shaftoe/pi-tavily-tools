/**
 * Response formatters for Tavily tools
 */

import type {
  ExtractFailedResult,
  ExtractResult,
  FormattedOutputParts,
  ImageResult,
  SearchResult,
} from "./types.js";

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

      // Add full content — truncation is handled downstream by applyTruncation
      const contentToShow = result.rawContent || result.content;
      if (contentToShow) {
        parts.push(`   Content: ${contentToShow}`);
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
      parts.sources.push(`   Content: ${contentToShow}`);
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

// ============================================================================
// Web Extract Formatting
// ============================================================================

/**
 * Format Tavily extract response into human-readable text
 */
export function formatExtractResponse(
  results: ExtractResult[],
  failedResults: ExtractFailedResult[],
  includeImages: boolean
): string {
  const parts: string[] = [];

  // Add successful extractions
  if (results.length > 0) {
    parts.push(`Successfully extracted content from ${results.length} URL(s):\n`);

    results.forEach((result, index) => {
      parts.push(`${index + 1}. ${result.title || "Untitled"}`);
      parts.push(`   URL: ${result.url}`);

      // Add full content — truncation is handled downstream by applyTruncation
      parts.push(`   Content: ${result.rawContent}`);

      // Add images if available and requested
      if (includeImages && result.images && result.images.length > 0) {
        parts.push(`   Images: ${result.images.length} found`);
        result.images.slice(0, 3).forEach((img, imgIndex) => {
          parts.push(`      ${imgIndex + 1}. ${img}`);
        });
        if (result.images.length > 3) {
          parts.push(`      ... ${result.images.length - 3} more`);
        }
      }

      parts.push("");
    });
  } else {
    parts.push("No content was extracted successfully.");
  }

  // Add failed extractions
  if (failedResults.length > 0) {
    parts.push(`\nFailed to extract from ${failedResults.length} URL(s):\n`);
    failedResults.forEach((failed, index) => {
      parts.push(`${index + 1}. URL: ${failed.url}`);
      parts.push(`   Error: ${failed.error}`);
    });
  }

  return parts.join("\n");
}

/**
 * Extract and type-safe Tavily extract response data
 */
export function extractExtractResults(response: unknown): {
  results: ExtractResult[];
  failedResults: ExtractFailedResult[];
} {
  const resp = response as {
    results?: unknown[];
    failedResults?: unknown[];
  };

  // Extract successful results
  const results: ExtractResult[] = (resp.results || [])
    .filter((r): r is object => r !== null && typeof r === "object")
    .map((r) => {
      const result = r as {
        url?: unknown;
        title?: unknown;
        rawContent?: unknown;
        images?: unknown[];
      };
      return {
        url: typeof result.url === "string" ? result.url : "",
        title: typeof result.title === "string" ? result.title : null,
        rawContent: typeof result.rawContent === "string" ? result.rawContent : "",
        images:
          Array.isArray(result.images) && result.images.every((img) => typeof img === "string")
            ? result.images
            : undefined,
      };
    });

  // Extract failed results
  const failedResults: ExtractFailedResult[] = (resp.failedResults || [])
    .filter((f): f is object => f !== null && typeof f === "object")
    .map((f) => {
      const failed = f as { url?: unknown; error?: unknown };
      return {
        url: typeof failed.url === "string" ? failed.url : "",
        error: typeof failed.error === "string" ? failed.error : "Unknown error",
      };
    });

  return {
    results,
    failedResults,
  };
}
