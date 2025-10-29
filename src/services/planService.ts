/**
 * Plan Service - Business logic for pricing plan management
 *
 * This service manages:
 * - Fetching active plans for pricing page
 * - Getting user's current plan with usage details
 * - Checking feature limits (API keys, patterns, webhooks)
 */

import { supabaseServer } from "@/lib/supabase-server";
import { logger } from "@/lib/logger";

// ============================================================================
// TYPES
// ============================================================================

export interface Plan {
  id: string;
  name: string;
  display_name: string;
  description: string;
  price_monthly_cents: number;
  price_yearly_cents: number | null;
  requests_per_month: number;  // -1 = unlimited
  burst_rate_limit_seconds: number | null;
  max_image_size_mb: number;
  max_characters_per_request: number;
  max_template_characters: number;  // Same as max_characters_per_request (not a separate limit)
  max_api_keys: number;  // -1 = unlimited
  max_patterns: number;  // -1 = unlimited
  max_webhooks: number;  // -1 = unlimited
  features: Record<string, unknown>;
  is_highlighted: boolean;
  sort_order: number;
  cta_text: string;
  cta_url: string | null;
}

export interface UserPlanDetails {
  plan: Plan;
  billing_cycle: 'monthly' | 'yearly' | null;
  current_period_start: string;
  current_period_end: string;
  requests_used_current_period: number;
  requests_remaining: number;  // -1 = unlimited
  usage_percent: number;  // 0-100, or 0 for unlimited
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
}

// ============================================================================
// PLAN QUERIES
// ============================================================================

/**
 * Get all active plans for pricing page
 * Ordered by sort_order (Free → Starter → Plus → Premium → Enterprise)
 */
