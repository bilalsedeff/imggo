/**
 * Unified Authentication
 * Supports both API Key and Supabase Session authentication
 *
 * Priority:
 * 1. API Key (Authorization: Bearer header)
 * 2. Supabase Session (Cookie-based)
 *
 * Returns unified user context regardless of auth method
 */

import { NextRequest } from "next/server";
import { authenticateApiKey, hasScope } from "@/services/apiKeyService";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { logger } from "@/lib/logger";
import { ApiError } from "@/lib/api-helpers";

// ============================================================================
// TYPES
// ============================================================================

export interface AuthContext {
  userId: string;
  authType: "api_key" | "session";
  apiKeyId?: string;
  apiKeyScopes?: string[];
  apiKeyEnvironment?: "test" | "live";
}

// ============================================================================
// AUTHENTICATION METHODS
// ============================================================================

/**
 * Try to authenticate with API Key from Authorization header
 *
 * @param request - Next.js request
 * @returns Auth context or null
 */
async function tryApiKeyAuth(
  request: NextRequest
): Promise<AuthContext | null> {
  const authHeader = request.headers.get("authorization");

  if (!authHeader) {
    return null;
  }

  // Parse Bearer token
  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer") {
    logger.warn("Invalid Authorization header format", {
      format: authHeader.substring(0, 20),
    });
    return null;
  }

  const bearerToken = parts[1];

  // Get request IP for whitelist check
  const requestIp =
    request.headers.get("x-forwarded-for")?.split(",")[0] ||
    request.headers.get("x-real-ip") ||
    undefined;

  // Authenticate API key
  const apiKey = await authenticateApiKey(bearerToken, requestIp);

  if (!apiKey) {
    return null;
  }

  logger.info("Authenticated with API key", {
    key_id: apiKey.keyId,
    user_id: apiKey.userId,
    environment: apiKey.environment,
  });

  return {
    userId: apiKey.userId,
    authType: "api_key",
    apiKeyId: apiKey.keyId,
    apiKeyScopes: apiKey.scopes,
    apiKeyEnvironment: apiKey.environment,
  };
}

/**
 * Try to authenticate with Supabase Session (cookie-based)
 *
 * @param request - Next.js request
 * @returns Auth context or null
 */
async function trySessionAuth(
  request: NextRequest
): Promise<AuthContext | null> {
  try {
    const cookieStore = await cookies();

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          },
        },
      }
    );

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return null;
    }

    logger.info("Authenticated with session", {
      user_id: user.id,
    });

    return {
      userId: user.id,
      authType: "session",
    };
  } catch (error) {
    logger.error("Session auth error", {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Require authentication (API key or session)
 * Throws ApiError if neither method succeeds
 *
 * @param request - Next.js request
 * @param requiredScope - Optional scope check (API key only)
 * @returns Auth context
 */
export async function requireAuthOrApiKey(
  request: NextRequest,
  requiredScope?: string
): Promise<AuthContext> {
  // Try API key first (if Authorization header present)
  const apiKeyAuth = await tryApiKeyAuth(request);

  if (apiKeyAuth) {
    // Check scope if required
    if (requiredScope && apiKeyAuth.apiKeyScopes) {
      if (!hasScope(apiKeyAuth.apiKeyScopes, requiredScope)) {
        logger.warn("API key missing required scope", {
          key_id: apiKeyAuth.apiKeyId,
          required_scope: requiredScope,
          available_scopes: apiKeyAuth.apiKeyScopes,
        });

        throw new ApiError(
          `Missing required permission: ${requiredScope}`,
          403,
          "INSUFFICIENT_SCOPE"
        );
      }
    }

    return apiKeyAuth;
  }

  // Fallback to session auth
  const sessionAuth = await trySessionAuth(request);

  if (sessionAuth) {
    // Sessions have full access (no scope checks)
    return sessionAuth;
  }

  // Neither method succeeded
  logger.warn("Authentication failed - no valid credentials", {
    has_auth_header: request.headers.has("authorization"),
    path: request.nextUrl.pathname,
  });

  throw new ApiError(
    "Authentication required. Provide either an API key (Authorization: Bearer) or login to the dashboard.",
    401,
    "UNAUTHENTICATED"
  );
}

/**
 * Optional authentication (doesn't throw if missing)
 * Useful for public endpoints that want to know who's calling
 *
 * @param request - Next.js request
 * @returns Auth context or null
 */
export async function optionalAuth(
  request: NextRequest
): Promise<AuthContext | null> {
  // Try API key first
  const apiKeyAuth = await tryApiKeyAuth(request);
  if (apiKeyAuth) return apiKeyAuth;

  // Try session
  const sessionAuth = await trySessionAuth(request);
  if (sessionAuth) return sessionAuth;

  // No auth found (OK for optional)
  return null;
}

/**
 * Check if current auth has required scope
 * Always returns true for session auth (full access)
 *
 * @param authContext - Auth context from requireAuthOrApiKey
 * @param requiredScope - Required scope
 * @returns True if authorized
 */
export function checkScope(
  authContext: AuthContext,
  requiredScope: string
): boolean {
  // Session auth has full access
  if (authContext.authType === "session") {
    return true;
  }

  // API key auth - check scopes
  if (authContext.apiKeyScopes) {
    return hasScope(authContext.apiKeyScopes, requiredScope);
  }

  return false;
}

/**
 * Get request IP for rate limiting and logging
 *
 * @param request - Next.js request
 * @returns IP address or "unknown"
 */
export function getRequestIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0] ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}
