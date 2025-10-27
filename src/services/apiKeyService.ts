/**
 * API Key Service
 * Handles API key generation, authentication, and management
 *
 * Security:
 * - Keys are hashed with SHA-256 before storage
 * - Plain key shown only once at creation
 * - Prefix stored for display purposes
 * - Scopes control fine-grained permissions
 */

import { supabaseServer } from "@/lib/supabase-server";
import { logger } from "@/lib/logger";
import { createHash, randomBytes } from "crypto";

// ============================================================================
// TYPES
// ============================================================================

export interface ApiKey {
  id: string;
  user_id: string;
  name: string;
  key_prefix: string;
  environment: "test" | "live";
  scopes: string[];
  last_used_at: string | null;
  last_used_ip: string | null;
  expires_at: string | null;
  ip_whitelist: string[] | null;
  created_at: string;
  revoked_at: string | null;
}

export interface ApiKeyMetadata extends Omit<ApiKey, "key_hash"> {
  // Public metadata (no sensitive data)
}

export interface CreateApiKeyParams {
  userId: string;
  name: string;
  environment: "test" | "live";
  scopes: string[];
  expiresAt?: string;
  ipWhitelist?: string[];
}

export interface AuthenticatedApiKey {
  userId: string;
  keyId: string;
  scopes: string[];
  environment: "test" | "live";
}

// ============================================================================
// SCOPES DEFINITION
// ============================================================================

export const SCOPES = {
  // Patterns
  "patterns:read": "View patterns",
  "patterns:write": "Create and update patterns",
  "patterns:ingest": "Submit images for processing",
  "patterns:delete": "Delete patterns",

  // Jobs
  "jobs:read": "View job status and results",

  // Webhooks
  "webhooks:read": "View webhooks",
  "webhooks:write": "Create and update webhooks",
  "webhooks:delete": "Delete webhooks",

  // Admin (future)
  "admin:all": "Full access (enterprise only)",
} as const;

export type ScopeKey = keyof typeof SCOPES;

// Default scopes for new API keys
export const DEFAULT_SCOPES: ScopeKey[] = [
  "patterns:read",
  "patterns:ingest",
  "jobs:read",
];

// ============================================================================
// KEY GENERATION
// ============================================================================

/**
 * Generate a cryptographically secure API key
 * Format: imggo_{env}_{40-char-random}
 *
 * @param environment - 'test' or 'live'
 * @returns Plain API key (show once!)
 */
function generateApiKey(environment: "test" | "live"): string {
  // Generate 40 characters of random data (240 bits of entropy)
  const randomPart = randomBytes(30).toString("base64url").substring(0, 40);

  return `imggo_${environment}_${randomPart}`;
}

/**
 * Hash API key with SHA-256
 * SHA-256 is sufficient for keys with 240-bit entropy (no salt needed)
 *
 * @param key - Plain API key
 * @returns SHA-256 hash (64 hex characters)
 */
function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

/**
 * Extract prefix from API key for display
 * Returns first 12 characters (e.g., "imggo_live_2")
 *
 * @param key - Plain API key
 * @returns Key prefix
 */
function getKeyPrefix(key: string): string {
  return key.substring(0, 12);
}

// ============================================================================
// API KEY CRUD
// ============================================================================

/**
 * Create a new API key
 * Returns plain key - MUST be shown to user immediately!
 *
 * @param params - API key parameters
 * @returns Plain key and metadata
 */
