/**
 * Unit tests for Tavily response formatters
 */

import { describe, expect, test } from "bun:test";
import {
  extractSearchResults,
  formatSearchResults,
  formatWebSearchResponse,
} from "../src/tools/tavily/formatters.js";

describe("formatWebSearchResponse", () => {
  test("formats response with answer and results", () => {
    const answer = "Paris is the capital of France.";
    const results = [
      {
        title: "Paris - Wikipedia",
        url: "https://en.wikipedia.org/wiki/Paris",
        score: 0.95,
        content: "Paris is the capital and most populous city of France.",
      },
    ];

    const output = formatWebSearchResponse(answer, results, [], false);

    expect(output).toContain("AI Answer: Paris is the capital of France.");
    expect(output).toContain("Sources:");
    expect(output).toContain("1. Paris - Wikipedia");
    expect(output).toContain("URL: https://en.wikipedia.org/wiki/Paris");
    expect(output).toContain("Score: 0.95");
    expect(output).toContain("Content: Paris is the capital and most populous city of France.");
  });

  test("formats response without answer", () => {
    const results = [
      {
        title: "Test Result",
        url: "https://example.com",
        score: 0.85,
        content: "Test content",
      },
    ];

    const output = formatWebSearchResponse(null, results, [], false);

    expect(output).not.toContain("AI Answer:");
    expect(output).toContain("Sources:");
    expect(output).toContain("1. Test Result");
  });

  test("shows 'No results found' when results array is empty", () => {
    const output = formatWebSearchResponse(null, [], [], false);

    expect(output).toContain("No results found.");
  });

  test("truncates content at 300 characters", () => {
    const longContent = "a".repeat(400);
    const results = [
      {
        title: "Long Content Test",
        url: "https://example.com",
        score: 0.9,
        content: longContent,
      },
    ];

    const output = formatWebSearchResponse(null, results, [], false);

    expect(output).toContain("Content: " + "a".repeat(300) + "...");
    expect(output).not.toContain("a".repeat(301));
  });

  test("prefers rawContent over content when both are present", () => {
    const results = [
      {
        title: "Raw Content Test",
        url: "https://example.com",
        score: 0.9,
        content: "Short content",
        rawContent: "Longer raw content that should be displayed",
      },
    ];

    const output = formatWebSearchResponse(null, results, [], false);

    expect(output).toContain("Content: Longer raw content that should be displayed");
    expect(output).not.toContain("Short content");
  });

  test("includes images when includeImages is true", () => {
    const answer = "Test answer";
    const results = [
      {
        title: "Test",
        url: "https://example.com",
        score: 0.9,
      },
    ];
    const images = [
      { url: "https://example.com/image1.jpg", description: "Test image 1" },
      { url: "https://example.com/image2.jpg", description: "Test image 2" },
    ];

    const output = formatWebSearchResponse(answer, results, images, true);

    expect(output).toContain("Images:");
    expect(output).toContain("1. https://example.com/image1.jpg");
    expect(output).toContain("Test image 1");
    expect(output).toContain("2. https://example.com/image2.jpg");
  });

  test("does not include images when includeImages is false", () => {
    const results = [
      {
        title: "Test",
        url: "https://example.com",
        score: 0.9,
      },
    ];
    const images = [{ url: "https://example.com/image1.jpg", description: "Test image 1" }];

    const output = formatWebSearchResponse(null, results, images, false);

    expect(output).not.toContain("Images:");
  });

  test("limits images to 5 results", () => {
    const images = Array.from({ length: 10 }, (_, i) => ({
      url: `https://example.com/image${i}.jpg`,
      description: `Image ${i}`,
    }));

    const output = formatWebSearchResponse(null, [], images, true);

    expect(output).toContain("1. https://example.com/image0.jpg");
    expect(output).toContain("5. https://example.com/image4.jpg");
    expect(output).not.toContain("6. https://example.com/image5.jpg");
  });
});

