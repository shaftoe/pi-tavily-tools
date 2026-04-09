/**
 * Tavily Usage Footer Status
 *
 * Manages the Pi footer status display for Tavily API usage,
 * with caching to avoid excessive API calls.
 */

import type { ExtensionContext } from "@mariozechner/pi-coding-agent";
import { Temporal } from "temporal-polyfill";
import { RateLimitError, getTavilyUsage, type TavilyUsageData } from "./api.js";

/** Fetch usage function signature (same as getTavilyUsage for testability) */
export type FetchUsageFn = (apiKey: string) => Promise<TavilyUsageData>;

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
  private setStatusFromUsage(ctx: ExtensionContext, usageData: TavilyUsageData): void {
    const theme = ctx.ui.theme;
    const displayPercentage = Math.round(usageData.percentage * 10) / 10;

    let status = theme.fg("muted", "Tavily:") + theme.fg("accent", `${displayPercentage}%`);

    ctx.ui.setStatus("tavily-usage", status);
  }

  /** Update footer status with Tavily usage information */
  async updateStatus(
    ctx: ExtensionContext,
    fetchUsage: FetchUsageFn = getTavilyUsage
  ): Promise<void> {
    const now = Temporal.Now.instant().epochMilliseconds;

    // Respect rate-limit backoff — use cached data or skip silently
    if (now < this.backoffUntil) {
      if (this.lastUsage) {
        this.setStatusFromUsage(ctx, this.lastUsage);
      }
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
      this.lastUsage = usage;
      this.lastFetchTime = now;

      this.setStatusFromUsage(ctx, usage);
    } catch (error) {
      if (error instanceof RateLimitError) {
        this.backoffUntil = now + error.retryAfterMs;
        // Keep last known status instead of clearing
        if (this.lastUsage) {
          this.setStatusFromUsage(ctx, this.lastUsage);
        }
      } else {
        console.error(`Error updating Tavily usage: ${String(error)}`);
        this.clear(ctx);
      }
    }
  }

  /** Clear Tavily usage footer status */
  clear(ctx: ExtensionContext): void {
    ctx.ui.setStatus("tavily-usage", undefined);
  }
}
