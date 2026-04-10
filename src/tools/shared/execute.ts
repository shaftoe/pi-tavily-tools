/**
 * Shared execute helpers for Tavily tools
 *
 * Provides reusable utilities for the common phases of tool execution:
 * - Progress updates (onUpdate)
 * - Truncation + result assembly
 */

import type {
  AgentToolUpdateCallback,
  ExtensionContext,
  TruncationResult,
} from "@mariozechner/pi-coding-agent";

import { applyTruncation } from "./truncation.js";

// ============================================================================
// Abort Signal
// ============================================================================

/**
 * Race a promise against an AbortSignal.
 * The SDK doesn't natively support signal, so we wrap the call.
 * The underlying HTTP request still completes on Tavily's side,
 * but the tool call rejects immediately on cancellation.
 */
export function raceAbort<T>(promise: Promise<T>, signal: AbortSignal | undefined): Promise<T> {
  if (!signal) return promise;
  if (signal.aborted) return Promise.reject(new Error("Tool call aborted"));
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(new Error("Tool call aborted"));
    signal.addEventListener("abort", onAbort, { once: true });
    promise.then(
      (value) => {
        signal.removeEventListener("abort", onAbort);
        resolve(value);
      },
      (error: unknown) => {
        signal.removeEventListener("abort", onAbort);
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    );
  });
}

// ============================================================================
// Rate Limit Error Detection
// ============================================================================

/** Check if an error is a 429 rate limit error from Tavily */
export function isRateLimitError(error: unknown): error is Error {
  if (!(error instanceof Error)) {
    return false;
  }
  const message = error.message;
  return message.startsWith("429") || message.includes("429");
}

// ============================================================================
// Retry with Exponential Backoff
// ============================================================================

/** Default retry configuration */
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_BASE_DELAY_MS = 1000;
const DEFAULT_MAX_DELAY_MS = 30000;

/** Configuration for retry logic */
export interface RetryConfig {
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
}

/**
 * Execute an async function with exponential backoff retry for rate limit errors.
 * Only retries on 429 errors; other errors are propagated immediately.
 */
export async function withRetry<T>(fn: () => Promise<T>, config: RetryConfig = {}): Promise<T> {
  const maxRetries = config.maxRetries ?? DEFAULT_MAX_RETRIES;
  const baseDelayMs = config.baseDelayMs ?? DEFAULT_BASE_DELAY_MS;
  const maxDelayMs = config.maxDelayMs ?? DEFAULT_MAX_DELAY_MS;

  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (!isRateLimitError(error) || attempt === maxRetries) {
        throw lastError;
      }

      const delay = Math.min(baseDelayMs * Math.pow(2, attempt) + Math.random() * 500, maxDelayMs);

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError || new Error("Unknown error occurred during retry");
}

// ============================================================================
// Error Sanitization
// ============================================================================

/**
 * Sanitize a provider error before surfacing it.
 * Strips Tavily API keys and auth header values from error messages
 * to prevent credential leakage in tool output or logs.
 */
export function sanitizeError(error: unknown): Error {
  const message = error instanceof Error ? error.message : String(error);
  const sanitized = message
    .replace(/tvly-[a-zA-Z0-9_-]+/gi, "[REDACTED]")
    .replace(/(authorization|x-api-key)[^\n]*/gi, "$1: [REDACTED]");
  return new Error(sanitized);
}

// ============================================================================
// Progress Update
// ============================================================================

/**
 * Send a progress update to the TUI during tool execution.
 * Wraps the common `onUpdate?.({ content: [...], details: {} })` pattern.
 */
export function sendProgress(onUpdate: AgentToolUpdateCallback | undefined, message: string): void {
  onUpdate?.({
    content: [{ type: "text", text: message }],
    details: {},
  });
}

// ============================================================================
// Tool Result Assembly
// ============================================================================

/**
 * Apply truncation to full output and assemble the standard tool result.
 *
 * Handles: truncation → temp file (if needed) → `{ content, details }` return shape.
 * The `buildDetails` callback receives truncation metadata so each tool can
 * include it in its own typed details object.
 */
export async function buildToolResult<TDetails>(
  fullOutput: string,
  ctx: ExtensionContext,
  toolName: string,
  buildDetails: (
    truncation: TruncationResult | undefined,
    fullOutputPath: string | undefined
  ) => TDetails
): Promise<{
  content: Array<{ type: "text"; text: string }>;
  details: TDetails;
}> {
  const { content, truncation, fullOutputPath } = await applyTruncation(
    fullOutput,
    ctx.cwd,
    toolName
  );

  return {
    content: [{ type: "text", text: content }],
    details: buildDetails(truncation, fullOutputPath),
  };
}
