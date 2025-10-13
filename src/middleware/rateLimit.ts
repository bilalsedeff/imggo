/**
 * Rate Limiting Middleware for Next.js Route Handlers
 * Uses token bucket algorithm via Postgres
 */

import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import {
  checkRateLimit,
  getRateLimitHeaders,
  RATE_LIMIT_CONFIGS,
  RateLimitConfig,
} from "@/lib/rateLimit";
import { logger } from "@/lib/logger";

export interface RateLimitOptions {
  /**
   * Endpoint identifier for rate limiting
   * Uses predefined config from RATE_LIMIT_CONFIGS
   */
  endpoint: string;

  /**
   * Optional custom config (overrides predefined config)
   */
  config?: RateLimitConfig;

  /**
   * Whether to fail open on errors (default: true)
   * If true, allows request through on rate limit check errors
   * If false, returns 500 on errors
   */
  failOpen?: boolean;

  /**
   * Custom error message
   */
  errorMessage?: string;

  /**
   * Get user ID from request (default: from Supabase auth)
   */
  getUserId?: (req: NextRequest) => Promise<string | null>;
}

/**
 * Rate limit middleware for Next.js route handlers
 *
 * @example
 * ```ts
 * export async function POST(req: NextRequest) {
 *   const rateLimitResult = await withRateLimit(req, {
 *     endpoint: "patterns.ingest",
 *   });
 *
 *   if (!rateLimitResult.allowed) {
 *     return rateLimitResult.response;
 *   }
 *
 *   // Process request...
 *   return NextResponse.json({ success: true }, {
 *     headers: rateLimitResult.headers
 *   });
 * }
 * ```
 */
export async function withRateLimit(
  req: NextRequest,
  options: RateLimitOptions
): Promise<{
  allowed: boolean;
  response?: NextResponse;
  headers: Record<string, string>;
  remaining: number;
}> {
  const {
    endpoint,
    config: customConfig,
    failOpen = true,
    errorMessage = "Rate limit exceeded. Please try again later.",
    getUserId,
  } = options;

  try {
    // Get user ID
    let userId: string | null = null;

    if (getUserId) {
      userId = await getUserId(req);
    } else {
      // Default: Get from Supabase session
      const {
        data: { user },
        error,
      } = await supabaseServer.auth.getUser();

      if (error) {
        logger.warn("Failed to get user for rate limiting", {
          error: error.message,
          endpoint,
        });

        if (!failOpen) {
          return {
            allowed: false,
            response: NextResponse.json(
              { error: "Authentication required for rate limiting" },
              { status: 401 }
            ),
            headers: {},
            remaining: 0,
          };
        }

        // Fail open - allow request
        return {
          allowed: true,
          headers: {},
          remaining: customConfig?.maxTokens ?? RATE_LIMIT_CONFIGS[endpoint]?.maxTokens ?? 100,
        };
      }

      userId = user?.id ?? null;
    }

    if (!userId) {
      logger.warn("No user ID for rate limiting", { endpoint });

      if (!failOpen) {
        return {
          allowed: false,
          response: NextResponse.json(
            { error: "Authentication required" },
            { status: 401 }
          ),
          headers: {},
          remaining: 0,
        };
      }

      // Fail open
      return {
        allowed: true,
        headers: {},
        remaining: customConfig?.maxTokens ?? RATE_LIMIT_CONFIGS[endpoint]?.maxTokens ?? 100,
      };
    }

    // Check rate limit
    const result = await checkRateLimit(userId, endpoint, supabaseServer);

    const headers = getRateLimitHeaders(result);

    if (!result.allowed) {
      logger.warn("Rate limit exceeded", {
        user_id: userId,
        endpoint,
        remaining: result.remaining,
      });

      return {
        allowed: false,
        response: NextResponse.json(
          {
            error: errorMessage,
            retryAfter: result.resetAt.toISOString(),
          },
          {
            status: 429,
            headers: {
              ...headers,
              "Retry-After": Math.ceil(
                (result.resetAt.getTime() - Date.now()) / 1000
              ).toString(),
            },
          }
        ),
        headers,
        remaining: result.remaining,
      };
    }

    logger.info("Rate limit check passed", {
      user_id: userId,
      endpoint,
      remaining: result.remaining,
    });

    return {
      allowed: true,
      headers,
      remaining: result.remaining,
    };
  } catch (error) {
    logger.error("Rate limit middleware error", error, { endpoint });

    if (!failOpen) {
      return {
        allowed: false,
        response: NextResponse.json(
          { error: "Rate limit check failed" },
          { status: 500 }
        ),
        headers: {},
        remaining: 0,
      };
    }

    // Fail open on errors
    return {
      allowed: true,
      headers: {},
      remaining: customConfig?.maxTokens ?? RATE_LIMIT_CONFIGS[endpoint]?.maxTokens ?? 100,
    };
  }
}

/**
 * HOF wrapper for route handlers with automatic rate limiting
 *
 * @example
 * ```ts
 * export const POST = rateLimited(
 *   { endpoint: "patterns.create" },
 *   async (req: NextRequest) => {
 *     // Your handler logic
 *     return NextResponse.json({ success: true });
 *   }
 * );
 * ```
 */
export function rateLimited<T extends unknown[]>(
  options: RateLimitOptions,
  handler: (req: NextRequest, ...args: T) => Promise<NextResponse>
): (req: NextRequest, ...args: T) => Promise<NextResponse> {
  return async (req: NextRequest, ...args: T): Promise<NextResponse> => {
    const result = await withRateLimit(req, options);

    if (!result.allowed && result.response) {
      return result.response;
    }

    // Call original handler with rate limit headers
    const response = await handler(req, ...args);

    // Append rate limit headers to response
    Object.entries(result.headers).forEach(([key, value]) => {
      response.headers.set(key, value);
    });

    return response;
  };
}

/**
 * Rate limit check for API routes (simpler alternative)
 * Returns 429 response or null if allowed
 *
 * @example
 * ```ts
 * export async function POST(req: NextRequest) {
 *   const rateLimitResponse = await checkRateLimitOrFail(req, "patterns.ingest");
 *   if (rateLimitResponse) return rateLimitResponse;
 *
 *   // Process request...
 *   return NextResponse.json({ success: true });
 * }
 * ```
 */
export async function checkRateLimitOrFail(
  req: NextRequest,
  endpoint: string,
  options?: Omit<RateLimitOptions, "endpoint">
): Promise<NextResponse | null> {
  const result = await withRateLimit(req, { endpoint, ...options });

  if (!result.allowed && result.response) {
    return result.response;
  }

  return null;
}

/**
 * IP-based rate limiting (for unauthenticated endpoints)
 * Uses IP address as the rate limit key
 */
export async function withIpRateLimit(
  req: NextRequest,
  options: Omit<RateLimitOptions, "getUserId">
): Promise<{
  allowed: boolean;
  response?: NextResponse;
  headers: Record<string, string>;
  remaining: number;
}> {
  const getIpUserId = async (request: NextRequest): Promise<string | null> => {
    // Get IP from various headers (Vercel, Cloudflare, standard)
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0] ||
      request.headers.get("x-real-ip") ||
      request.headers.get("cf-connecting-ip") ||
      "unknown";

    // Hash IP to create a stable user ID
    const encoder = new TextEncoder();
    const data = encoder.encode(ip);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    return `ip:${hashHex}`;
  };

  return withRateLimit(req, {
    ...options,
    getUserId: getIpUserId,
  });
}
