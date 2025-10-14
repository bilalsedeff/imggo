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

  // Get success rate (all time)
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

  // Get success rate (last 24h)
  const last24hStart = new Date();
  last24hStart.setHours(last24hStart.getHours() - 24);

  const { count: totalJobs24h } = await supabaseServer
    .from("jobs")
    .select("id", { count: "exact", head: true })
    .eq("requested_by", user.userId)
    .gte("created_at", last24hStart.toISOString());

  const { count: successfulJobs24h } = await supabaseServer
    .from("jobs")
    .select("id", { count: "exact", head: true })
    .eq("requested_by", user.userId)
    .eq("status", "succeeded")
    .gte("created_at", last24hStart.toISOString());

  const successRate24h =
    totalJobs24h && totalJobs24h > 0
      ? Math.round((successfulJobs24h! / totalJobs24h) * 100)
      : 0;

  return successResponse({
    total_patterns: totalPatterns || 0,
    active_patterns: activePatterns || 0,
    jobs_today: jobsToday || 0,
    success_rate: successRate,
    total_jobs: totalJobs || 0,
    success_rate_24h: successRate24h,
    total_jobs_24h: totalJobs24h || 0,
    successful_jobs_24h: successfulJobs24h || 0,
  });
});
