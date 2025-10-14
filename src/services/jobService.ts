/**
 * Job Service - Business logic for job management
 */

import { supabaseServer } from "@/lib/supabase-server";
import { Database } from "@/lib/database.types";
import { insertRow, callRpc } from "@/lib/supabase-helpers";
import { logger } from "@/lib/logger";
import { Job, JobStatus } from "@/schemas/manifest";
import { enqueueJob, QueueJobPayload } from "@/queues/pgmq";

/**
 * Create job record only (without enqueueing) - used by hybrid approach
 */
export async function createJobRecord(params: {
  patternId: string;
  imageUrl: string;
  userId: string;
  idempotencyKey?: string;
  extras?: Record<string, unknown>;
}): Promise<{ jobId: string }> {
  const { patternId, imageUrl, userId, idempotencyKey, extras } = params;

  try {
    logger.info("Creating job record", {
      pattern_id: patternId,
      user_id: userId,
      idempotency_key: idempotencyKey,
    });

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

    logger.info("Job record created", { job_id: data.id });

    return { jobId: data.id };
  } catch (error) {
    logger.error("Exception creating job record", error);
    throw error;
  }
}

/**
 * Enqueue an existing job to PGMQ - used by hybrid approach fallback
 */
export async function enqueueExistingJob(
  jobId: string,
  queuePayload: QueueJobPayload
): Promise<void> {
  try {
    logger.info("Enqueueing existing job", { job_id: jobId });

    const enqueueResult = await enqueueJob(queuePayload);

    if (!enqueueResult.success) {
      // Mark job as failed if enqueue fails
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabaseServer.from("jobs") as any)
        .update({
          status: "failed",
          error: `Failed to enqueue: ${enqueueResult.error}`,
        })
        .eq("id", jobId);

      throw new Error(`Failed to enqueue job: ${enqueueResult.error}`);
    }

    logger.info("Job enqueued successfully", {
      job_id: jobId,
      msg_id: enqueueResult.msg_id,
    });
  } catch (error) {
    logger.error("Exception enqueueing job", error, { job_id: jobId });
    throw error;
  }
}

/**
 * Create and enqueue a new job (legacy/backwards compatibility)
 */
export async function createJob(params: {
  patternId: string;
  imageUrl: string;
  userId: string;
  idempotencyKey?: string;
  extras?: Record<string, unknown>;
}): Promise<{ jobId: string; status: JobStatus }> {
  const { jobId } = await createJobRecord(params);

  const queuePayload: QueueJobPayload = {
    job_id: jobId,
    pattern_id: params.patternId,
    image_url: params.imageUrl,
    extras: params.extras,
  };

  await enqueueExistingJob(jobId, queuePayload);

  return {
    jobId,
    status: "queued" as JobStatus,
  };
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
        patterns!inner(id, name, format, user_id)
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

    // Return with pattern info included
    return data as unknown as Job;
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

    const { data, error } = await callRpc(supabaseServer, "get_my_jobs", {
      p_pattern_id: patternId,
      p_status: status,
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

    // Build update object
    const updateData: Database["public"]["Tables"]["jobs"]["Update"] = {
      status,
      ...(updates.manifest && { manifest: updates.manifest as Database["public"]["Tables"]["jobs"]["Update"]["manifest"] }),
      ...(updates.error && { error: updates.error }),
      ...(updates.latencyMs && { latency_ms: updates.latencyMs }),
      ...(status === "running" && { started_at: now }),
      ...(["succeeded", "failed"].includes(status) && { completed_at: now }),
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabaseServer.from("jobs") as any)
      .update(updateData)
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
