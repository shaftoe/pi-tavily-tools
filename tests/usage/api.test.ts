/**
 * Unit tests for src/usage/api.ts
 */

import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { getTavilyUsage, type TavilyUsageResponse } from "../../src/usage/api.js";

const mockUsageResponse: TavilyUsageResponse = {
  key: {
    usage: 150,
    limit: 1000,
    search_usage: 100,
    extract_usage: 25,
    crawl_usage: 15,
    map_usage: 7,
    research_usage: 3,
  },
  account: {
    current_plan: "Bootstrap",
    plan_usage: 500,
    plan_limit: 15000,
    paygo_usage: 25,
    paygo_limit: 100,
    search_usage: 350,
    extract_usage: 75,
    crawl_usage: 50,
    map_usage: 15,
    research_usage: 10,
  },
};

describe("getTavilyUsage", () => {
  let mockFetch: ReturnType<typeof mock>;

  beforeEach(() => {
    mockFetch = mock(() =>
      Promise.resolve({
        ok: true,
        json: async () => structuredClone(mockUsageResponse),
      } as Response)
    );
    global.fetch = mockFetch as unknown as typeof fetch;
  });

  afterEach(() => {
    mockFetch.mockRestore();
  });

  test("should throw an error when API key is empty string", async () => {
    expect(getTavilyUsage("")).rejects.toThrow("TAVILY_API_KEY is not set");
  });

  test("should throw an error when API request fails with 401", async () => {
    mockFetch.mockImplementationOnce(() => Promise.resolve({ ok: false, status: 401 } as Response));

    expect(getTavilyUsage("test-key")).rejects.toThrow(
      "Tavily usage API request failed with status 401"
    );
  });

  test("should throw an error when API returns 500", async () => {
    mockFetch.mockImplementationOnce(() => Promise.resolve({ ok: false, status: 500 } as Response));

    expect(getTavilyUsage("test-key")).rejects.toThrow(
      "Tavily usage API request failed with status 500"
    );
  });

  test("should throw an error when account section is missing", async () => {
    mockFetch.mockImplementationOnce(() =>
      Promise.resolve({ ok: true, json: async () => ({ key: mockUsageResponse.key }) } as Response)
    );

    expect(getTavilyUsage("test-key")).rejects.toThrow(
      "Unexpected Tavily usage API response: missing account usage data"
    );
  });

  test("should throw an error when plan_usage is missing", async () => {
    mockFetch.mockImplementationOnce(() =>
      Promise.resolve({
        ok: true,
        json: async () => ({
          account: { plan_limit: 15000 },
        }),
      } as Response)
    );

    expect(getTavilyUsage("test-key")).rejects.toThrow(
      "Unexpected Tavily usage API response: missing account usage data"
    );
  });

  test("should throw an error when plan_limit is missing", async () => {
    mockFetch.mockImplementationOnce(() =>
      Promise.resolve({
        ok: true,
        json: async () => ({
          account: { plan_usage: 500 },
        }),
      } as Response)
    );

    expect(getTavilyUsage("test-key")).rejects.toThrow(
      "Unexpected Tavily usage API response: missing account plan limit"
    );
  });

  test("should return correct usage data from a valid response", async () => {
    const result = await getTavilyUsage("test-key");

    // 500 / (15000 + 100) * 100 = 3.311...
    expect(result.percentage).toBeCloseTo(3.311, 2);
    expect(result.planUsage).toBe(500);
    expect(result.planLimit).toBe(15000);
    expect(result.paygoUsage).toBe(25);
    expect(result.paygoLimit).toBe(100);
    expect(result.keyUsage).toBe(150);
    expect(result.keyLimit).toBe(1000);
  });

  test("should handle 0% usage", async () => {
    const response = structuredClone(mockUsageResponse);
    response.account.plan_usage = 0;
    response.account.paygo_usage = 0;

    mockFetch.mockImplementationOnce(() =>
      Promise.resolve({ ok: true, json: async () => response } as Response)
    );

    const result = await getTavilyUsage("test-key");

    expect(result.percentage).toBe(0);
    expect(result.planUsage).toBe(0);
  });

  test("should handle 100% usage (plan and PAYGO both maxed)", async () => {
    const response = structuredClone(mockUsageResponse);
    response.account.plan_usage = response.account.plan_limit;
    response.account.paygo_usage = response.account.paygo_limit;

    mockFetch.mockImplementationOnce(() =>
      Promise.resolve({ ok: true, json: async () => response } as Response)
    );

    const result = await getTavilyUsage("test-key");

    // 15000 / (15000 + 100) * 100 = 99.3377...
    expect(result.percentage).toBeCloseTo(99.34, 2);
  });

  test("should handle plan_limit of 0 without division by zero", async () => {
    const response = structuredClone(mockUsageResponse);
    response.account.plan_limit = 0;
    response.account.plan_usage = 50;
    response.account.paygo_usage = 0;
    response.account.paygo_limit = 0;

    mockFetch.mockImplementationOnce(() =>
      Promise.resolve({ ok: true, json: async () => response } as Response)
    );

    const result = await getTavilyUsage("test-key");

    // (50 + 0) / (0 + 0 || 1) * 100 = 5000 — falls back to limit of 1
    expect(result.percentage).toBe(5000);
  });

  test("should make request to correct API endpoint with correct headers", async () => {
    let fetchUrl: string | undefined;
    let fetchHeaders: Record<string, string> | undefined;

    mockFetch.mockImplementationOnce((url: string, options: RequestInit) => {
      fetchUrl = url;
      fetchHeaders = options.headers as Record<string, string>;
      return Promise.resolve({
        ok: true,
        json: async () => structuredClone(mockUsageResponse),
      } as Response);
    });

    await getTavilyUsage("my-secret-key");

    expect(fetchUrl).toBe("https://api.tavily.com/usage");
    expect(fetchHeaders?.Authorization).toBe("Bearer my-secret-key");
  });

  test("should default keyUsage/keyLimit to 0 when key section is missing", async () => {
    mockFetch.mockImplementationOnce(() =>
      Promise.resolve({
        ok: true,
        json: async () => ({
          account: {
            plan_usage: 100,
            plan_limit: 1000,
          },
        }),
      } as Response)
    );

    const result = await getTavilyUsage("test-key");

    expect(result.keyUsage).toBe(0);
    expect(result.keyLimit).toBe(0);
    expect(result.percentage).toBe(10);
  });

  test("should calculate percentage correctly for free-tier-only user (no PAYGO)", async () => {
    mockFetch.mockImplementationOnce(() =>
      Promise.resolve({
        ok: true,
        json: async () => ({
          account: {
            plan_usage: 500,
            plan_limit: 1000,
            paygo_usage: 0,
            paygo_limit: 0,
          },
        }),
      } as Response)
    );

    const result = await getTavilyUsage("test-key");

    expect(result.percentage).toBe(50);
    expect(result.paygoUsage).toBe(0);
    expect(result.paygoLimit).toBe(0);
  });

  test("should calculate percentage correctly when plan exceeded but PAYGO covers it", async () => {
    mockFetch.mockImplementationOnce(() =>
      Promise.resolve({
        ok: true,
        json: async () => ({
          account: {
            plan_usage: 1018,
            plan_limit: 1000,
            paygo_usage: 0,
            paygo_limit: 5000,
          },
        }),
      } as Response)
    );

    const result = await getTavilyUsage("test-key");

    // (1018 + 0) / (1000 + 5000) * 100 = 16.97%
    expect(result.percentage).toBeCloseTo(16.97, 1);
  });

  test("should default paygo fields to 0 when missing from response", async () => {
    mockFetch.mockImplementationOnce(() =>
      Promise.resolve({
        ok: true,
        json: async () => ({
          account: {
            plan_usage: 200,
            plan_limit: 1000,
          },
        }),
      } as Response)
    );

    const result = await getTavilyUsage("test-key");

    expect(result.paygoUsage).toBe(0);
    expect(result.paygoLimit).toBe(0);
    expect(result.percentage).toBe(20);
  });

  test("should handle PAYGO-only usage with exhausted plan", async () => {
    mockFetch.mockImplementationOnce(() =>
      Promise.resolve({
        ok: true,
        json: async () => ({
          account: {
            plan_usage: 1000,
            plan_limit: 1000,
            paygo_usage: 250,
            paygo_limit: 1000,
          },
        }),
      } as Response)
    );

    const result = await getTavilyUsage("test-key");

    // 1000 / (1000 + 1000) * 100 = 50%
    expect(result.percentage).toBe(50);
  });
});