export async function createApiKey(params: CreateApiKeyParams): Promise<{
  key: string;
  keyPrefix: string;
  id: string;
  metadata: ApiKeyMetadata;
}> {
  const { userId, name, environment, scopes, expiresAt, ipWhitelist } = params;

  try {
    // Check if user can create more API keys (plan limits)
    const { data: canCreate, error: limitError } = await supabaseServer.rpc(
      "can_create_api_key",
      { p_user_id: userId }
    );

    if (limitError) {
      throw new Error(`Failed to check API key limit: ${limitError.message}`);
    }

    if (!canCreate) {
      throw new Error("API key limit reached for your plan. Please upgrade or revoke unused keys.");
    }

    // Generate plain key
    const plainKey = generateApiKey(environment);
    const keyHash = hashApiKey(plainKey);
    const keyPrefix = getKeyPrefix(plainKey);

    logger.info("Creating API key", {
      user_id: userId,
      name,
      environment,
      scopes_count: scopes.length,
    });

    // Insert into database
    const { data, error } = await supabaseServer
      .from("api_keys")
      .insert({
        user_id: userId,
        name,
        key_prefix: keyPrefix,
        key_hash: keyHash,
        environment,
        scopes,
        expires_at: expiresAt || null,
        ip_whitelist: ipWhitelist || null,
      })
      .select()
      .single();

    if (error) {
      logger.error("Failed to create API key", {
        user_id: userId,
        error: error.message,
      });
      throw new Error(`Failed to create API key: ${error.message}`);
    }

    logger.info("API key created successfully", {
      key_id: data.id,
      user_id: userId,
      prefix: keyPrefix,
    });

    return {
      key: plainKey, // ⚠️ SHOW ONCE!
      keyPrefix,
      id: data.id,
      metadata: data as ApiKeyMetadata,
    };
  } catch (error) {
    logger.error("Exception creating API key", {
      user_id: userId,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Authenticate request with API key
 * Returns user context if key is valid
 *
 * @param bearerToken - Token from Authorization header
 * @param requestIp - Optional IP for whitelist check
 * @returns Authenticated context or null
 */
export async function authenticateApiKey(
  bearerToken: string,
  requestIp?: string
): Promise<AuthenticatedApiKey | null> {
  try {
    // Validate format
    if (!bearerToken.startsWith("imggo_")) {
      logger.warn("Invalid API key format", { prefix: bearerToken.substring(0, 6) });
      return null;
    }

    // Hash the provided key
    const keyHash = hashApiKey(bearerToken);

    // Lookup in database
    const { data: apiKey, error } = await supabaseServer
      .from("api_keys")
      .select("*")
      .eq("key_hash", keyHash)
      .is("revoked_at", null)
      .single();

    if (error || !apiKey) {
      logger.warn("API key not found or revoked", {
        hash_prefix: keyHash.substring(0, 8),
      });
      return null;
    }

    // Check expiration
    if (apiKey.expires_at && new Date(apiKey.expires_at) < new Date()) {
      logger.warn("API key expired", {
        key_id: apiKey.id,
        expired_at: apiKey.expires_at,
      });
      return null;
    }

    // Check IP whitelist
    if (apiKey.ip_whitelist && apiKey.ip_whitelist.length > 0 && requestIp) {
      if (!apiKey.ip_whitelist.includes(requestIp)) {
        logger.warn("IP not in whitelist", {
          key_id: apiKey.id,
          request_ip: requestIp,
          whitelist: apiKey.ip_whitelist,
        });
        return null;
      }
    }

    // Update last used timestamp (fire and forget)
    supabaseServer
      .from("api_keys")
      .update({
        last_used_at: new Date().toISOString(),
        last_used_ip: requestIp || null,
      })
      .eq("id", apiKey.id)
      .then(() => {
        logger.debug("Updated API key last used", { key_id: apiKey.id });
      });

    logger.info("API key authenticated successfully", {
      key_id: apiKey.id,
      user_id: apiKey.user_id,
      environment: apiKey.environment,
    });

    return {
      userId: apiKey.user_id,
      keyId: apiKey.id,
      scopes: apiKey.scopes,
      environment: apiKey.environment,
    };
  } catch (error) {
    logger.error("Exception authenticating API key", {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/**
 * Check if API key has required scope
 * Supports scope hierarchy (admin:all includes everything)
 *
 * @param userScopes - Scopes from authenticated API key
 * @param requiredScope - Required scope for operation
 * @returns True if authorized
 */
export function hasScope(userScopes: string[], requiredScope: string): boolean {
  // Admin has all permissions
  if (userScopes.includes("admin:all")) {
    return true;
  }

  // Check direct scope match
  return userScopes.includes(requiredScope);
}

/**
 * List user's API keys (without sensitive data)
 *
 * @param userId - User ID
 * @returns List of API key metadata
 */
export async function listApiKeys(userId: string): Promise<ApiKeyMetadata[]> {
  try {
    const { data, error } = await supabaseServer
      .from("api_keys")
      .select("*")
      .eq("user_id", userId)
      .is("revoked_at", null)
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(`Failed to list API keys: ${error.message}`);
    }

    return (data || []) as ApiKeyMetadata[];
  } catch (error) {
    logger.error("Exception listing API keys", {
      user_id: userId,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Revoke an API key (soft delete)
 *
 * @param userId - User ID (for authorization)
 * @param keyId - API key ID to revoke
 * @param reason - Optional revocation reason
 */
export async function revokeApiKey(
  userId: string,
  keyId: string,
  reason?: string
): Promise<void> {
  try {
    logger.info("Revoking API key", {
      user_id: userId,
      key_id: keyId,
      reason,
    });

    const { error } = await supabaseServer
      .from("api_keys")
      .update({
        revoked_at: new Date().toISOString(),
        revoked_reason: reason || null,
      })
      .eq("id", keyId)
      .eq("user_id", userId); // Security: only owner can revoke

    if (error) {
      throw new Error(`Failed to revoke API key: ${error.message}`);
    }

    logger.info("API key revoked successfully", { key_id: keyId });
  } catch (error) {
    logger.error("Exception revoking API key", {
      user_id: userId,
      key_id: keyId,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Get user's plan limits (from new plans table)
 *
 * @param userId - User ID
 * @returns Rate limit configuration
 */
export async function getUserPlanLimits(userId: string): Promise<{
  rateLimitRequests: number;
  rateLimitWindowSeconds: number;
  maxApiKeys: number;
  maxPatterns: number;
  maxWebhooks: number;
  planName: string;
}> {
  try {
    // Query user_plans with plans table joined
    const { data: userPlan, error } = await supabaseServer
      .from("user_plans")
      .select(`
        *,
        plans!inner(
          name,
          requests_per_month,
          burst_rate_limit_seconds,
          max_api_keys,
          max_patterns,
          max_webhooks
        )
      `)
      .eq("user_id", userId)
      .single();

    if (error || !userPlan) {
      // Default to free plan if not found
      logger.warn("User plan not found, using free tier defaults", {
        user_id: userId,
        error: error?.message,
      });

      return {
        rateLimitRequests: 50,  // 50 requests per month for free
        rateLimitWindowSeconds: 2592000,  // 30 days in seconds (monthly window)
        maxApiKeys: 2,
        maxPatterns: 5,
        maxWebhooks: 3,
        planName: "free",
      };
    }

    const plan = userPlan.plans as {
      name: string;
      requests_per_month: number;
      burst_rate_limit_seconds: number | null;
      max_api_keys: number;
      max_patterns: number;
      max_webhooks: number;
    };

    return {
      rateLimitRequests: plan.requests_per_month,
      rateLimitWindowSeconds: 2592000,  // Monthly billing cycle (30 days)
      maxApiKeys: plan.max_api_keys,
      maxPatterns: plan.max_patterns,
      maxWebhooks: plan.max_webhooks,
      planName: plan.name,
    };
  } catch (error) {
    logger.error("Exception getting user plan limits", {
      user_id: userId,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}
