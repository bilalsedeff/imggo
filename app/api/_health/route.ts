/**
 * Health Check API Route
 * GET /api/_health - System health status
 */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import { getQueueMetrics } from "@/queues/pgmq";
import { logger } from "@/lib/logger";

export async function GET() {
  const timestamp = new Date().toISOString();

  try {
    // Check database
    const dbStatus = await checkDatabase();

    // Check storage
    const storageStatus = await checkStorage();

    // Check queue
    const queueStatus = await checkQueue();

    const allHealthy =
      dbStatus === "up" && storageStatus === "up" && queueStatus === "up";

    const status = allHealthy ? "healthy" : "degraded";

    return NextResponse.json(
      {
        status,
        timestamp,
        services: {
          database: dbStatus,
          storage: storageStatus,
          queue: queueStatus,
        },
      },
      { status: allHealthy ? 200 : 503 }
    );
  } catch (error) {
    logger.error("Health check failed", error);

    return NextResponse.json(
      {
        status: "unhealthy",
        timestamp,
        services: {
          database: "down",
          storage: "down",
          queue: "down",
        },
      },
      { status: 503 }
    );
  }
}

async function checkDatabase(): Promise<"up" | "down"> {
  try {
    const { error } = await supabaseServer
      .from("profiles")
      .select("id")
      .limit(1);

    return error ? "down" : "up";
  } catch {
    return "down";
  }
}

async function checkStorage(): Promise<"up" | "down"> {
  try {
    const BUCKET = process.env.SUPABASE_STORAGE_BUCKET || "images";
    const { error } = await supabaseServer.storage.from(BUCKET).list("", {
      limit: 1,
    });

    return error ? "down" : "up";
  } catch {
    return "down";
  }
}

async function checkQueue(): Promise<"up" | "down"> {
  try {
    const metrics = await getQueueMetrics();
    return metrics ? "up" : "down";
  } catch {
    return "down";
  }
}
