/**
 * Parametric Rate Limiting
 * Rate limits based on user's subscription plan
 *
 * Free: 100 req/10min
 * Pro: 1000 req/10min
 * Enterprise: 10000 req/10min
 *
 * Uses sliding window algorithm with PostgreSQL
 */

import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import { getUserPlanLimits } from "@/services/apiKeyService";
import { logger } from "@/lib/logger";
import { AuthContext } from "@/lib/auth-unified";

// ============================================================================
// RATE LIMIT TRACKING
// ============================================================================

export interface RateLimitStatus {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: Date;
  retryAfter?: number; // seconds
}

interface EnforceRateLimitOptions {
  statusRef?: { current?: RateLimitStatus };
}

/**
 * Check rate limit for authenticated user
 * Uses sliding window with PostgreSQL timestamp tracking
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
    // Get user's plan limits
    const planLimits = await getUserPlanLimits(userId);
    const {
      rateLimitRequests: limit,
      rateLimitWindowSeconds: windowSeconds,
    } = planLimits;

    // Calculate window start time
    const windowStart = new Date(Date.now() - windowSeconds * 1000);

    // Count requests in current window
    // This is a simplified approach - for production, consider Redis or a dedicated rate limiting service
    const { count, error: countError } = await supabaseServer
      .from("api_request_logs")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("created_at", windowStart.toISOString());

    if (countError) {
      // If table doesn't exist yet, allow request (graceful degradation)
      logger.warn("Rate limit check failed, allowing request", {
        user_id: userId,
        error: countError.message,
      });

      return {
        allowed: true,
        limit,
        remaining: limit,
        resetAt: new Date(Date.now() + windowSeconds * 1000),
      };
    }

    const requestCount = count || 0;
    const remaining = Math.max(0, limit - requestCount);
    const allowed = requestCount < limit;

    const resetAt = new Date(Date.now() + windowSeconds * 1000);

    logger.debug("Rate limit check", {
      user_id: userId,
      auth_type: authContext.authType,
      plan: planLimits.planName,
      count: requestCount,
      limit,
      remaining,
      allowed,
    });

    if (!allowed) {
      logger.warn("Rate limit exceeded", {
        user_id: userId,
        auth_type: authContext.authType,
        plan: planLimits.planName,
        count: requestCount,
        limit,
      });

      return {
        allowed: false,
        limit,
        remaining: 0,
        resetAt,
        retryAfter: Math.ceil(
          (resetAt.getTime() - Date.now()) / 1000
        ),
      };
    }

    return {
      allowed: true,
      limit,
      remaining,
      resetAt,
    };
  } catch (error) {
    // On error, allow request (fail open)
    logger.error("Rate limit check exception, allowing request", {
      user_id: userId,
      error: error instanceof Error ? error.message : String(error),
    });

    return {
      allowed: true,
      limit: 100,
      remaining: 100,
      resetAt: new Date(Date.now() + 600000), // 10 minutes
    };
  }
}

/**
 * Log API request for rate limiting
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
 * Middleware wrapper for rate limit checks
 * Returns 429 Too Many Requests if limit exceeded
 *
 * @param userId - User ID
 * @param authContext - Auth context
 * @param endpoint - API endpoint
 * @param requestIp - Request IP
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

  // Log request (non-blocking)
  logApiRequest(userId, authContext, endpoint, requestIp);

  // If rate limited, return 429 response
  if (!rateLimitStatus.allowed) {
    if (options?.statusRef) {
      options.statusRef.current = {
        ...rateLimitStatus,
        remaining: 0,
      };
    }

    const response = NextResponse.json(
      {
        error: "Rate limit exceeded",
        message: `You have exceeded your rate limit of ${rateLimitStatus.limit} requests. Please try again after ${rateLimitStatus.retryAfter} seconds.`,
        limit: rateLimitStatus.limit,
        remaining: 0,
        reset_at: rateLimitStatus.resetAt.toISOString(),
        retry_after: rateLimitStatus.retryAfter,
      },
      { status: 429 }
    );

    // Add rate limit headers (standard)
    response.headers.set("X-RateLimit-Limit", rateLimitStatus.limit.toString());
    response.headers.set("X-RateLimit-Remaining", "0");
    response.headers.set(
      "X-RateLimit-Reset",
      Math.floor(rateLimitStatus.resetAt.getTime() / 1000).toString()
    );
    response.headers.set(
      "Retry-After",
      rateLimitStatus.retryAfter!.toString()
    );

    return response;
  }

  // Rate limit passed - return null (continue)
  if (options?.statusRef) {
    options.statusRef.current = {
      ...rateLimitStatus,
      remaining: Math.max(0, rateLimitStatus.remaining - 1),
    };
  }

  return null;
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
    "X-RateLimit-Limit": rateLimitStatus.limit.toString(),
    "X-RateLimit-Remaining": rateLimitStatus.remaining.toString(),
    "X-RateLimit-Reset": Math.floor(
      rateLimitStatus.resetAt.getTime() / 1000
    ).toString(),
  };
}
