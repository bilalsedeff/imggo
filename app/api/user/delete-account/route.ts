/**
 * Delete Account API Route
 * POST /api/user/delete-account - Permanently delete user account
 */

import { NextRequest } from "next/server";
import {
  withErrorHandling,
  requireAuth,
  successResponse,
  ApiError,
} from "@/lib/api-helpers";
import { supabaseServer } from "@/lib/supabase-server";
import { logger } from "@/lib/logger";

export const POST = withErrorHandling(async (request: NextRequest) => {
  const user = await requireAuth(request);

  logger.warn("User requesting account deletion", {
    user_id: user.userId,
    email: user.email,
  });

  // Delete user's data in cascade order:
  // 1. Jobs (will cascade delete job_results)
  // 2. Patterns (will cascade delete pattern_versions)
  // 3. API keys
  // 4. Webhooks
  // 5. User plan
  // 6. Profile
  // 7. Auth user (from Supabase Auth)

  try {
    // Get user's pattern IDs first
    const { data: patterns } = await supabaseServer
      .from("patterns")
      .select("id")
      .eq("user_id", user.userId);

    const patternIds = patterns?.map((p) => p.id) || [];

    // Delete jobs (if user has patterns)
    if (patternIds.length > 0) {
      const { error: jobsError } = await supabaseServer
        .from("jobs")
        .delete()
        .in("pattern_id", patternIds);

      if (jobsError) {
        logger.error("Failed to delete jobs", jobsError, { user_id: user.userId });
        throw new ApiError("Failed to delete account data", 500);
      }
    }

    // Delete patterns (cascades to pattern_versions)
    const { error: patternsError } = await supabaseServer
      .from("patterns")
      .delete()
      .eq("user_id", user.userId);

    if (patternsError) {
      logger.error("Failed to delete patterns", patternsError, { user_id: user.userId });
      throw new ApiError("Failed to delete account data", 500);
    }

    // Delete API keys
    const { error: apiKeysError } = await supabaseServer
      .from("api_keys")
      .delete()
      .eq("user_id", user.userId);

    if (apiKeysError) {
      logger.error("Failed to delete API keys", apiKeysError, { user_id: user.userId });
      throw new ApiError("Failed to delete account data", 500);
    }

    // Delete webhooks
    const { error: webhooksError } = await supabaseServer
      .from("webhooks")
      .delete()
      .eq("user_id", user.userId);

    if (webhooksError) {
      logger.error("Failed to delete webhooks", webhooksError, { user_id: user.userId });
      throw new ApiError("Failed to delete account data", 500);
    }

    // Delete user plan
    const { error: userPlanError } = await supabaseServer
      .from("user_plans")
      .delete()
      .eq("user_id", user.userId);

    if (userPlanError) {
      logger.error("Failed to delete user plan", userPlanError, { user_id: user.userId });
      throw new ApiError("Failed to delete account data", 500);
    }

    // Delete profile
    const { error: profileError } = await supabaseServer
      .from("profiles")
      .delete()
      .eq("id", user.userId);

    if (profileError) {
      logger.error("Failed to delete profile", profileError, { user_id: user.userId });
      throw new ApiError("Failed to delete account data", 500);
    }

    // Delete auth user (from Supabase Auth)
    const { error: authError } = await supabaseServer.auth.admin.deleteUser(
      user.userId
    );

    if (authError) {
      logger.error("Failed to delete auth user", authError, { user_id: user.userId });
      throw new ApiError("Failed to delete account", 500);
    }

    logger.info("User account successfully deleted", {
      user_id: user.userId,
      email: user.email,
    });

    return successResponse({
      message: "Account successfully deleted",
    });
  } catch (error) {
    logger.error("Account deletion failed", error instanceof Error ? error : new Error(String(error)), {
      user_id: user.userId,
    });

    if (error instanceof ApiError) {
      throw error;
    }

    throw new ApiError("Failed to delete account", 500);
  }
});