export async function getActivePlans(): Promise<Plan[]> {
  try {
    const { data, error } = await supabaseServer
      .from("plans")
      .select("*")
      .eq("is_active", true)
      .order("sort_order", { ascending: true });

    if (error) {
      logger.error("Failed to fetch active plans", { error: error.message });
      throw new Error(`Failed to fetch plans: ${error.message}`);
    }

    return (data || []) as Plan[];
  } catch (error) {
    logger.error("Exception fetching active plans", {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Get user's current plan details (including usage)
 *
 * @param userId - User ID
 * @returns User plan with usage statistics
 */
export async function getUserPlan(userId: string): Promise<UserPlanDetails> {
  try {
    // Get user plan with plan details joined
    const { data: userPlan, error } = await supabaseServer
      .from("user_plans")
      .select(`
        *,
        plans!inner(*)
      `)
      .eq("user_id", userId)
      .single();

    if (error || !userPlan) {
      logger.error("Failed to fetch user plan", {
        user_id: userId,
        error: error?.message,
      });
      throw new Error("User plan not found");
    }

    const plan = userPlan.plans as unknown as Plan;

    // Calculate remaining requests
    const requestsRemaining = plan.requests_per_month === -1
      ? -1  // Unlimited
      : Math.max(0, plan.requests_per_month - userPlan.requests_used_current_period);

    // Calculate usage percentage
    const usagePercent = plan.requests_per_month === -1
      ? 0  // Unlimited = 0%
      : Math.min(100, (userPlan.requests_used_current_period / plan.requests_per_month) * 100);

    return {
      plan,
      billing_cycle: userPlan.billing_cycle,
      current_period_start: userPlan.current_period_start,
      current_period_end: userPlan.current_period_end,
      requests_used_current_period: userPlan.requests_used_current_period,
      requests_remaining: requestsRemaining,
      usage_percent: usagePercent,
      stripe_customer_id: userPlan.stripe_customer_id,
      stripe_subscription_id: userPlan.stripe_subscription_id,
    };
  } catch (error) {
    logger.error("Exception fetching user plan", {
      user_id: userId,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Get plan by name
 *
 * @param planName - Plan name ('free', 'starter', 'pro', 'business', 'enterprise')
 * @returns Plan or null if not found
 */
export async function getPlanByName(planName: string): Promise<Plan | null> {
  try {
    const { data, error } = await supabaseServer
      .from("plans")
      .select("*")
      .eq("name", planName)
      .eq("is_active", true)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return null;
      }
      throw error;
    }

    return data as Plan;
  } catch (error) {
    logger.error("Exception fetching plan by name", {
      plan_name: planName,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Get plan by ID
 *
 * @param planId - Plan UUID
 * @returns Plan or null if not found
 */
export async function getPlanById(planId: string): Promise<Plan | null> {
  try {
    const { data, error } = await supabaseServer
      .from("plans")
      .select("*")
      .eq("id", planId)
      .eq("is_active", true)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return null;
      }
      throw error;
    }

    return data as Plan;
  } catch (error) {
    logger.error("Exception fetching plan by ID", {
      plan_id: planId,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

// ============================================================================
// FEATURE LIMIT CHECKS
// ============================================================================

export type FeatureLimitType = 'api_keys' | 'patterns' | 'webhooks';

export interface FeatureLimitCheck {
  allowed: boolean;
  limit: number;  // -1 = unlimited
  current: number;
  message?: string;
}

/**
 * Check if user can create another feature (API key, pattern, or webhook)
 * based on their plan limits
 *
 * CRITICAL: This prevents users from bypassing rate limits by creating unlimited API keys
 *
 * @param userId - User ID
 * @param feature - Feature type to check
 * @param currentCount - Current count of this feature for the user
 * @returns Check result with allowed boolean and optional message
 */
export async function checkFeatureLimit(
  userId: string,
  feature: FeatureLimitType,
  currentCount: number
): Promise<FeatureLimitCheck> {
  try {
    const userPlan = await getUserPlan(userId);
    const plan = userPlan.plan;

    let limit: number;
    let featureName: string;

    switch (feature) {
      case 'api_keys':
        limit = plan.max_api_keys;
        featureName = 'API keys';
        break;
      case 'patterns':
        limit = plan.max_patterns;
        featureName = 'patterns';
        break;
      case 'webhooks':
        limit = plan.max_webhooks;
        featureName = 'webhooks';
        break;
    }

    // -1 means unlimited
    if (limit === -1) {
      return {
        allowed: true,
        limit: -1,
        current: currentCount,
      };
    }

    const allowed = currentCount < limit;
    const message = allowed
      ? undefined
      : `You've reached your plan limit of ${limit} ${featureName}. Please upgrade to create more.`;

    return {
      allowed,
      limit,
      current: currentCount,
      message,
    };
  } catch (error) {
    logger.error("Exception checking feature limit", {
      user_id: userId,
      feature,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Check fair-use limits for a job
 * Returns warning message if limits exceeded, null otherwise
 *
 * @param userId - User ID
 * @param imageSizeBytes - Image file size in bytes
 * @param tokensUsed - Total tokens used (input + output)
 * @returns Warning message or null
 */
export async function checkFairUseLimits(
  userId: string,
  imageSizeBytes: number,
  tokensUsed: number
): Promise<string | null> {
  try {
    const userPlan = await getUserPlan(userId);
    const plan = userPlan.plan;

    const imageSizeMB = imageSizeBytes / (1024 * 1024);
    const maxImageSizeMB = plan.max_image_size_mb;
    const maxTokens = plan.max_characters_per_request;

    // Check image size
    if (imageSizeMB > maxImageSizeMB) {
      return `Image size (${imageSizeMB.toFixed(1)}MB) exceeds your plan limit of ${maxImageSizeMB}MB. Please use a smaller image or upgrade your plan.`;
    }

    // Check token usage
    if (tokensUsed > maxTokens) {
      return `Token usage (${tokensUsed.toLocaleString()}) exceeds your plan limit of ${maxTokens.toLocaleString()}. Consider simplifying your pattern or upgrading your plan.`;
    }

    return null;  // Within limits
  } catch (error) {
    logger.error("Exception checking fair-use limits", {
      user_id: userId,
      error: error instanceof Error ? error.message : String(error),
    });
    // Don't throw - fair-use checks are soft limits
    return null;
  }
}

/**
 * Format price for display
 *
 * @param cents - Price in cents
 * @returns Formatted price string (e.g., "$29")
 */
export function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(0)}`;
}

/**
 * Calculate savings for yearly plan
 *
 * @param monthlyPriceCents - Monthly price in cents
 * @param yearlyPriceCents - Yearly price in cents
 * @returns Savings amount in cents and percentage
 */
export function calculateYearlySavings(
  monthlyPriceCents: number,
  yearlyPriceCents: number
): { savingsCents: number; savingsPercent: number } {
  const yearlyEquivalent = monthlyPriceCents * 12;
  const savingsCents = yearlyEquivalent - yearlyPriceCents;
  const savingsPercent = (savingsCents / yearlyEquivalent) * 100;

  return {
    savingsCents,
    savingsPercent: Math.round(savingsPercent),
  };
}
