/**
 * Parametric Rate Limiting (USER-LEVEL)
 * Rate limits based on user's subscription plan
 *
 * CRITICAL: All API keys under same user share the same request pool
 * This prevents users from bypassing limits by creating multiple API keys
 *
 * Free: 50 req/month + 1 req/min burst limit
 * Starter: 500 req/month
 * Plus: 3000 req/month
 * Premium: 15000 req/month
 * Enterprise: 50000+ req/month (custom)
 */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import { logger } from "@/lib/logger";
import { AuthContext } from "@/lib/auth-unified";

// ============================================================================
// RATE LIMIT TRACKING (USER-LEVEL)
// ============================================================================

export interface RateLimitStatus {
  allowed: boolean;
  monthly_limit: number;  // -1 = unlimited
  monthly_used: number;
  monthly_remaining: number;  // -1 = unlimited
  burst_limit_seconds: number | null;  // 60 for free (1 req/min), NULL for paid
  reset_at: Date;
  retry_after?: number;  // seconds
  plan_name?: string;

  // Legacy fields for backwards compatibility (deprecated)
  limit?: number;
  remaining?: number;
  resetAt?: Date;
}

interface EnforceRateLimitOptions {
  statusRef?: { current?: RateLimitStatus };
}

/**
 * Check rate limit for authenticated user (USER-LEVEL)
 *
 * CRITICAL: This checks at USER level, not API key level
 * All API keys under same user share the request pool
 *
 * @param userId - User ID
 * @param authContext - Auth context (for logging)
 * @returns Rate limit status
 */
export async function checkRateLimit(
  userId: string,
  authContext: AuthContext
): Promise<RateLimitStatus> {
  try {
    // Get user's plan details (includes limits and usage)
    const { data: userPlan, error: planError } = await supabaseServer
      .from("user_plans")
      .select(`
        *,
        plans!inner(
          name,
          requests_per_month,
          burst_rate_limit_seconds
        )
      `)
      .eq("user_id", userId)
      .single();

    if (planError || !userPlan) {
      logger.warn("User plan not found, defaulting to free tier", {
        user_id: userId,
        error: planError?.message,
      });

      // Default to free tier limits (graceful degradation)
      return {
        allowed: false,
        monthly_limit: 50,
        monthly_used: 0,
        monthly_remaining: 0,
        burst_limit_seconds: 60,
        reset_at: new Date(Date.now() + 60000),
        retry_after: 60,
        plan_name: 'free',
        // Legacy fields
        limit: 50,
        remaining: 0,
        resetAt: new Date(Date.now() + 60000),
      };
    }

    const plan = userPlan.plans as { name: string; requests_per_month: number; burst_rate_limit_seconds: number | null };
    const monthlyLimit = plan.requests_per_month;
    const burstLimitSeconds = plan.burst_rate_limit_seconds;
    const monthlyUsed = userPlan.requests_used_current_period || 0;

    // Calculate remaining requests
    const monthlyRemaining = monthlyLimit === -1 ? -1 : Math.max(0, monthlyLimit - monthlyUsed);

    // Check 1: Monthly limit (all plans)
    if (monthlyLimit !== -1 && monthlyUsed >= monthlyLimit) {
      logger.warn("Monthly rate limit exceeded", {
        user_id: userId,
        auth_type: authContext.authType,
        plan: plan.name,
        limit: monthlyLimit,
        used: monthlyUsed,
      });

      const resetAt = new Date(userPlan.current_period_end);
      return {
        allowed: false,
        monthly_limit: monthlyLimit,
        monthly_used: monthlyUsed,
        monthly_remaining: 0,
        burst_limit_seconds: burstLimitSeconds,
        reset_at: resetAt,
        retry_after: Math.ceil((resetAt.getTime() - Date.now()) / 1000),
        plan_name: plan.name,
        // Legacy fields
        limit: monthlyLimit,
        remaining: 0,
        resetAt: resetAt,
      };
    }

    // Check 2: Burst rate limit (FREE plan only: 1 req/min)
    if (burstLimitSeconds) {
      const lastRequestAt = userPlan.last_burst_request_at;
      if (lastRequestAt) {
        const timeSinceLastRequest = (Date.now() - new Date(lastRequestAt).getTime()) / 1000;

        if (timeSinceLastRequest < burstLimitSeconds) {
          logger.warn("Burst rate limit exceeded", {
            user_id: userId,
            auth_type: authContext.authType,
            plan: plan.name,
            burst_limit: burstLimitSeconds,
            time_since_last: timeSinceLastRequest.toFixed(1),
          });

          const retryAfter = Math.ceil(burstLimitSeconds - timeSinceLastRequest);
          return {
            allowed: false,
            monthly_limit: monthlyLimit,
            monthly_used: monthlyUsed,
            monthly_remaining: monthlyRemaining,
            burst_limit_seconds: burstLimitSeconds,
            reset_at: new Date(Date.now() + retryAfter * 1000),
            retry_after: retryAfter,
            plan_name: plan.name,
            // Legacy fields
            limit: monthlyLimit,
            remaining: monthlyRemaining,
            resetAt: new Date(Date.now() + retryAfter * 1000),
          };
        }
      }
    }

    // ALLOWED - both monthly and burst limits passed
    logger.debug("Rate limit check passed", {
      user_id: userId,
      auth_type: authContext.authType,
      plan: plan.name,
      monthly_used: monthlyUsed,
      monthly_limit: monthlyLimit,
      monthly_remaining: monthlyRemaining,
    });

    return {
      allowed: true,
      monthly_limit: monthlyLimit,
      monthly_used: monthlyUsed,
      monthly_remaining: monthlyRemaining,
      burst_limit_seconds: burstLimitSeconds,
      reset_at: new Date(userPlan.current_period_end),
      plan_name: plan.name,
      // Legacy fields
      limit: monthlyLimit,
      remaining: monthlyRemaining,
      resetAt: new Date(userPlan.current_period_end),
    };
  } catch (error) {
    logger.error("Rate limit check exception, failing open", {
      user_id: userId,
      error: error instanceof Error ? error.message : String(error),
    });

    // Fail open (allow request) on errors to prevent service disruption
    return {
      allowed: true,
      monthly_limit: 50,
      monthly_used: 0,
      monthly_remaining: 50,
      burst_limit_seconds: null,
      reset_at: new Date(Date.now() + 3600000),
      // Legacy fields
      limit: 50,
      remaining: 50,
      resetAt: new Date(Date.now() + 3600000),
    };
  }
}

