/**
 * GET /api/demo/status/:job_id
 * Get demo job status and result
 * Public endpoint (no authentication required)
 */

import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import { logger } from "@/lib/logger";

interface RouteParams {
  params: {
    job_id: string;
  };
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { job_id } = params;

    if (!job_id) {
      return NextResponse.json(
        { error: "Missing job_id" },
        { status: 400 }
      );
    }

    // Fetch job with pattern details
    const { data: job, error } = await supabaseServer
      .from("jobs")
      .select(`
        id,
        status,
        manifest,
        error,
        latency_ms,
        created_at,
        updated_at,
        pattern_id,
        patterns!inner(
          id,
          name,
          format
        )
      `)
      .eq("id", job_id)
      .single();

    if (error || !job) {
      logger.error("Demo job not found", {
        job_id,
        error: error?.message,
      });
      return NextResponse.json(
        { error: "Job not found" },
        { status: 404 }
      );
    }

    // Format response based on status
    const response: Record<string, unknown> = {
      job_id: job.id,
      status: job.status,
      pattern: {
        id: (job.patterns as { id: string; name: string; format: string }).id,
        name: (job.patterns as { id: string; name: string; format: string }).name,
        format: (job.patterns as { id: string; name: string; format: string }).format,
      },
      created_at: job.created_at,
      updated_at: job.updated_at,
    };

    if (job.status === "succeeded") {
      // Return manifest in appropriate format
      const format = (job.patterns as { format: string }).format;

      if (format === "json") {
        response.manifest = job.manifest;
      } else {
        // For other formats, manifest is stored as a string
        response.manifest = job.manifest;
      }

      response.latency_ms = job.latency_ms;
    }

    if (job.status === "failed") {
      response.error = job.error;
    }

    return NextResponse.json(response);
  } catch (error) {
    logger.error("Failed to fetch demo job status", {
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      {
        error: "Failed to fetch status",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
