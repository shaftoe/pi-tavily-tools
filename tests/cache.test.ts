/**
 * Unit tests for session-level result cache
 */

import { describe, expect, test } from "bun:test";
import { resultCache } from "../src/tools/shared/cache.js";

describe("resultCache", () => {
  test("returns undefined for unknown URL", () => {
    resultCache.clear();
    expect(resultCache.get("https://example.com")).toBeUndefined();
  });

  test("returns cached result after set", () => {
    resultCache.clear();
    const entry = { url: "https://example.com", title: "Example", rawContent: "Hello" };
    resultCache.set(entry);
    expect(resultCache.get("https://example.com")).toEqual(entry);
  });

  test("overwrites existing entry for same URL", () => {
    resultCache.clear();
    resultCache.set({ url: "https://example.com", title: "Old", rawContent: "Old content" });
    resultCache.set({ url: "https://example.com", title: "New", rawContent: "New content" });
    expect(resultCache.get("https://example.com")?.title).toBe("New");
  });

  test("clear removes all entries", () => {
    resultCache.set({ url: "https://a.com", title: "A", rawContent: "a" });
    resultCache.set({ url: "https://b.com", title: "B", rawContent: "b" });
    resultCache.clear();
    expect(resultCache.get("https://a.com")).toBeUndefined();
    expect(resultCache.get("https://b.com")).toBeUndefined();
  });

  test("stores null title correctly", () => {
    resultCache.clear();
    resultCache.set({ url: "https://example.com", title: null, rawContent: "content" });
    expect(resultCache.get("https://example.com")?.title).toBeNull();
  });
});
