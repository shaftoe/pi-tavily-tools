/**
 * Shared types for Tavily tools
 */

import type { TruncationResult } from "@mariozechner/pi-coding-agent";

// ============================================================================
// Common Search Options
// ============================================================================

export interface BaseSearchParams {
  query: string;
  max_results?: number;
  search_depth?: "basic" | "advanced";
  days?: number;
}

export interface SearchResponseDetails {
  query: string;
  maxResults: number;
  searchDepth: string;
  days?: number;
  answer?: string;
  resultCount: number;
  sources: Array<{
    title: string;
    url: string;
    score: number;
  }>;
  truncation?: TruncationResult;
  fullOutputPath?: string;
  error?: string;
}

// ============================================================================
// Web Search Specific
// ============================================================================

export interface WebSearchParams extends BaseSearchParams {
  include_answer?: boolean;
  include_raw_content?: boolean;
  include_images?: boolean;
}

export interface WebSearchDetails extends SearchResponseDetails {
  includeAnswer: boolean;
  includeRawContent: boolean;
  includeImages: boolean;
}

// ============================================================================
// Web Extract Specific
// ============================================================================

export interface WebExtractParams {
  urls: string[];
  extract_depth?: "basic" | "advanced";
  include_images?: boolean;
  format?: "markdown" | "text";
  query?: string;
}

export interface ExtractResult {
  url: string;
  title: string | null;
  rawContent: string;
  images?: string[];
}

export interface ExtractFailedResult {
  url: string;
  error: string;
}

export interface WebExtractDetails {
  urlCount: number;
  extractDepth: string;
  includeImages: boolean;
  format: string;
  query?: string;
  successCount: number;
  failureCount: number;
  results: ExtractResult[];
  failedResults: ExtractFailedResult[];
  truncation?: TruncationResult;
  fullOutputPath?: string;
  error?: string;
}

// ============================================================================
// Search Source with Content
// ============================================================================

export interface SearchResult {
  title: string;
  url: string;
  score: number;
  content?: string;
  rawContent?: string;
}

export interface ImageResult {
  url: string;
  description?: string;
}

// ============================================================================
// Formatted Output Parts
// ============================================================================

export interface FormattedOutputParts {
  answer?: string;
  sources: string[];
  images?: string[];
}