/**
 * Atomically increment request count at USER level
 * CRITICAL: This is called AFTER request is allowed (not before)
 *
 * Uses Postgres function to prevent race conditions with concurrent requests
 *
 * @param userId - User ID
 */
export async function incrementRequestCount(userId: string): Promise<void> {
  try {
    const now = new Date().toISOString();

    // Call Postgres function for atomic increment (prevents race conditions)
    const { error } = await supabaseServer.rpc("increment_user_request_count", {
      p_user_id: userId,
      p_timestamp: now,
    });

    if (error) {
      logger.error("Failed to increment request count", {
        user_id: userId,
        error: error.message,
      });
      // Don't throw - request already processed
    }
  } catch (error) {
    logger.error("Exception incrementing request count", {
      user_id: userId,
      error: error instanceof Error ? error.message : String(error),
    });
    // Don't throw - request already processed
  }
}

/**
 * Log API request for analytics (optional, non-blocking)
 * Fire-and-forget, non-blocking
 *
 * @param userId - User ID
 * @param authContext - Auth context
 * @param endpoint - API endpoint path
 * @param requestIp - Request IP
 */
export async function logApiRequest(
  userId: string,
  authContext: AuthContext,
  endpoint: string,
  requestIp: string
): Promise<void> {
  // Fire and forget - don't block request
  supabaseServer
    .from("api_request_logs")
    .insert({
      user_id: userId,
      auth_type: authContext.authType,
      api_key_id: authContext.apiKeyId || null,
      endpoint,
      request_ip: requestIp,
      environment: authContext.apiKeyEnvironment || null,
    })
    .then(({ error }) => {
      if (error) {
        // Log table might not exist yet - that's OK
        logger.debug("Failed to log API request (expected during setup)", {
          error: error.message,
        });
      }
    });
}

