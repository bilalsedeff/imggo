/**
 * Jobs API Routes
 * GET /api/jobs - List user's jobs
 */

import { NextRequest } from "next/server";
import {
  withErrorHandling,
  requireAuth,
  parseQuery,
  successResponse,
} from "@/lib/api-helpers";
import { supabaseServer } from "@/lib/supabase-server";
import { logger } from "@/lib/logger";
import { z } from "zod";

const ListJobsQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  per_page: z.coerce.number().int().positive().max(100).optional().default(15),
  pattern_id: z.string().uuid().optional(),
  status: z.enum(["queued", "running", "succeeded", "failed"]).optional(),
});

export const GET = withErrorHandling(async (request: NextRequest) => {
  const user = await requireAuth(request);
  const query = parseQuery(request, ListJobsQuerySchema);

  logger.info("Listing jobs via API", {
    user_id: user.userId,
  });

  const { page, per_page, pattern_id, status } = query;
  const offset = (page - 1) * per_page;

  // Build query with pattern ownership check
  let jobsQuery = supabaseServer
    .from("jobs")
    .select(
      `
      *,
      patterns!inner(id, name, user_id, format)
    `,
      { count: "exact" }
    )
    .eq("patterns.user_id", user.userId)
    .order("created_at", { ascending: false });

  if (pattern_id) {
    jobsQuery = jobsQuery.eq("pattern_id", pattern_id);
  }

  if (status) {
    jobsQuery = jobsQuery.eq("status", status);
  }

  const { data, error, count } = await jobsQuery.range(
    offset,
    offset + per_page - 1
  );

  if (error) {
    logger.error("Failed to list jobs", error, { user_id: user.userId });
    throw error;
  }

  return successResponse({
    data: data || [],
    pagination: {
      page,
      per_page,
      total: count || 0,
      total_pages: Math.ceil((count || 0) / per_page),
    },
  });
});