describe("formatSearchResults", () => {
  test("formats results into parts structure", () => {
    const answer = "Test answer";
    const results = [
      {
        title: "Result 1",
        url: "https://example.com/1",
        score: 0.95,
        content: "Content 1",
      },
    ];

    const output = formatSearchResults(answer, results, [], false);

    expect(output.answer).toBe("Test answer");
    expect(output.sources).toHaveLength(4); // title, url, score, content lines
    expect(output.sources[0]).toContain("1. Result 1");
    expect(output.images).toBeUndefined();
  });

  test("handles undefined answer", () => {
    const output = formatSearchResults(null, [], [], false);

    expect(output.answer).toBeUndefined();
  });

  test("includes images when requested", () => {
    const images = [{ url: "https://example.com/image.jpg", description: "Test image" }];

    const output = formatSearchResults(null, [], images, true);

    expect(output.images).toBeDefined();
    expect(output.images).toHaveLength(2); // url and description lines
  });

  test("excludes images when not requested", () => {
    const images = [{ url: "https://example.com/image.jpg", description: "Test image" }];

    const output = formatSearchResults(null, [], images, false);

    expect(output.images).toBeUndefined();
  });
});

describe("extractSearchResults", () => {
  test("extracts answer from response", () => {
    const response = { answer: "Test answer" };

    const extracted = extractSearchResults(response);

    expect(extracted.answer).toBe("Test answer");
  });

  test("returns null answer when not present", () => {
    const response = {};

    const extracted = extractSearchResults(response);

    expect(extracted.answer).toBeNull();
  });

  test("extracts results array", () => {
    const response = {
      results: [
        {
          title: "Test Result",
          url: "https://example.com",
          score: 0.95,
          content: "Test content",
        },
      ],
    };

    const extracted = extractSearchResults(response);

    expect(extracted.results).toHaveLength(1);
    expect(extracted.results[0]?.title).toBe("Test Result");
    expect(extracted.results[0]?.url).toBe("https://example.com");
    expect(extracted.results[0]?.score).toBe(0.95);
    expect(extracted.results[0]?.content).toBe("Test content");
  });

  test("handles missing result properties with defaults", () => {
    const response = {
      results: [{}],
    };

    const extracted = extractSearchResults(response);

    expect(extracted.results[0]?.title).toBe("Untitled");
    expect(extracted.results[0]?.url).toBe("");
    expect(extracted.results[0]?.score).toBe(0);
  });

  test("filters out null results", () => {
    const response = {
      results: [{ title: "Valid", url: "https://example.com", score: 0.9 }, null, undefined],
    };

    const extracted = extractSearchResults(response);

    expect(extracted.results).toHaveLength(1);
  });

  test("extracts images array", () => {
    const response = {
      images: [{ url: "https://example.com/image.jpg", description: "Test image" }],
    };

    const extracted = extractSearchResults(response);

    expect(extracted.images).toHaveLength(1);
    expect(extracted.images[0]?.url).toBe("https://example.com/image.jpg");
    expect(extracted.images[0]?.description).toBe("Test image");
  });

  test("handles missing image properties", () => {
    const response = {
      images: [{}],
    };

    const extracted = extractSearchResults(response);

    expect(extracted.images[0]?.url).toBe("");
    expect(extracted.images[0]?.description).toBeUndefined();
  });

  test("filters out null images", () => {
    const response = {
      images: [{ url: "https://example.com/image.jpg" }, null, undefined],
    };

    const extracted = extractSearchResults(response);

    expect(extracted.images).toHaveLength(1);
  });

  test("handles non-object results gracefully", () => {
    const response = {
      results: [{ title: "Valid", url: "https://example.com", score: 0.9 }, "invalid", 123],
    };

    const extracted = extractSearchResults(response);

    expect(extracted.results).toHaveLength(1);
  });

  test("converts score to number", () => {
    const response = {
      results: [{ title: "Test", url: "https://example.com", score: "0.95" }],
    };

    const extracted = extractSearchResults(response);

    expect(typeof extracted.results[0]?.score).toBe("number");
    expect(extracted.results[0]?.score).toBe(0.95);
  });
});
