/**
 * Logs API
 * GET /api/logs - Get all jobs with filtering (time_range, pattern_id, status)
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import {
  requireAuth,
  parseQuery,
  successResponse,
  withErrorHandling,
} from "@/lib/api-helpers";
import { supabaseServer } from "@/lib/supabase-server";

const LogsQuerySchema = z.object({
  time_range: z.enum(["1m", "15m", "1h", "6h", "12h", "24h", "all"]).default("24h"),
  pattern_id: z.string().uuid().optional(),
  status: z.enum(["queued", "running", "succeeded", "failed"]).optional(),
  page: z.coerce.number().int().positive().default(1),
  per_page: z.coerce.number().int().min(1).max(100).default(50),
});

// Time range to milliseconds mapping
const TIME_RANGE_MS: Record<string, number> = {
  "1m": 1 * 60 * 1000,
  "15m": 15 * 60 * 1000,
  "1h": 60 * 60 * 1000,
  "6h": 6 * 60 * 60 * 1000,
  "12h": 12 * 60 * 60 * 1000,
  "24h": 24 * 60 * 60 * 1000,
  "all": 100 * 365 * 24 * 60 * 60 * 1000, // Effectively all records
};

export const GET = withErrorHandling(async (request: NextRequest) => {
  const user = await requireAuth(request);
  const query = parseQuery(request, LogsQuerySchema);

  // Calculate offset for pagination (page and per_page have defaults, guaranteed to be numbers)
  const page = query.page ?? 1;
  const perPage = query.per_page ?? 50;
  const timeRange = query.time_range ?? "24h";
  const offset = (page - 1) * perPage;

  // Build base query
  let queryBuilder = supabaseServer
    .from("jobs")
    .select(
      `
      id,
      pattern_id,
      image_url,
      status,
      manifest,
      error,
      latency_ms,
      created_at,
      started_at,
      completed_at,
      patterns!inner (
        id,
        name,
        format,
        user_id
      )
    `,
      { count: "exact" }
    )
    .eq("patterns.user_id", user.userId);

  // Apply time range filter
  if (timeRange !== "all") {
    const msAgo = TIME_RANGE_MS[timeRange];
    const timestamp = new Date(Date.now() - msAgo).toISOString();
    queryBuilder = queryBuilder.gte("created_at", timestamp);
  }

  // Apply pattern filter
  if (query.pattern_id) {
    queryBuilder = queryBuilder.eq("pattern_id", query.pattern_id);
  }

  // Apply status filter
  if (query.status) {
    queryBuilder = queryBuilder.eq("status", query.status);
  }

  // Order by most recent first
  queryBuilder = queryBuilder
    .order("created_at", { ascending: false })
    .range(offset, offset + perPage - 1);

  const { data: jobs, error, count } = await queryBuilder;

  if (error) {
    throw error;
  }

  return successResponse({
    data: jobs || [],
    pagination: {
      page,
      per_page: perPage,
      total: count || 0,
      total_pages: Math.ceil((count || 0) / perPage),
    },
  });
});
