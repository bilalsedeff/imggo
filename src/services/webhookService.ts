/**
 * Webhook Service - Webhook delivery and management
 */

import { supabaseServer } from "@/lib/supabase-server";
import { logger } from "@/lib/logger";
import { signWebhookPayload } from "@/lib/crypto";
import { WebhookPayload } from "@/schemas/manifest";

/**
 * Send webhook notification
 */
export async function sendWebhook(params: {
  userId: string;
  event: "job.succeeded" | "job.failed";
  jobId: string;
  patternId: string;
  manifest?: Record<string, unknown>;
  error?: string;
}): Promise<void> {
  const { userId, event, jobId, patternId, manifest, error } = params;

  try {
    logger.info("Sending webhook", {
      user_id: userId,
      event,
      job_id: jobId,
    });

    // Get active webhooks for this user and event
    const { data: webhooks, error: fetchError } = await supabaseServer
      .from("webhooks")
      .select("id, url, secret")
      .eq("user_id", userId)
      .eq("is_active", true)
      .contains("events", [event]);

    if (fetchError) {
      logger.error("Failed to fetch webhooks", fetchError, {
        user_id: userId,
      });
      return;
    }

    if (!webhooks || webhooks.length === 0) {
      logger.debug("No webhooks configured", {
        user_id: userId,
        event,
      });
      return;
    }

    // Prepare payload
    const payload: WebhookPayload = {
      event,
      job_id: jobId,
      pattern_id: patternId,
      manifest: manifest || null,
      error: error || null,
      timestamp: new Date().toISOString(),
    };

    // Send to each webhook
    await Promise.allSettled(
      webhooks.map(async (webhook) => {
        try {
          const signature = signWebhookPayload(payload, webhook.secret);

          const response = await fetch(webhook.url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-ImgGo-Signature": signature,
              "User-Agent": "ImgGo-Webhook/1.0",
            },
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(30000), // 30s timeout
          });

          if (!response.ok) {
            logger.warn("Webhook delivery failed", {
              webhook_id: webhook.id,
              status: response.status,
              job_id: jobId,
            });
          } else {
            logger.info("Webhook delivered", {
              webhook_id: webhook.id,
              job_id: jobId,
            });

            // Update last triggered timestamp
            await supabaseServer
              .from("webhooks")
              .update({ last_triggered_at: new Date().toISOString() })
              .eq("id", webhook.id);
          }
        } catch (err) {
          logger.error("Webhook delivery exception", err, {
            webhook_id: webhook.id,
            job_id: jobId,
          });
        }
      })
    );
  } catch (error) {
    logger.error("Exception in webhook service", error);
  }
}

/**
 * Create webhook
 */
export async function createWebhook(params: {
  userId: string;
  url: string;
  secret: string;
  events: string[];
}): Promise<{ id: string }> {
  try {
    const { data, error } = await supabaseServer
      .from("webhooks")
      .insert({
        user_id: params.userId,
        url: params.url,
        secret: params.secret,
        events: params.events,
        is_active: true,
      })
      .select("id")
      .single();

    if (error) {
      logger.error("Failed to create webhook", error);
      throw new Error(`Failed to create webhook: ${error.message}`);
    }

    logger.info("Webhook created", {
      webhook_id: data.id,
      user_id: params.userId,
    });

    return { id: data.id };
  } catch (error) {
    logger.error("Exception creating webhook", error);
    throw error;
  }
}

/**
 * List user's webhooks
 */
export async function listWebhooks(userId: string): Promise<
  Array<{
    id: string;
    url: string;
    events: string[];
    is_active: boolean;
    created_at: string;
    last_triggered_at: string | null;
  }>
> {
  try {
    const { data, error } = await supabaseServer
      .from("webhooks")
      .select("id, url, events, is_active, created_at, last_triggered_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      logger.error("Failed to list webhooks", error);
      throw error;
    }

    return data || [];
  } catch (error) {
    logger.error("Exception listing webhooks", error);
    throw error;
  }
}

/**
 * Delete webhook
 */
export async function deleteWebhook(
  webhookId: string,
  userId: string
): Promise<void> {
  try {
    const { error } = await supabaseServer
      .from("webhooks")
      .delete()
      .eq("id", webhookId)
      .eq("user_id", userId);

    if (error) {
      logger.error("Failed to delete webhook", error);
      throw error;
    }

    logger.info("Webhook deleted", { webhook_id: webhookId });
  } catch (error) {
    logger.error("Exception deleting webhook", error);
    throw error;
  }
}
