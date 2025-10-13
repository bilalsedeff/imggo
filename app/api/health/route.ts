/**
 * Health Check API Route
 * GET /api/health - System health status
 */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import { getQueueMetrics } from "@/queues/pgmq";

interface HealthResponse {
  status: "healthy" | "degraded" | "unhealthy";
  timestamp: string;
  version: string;
  services: {
    database: {
      status: "up" | "down";
      latency_ms?: number;
    };
    queue: {
      status: "up" | "down";
      length?: number;
    };
    storage: {
      status: "up" | "down";
    };
  };
  uptime_seconds: number;
}

const startTime = Date.now();

/**
 * Public health check endpoint (no auth required)
 * Used by uptime monitoring services
 */
export async function GET() {
  const checks: HealthResponse["services"] = {
    database: { status: "down" },
    queue: { status: "down" },
    storage: { status: "down" },
  };

  // Check 1: Database connectivity
  const dbStart = Date.now();
  try {
    const { error } = await supabaseServer
      .from("profiles")
      .select("id")
      .limit(1);

    if (!error) {
      checks.database.status = "up";
      checks.database.latency_ms = Date.now() - dbStart;
    }
  } catch (error) {
    checks.database.status = "down";
  }

  // Check 2: Queue health
  try {
    const queueMetrics = await getQueueMetrics();
    if (queueMetrics) {
      checks.queue.status = "up";
      checks.queue.length = queueMetrics.queue_length;
    }
  } catch (error) {
    checks.queue.status = "down";
  }

  // Check 3: Storage connectivity
  try {
    const { data: buckets, error } = await supabaseServer.storage.listBuckets();
    if (!error && buckets) {
      checks.storage.status = "up";
    }
  } catch (error) {
    checks.storage.status = "down";
  }

  // Determine overall status
  const allServicesUp = Object.values(checks).every(
    (service) => service.status === "up"
  );
  const someServicesDown = Object.values(checks).some(
    (service) => service.status === "down"
  );

  let overallStatus: HealthResponse["status"];
  if (allServicesUp) {
    overallStatus = "healthy";
  } else if (someServicesDown && !allServicesUp) {
    overallStatus = checks.database.status === "down" ? "unhealthy" : "degraded";
  } else {
    overallStatus = "unhealthy";
  }

  const response: HealthResponse = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || "1.0.0",
    services: checks,
    uptime_seconds: Math.floor((Date.now() - startTime) / 1000),
  };

  // Return appropriate HTTP status code
  const httpStatus = overallStatus === "healthy" ? 200 : overallStatus === "degraded" ? 200 : 503;

  return NextResponse.json(response, {
    status: httpStatus,
    headers: {
      "Cache-Control": "no-cache, no-store, must-revalidate",
      "Pragma": "no-cache",
      "Expires": "0",
    },
  });
}
