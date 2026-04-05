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
