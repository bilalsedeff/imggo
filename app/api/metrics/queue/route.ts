/**
 * Queue Metrics API Route
 * GET /api/metrics/queue - Get queue health metrics
 */

import { NextRequest } from "next/server";
import {
  withErrorHandling,
  requireAuth,
  successResponse,
} from "@/lib/api-helpers";
import { getQueueMetrics } from "@/queues/pgmq";
import { supabaseServer } from "@/lib/supabase-server";
import { logger } from "@/lib/logger";

interface QueueHealthMetrics {
  queue: {
    name: string;
    length: number;
    oldest_msg_age_sec: number | null;
    newest_msg_age_sec: number | null;
    total_messages: number;
  };
  jobs: {
    queued: number;
    running: number;
    succeeded: number;
    failed: number;
    total: number;
  };
  health: {
    status: "healthy" | "warning" | "critical";
    message: string;
    checks: {
      name: string;
      status: "pass" | "warn" | "fail";
      message: string;
    }[];
  };
  timestamp: string;
}

/**
 * Calculate queue health status based on metrics
 */
function calculateHealth(
  queueMetrics: {
    queue_length: number;
    oldest_msg_age_sec: number | null;
    newest_msg_age_sec: number | null;
    total_messages: number;
  },
  jobCounts: {
    queued: number;
    running: number;
    succeeded: number;
    failed: number;
  }
): QueueHealthMetrics["health"] {
  const checks: QueueHealthMetrics["health"]["checks"] = [];

  // Check 1: Queue backlog
  if (queueMetrics.queue_length === 0) {
    checks.push({
      name: "queue_backlog",
      status: "pass",
      message: "No jobs in queue",
    });
  } else if (queueMetrics.queue_length < 100) {
    checks.push({
      name: "queue_backlog",
      status: "pass",
      message: `${queueMetrics.queue_length} jobs in queue (healthy)`,
    });
  } else if (queueMetrics.queue_length < 500) {
    checks.push({
      name: "queue_backlog",
      status: "warn",
      message: `${queueMetrics.queue_length} jobs in queue (elevated)`,
    });
  } else {
    checks.push({
      name: "queue_backlog",
      status: "fail",
      message: `${queueMetrics.queue_length} jobs in queue (critical backlog)`,
    });
  }

  // Check 2: Oldest message age
  if (
    queueMetrics.oldest_msg_age_sec === null ||
    queueMetrics.oldest_msg_age_sec < 300
  ) {
    checks.push({
      name: "message_age",
      status: "pass",
      message: "Messages being processed promptly",
    });
  } else if (queueMetrics.oldest_msg_age_sec < 600) {
    checks.push({
      name: "message_age",
      status: "warn",
      message: `Oldest message is ${Math.floor(queueMetrics.oldest_msg_age_sec / 60)} minutes old`,
    });
  } else {
    checks.push({
      name: "message_age",
      status: "fail",
      message: `Oldest message is ${Math.floor(queueMetrics.oldest_msg_age_sec / 60)} minutes old (stale)`,
    });
  }

  // Check 3: Failure rate (last hour)
  const totalProcessed = jobCounts.succeeded + jobCounts.failed;
  const failureRate = totalProcessed > 0 ? jobCounts.failed / totalProcessed : 0;

  if (failureRate === 0 || totalProcessed === 0) {
    checks.push({
      name: "failure_rate",
      status: "pass",
      message: "No recent failures",
    });
  } else if (failureRate < 0.05) {
    checks.push({
      name: "failure_rate",
      status: "pass",
      message: `${(failureRate * 100).toFixed(1)}% failure rate (normal)`,
    });
  } else if (failureRate < 0.2) {
    checks.push({
      name: "failure_rate",
      status: "warn",
      message: `${(failureRate * 100).toFixed(1)}% failure rate (elevated)`,
    });
  } else {
    checks.push({
      name: "failure_rate",
      status: "fail",
      message: `${(failureRate * 100).toFixed(1)}% failure rate (critical)`,
    });
  }

  // Check 4: Running jobs
  if (jobCounts.running === 0 && queueMetrics.queue_length > 0) {
    checks.push({
      name: "worker_activity",
      status: "warn",
      message: "Jobs in queue but none running (worker may be idle)",
    });
  } else if (jobCounts.running > 0) {
    checks.push({
      name: "worker_activity",
      status: "pass",
      message: `${jobCounts.running} jobs currently processing`,
    });
  } else {
    checks.push({
      name: "worker_activity",
      status: "pass",
      message: "No jobs to process",
    });
  }

  // Determine overall status
  const hasFailure = checks.some((c) => c.status === "fail");
  const hasWarning = checks.some((c) => c.status === "warn");

  let overallStatus: "healthy" | "warning" | "critical";
  let overallMessage: string;

  if (hasFailure) {
    overallStatus = "critical";
    overallMessage = "Queue requires immediate attention";
  } else if (hasWarning) {
    overallStatus = "warning";
    overallMessage = "Queue health degraded, monitor closely";
  } else {
    overallStatus = "healthy";
    overallMessage = "All systems operational";
  }

  return {
    status: overallStatus,
    message: overallMessage,
    checks,
  };
}

export const GET = withErrorHandling(async (request: NextRequest) => {
  const user = await requireAuth(request);

  logger.info("Fetching queue metrics", {
    user_id: user.userId,
  });

  // Get PGMQ metrics
  const queueMetrics = await getQueueMetrics();

  if (!queueMetrics) {
    logger.error("Failed to get queue metrics");
    throw new Error("Failed to retrieve queue metrics");
  }

  // Get job counts for this user (last hour)
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  const { data: jobCounts, error: jobCountError } = await supabaseServer
    .rpc("get_user_job_counts", {
      p_user_id: user.userId,
      p_since: oneHourAgo,
    })
    .single();

  if (jobCountError) {
    logger.error("Failed to get job counts", jobCountError);
    // Continue with partial data
  }

  const counts = jobCounts || {
    queued: 0,
    running: 0,
    succeeded: 0,
    failed: 0,
    total: 0,
  };

  // Calculate health status
  const health = calculateHealth(queueMetrics, counts);

  const metrics: QueueHealthMetrics = {
    queue: {
      name: process.env.SUPABASE_PGMQ_QUEUE || "ingest_jobs",
      length: queueMetrics.queue_length,
      oldest_msg_age_sec: queueMetrics.oldest_msg_age_sec,
      newest_msg_age_sec: queueMetrics.newest_msg_age_sec,
      total_messages: queueMetrics.total_messages,
    },
    jobs: counts,
    health,
    timestamp: new Date().toISOString(),
  };

  return successResponse(metrics);
});
