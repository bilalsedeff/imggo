/**
 * PGMQ (Postgres Message Queue) Helpers
 * Wrapper around pgmq extension for job queue management
 */

import { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "./logger";

const QUEUE_NAME = process.env.SUPABASE_PGMQ_QUEUE || "ingest_jobs";

export interface QueueMessage<T = unknown> {
  msg_id: number;
  read_ct: number;
  enqueued_at: string;
  vt: string;
  message: T;
}

export interface JobPayload {
  job_id: string;
  pattern_id: string;
  image_url: string;
  extras?: Record<string, unknown>;
}

/**
 * Initialize queue (create if doesn't exist)
 */
export async function initQueue(supabase: SupabaseClient): Promise<void> {
  try {
    const { error } = await supabase.rpc("pgmq_create", {
      queue_name: QUEUE_NAME,
    });

    if (error && !error.message.includes("already exists")) {
      throw error;
    }

    logger.info("PGMQ queue initialized", { queue: QUEUE_NAME });
  } catch (error) {
    logger.error("Failed to initialize PGMQ queue", error);
    throw error;
  }
}

/**
 * Enqueue a job
 */
export async function enqueueJob(
  supabase: SupabaseClient,
  payload: JobPayload
): Promise<number> {
  try {
    const { data, error } = await supabase.rpc("pgmq_send", {
      queue_name: QUEUE_NAME,
      msg: payload,
    });

    if (error) throw error;

    const msgId = data as number;
    logger.info("Job enqueued", { job_id: payload.job_id, msg_id: msgId });

    return msgId;
  } catch (error) {
    logger.error("Failed to enqueue job", error, { job_id: payload.job_id });
    throw error;
  }
}

/**
 * Read messages from queue with visibility timeout
 * @param vt Visibility timeout in seconds (default: 60)
 * @param limit Number of messages to read (default: 1)
 */
export async function readMessages(
  supabase: SupabaseClient,
  vt: number = 60,
  limit: number = 1
): Promise<QueueMessage<JobPayload>[]> {
  try {
    const { data, error } = await supabase.rpc("pgmq_read", {
      queue_name: QUEUE_NAME,
      vt,
      qty: limit,
    });

    if (error) throw error;

    return (data || []) as QueueMessage<JobPayload>[];
  } catch (error) {
    logger.error("Failed to read messages from queue", error);
    throw error;
  }
}

/**
 * Delete a message from queue (after successful processing)
 */
export async function deleteMessage(
  supabase: SupabaseClient,
  msgId: number
): Promise<void> {
  try {
    const { error } = await supabase.rpc("pgmq_delete", {
      queue_name: QUEUE_NAME,
      msg_id: msgId,
    });

    if (error) throw error;

    logger.info("Message deleted from queue", { msg_id: msgId });
  } catch (error) {
    logger.error("Failed to delete message from queue", error, {
      msg_id: msgId,
    });
    throw error;
  }
}

/**
 * Archive a message (move to archive table for failed jobs)
 */
export async function archiveMessage(
  supabase: SupabaseClient,
  msgId: number
): Promise<void> {
  try {
    const { error } = await supabase.rpc("pgmq_archive", {
      queue_name: QUEUE_NAME,
      msg_id: msgId,
    });

    if (error) throw error;

    logger.info("Message archived", { msg_id: msgId });
  } catch (error) {
    logger.error("Failed to archive message", error, { msg_id: msgId });
    throw error;
  }
}

/**
 * Get queue metrics
 */
export async function getQueueMetrics(
  supabase: SupabaseClient
): Promise<{
  queue_length: number;
  oldest_msg_age_sec: number | null;
  newest_msg_age_sec: number | null;
  total_messages: number;
}> {
  try {
    const { data, error } = await supabase.rpc("pgmq_metrics", {
      queue_name: QUEUE_NAME,
    });

    if (error) throw error;

    return data as {
      queue_length: number;
      oldest_msg_age_sec: number | null;
      newest_msg_age_sec: number | null;
      total_messages: number;
    };
  } catch (error) {
    logger.error("Failed to get queue metrics", error);
    throw error;
  }
}
