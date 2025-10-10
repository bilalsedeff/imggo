/**
 * Idempotency utilities for ImgGo
 * Handle idempotency keys for duplicate request prevention
 */

import { logger } from "./logger";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface IdempotencyResult<T = unknown> {
  isDuplicate: boolean;
  existingData?: T;
}

/**
 * Check if idempotency key exists and return existing job if found
 */
export async function checkIdempotencyKey(
  idempotencyKey: string,
  supabaseClient: SupabaseClient
): Promise<IdempotencyResult> {
  try {
    const { data, error } = await supabaseClient
      .from("jobs")
      .select("id, status, manifest")
      .eq("idempotency_key", idempotencyKey)
      .single();

    if (error) {
      // Not found is OK, means first time
      if (error && typeof error === "object" && "code" in error && error.code === "PGRST116") {
        return { isDuplicate: false };
      }
      logger.warn("Idempotency check error", { idempotency_key: idempotencyKey, error });
      return { isDuplicate: false };
    }

    if (data) {
      return {
        isDuplicate: true,
        existingData: {
          job_id: data.id,
          status: data.status,
          manifest: data.manifest,
        },
      };
    }

    return { isDuplicate: false };
  } catch (err) {
    logger.error("Idempotency check exception", err, {
      idempotency_key: idempotencyKey,
    });
    // Fail open - allow request
    return { isDuplicate: false };
  }
}

/**
 * Generate idempotency key from request data
 * Use this if client doesn't provide one
 */
export function generateIdempotencyKey(data: Record<string, unknown>): string {
  const hash = createSimpleHash(JSON.stringify(data));
  return `auto_${hash}`;
}

/**
 * Simple hash function for generating idempotency keys
 */
function createSimpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36);
}

/**
 * Validate idempotency key format
 */
export function validateIdempotencyKey(key: string): boolean {
  // Allow alphanumeric, dash, underscore. Max 255 chars.
  const regex = /^[a-zA-Z0-9_-]{1,255}$/;
  return regex.test(key);
}
