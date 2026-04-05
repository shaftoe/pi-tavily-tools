/**
 * Shared truncation utilities
 */

import {
  DEFAULT_MAX_BYTES,
  DEFAULT_MAX_LINES,
  formatSize,
  truncateHead,
  withFileMutationQueue,
  type TruncationResult,
} from "@mariozechner/pi-coding-agent";

// ============================================================================
// Truncation
// ============================================================================

export interface TruncatedOutput {
  content: string;
  truncation?: TruncationResult;
  fullOutputPath?: string;
}

/**
 * Apply truncation to output and save full content to temp file if needed
 */
export async function applyTruncation(
  fullOutput: string,
  cwd: string,
  toolName: string
): Promise<TruncatedOutput> {
  const truncation = truncateHead(fullOutput, {
    maxLines: DEFAULT_MAX_LINES,
    maxBytes: DEFAULT_MAX_BYTES,
  });

  let content = truncation.content;

  // Save full output to temp file if truncated
  if (truncation.truncated) {
    const tempDir = `${cwd}/.pi-tavily-temp`;
    const timestamp = Date.now();
    const tempFile = `${tempDir}/${toolName}-${timestamp}.txt`;

    await withFileMutationQueue(tempFile, async () => {
      const { writeFile, mkdir } = await import("node:fs/promises");
      await mkdir(tempDir, { recursive: true });
      await writeFile(tempFile, fullOutput, "utf8");
    });

    // Add truncation notice
    const truncatedLines = truncation.totalLines - truncation.outputLines;
    const truncatedBytes = truncation.totalBytes - truncation.outputBytes;

    content += "\n\n";
    content += "[Output truncated: ";
    content += `showing ${truncation.outputLines} of ${truncation.totalLines} lines, `;
    content += `(${formatSize(truncation.outputBytes)} of ${formatSize(truncation.totalBytes)}). `;
    content += `${truncatedLines} lines (${formatSize(truncatedBytes)}) omitted. `;
    content += `Full output saved to: ${tempFile}]`;

    return {
      content,
      truncation,
      fullOutputPath: tempFile,
    };
  }

  return { content };
}

/**
 * Create error output
 */
export function createErrorOutput(
  errorMessage: string,
  baseDetails: Record<string, unknown>
): { content: string; details: Record<string, unknown> } {
  return {
    content: `Error: ${errorMessage}`,
    details: {
      ...baseDetails,
      resultCount: 0,
      sources: [],
      error: errorMessage,
    },
  };
}
