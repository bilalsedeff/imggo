/**
 * Rate limiting utilities for ImgGo
 * Token bucket implementation using Postgres
 */

import { logger } from "./logger";

export interface RateLimitConfig {
  maxTokens: number;
  refillRate: number;
  refillIntervalSeconds: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
}

/**
 * Default rate limit configurations per endpoint
 */
export const RATE_LIMIT_CONFIGS: Record<string, RateLimitConfig> = {
  "patterns.create": {
    maxTokens: 10,
    refillRate: 1,
    refillIntervalSeconds: 60, // 10 patterns per hour
  },
  "patterns.ingest": {
    maxTokens: 100,
    refillRate: 10,
    refillIntervalSeconds: 60, // 100 images per 10 minutes (sustained)
  },
  "api.default": {
    maxTokens: 100,
    refillRate: 10,
    refillIntervalSeconds: 1, // 100 requests per 10 seconds
  },
};

/**
 * Check and consume rate limit via Postgres function
 * Note: The actual enforcement happens in the DB via check_rate_limit()
 * This is a client-side helper
 */
export async function checkRateLimit(
  userId: string,
  endpoint: string,
  supabaseClient: { rpc: (fn: string, params: Record<string, unknown>) => Promise<{ data: boolean | null; error: unknown }> }
): Promise<RateLimitResult> {
  const config = (RATE_LIMIT_CONFIGS[endpoint] || RATE_LIMIT_CONFIGS["api.default"])!;

  try {
    const { data: allowed, error } = await supabaseClient.rpc("check_rate_limit", {
      p_endpoint: endpoint,
      p_max_tokens: config.maxTokens,
      p_refill_rate: config.refillRate,
      p_refill_interval: `${config.refillIntervalSeconds} seconds`,
    });

    if (error) {
      logger.error("Rate limit check failed", error, {
        user_id: userId,
        endpoint,
      });
      // Fail open in case of DB errors
      return {
        allowed: true,
        remaining: config.maxTokens,
        resetAt: new Date(Date.now() + config.refillIntervalSeconds * 1000),
      };
    }

    return {
      allowed: allowed ?? true,
      remaining: allowed ? config.maxTokens - 1 : 0,
      resetAt: new Date(Date.now() + config.refillIntervalSeconds * 1000),
    };
  } catch (err) {
    logger.error("Rate limit exception", err, {
      user_id: userId,
      endpoint,
    });
    // Fail open on exceptions
    return {
      allowed: true,
      remaining: config.maxTokens,
      resetAt: new Date(Date.now() + config.refillIntervalSeconds * 1000),
    };
  }
}

/**
 * Headers to include in rate-limited responses
 */
export function getRateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": result.resetAt.toISOString(),
  };
}
