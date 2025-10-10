/**
 * PGMQ (PostgreSQL Message Queue) helpers for ImgGo
 * Handles job enqueueing and dequeuing
 */

import { supabaseServer } from "@/lib/supabase-server";
import { logger } from "@/lib/logger";

const QUEUE_NAME = process.env.SUPABASE_PGMQ_QUEUE || "ingest_jobs";

/**
 * Job payload for the queue
 */
export interface QueueJobPayload {
  job_id: string;
  pattern_id: string;
  image_url: string;
  extras?: Record<string, unknown>;
}

/**
 * PGMQ message envelope
 */
export interface PGMQMessage<T = QueueJobPayload> {
  msg_id: number;
  read_ct: number;
  enqueued_at: string;
  vt: string;
  message: T;
}

/**
 * Enqueue a job to PGMQ
 */
export async function enqueueJob(
  payload: QueueJobPayload
): Promise<{ success: boolean; msg_id?: number; error?: string }> {
  try {
    logger.info("Enqueueing job", {
      job_id: payload.job_id,
      pattern_id: payload.pattern_id,
    });

    // @ts-expect-error Supabase RPC type inference limitation
    const { data, error } = await supabaseServer.rpc("pgmq_send", {
      queue_name: QUEUE_NAME,
      msg: payload,
    });

    if (error) {
      logger.error("Failed to enqueue job", error, {
        job_id: payload.job_id,
      });
      return {
        success: false,
        error: error.message || "Failed to enqueue job",
      };
    }

    logger.info("Job enqueued successfully", {
      job_id: payload.job_id,
      msg_id: data,
    });

    return {
      success: true,
      msg_id: data as number,
    };
  } catch (err) {
    logger.error("Exception enqueueing job", err, {
      job_id: payload.job_id,
    });
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

/**
 * Read messages from PGMQ (for worker consumption)
 * @param vtSeconds - Visibility timeout in seconds (message invisible to other consumers)
 * @param batchSize - Number of messages to read
 */
export async function readMessages(
  vtSeconds = 300,
  batchSize = 10
): Promise<PGMQMessage<QueueJobPayload>[]> {
  try {
    // @ts-expect-error Supabase RPC type inference limitation
    const { data, error } = await supabaseServer.rpc("pgmq_read", {
      queue_name: QUEUE_NAME,
      vt: vtSeconds,
      qty: batchSize,
    });

    if (error) {
      logger.error("Failed to read messages from queue", error);
      return [];
    }

    return (data as PGMQMessage<QueueJobPayload>[]) || [];
  } catch (err) {
    logger.error("Exception reading messages from queue", err);
    return [];
  }
}

/**
 * Delete a message from PGMQ after successful processing
 */
export async function deleteMessage(msgId: number): Promise<boolean> {
  try {
    // @ts-expect-error Supabase RPC type inference limitation
    const { error } = await supabaseServer.rpc("pgmq_delete", {
      queue_name: QUEUE_NAME,
      msg_id: msgId,
    });

    if (error) {
      logger.error("Failed to delete message", error, { msg_id: msgId });
      return false;
    }

    return true;
  } catch (err) {
    logger.error("Exception deleting message", err, { msg_id: msgId });
    return false;
  }
}

/**
 * Archive a message (move to dead letter queue) after failed processing
 */
export async function archiveMessage(msgId: number): Promise<boolean> {
  try {
    // @ts-expect-error Supabase RPC type inference limitation
    const { error } = await supabaseServer.rpc("pgmq_archive", {
      queue_name: QUEUE_NAME,
      msg_id: msgId,
    });

    if (error) {
      logger.error("Failed to archive message", error, { msg_id: msgId });
      return false;
    }

    logger.info("Message archived", { msg_id: msgId });
    return true;
  } catch (err) {
    logger.error("Exception archiving message", err, { msg_id: msgId });
    return false;
  }
}

/**
 * Get queue metrics
 */
export async function getQueueMetrics(): Promise<{
  queue_length: number;
  oldest_msg_age_sec: number | null;
  newest_msg_age_sec: number | null;
  total_messages: number;
} | null> {
  try {
    // @ts-expect-error Supabase RPC type inference limitation
    const { data, error } = await supabaseServer.rpc("pgmq_metrics", {
      queue_name: QUEUE_NAME,
    });

    if (error) {
      logger.error("Failed to get queue metrics", error);
      return null;
    }

    return data as {
      queue_length: number;
      oldest_msg_age_sec: number | null;
      newest_msg_age_sec: number | null;
      total_messages: number;
    };
  } catch (err) {
    logger.error("Exception getting queue metrics", err);
    return null;
  }
}

/**
 * Purge the queue (for testing/admin)
 */
export async function purgeQueue(): Promise<boolean> {
  try {
    // @ts-expect-error Supabase RPC type inference limitation
    const { error } = await supabaseServer.rpc("pgmq_purge_queue", {
      queue_name: QUEUE_NAME,
    });

    if (error) {
      logger.error("Failed to purge queue", error);
      return false;
    }

    logger.warn("Queue purged", { queue_name: QUEUE_NAME });
    return true;
  } catch (err) {
    logger.error("Exception purging queue", err);
    return false;
  }
}
