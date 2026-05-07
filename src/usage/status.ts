/**
 * Tavily Usage Footer Status
 *
 * Manages the Pi footer status display for Tavily API usage,
 * with caching to avoid excessive API calls.
 */

import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { Temporal } from "temporal-polyfill";
import { RateLimitError, getTavilyUsage, type TavilyUsageData } from "./api.js";

/** Fetch usage function signature (same as getTavilyUsage for testability) */
export type FetchUsageFn = (apiKey: string) => Promise<TavilyUsageData | undefined>;

/** Cache for Tavily usage data to avoid excessive API calls */
export class UsageCache {
  private readonly apiKey: string;
  private lastUsage: TavilyUsageData | null = null;
  private lastFetchTime = 0;
  private backoffUntil = 0;
  private static readonly FETCH_COOLDOWN_MS = 120_000;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  /** Build and set footer status string from usage data */
  private setStatusFromUsage(ctx: ExtensionContext, usageData: TavilyUsageData | undefined): void {
    const theme = ctx.ui.theme;

    let status: string;
    if (usageData) {
      const displayPercentage = Math.round(usageData.percentage * 10) / 10;
      status = theme.fg("muted", "Tavily:") + theme.fg("accent", `${displayPercentage}%`);
    } else {
      status = theme.fg("muted", "Tavily:") + theme.fg("accent", "N/A");
    }

    ctx.ui.setStatus("tavily-usage", status);
  }

  /** Update footer status with Tavily usage information */
  async updateStatus(
    ctx: ExtensionContext,
    fetchUsage: FetchUsageFn = getTavilyUsage
  ): Promise<void> {
    const now = Temporal.Now.instant().epochMilliseconds;

    // Respect rate-limit backoff — use cached data or show N/A
    if (now < this.backoffUntil) {
      this.setStatusFromUsage(ctx, this.lastUsage ?? undefined);
      return;
    }

    // Use cached data if still fresh
    if (
      this.lastUsage &&
      this.lastFetchTime &&
      now - this.lastFetchTime < UsageCache.FETCH_COOLDOWN_MS
    ) {
      this.setStatusFromUsage(ctx, this.lastUsage);
      return;
    }

    try {
      const usage = await fetchUsage(this.apiKey);
      if (!usage) {
        // API returned empty or non-JSON body (e.g. 202 with no data)
        if (!this.lastUsage) {
          this.setStatusFromUsage(ctx, undefined);
        }
        return;
      }
      this.lastUsage = usage;
      this.lastFetchTime = now;

      this.setStatusFromUsage(ctx, usage);
    } catch (error) {
      if (error instanceof RateLimitError) {
        this.backoffUntil = now + error.retryAfterMs;
        this.lastFetchTime = now;
        this.setStatusFromUsage(ctx, this.lastUsage ?? undefined);
      } else {
        // Network/API errors — show N/A if no cached data, otherwise keep cache
        if (this.lastUsage) {
          this.setStatusFromUsage(ctx, this.lastUsage);
        } else {
          this.setStatusFromUsage(ctx, undefined);
        }
      }
    }
  }

  /** Clear Tavily usage footer status */
  clear(ctx: ExtensionContext): void {
    ctx.ui.setStatus("tavily-usage", undefined);
  }
}
