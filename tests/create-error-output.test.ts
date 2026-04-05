/**
 * Unit tests for truncation utilities
 */

import { describe, expect, test } from "bun:test";
import { createErrorOutput } from "../src/tools/shared/truncation.js";

describe("createErrorOutput", () => {
  test("creates error output with message", () => {
    const result = createErrorOutput("API key missing", {
      query: "test",
      maxResults: 5,
    });

    expect(result.content).toBe("Error: API key missing");
    expect(result.details).toEqual({
      query: "test",
      maxResults: 5,
      resultCount: 0,
      sources: [],
      error: "API key missing",
    });
  });

  test("merges base details with error details", () => {
    const baseDetails = {
      query: "search query",
      maxResults: 10,
      searchDepth: "advanced",
      customField: "custom value",
    };

    const result = createErrorOutput("Network error", baseDetails);

    expect(result.details).toEqual({
      query: "search query",
      maxResults: 10,
      searchDepth: "advanced",
      customField: "custom value",
      resultCount: 0,
      sources: [],
      error: "Network error",
    });
  });

  test("sets resultCount to 0", () => {
    const result = createErrorOutput("Error", { resultCount: 5 });

    expect(result.details.resultCount).toBe(0);
  });

  test("sets sources to empty array", () => {
    const result = createErrorOutput("Error", { sources: ["source1", "source2"] });

    expect(result.details.sources).toEqual([]);
  });

  test("preserves all base details", () => {
    const baseDetails = {
      field1: "value1",
      field2: 42,
      field3: true,
      nested: { a: 1, b: 2 },
    };

    const result = createErrorOutput("Error", baseDetails);

    expect(result.details.field1).toBe("value1");
    expect(result.details.field2).toBe(42);
    expect(result.details.field3).toBe(true);
    expect(result.details.nested).toEqual({ a: 1, b: 2 });
  });

  test("handles empty base details", () => {
    const result = createErrorOutput("Error", {});

    expect(result.details).toEqual({
      resultCount: 0,
      sources: [],
      error: "Error",
    });
  });

  test("formats error message correctly", () => {
    const result = createErrorOutput("Something went wrong", {});

    expect(result.content).toBe("Error: Something went wrong");
  });

  test("does not mutate base details object", () => {
    const baseDetails = { query: "test", maxResults: 5 };
    const original = { ...baseDetails };

    createErrorOutput("Error", baseDetails);

    expect(baseDetails).toEqual(original);
  });
});
