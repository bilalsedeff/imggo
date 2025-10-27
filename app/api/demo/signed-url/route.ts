/**
 * Demo Signed Upload URL API Route
 * POST /api/demo/signed-url - Create signed upload URL for demo (no auth required)
 */

import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import { logger } from "@/lib/logger";

const BUCKET = process.env.SUPABASE_STORAGE_BUCKET || "images";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { path } = body;

    if (!path || typeof path !== "string") {
      return NextResponse.json(
        {
          error: "Invalid path",
          message: "Please provide a valid path",
        },
        { status: 400 }
      );
    }

    // Create signed upload URL with 5 minute expiry
    const { data, error } = await supabaseServer.storage
      .from(BUCKET)
      .createSignedUploadUrl(path, {
        upsert: true,
      });

    if (error || !data) {
      logger.error("Failed to create demo signed upload URL", {
        error: error?.message,
        path,
      });
      return NextResponse.json(
        {
          error: "Failed to create upload URL",
          message: error?.message || "Unknown error",
        },
        { status: 500 }
      );
    }

    logger.info("Created demo signed upload URL", {
      path,
      expires_in_seconds: 300,
    });

    return NextResponse.json({
      url: data.signedUrl,
      token: data.token,
      path: data.path,
    });
  } catch (error) {
    logger.error("Demo signed URL creation failed", {
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      {
        error: "Failed to create upload URL",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
