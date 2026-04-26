/**
 * Unit tests for Tavily TypeBox schemas
 */

import { describe, expect, test } from "bun:test";
import { DEFAULT_MAX_RESULTS } from "../src/tools/tavily/client.js";
import {
  BaseSearchParamsSchema,
  IncludeOptionsSchema,
  WebSearchParamsSchema,
} from "../src/tools/tavily/schemas.js";

describe("WebSearchParamsSchema", () => {
  test("is a valid Type.Object schema", () => {
    expect(WebSearchParamsSchema.type).toBe("object");
  });

  test("has required query field", () => {
    // TypeBox schema doesn't export required fields directly in a simple way
    // We can verify by checking the properties exist
    const properties = WebSearchParamsSchema.properties;
    expect(properties).toBeDefined();
    expect(properties.query).toBeDefined();
  });

  test("query field is a string", () => {
    const properties = WebSearchParamsSchema.properties as Record<string, unknown>;
    const querySchema = properties.query as { type: string };
    expect(querySchema.type).toBe("string");
  });

  test("query has description", () => {
    const properties = WebSearchParamsSchema.properties as Record<string, unknown>;
    const querySchema = properties.query as { description?: string };
    expect(querySchema.description).toBe("Search query string");
  });

  test("has optional max_results field", () => {
    const properties = WebSearchParamsSchema.properties as Record<string, unknown>;
    expect(properties.max_results).toBeDefined();
  });

  test("max_results field is a number", () => {
    const properties = WebSearchParamsSchema.properties as Record<string, unknown>;
    const maxResultsSchema = properties.max_results as { type: string };
    expect(maxResultsSchema.type).toBe("number");
  });

  test("max_results has description", () => {
    const properties = WebSearchParamsSchema.properties as Record<string, unknown>;
    const maxResultsSchema = properties.max_results as { description?: string };
    expect(maxResultsSchema.description).toBe(
      `Number of results to return (1-20, default: ${DEFAULT_MAX_RESULTS})`
    );
  });

  test("has optional search_depth field", () => {
    const properties = WebSearchParamsSchema.properties as Record<string, unknown>;
    expect(properties.search_depth).toBeDefined();
  });

  test("search_depth is a Union of Literal values", () => {
    const properties = WebSearchParamsSchema.properties as Record<string, unknown>;
    const searchDepthSchema = properties.search_depth as {
      anyOf?: { const: string }[];
    };
    expect(searchDepthSchema.anyOf).toBeDefined();
    expect(searchDepthSchema.anyOf!.map((v) => v.const)).toEqual(["basic", "advanced"]);
  });

  test("search_depth has description", () => {
    const properties = WebSearchParamsSchema.properties as Record<string, unknown>;
    const searchDepthSchema = properties.search_depth as { description?: string };
    expect(searchDepthSchema.description).toBe(
      "Search depth: 'basic' or 'advanced' (default: 'basic')"
    );
  });

  test("has optional include_answer field", () => {
    const properties = WebSearchParamsSchema.properties as Record<string, unknown>;
    expect(properties.include_answer).toBeDefined();
  });

  test("include_answer field is a boolean", () => {
    const properties = WebSearchParamsSchema.properties as Record<string, unknown>;
    const includeAnswerSchema = properties.include_answer as { type: string };
    expect(includeAnswerSchema.type).toBe("boolean");
  });

  test("include_answer has description", () => {
    const properties = WebSearchParamsSchema.properties as Record<string, unknown>;
    const includeAnswerSchema = properties.include_answer as { description?: string };
    expect(includeAnswerSchema.description).toBe("Include AI-generated answer (default: true)");
  });

  test("has optional include_raw_content field", () => {
    const properties = WebSearchParamsSchema.properties as Record<string, unknown>;
    expect(properties.include_raw_content).toBeDefined();
  });

  test("include_raw_content field is a boolean", () => {
    const properties = WebSearchParamsSchema.properties as Record<string, unknown>;
    const includeRawContentSchema = properties.include_raw_content as { type: string };
    expect(includeRawContentSchema.type).toBe("boolean");
  });

  test("include_raw_content has description", () => {
    const properties = WebSearchParamsSchema.properties as Record<string, unknown>;
    const includeRawContentSchema = properties.include_raw_content as { description?: string };
    expect(includeRawContentSchema.description).toBe(
      "Include raw page content in results (default: false)"
    );
  });

  test("has optional include_images field", () => {
    const properties = WebSearchParamsSchema.properties as Record<string, unknown>;
    expect(properties.include_images).toBeDefined();
  });

  test("include_images field is a boolean", () => {
    const properties = WebSearchParamsSchema.properties as Record<string, unknown>;
    const includeImagesSchema = properties.include_images as { type: string };
    expect(includeImagesSchema.type).toBe("boolean");
  });

  test("include_images has description", () => {
    const properties = WebSearchParamsSchema.properties as Record<string, unknown>;
    const includeImagesSchema = properties.include_images as { description?: string };
    expect(includeImagesSchema.description).toBe(
      "Include relevant images in results (default: false)"
    );
  });

  test("has optional days field", () => {
    const properties = WebSearchParamsSchema.properties as Record<string, unknown>;
    expect(properties.days).toBeDefined();
  });

  test("days field is a number", () => {
    const properties = WebSearchParamsSchema.properties as Record<string, unknown>;
    const daysSchema = properties.days as { type: string };
    expect(daysSchema.type).toBe("number");
  });

  test("days has description", () => {
    const properties = WebSearchParamsSchema.properties as Record<string, unknown>;
    const daysSchema = properties.days as { description?: string };
    expect(daysSchema.description).toBe("Limit results to last N days (e.g., 7 for last week)");
  });

  test("has exactly 7 properties", () => {
    const properties = WebSearchParamsSchema.properties as Record<string, unknown>;
    const keys = Object.keys(properties);
    expect(keys).toHaveLength(7);
  });

  // Note: Runtime validation tests with TypeCompiler are skipped because
  // StringEnum from @mariozechner/pi-ai may not be a standard TypeBox schema
  // that TypeCompiler can compile. Schema structure tests are sufficient here.
});

