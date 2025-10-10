/**
 * Job Service - Business logic for job management
 */

import { supabaseServer } from "@/lib/supabase-server";
import { Database } from "@/lib/database.types";
import { insertRow, updateRow } from "@/lib/supabase-helpers";
import { logger } from "@/lib/logger";
import { Job, JobStatus } from "@/schemas/manifest";
import { enqueueJob, QueueJobPayload } from "@/queues/pgmq";

/**
 * Create and enqueue a new job
 */
export async function createJob(params: {
  patternId: string;
  imageUrl: string;
  userId: string;
  idempotencyKey?: string;
  extras?: Record<string, unknown>;
}): Promise<{ jobId: string; status: JobStatus }> {
  const { patternId, imageUrl, userId, idempotencyKey, extras } = params;

  try {
    logger.info("Creating job", {
      pattern_id: patternId,
      user_id: userId,
      idempotency_key: idempotencyKey,
    });

    // Create job record
    type JobInsert = Database["public"]["Tables"]["jobs"]["Insert"];

    const jobData: JobInsert = {
      pattern_id: patternId,
      image_url: imageUrl,
      status: "queued",
      requested_by: userId,
      idempotency_key: idempotencyKey || null,
      extras: extras ? (extras as any) : null,
    };

    const { data, error } = await insertRow(supabaseServer, "jobs", jobData);

    if (error) {
      logger.error("Failed to create job", error, {
        pattern_id: patternId,
        user_id: userId,
      });
      throw new Error(`Failed to create job: ${error.message}`);
    }

    if (!data) {
      throw new Error("No data returned from job creation");
    }

    const jobId = data.id;

    // Enqueue job for processing
    const queuePayload: QueueJobPayload = {
      job_id: jobId,
      pattern_id: patternId,
      image_url: imageUrl,
      extras,
    };

    const enqueueResult = await enqueueJob(queuePayload);

    if (!enqueueResult.success) {
      // Mark job as failed if enqueue fails
      type JobUpdate = Database["public"]["Tables"]["jobs"]["Update"];
      const updateData: JobUpdate = {
        status: "failed",
        error: `Failed to enqueue: ${enqueueResult.error}`,
      };

      await updateRow(supabaseServer, "jobs", updateData, {
        column: "id",
        value: jobId,
      });

      throw new Error(`Failed to enqueue job: ${enqueueResult.error}`);
    }

    logger.info("Job created and enqueued", {
      job_id: jobId,
      msg_id: enqueueResult.msg_id,
    });

    return {
      jobId,
      status: "queued" as JobStatus,
    };
  } catch (error) {
    logger.error("Exception creating job", error);
    throw error;
  }
}

/**
 * Get job by ID
 */
export async function getJob(
  jobId: string,
  userId: string
): Promise<Job | null> {
  try {
    // Verify user owns this job via pattern ownership
    const { data, error } = await supabaseServer
      .from("jobs")
      .select(
        `
        *,
        patterns!inner(user_id)
      `
      )
      .eq("id", jobId)
      .eq("patterns.user_id", userId)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return null;
      }
      throw error;
    }

    // Remove the join data
    const { patterns, ...job } = data as { patterns: { user_id: string }; [key: string]: unknown };
    return job as unknown as Job;
  } catch (error) {
    logger.error("Exception getting job", error, { job_id: jobId });
    throw error;
  }
}

/**
 * List user's jobs
 */
export async function listJobs(
  userId: string,
  options: {
    patternId?: string;
    status?: JobStatus;
    page?: number;
    perPage?: number;
  } = {}
): Promise<{ jobs: Job[]; total: number }> {
  try {
    const { patternId, status, page = 1, perPage = 50 } = options;
    const offset = (page - 1) * perPage;

    const { data, error } = await supabaseServer.rpc("get_my_jobs", {
      p_pattern_id: patternId || null,
      p_status: status || null,
      p_limit: perPage,
      p_offset: offset,
    });

    if (error) {
      logger.error("Failed to list jobs", error, { user_id: userId });
      throw error;
    }

    // Get total count (simplified, actual count would need separate query)
    const jobs = (data || []) as unknown as Job[];

    return {
      jobs,
      total: jobs.length, // Simplified
    };
  } catch (error) {
    logger.error("Exception listing jobs", error);
    throw error;
  }
}

/**
 * Update job status (used by worker)
 */
export async function updateJobStatus(
  jobId: string,
  status: JobStatus,
  updates: {
    manifest?: Record<string, unknown>;
    error?: string;
    latencyMs?: number;
  } = {}
): Promise<void> {
  try {
    const now = new Date().toISOString();

    const { error } = await supabaseServer
      .from("jobs")
      .update({
        status,
        ...(updates.manifest && { manifest: updates.manifest }),
        ...(updates.error && { error: updates.error }),
        ...(updates.latencyMs && { latency_ms: updates.latencyMs }),
        ...(status === "running" && { started_at: now }),
        ...(["succeeded", "failed"].includes(status) && { completed_at: now }),
      })
      .eq("id", jobId);

    if (error) {
      logger.error("Failed to update job status", error, {
        job_id: jobId,
        status,
      });
      throw error;
    }

    logger.info("Job status updated", { job_id: jobId, status });
  } catch (error) {
    logger.error("Exception updating job status", error);
    throw error;
  }
}
