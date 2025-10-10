/**
 * Dashboard Metrics API Route
 * GET /api/dashboard/metrics - Get dashboard statistics
 */

import { NextRequest } from "next/server";
import {
  withErrorHandling,
  requireAuth,
  successResponse,
} from "@/lib/api-helpers";
import { supabaseServer } from "@/lib/supabase-server";
import { logger } from "@/lib/logger";

export const GET = withErrorHandling(async (request: NextRequest) => {
  const user = await requireAuth(request);

  logger.info("Fetching dashboard metrics", { user_id: user.userId });

  // Get total patterns count
  const { count: totalPatterns } = await supabaseServer
    .from("patterns")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.userId);

  // Get active patterns count
  const { count: activePatterns } = await supabaseServer
    .from("patterns")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.userId)
    .eq("is_active", true);

  // Get today's jobs count
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const { count: jobsToday } = await supabaseServer
    .from("jobs")
    .select("id", { count: "exact", head: true })
    .eq("requested_by", user.userId)
    .gte("created_at", todayStart.toISOString());

  // Get success rate (jobs with status 'succeeded' vs total jobs)
  const { count: totalJobs } = await supabaseServer
    .from("jobs")
    .select("id", { count: "exact", head: true })
    .eq("requested_by", user.userId);

  const { count: successfulJobs } = await supabaseServer
    .from("jobs")
    .select("id", { count: "exact", head: true })
    .eq("requested_by", user.userId)
    .eq("status", "succeeded");

  const successRate =
    totalJobs && totalJobs > 0
      ? Math.round((successfulJobs! / totalJobs) * 100)
      : 0;

  return successResponse({
    total_patterns: totalPatterns || 0,
    active_patterns: activePatterns || 0,
    jobs_today: jobsToday || 0,
    success_rate: successRate,
    total_jobs: totalJobs || 0,
  });
});
