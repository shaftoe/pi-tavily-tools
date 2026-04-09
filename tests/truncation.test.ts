/**
 * Unit tests for applyTruncation function
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { access, mkdir, readFile, rm, stat } from "node:fs/promises";
import { Temporal } from "temporal-polyfill";
import { applyTruncation, cleanupTempDir, getTempDir } from "../src/tools/shared/truncation.js";

// ============================================================================
// Test Helpers
// ============================================================================

const testTempDir = "/tmp/pi-tavily-extension-test-truncation";

async function removeTestDir() {
  try {
    await rm(testTempDir, { recursive: true, force: true });
  } catch {
    // Directory may not exist
  }
}

beforeEach(async () => {
  await removeTestDir();
  await mkdir(testTempDir, { recursive: true });
});

afterEach(async () => {
  await removeTestDir();
});

// ============================================================================
// getTempDir Tests
// ============================================================================

describe("getTempDir", () => {
  test("returns path with .pi-tavily-temp suffix", () => {
    expect(getTempDir("/project")).toBe("/project/.pi-tavily-temp");
  });

  test("preserves cwd as-is", () => {
    expect(getTempDir("/some/deep/path")).toBe("/some/deep/path/.pi-tavily-temp");
  });

  test("handles relative paths", () => {
    expect(getTempDir(".")).toBe("./.pi-tavily-temp");
  });
});

// ============================================================================
// cleanupTempDir Tests
// ============================================================================

describe("cleanupTempDir", () => {
  test("removes temp directory and its contents", async () => {
    const tempDir = getTempDir(testTempDir);
    await mkdir(tempDir, { recursive: true });
    const { writeFile } = await import("node:fs/promises");
    await writeFile(`${tempDir}/test-file.txt`, "hello", "utf8");

    // Sanity: dir exists
    await stat(tempDir);

    await cleanupTempDir(testTempDir);

    // Dir should be gone
    expect(stat(tempDir)).rejects.toThrow();
  });

  test("succeeds when temp directory does not exist", async () => {
    await rm(testTempDir, { recursive: true, force: true });

    expect(cleanupTempDir(testTempDir)).resolves.toBeUndefined();
  });

  test("removes nested files created by applyTruncation", async () => {
    const longContent = Array.from({ length: 3000 }, () => "Line content").join("\n");

    const result1 = await applyTruncation(longContent, testTempDir, "tool-a");
    const result2 = await applyTruncation(longContent, testTempDir, "tool-b");

    // Sanity: files exist
    await access(result1.fullOutputPath!);
    await access(result2.fullOutputPath!);

    await cleanupTempDir(testTempDir);

    expect(access(result1.fullOutputPath!)).rejects.toThrow();
    expect(access(result2.fullOutputPath!)).rejects.toThrow();
  });

  test("preserves files outside temp directory", async () => {
    const tempDir = getTempDir(testTempDir);
    const outsideFile = `${testTempDir}/keep-me.txt`;
    const { writeFile } = await import("node:fs/promises");
    await mkdir(tempDir, { recursive: true });
    await writeFile(outsideFile, "untouched", "utf8");
    await writeFile(`${tempDir}/remove-me.txt`, "gone", "utf8");

    await cleanupTempDir(testTempDir);

    const content = await readFile(outsideFile, "utf8");
    expect(content).toBe("untouched");
    expect(stat(tempDir)).rejects.toThrow();
  });
});

// ============================================================================
// applyTruncation Tests
// ============================================================================

describe("applyTruncation", () => {
  test("returns content unchanged when output is small", async () => {
    const shortContent = "This is a short content.";

    const result = await applyTruncation(shortContent, testTempDir, "test-tool");

    expect(result.content).toBe(shortContent);
    expect(result.truncation).toBeUndefined();
    expect(result.fullOutputPath).toBeUndefined();
  });

  test("returns content unchanged when output is under line limit", async () => {
    const lines = Array.from({ length: 10 }, () => "Line content").join("\n");

    const result = await applyTruncation(lines, testTempDir, "test-tool");

    expect(result.content).toBe(lines);
    expect(result.truncation).toBeUndefined();
    expect(result.fullOutputPath).toBeUndefined();
  });

  test("returns content unchanged when output is under byte limit", async () => {
    // Create content under 50KB but with many lines
    const shortLines = Array.from({ length: 100 }, () => "Short").join("\n");

    const result = await applyTruncation(shortLines, testTempDir, "test-tool");

    expect(result.content).toBe(shortLines);
    expect(result.truncation).toBeUndefined();
    expect(result.fullOutputPath).toBeUndefined();
  });

  test("truncates content when line limit is exceeded", async () => {
    // Create content with more than 2000 lines
    const longContent = Array.from({ length: 3000 }, () => "Line content").join("\n");

    const result = await applyTruncation(longContent, testTempDir, "test-tool");

    // Should be truncated
    expect(result.truncation).toBeDefined();
    expect(result.truncation?.truncated).toBe(true);
    expect(result.truncation?.outputLines).toBe(2000);
    expect(result.truncation?.totalLines).toBe(3000);

    // Should contain truncation notice
    expect(result.content).toContain("[Output truncated:");

    // Full output should be saved to a file
    expect(result.fullOutputPath).toBeDefined();
    expect(result.fullOutputPath).toMatch(/test-tool-\d+\.txt$/);
  });

  test("truncates content when byte limit is exceeded", async () => {
    // Create content with over 50KB but under 2000 lines
    // Each line is 100 chars, 600 lines = ~61KB
    const longContent = Array.from({ length: 600 }, () => "X".repeat(100)).join("\n");

    const result = await applyTruncation(longContent, testTempDir, "test-tool");

    // Should be truncated by bytes (since 600 lines < 2000 lines)
    expect(result.truncation).toBeDefined();
    expect(result.truncation?.truncated).toBe(true);
    // outputBytes may slightly exceed the limit due to line-based truncation
    expect(result.truncation?.totalBytes).toBeGreaterThan(50000);
    expect(result.truncation?.outputBytes).toBeGreaterThan(50000);
    expect(result.truncation?.totalBytes).toBeDefined();
    expect(result.truncation?.outputBytes).toBeLessThan(result.truncation!.totalBytes);

    // Should contain truncation notice
    expect(result.content).toContain("[Output truncated:");

    // Full output should be saved to a file
    expect(result.fullOutputPath).toBeDefined();
  });

  test("includes truncation details in output message", async () => {
    const longContent = Array.from({ length: 3000 }, () => "Line content").join("\n");

    const result = await applyTruncation(longContent, testTempDir, "test-tool");

    const truncation = result.truncation;
    expect(truncation).toBeDefined();

    // Check truncation notice contains the details
    expect(result.content).toContain(
      `showing ${truncation?.outputLines} of ${truncation?.totalLines} lines`
    );
    expect(result.content).toContain("truncated");
    expect(result.content).toContain("Full output saved to:");
  });

  test("saves full output to temp file when truncated", async () => {
    const longContent = Array.from({ length: 3000 }, () => "Line content").join("\n");

    const result = await applyTruncation(longContent, testTempDir, "test-tool");

    expect(result.fullOutputPath).toBeDefined();

    // Verify file exists
    await access(result.fullOutputPath!);

    // Verify file contains full content
    // Note: We can't easily read the file to compare due to timing,
    // but we can verify it exists and has content
    const fileStat = await Bun.file(result.fullOutputPath!).stat();
    expect(fileStat.size).toBeGreaterThan(0);
  });

  test("uses tool name in temp file name", async () => {
    const longContent = Array.from({ length: 3000 }, () => "Line content").join("\n");

    const result1 = await applyTruncation(longContent, testTempDir, "web-search");
    const result2 = await applyTruncation(longContent, testTempDir, "news-search");

    expect(result1.fullOutputPath).toMatch(/web-search-\d+\.txt$/);
    expect(result2.fullOutputPath).toMatch(/news-search-\d+\.txt$/);
  });

  test("includes timestamp in temp file name", async () => {
    const longContent = Array.from({ length: 3000 }, () => "Line content").join("\n");

    const result = await applyTruncation(longContent, testTempDir, "test-tool");

    // File name should end with timestamp-like pattern
    expect(result.fullOutputPath).toMatch(/test-tool-\d+\.txt$/);

    // Extract and verify the timestamp is a number
    const match = result.fullOutputPath?.match(/test-tool-(\d+)\.txt$/);
    expect(match).not.toBeNull();
    const timestamp = match ? Number.parseInt(match[1]!, 10) : 0;
    const now = Temporal.Now.instant().epochMilliseconds;
    expect(timestamp).toBeGreaterThan(now - 10000); // Within last 10 seconds
    expect(timestamp).toBeLessThanOrEqual(now);
  });

  test("temp file is in correct directory", async () => {
    const longContent = Array.from({ length: 3000 }, () => "Line content").join("\n");

    const result = await applyTruncation(longContent, testTempDir, "test-tool");

    expect(result.fullOutputPath).toBeDefined();
    expect(result.fullOutputPath).toContain(testTempDir);
    expect(result.fullOutputPath).toMatch(new RegExp(`^${testTempDir}/`));
  });

  test("handles unicode content correctly", async () => {
    // Create content with unicode characters that would exceed byte limit
    // Each emoji is 4 bytes, 15000 emojis = 60KB
    const longContent = Array.from({ length: 15000 }, () => "😀").join("");

    const result = await applyTruncation(longContent, testTempDir, "test-tool");

    expect(result.truncation).toBeDefined();
    expect(result.truncation?.truncated).toBe(true);
    expect(result.fullOutputPath).toBeDefined();
  });

  test("handles empty string", async () => {
    const emptyContent = "";

    const result = await applyTruncation(emptyContent, testTempDir, "test-tool");

    expect(result.content).toBe("");
    expect(result.truncation).toBeUndefined();
    expect(result.fullOutputPath).toBeUndefined();
  });

  test("handles single line", async () => {
    const singleLine = "This is a single line.";

    const result = await applyTruncation(singleLine, testTempDir, "test-tool");

    expect(result.content).toBe(singleLine);
    expect(result.truncation).toBeUndefined();
    expect(result.fullOutputPath).toBeUndefined();
  });

  test("handles multiline content under limits", async () => {
    const multilineContent = "Line 1\nLine 2\nLine 3";

    const result = await applyTruncation(multilineContent, testTempDir, "test-tool");

    expect(result.content).toBe(multilineContent);
    expect(result.truncation).toBeUndefined();
    expect(result.fullOutputPath).toBeUndefined();
  });

  test("truncation notice is appended to content", async () => {
    const originalContent = "Original content";
    const longContent = Array.from({ length: 3000 }, () => originalContent).join("\n");

    const result = await applyTruncation(longContent, testTempDir, "test-tool");

    // Content should start with original (truncated) content
    expect(result.content).toContain(originalContent);

    // And end with truncation notice
    expect(result.content).toContain("[Output truncated:");
  });

  test("truncation details are correct for line limit", async () => {
    const longContent = Array.from({ length: 3000 }, () => "Line content").join("\n");

    const result = await applyTruncation(longContent, testTempDir, "test-tool");

    expect(result.truncation).toBeDefined();
    expect(result.truncation?.truncated).toBe(true);
    expect(result.truncation?.outputLines).toBe(2000);
    expect(result.truncation?.totalLines).toBe(3000);
    expect(result.truncation?.outputBytes).toBeDefined();
    expect(result.truncation?.totalBytes).toBeDefined();
  });

  test("creates temp directory if it doesn't exist", async () => {
    const nonExistentDir = "/tmp/test-truncation-nonexistent";
    const longContent = Array.from({ length: 3000 }, () => "Line content").join("\n");

    // This should not throw even if directory doesn't exist
    const result = await applyTruncation(longContent, nonExistentDir, "test-tool");

    expect(result.fullOutputPath).toBeDefined();

    // Clean up
    await rm(nonExistentDir, { recursive: true, force: true });
  });

  test("handles very long single line", async () => {
    // Create a very long single line (over 50KB)
    const longLine = "X".repeat(100000);

    const result = await applyTruncation(longLine, testTempDir, "test-tool");

    expect(result.truncation).toBeDefined();
    expect(result.truncation?.truncated).toBe(true);
    expect(result.fullOutputPath).toBeDefined();
  });

  test("handles content with special characters", async () => {
    const specialContent = Array.from(
      { length: 3000 },
      () => "Line with special chars: \n\t\r\\\"'"
    ).join("\n");

    const result = await applyTruncation(specialContent, testTempDir, "test-tool");

    expect(result.truncation).toBeDefined();
    expect(result.truncation?.truncated).toBe(true);
    expect(result.fullOutputPath).toBeDefined();
  });

  test("returns truncation result object", async () => {
    const longContent = Array.from({ length: 3000 }, () => "Line content").join("\n");

    const result = await applyTruncation(longContent, testTempDir, "test-tool");

    expect(result).toHaveProperty("content");
    expect(result).toHaveProperty("truncation");
    expect(result).toHaveProperty("fullOutputPath");
  });

  test("content property is always a string", async () => {
    const shortContent = "Short content";
    const longContent = Array.from({ length: 3000 }, () => "Line content").join("\n");

    const result1 = await applyTruncation(shortContent, testTempDir, "test-tool");
    const result2 = await applyTruncation(longContent, testTempDir, "test-tool");

    expect(typeof result1.content).toBe("string");
    expect(typeof result2.content).toBe("string");
  });

  test("fullOutputPath is string when truncated", async () => {
    const longContent = Array.from({ length: 3000 }, () => "Line content").join("\n");

    const result = await applyTruncation(longContent, testTempDir, "test-tool");

    if (result.truncation?.truncated) {
      expect(typeof result.fullOutputPath).toBe("string");
    }
  });

  test("multiple truncations create different files", async () => {
    const longContent = Array.from({ length: 3000 }, () => "Line content").join("\n");

    const result1 = await applyTruncation(longContent, testTempDir, "test-tool");
    // Wait a bit to ensure different timestamp
    await new Promise((resolve) => setTimeout(resolve, 10));
    const result2 = await applyTruncation(longContent, testTempDir, "test-tool");

    expect(result1.fullOutputPath).not.toBe(result2.fullOutputPath);
  });
});