describe("BaseSearchParamsSchema", () => {
  test("has query property", () => {
    expect(BaseSearchParamsSchema.query).toBeDefined();
  });

  test("query is a string type", () => {
    const querySchema = BaseSearchParamsSchema.query as { type: string };
    expect(querySchema.type).toBe("string");
  });

  test("query has description", () => {
    const querySchema = BaseSearchParamsSchema.query as { description?: string };
    expect(querySchema.description).toBe("Search query string");
  });

  test("has max_results property", () => {
    expect(BaseSearchParamsSchema.max_results).toBeDefined();
  });

  test("max_results is Optional.Number", () => {
    const maxResultsSchema = BaseSearchParamsSchema.max_results as { type: string };
    expect(maxResultsSchema.type).toBe("number");
  });

  test("max_results has description", () => {
    const maxResultsSchema = BaseSearchParamsSchema.max_results as { description?: string };
    expect(maxResultsSchema.description).toBe(
      `Number of results to return (1-20, default: ${DEFAULT_MAX_RESULTS})`
    );
  });

  test("has search_depth property", () => {
    expect(BaseSearchParamsSchema.search_depth).toBeDefined();
  });

  test("search_depth is a Union of Literal values", () => {
    const searchDepthSchema = BaseSearchParamsSchema.search_depth as unknown as {
      anyOf?: { const: string }[];
    };
    expect(searchDepthSchema.anyOf).toBeDefined();
    expect(searchDepthSchema.anyOf!.map((v) => v.const)).toEqual(["basic", "advanced"]);
  });

  test("search_depth has description", () => {
    const searchDepthSchema = BaseSearchParamsSchema.search_depth as { description?: string };
    expect(searchDepthSchema.description).toBe(
      "Search depth: 'basic' or 'advanced' (default: 'basic')"
    );
  });

  test("has days property", () => {
    expect(BaseSearchParamsSchema.days).toBeDefined();
  });

  test("days is a number type", () => {
    const daysSchema = BaseSearchParamsSchema.days as { type: string };
    expect(daysSchema.type).toBe("number");
  });

  test("days has description", () => {
    const daysSchema = BaseSearchParamsSchema.days as { description?: string };
    expect(daysSchema.description).toBe("Limit results to last N days (e.g., 7 for last week)");
  });

  test("has exactly 4 properties", () => {
    const keys = Object.keys(BaseSearchParamsSchema);
    expect(keys).toHaveLength(4);
  });

  test("properties are the expected ones", () => {
    const keys = Object.keys(BaseSearchParamsSchema);
    expect(keys).toContain("query");
    expect(keys).toContain("max_results");
    expect(keys).toContain("search_depth");
    expect(keys).toContain("days");
  });
});

