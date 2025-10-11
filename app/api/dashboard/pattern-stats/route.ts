/**
 * Dashboard Pattern Stats API
 * GET /api/dashboard/pattern-stats - Get job statistics per pattern
 */

import { NextRequest } from "next/server";
import {
  requireAuth,
  successResponse,
  withErrorHandling,
} from "@/lib/api-helpers";
import { supabaseServer } from "@/lib/supabase-server";

export const GET = withErrorHandling(async (request: NextRequest) => {
  const user = await requireAuth(request);

  // Get pattern-based job stats for last 24 hours
  // Group by pattern, calculate success rate and job counts
  const { data: patternStats, error } = await supabaseServer.rpc(
    "get_pattern_job_stats",
    {
      p_user_id: user.userId,
    }
  );

  if (error) {
    throw error;
  }

  return successResponse({ stats: patternStats || [] });
});
