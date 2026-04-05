/**
 * Schemas for Tavily tools
 */

import { StringEnum } from "@mariozechner/pi-ai";
import { Type } from "@sinclair/typebox";

// ============================================================================
// Web Search Schema
// ============================================================================

export const WebSearchParamsSchema = Type.Object({
  query: Type.String({ description: "Search query string" }),
  max_results: Type.Optional(
    Type.Number({ description: "Number of results to return (1-20, default: 5)" })
  ),
  search_depth: Type.Optional(
    StringEnum(["basic", "advanced"] as const, {
      description: "Search depth: 'basic' or 'advanced' (default: 'basic')",
    })
  ),
  include_answer: Type.Optional(
    Type.Boolean({ description: "Include AI-generated answer (default: true)" })
  ),
  include_raw_content: Type.Optional(
    Type.Boolean({ description: "Include raw page content in results (default: false)" })
  ),
  include_images: Type.Optional(
    Type.Boolean({ description: "Include relevant images in results (default: false)" })
  ),
  days: Type.Optional(
    Type.Number({ description: "Limit results to last N days (e.g., 7 for last week)" })
  ),
});

// ============================================================================
// Web Extract Schema
// ============================================================================

export const WebExtractParamsSchema = Type.Object({
  urls: Type.Array(Type.String({ description: "URL to extract content from" }), {
    description: "Array of URLs to extract content from (max 20)",
  }),
  extract_depth: Type.Optional(
    StringEnum(["basic", "advanced"] as const, {
      description: "Extraction depth: 'basic' or 'advanced' (default: 'basic')",
    })
  ),
  include_images: Type.Optional(
    Type.Boolean({ description: "Include images from pages (default: false)" })
  ),
  format: Type.Optional(
    StringEnum(["markdown", "text"] as const, {
      description: "Output format: 'markdown' or 'text' (default: 'markdown')",
    })
  ),
  query: Type.Optional(
    Type.String({ description: "Optional query to focus extraction on specific content" })
  ),
});

// ============================================================================
// Common Schema Parts
// ============================================================================

export const BaseSearchParamsSchema = {
  query: Type.String({ description: "Search query string" }),
  max_results: Type.Optional(
    Type.Number({ description: "Number of results to return (1-20, default: 5)" })
  ),
  search_depth: Type.Optional(
    StringEnum(["basic", "advanced"] as const, {
      description: "Search depth: 'basic' or 'advanced' (default: 'basic')",
    })
  ),
  days: Type.Optional(
    Type.Number({ description: "Limit results to last N days (e.g., 7 for last week)" })
  ),
};

export const IncludeOptionsSchema = {
  include_answer: Type.Optional(
    Type.Boolean({ description: "Include AI-generated answer (default: true)" })
  ),
  include_raw_content: Type.Optional(
    Type.Boolean({ description: "Include raw page content in results (default: false)" })
  ),
  include_images: Type.Optional(
    Type.Boolean({ description: "Include relevant images in results (default: false)" })
  ),
};