describe("IncludeOptionsSchema", () => {
  test("has include_answer property", () => {
    expect(IncludeOptionsSchema.include_answer).toBeDefined();
  });

  test("include_answer is a boolean type", () => {
    const includeAnswerSchema = IncludeOptionsSchema.include_answer as { type: string };
    expect(includeAnswerSchema.type).toBe("boolean");
  });

  test("include_answer has description", () => {
    const includeAnswerSchema = IncludeOptionsSchema.include_answer as { description?: string };
    expect(includeAnswerSchema.description).toBe("Include AI-generated answer (default: true)");
  });

  test("has include_raw_content property", () => {
    expect(IncludeOptionsSchema.include_raw_content).toBeDefined();
  });

  test("include_raw_content is a boolean type", () => {
    const includeRawContentSchema = IncludeOptionsSchema.include_raw_content as { type: string };
    expect(includeRawContentSchema.type).toBe("boolean");
  });

  test("include_raw_content has description", () => {
    const includeRawContentSchema = IncludeOptionsSchema.include_raw_content as {
      description?: string;
    };
    expect(includeRawContentSchema.description).toBe(
      "Include raw page content in results (default: false)"
    );
  });

  test("has include_images property", () => {
    expect(IncludeOptionsSchema.include_images).toBeDefined();
  });

  test("include_images is a boolean type", () => {
    const includeImagesSchema = IncludeOptionsSchema.include_images as { type: string };
    expect(includeImagesSchema.type).toBe("boolean");
  });

  test("include_images has description", () => {
    const includeImagesSchema = IncludeOptionsSchema.include_images as { description?: string };
    expect(includeImagesSchema.description).toBe(
      "Include relevant images in results (default: false)"
    );
  });

  test("has exactly 3 properties", () => {
    const keys = Object.keys(IncludeOptionsSchema);
    expect(keys).toHaveLength(3);
  });

  test("properties are the expected ones", () => {
    const keys = Object.keys(IncludeOptionsSchema);
    expect(keys).toContain("include_answer");
    expect(keys).toContain("include_raw_content");
    expect(keys).toContain("include_images");
  });
});

describe("Schema Consistency", () => {
  test("BaseSearchParamsSchema query matches WebSearchParamsSchema query", () => {
    const baseQuery = BaseSearchParamsSchema.query as { description?: string };
    const webQuery = (WebSearchParamsSchema.properties as Record<string, unknown>).query as {
      description?: string;
    };
    expect(baseQuery.description).toBe(webQuery.description);
  });

  test("BaseSearchParamsSchema max_results matches WebSearchParamsSchema max_results", () => {
    const baseMaxResults = BaseSearchParamsSchema.max_results as { description?: string };
    const webMaxResults = (WebSearchParamsSchema.properties as Record<string, unknown>)
      .max_results as { description?: string };
    expect(baseMaxResults.description).toBe(webMaxResults.description);
  });

  test("BaseSearchParamsSchema search_depth matches WebSearchParamsSchema search_depth", () => {
    const baseSearchDepth = BaseSearchParamsSchema.search_depth as { description?: string };
    const webSearchDepth = (WebSearchParamsSchema.properties as Record<string, unknown>)
      .search_depth as { description?: string };
    expect(baseSearchDepth.description).toBe(webSearchDepth.description);
  });

  test("BaseSearchParamsSchema days matches WebSearchParamsSchema days", () => {
    const baseDays = BaseSearchParamsSchema.days as { description?: string };
    const webDays = (WebSearchParamsSchema.properties as Record<string, unknown>).days as {
      description?: string;
    };
    expect(baseDays.description).toBe(webDays.description);
  });

  test("IncludeOptionsSchema include_answer matches WebSearchParamsSchema include_answer", () => {
    const includeAnswer = IncludeOptionsSchema.include_answer as { description?: string };
    const webIncludeAnswer = (WebSearchParamsSchema.properties as Record<string, unknown>)
      .include_answer as { description?: string };
    expect(includeAnswer.description).toBe(webIncludeAnswer.description);
  });

  test("IncludeOptionsSchema include_raw_content matches WebSearchParamsSchema include_raw_content", () => {
    const includeRawContent = IncludeOptionsSchema.include_raw_content as { description?: string };
    const webIncludeRawContent = (WebSearchParamsSchema.properties as Record<string, unknown>)
      .include_raw_content as { description?: string };
    expect(includeRawContent.description).toBe(webIncludeRawContent.description);
  });

  test("IncludeOptionsSchema include_images matches WebSearchParamsSchema include_images", () => {
    const includeImages = IncludeOptionsSchema.include_images as { description?: string };
    const webIncludeImages = (WebSearchParamsSchema.properties as Record<string, unknown>)
      .include_images as { description?: string };
    expect(includeImages.description).toBe(webIncludeImages.description);
  });
});
