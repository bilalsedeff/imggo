/**
 * Pattern Name Availability Check API Route
 * GET /api/patterns/check-name?name=pattern-name
 */

import { NextRequest } from "next/server";
import {
  withErrorHandling,
  requireAuth,
  successResponse,
  ApiError,
} from "@/lib/api-helpers";
import { supabaseServer } from "@/lib/supabase-server";

export const GET = withErrorHandling(async (request: NextRequest) => {
  const user = await requireAuth(request);

  const { searchParams } = new URL(request.url);
  const name = searchParams.get("name");

  if (!name || !name.trim()) {
    throw new ApiError("Pattern name is required", 400);
  }

  // Check if pattern name exists for this user
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existingPattern, error } = await (supabaseServer.from("patterns") as any)
    .select("id, name")
    .eq("user_id", user.userId)
    .eq("name", name.trim())
    .maybeSingle();

  if (error && error.code !== "PGRST116") {
    // PGRST116 is "not found" which is fine
    console.error("Check name error:", error);
    throw new ApiError("Failed to check pattern name", 500);
  }

  const available = !existingPattern;

  console.log("Name check:", {
    name: name.trim(),
    userId: user.userId,
    existingPattern,
    available
  });

  return successResponse({
    available,
    name: name.trim(),
  });
});
