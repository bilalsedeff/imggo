/**
 * User Profile API Routes
 * GET /api/user/profile - Get user profile
 * PATCH /api/user/profile - Update user profile
 */

import { NextRequest } from "next/server";
import {
  withErrorHandling,
  requireAuth,
  parseBody,
  successResponse,
  ApiError,
} from "@/lib/api-helpers";
import { supabaseServer } from "@/lib/supabase-server";
import { z } from "zod";
import { logger } from "@/lib/logger";

const UpdateProfileSchema = z.object({
  full_name: z.string().min(1).max(255).optional(),
  avatar_url: z.string().url().optional().nullable(),
});

export const GET = withErrorHandling(async (request: NextRequest) => {
  const user = await requireAuth(request);

  logger.info("Getting user profile via API", {
    user_id: user.userId,
  });

  // Get profile from profiles table
  const { data: profile, error } = await supabaseServer
    .from("profiles")
    .select("*")
    .eq("id", user.userId)
    .single();

  if (error || !profile) {
    throw new ApiError("Profile not found", 404, "NOT_FOUND");
  }

  const profileData = profile as {
    id: string;
    email: string;
    full_name?: string;
    avatar_url?: string;
    created_at: string;
    updated_at: string;
  };

  return successResponse({
    id: profileData.id,
    email: profileData.email || user.email,
    full_name: profileData.full_name,
    avatar_url: profileData.avatar_url,
    created_at: profileData.created_at,
    updated_at: profileData.updated_at,
  });
});

export const PATCH = withErrorHandling(async (request: NextRequest) => {
  const user = await requireAuth(request);
  const input = await parseBody(request, UpdateProfileSchema);

  logger.info("Updating user profile via API", {
    user_id: user.userId,
    fields: Object.keys(input),
  });

  // Update profile in profiles table
  const { data: updatedProfile, error } = await supabaseServer
    .from("profiles")
    .update({
      full_name: input.full_name,
      avatar_url: input.avatar_url,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.userId)
    .select()
    .single();

  if (error) {
    logger.error("Failed to update profile", error, { user_id: user.userId });
    throw new ApiError("Failed to update profile", 500, "UPDATE_FAILED");
  }

  const profileData = updatedProfile as {
    id: string;
    email: string;
    full_name?: string;
    avatar_url?: string;
    created_at: string;
    updated_at: string;
  };

  return successResponse({
    id: profileData.id,
    email: profileData.email || user.email,
    full_name: profileData.full_name,
    avatar_url: profileData.avatar_url,
    created_at: profileData.created_at,
    updated_at: profileData.updated_at,
  });
});
