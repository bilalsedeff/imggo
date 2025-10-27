/**
 * POST /api/demo/process
 * Demo endpoint for landing page - bypasses rate limiting
 * Uses privileged service role to enqueue jobs
 * Public endpoint (no authentication required)
 */

import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import { logger } from "@/lib/logger";
import { v4 as uuidv4 } from "uuid";

// Demo pattern IDs (read-only patterns for public demo)
const DEMO_PATTERN_IDS = [
  "00000000-0000-0000-0000-000000000001",
  "00000000-0000-0000-0000-000000000002",
  "00000000-0000-0000-0000-000000000003",
  "00000000-0000-0000-0000-000000000004",
  "00000000-0000-0000-0000-000000000005",
];

const QUEUE_NAME = process.env.SUPABASE_PGMQ_QUEUE || "ingest_jobs";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { pattern_id, image_url } = body;

    // Validate pattern_id is a demo pattern
    if (!pattern_id || !DEMO_PATTERN_IDS.includes(pattern_id)) {
      return NextResponse.json(
        {
          error: "Invalid pattern",
          message: "Please select a valid demo pattern",
        },
        { status: 400 }
      );
    }

    // Validate image_url
    if (!image_url || typeof image_url !== "string") {
      return NextResponse.json(
        {
          error: "Invalid image URL",
          message: "Please provide a valid image URL",
        },
        { status: 400 }
      );
    }

    // Verify pattern exists
    const { data: pattern, error: patternError } = await supabaseServer
      .from("patterns")
      .select("id, name, format, user_id")
      .eq("id", pattern_id)
      .eq("is_active", true)
      .single();

    if (patternError || !pattern) {
      logger.error("Demo pattern not found", {
        pattern_id,
        error: patternError?.message,
      });
      return NextResponse.json(
        {
          error: "Pattern not found",
          message: "The selected pattern is not available",
        },
        { status: 404 }
      );
    }

    // Create job record (no rate limiting for demo)
    const jobId = uuidv4();
    const idempotencyKey = `demo-${Date.now()}-${Math.random()}`;

    const { error: insertError } = await supabaseServer.from("jobs").insert({
      id: jobId,
      pattern_id: pattern_id,
      image_url: image_url,
      status: "queued",
      idempotency_key: idempotencyKey,
      requested_by: null, // Anonymous demo user
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    if (insertError) {
      logger.error("Failed to create demo job", {
        job_id: jobId,
        error: insertError.message,
      });
      return NextResponse.json(
        {
          error: "Failed to create job",
          message: insertError.message,
        },
        { status: 500 }
      );
    }

    // Enqueue to PGMQ
    const payload = {
      job_id: jobId,
      pattern_id: pattern_id,
      image_url: image_url,
      extras: {
        demo: true,
        timestamp: Date.now(),
      },
    };

    const { error: queueError } = await supabaseServer.rpc("pgmq_send", {
      queue_name: QUEUE_NAME,
      msg: payload,
    });

    if (queueError) {
      logger.error("Failed to enqueue demo job", {
        job_id: jobId,
        error: queueError.message,
      });

      // Update job status to failed
      await supabaseServer
        .from("jobs")
        .update({
          status: "failed",
          error: `Queue error: ${queueError.message}`,
          updated_at: new Date().toISOString(),
        })
        .eq("id", jobId);

      return NextResponse.json(
        {
          error: "Failed to enqueue job",
          message: queueError.message,
        },
        { status: 500 }
      );
    }

    logger.info("Demo job enqueued successfully", {
      job_id: jobId,
      pattern_id,
      pattern_name: pattern.name,
    });

    return NextResponse.json(
      {
        job_id: jobId,
        status: "queued",
        pattern: {
          id: pattern.id,
          name: pattern.name,
          format: pattern.format,
        },
      },
      { status: 202 }
    );
  } catch (error) {
    logger.error("Demo processing failed", {
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      {
        error: "Processing failed",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
