/**
 * Pattern Metrics API Route
 * GET /api/patterns/:id/metrics - Get detailed metrics for a pattern
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

interface PatternMetrics {
  pattern_id: string;
  pattern_name: string;
  jobs: {
    total: number;
    queued: number;
    running: number;
    succeeded: number;
    failed: number;
    success_rate: number | null;
  };
  performance: {
    avg_latency_ms: number | null;
    p50_latency_ms: number | null;
    p95_latency_ms: number | null;
    p99_latency_ms: number | null;
    total_processing_time_ms: number | null;
  };
  timeline: {
    last_job_at: string | null;
    last_success_at: string | null;
    last_failure_at: string | null;
  };
  recent_errors?: {
    error_message: string;
    count: number;
    last_occurrence: string;
  }[];
  timestamp: string;
}

export const GET = withErrorHandling(
  async (
    request: NextRequest,
    context?: { params: Promise<Record<string, string>> }
  ) => {
    if (!context) throw new ApiError("Missing params", 400);
    const user = await requireAuth(request);
    const { id: patternId } = await context.params;
    if (!patternId) throw new ApiError("Missing pattern ID", 400);

    logger.info("Fetching pattern metrics", {
      pattern_id: patternId,
      user_id: user.userId,
    });

    // Verify pattern ownership
    const { data: pattern, error: patternError } = await supabaseServer
      .from("patterns")
      .select("id, name")
      .eq("id", patternId)
      .eq("user_id", user.userId)
      .single();

    if (patternError || !pattern) {
      throw new ApiError("Pattern not found", 404, "NOT_FOUND");
    }

    // Get detailed stats
    const { data: stats, error: statsError } = await supabaseServer
      .rpc("get_pattern_job_stats_detailed", {
        p_pattern_id: patternId,
      })
      .single();

    if (statsError) {
      logger.error("Failed to get pattern stats", statsError, {
        pattern_id: patternId,
      });
      throw new ApiError("Failed to retrieve pattern statistics", 500);
    }

    // Get recent errors (last 24 hours)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: errors } = await supabaseServer
      .rpc("get_job_error_summary", {
        p_user_id: user.userId,
        p_since: oneDayAgo,
        p_limit: 10,
      });

    // Filter errors for this pattern
    const patternErrors = errors?.filter((err: { pattern_names: string[] }) =>
      err.pattern_names?.includes(pattern.name)
    ) || [];

    const recentErrors = patternErrors.map((err: {
      error_message: string;
      error_count: number;
      last_occurrence: string;
    }) => ({
      error_message: err.error_message,
      count: Number(err.error_count),
      last_occurrence: err.last_occurrence,
    }));

    const metrics: PatternMetrics = {
      pattern_id: pattern.id,
      pattern_name: pattern.name,
      jobs: {
        total: Number(stats.total_jobs) || 0,
        queued: Number(stats.queued) || 0,
        running: Number(stats.running) || 0,
        succeeded: Number(stats.succeeded) || 0,
        failed: Number(stats.failed) || 0,
        success_rate: stats.success_rate
          ? Number(stats.success_rate.toFixed(2))
          : null,
      },
      performance: {
        avg_latency_ms: stats.avg_latency_ms
          ? Number(stats.avg_latency_ms.toFixed(0))
          : null,
        p50_latency_ms: null, // Not calculated in current function
        p95_latency_ms: stats.p95_latency_ms
          ? Number(stats.p95_latency_ms.toFixed(0))
          : null,
        p99_latency_ms: stats.p99_latency_ms
          ? Number(stats.p99_latency_ms.toFixed(0))
          : null,
        total_processing_time_ms: stats.total_processing_time_ms
          ? Number(stats.total_processing_time_ms)
          : null,
      },
      timeline: {
        last_job_at: stats.last_job_at || null,
        last_success_at: stats.last_success_at || null,
        last_failure_at: stats.last_failure_at || null,
      },
      recent_errors: recentErrors.length > 0 ? recentErrors : undefined,
      timestamp: new Date().toISOString(),
    };

    return successResponse(metrics);
  }
);