/**
 * Enforce rate limit (returns 429 if exceeded)
 *
 * CRITICAL: This is the main entry point for rate limiting
 * Call this at the beginning of every rate-limited API route
 *
 * @param userId - User ID
 * @param authContext - Auth context
 * @param endpoint - API endpoint
 * @param requestIp - Request IP
 * @param options - Optional options (statusRef for returning status)
 * @returns NextResponse if rate limited, null if allowed
 */
export async function enforceRateLimit(
  userId: string,
  authContext: AuthContext,
  endpoint: string,
  requestIp: string,
  options?: EnforceRateLimitOptions
): Promise<NextResponse | null> {
  // Check rate limit
  const rateLimitStatus = await checkRateLimit(userId, authContext);

  // Log request for analytics (non-blocking, optional)
  logApiRequest(userId, authContext, endpoint, requestIp);

  // If rate limited, return 429 response
  if (!rateLimitStatus.allowed) {
    if (options?.statusRef) {
      options.statusRef.current = {
        ...rateLimitStatus,
        monthly_remaining: 0,
        remaining: 0,
      };
    }

    // Determine error message based on limit type
    let errorMessage: string;
    if (rateLimitStatus.burst_limit_seconds && rateLimitStatus.retry_after && rateLimitStatus.retry_after < 120) {
      // Burst limit (free plan: 1 req/min)
      errorMessage = `Rate limit exceeded. Free plan allows 1 request per minute. Please wait ${rateLimitStatus.retry_after} seconds before trying again, or upgrade to remove burst limits.`;
    } else {
      // Monthly limit
      errorMessage = `Monthly request limit (${rateLimitStatus.monthly_limit} requests) exceeded. Your limit resets on ${rateLimitStatus.reset_at.toISOString()}. Upgrade your plan for higher limits.`;
    }

    const response = NextResponse.json(
      {
        error: "Rate limit exceeded",
        message: errorMessage,
        limit: {
          monthly: rateLimitStatus.monthly_limit,
          used: rateLimitStatus.monthly_used,
          remaining: 0,
          reset_at: rateLimitStatus.reset_at.toISOString(),
        },
        ...(rateLimitStatus.burst_limit_seconds && {
          burst_limit: `1 request per ${rateLimitStatus.burst_limit_seconds} seconds (free plan only)`,
        }),
        upgrade_url: "/pricing",
      },
      { status: 429 }
    );

    // Add standard rate limit headers
    response.headers.set("X-RateLimit-Limit", rateLimitStatus.monthly_limit.toString());
    response.headers.set("X-RateLimit-Remaining", "0");
    response.headers.set(
      "X-RateLimit-Reset",
      Math.floor(rateLimitStatus.reset_at.getTime() / 1000).toString()
    );
    if (rateLimitStatus.retry_after) {
      response.headers.set("Retry-After", rateLimitStatus.retry_after.toString());
    }

    return response;
  }

  // ALLOWED - increment count asynchronously (non-blocking)
  incrementRequestCount(userId).catch((err) => {
    logger.error("Async increment failed", { user_id: userId, error: err });
  });

  // Return status for headers
  if (options?.statusRef) {
    options.statusRef.current = {
      ...rateLimitStatus,
      monthly_remaining: Math.max(0, rateLimitStatus.monthly_remaining - 1),
      remaining: Math.max(0, rateLimitStatus.monthly_remaining - 1),
    };
  }

  return null;  // Allow request to proceed
}

/**
 * Get rate limit headers for successful responses
 *
 * @param rateLimitStatus - Rate limit status
 * @returns Headers object
 */
export function getRateLimitHeaders(
  rateLimitStatus: RateLimitStatus
): Record<string, string> {
  return {
    "X-RateLimit-Limit": rateLimitStatus.monthly_limit.toString(),
    "X-RateLimit-Remaining": rateLimitStatus.monthly_remaining.toString(),
    "X-RateLimit-Reset": Math.floor(
      rateLimitStatus.reset_at.getTime() / 1000
    ).toString(),
  };
}
