/**
 * Image Processing Service - Shared logic for direct and queue-based processing
 * Used by both API routes (direct processing) and worker (queue processing)
 */

import OpenAI from "openai";
import { supabaseServer } from "@/lib/supabase-server";
import { logger } from "@/lib/logger";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
  timeout: 25000, // 25s timeout for direct processing
  maxRetries: 2, // Automatic retries
});

const MODEL = "gpt-4o-2024-08-06";

interface ProcessImageParams {
  jobId: string;
  patternId: string;
  imageUrl: string;
  userId: string;
}

interface ProcessImageResult {
  success: boolean;
  manifest?: Record<string, unknown>;
  latencyMs?: number;
  error?: string;
}

interface Pattern {
  id: string;
  user_id: string;
  format: string;
  json_schema: Record<string, unknown> | null;
  instructions: string;
}

/**
 * Main processing function - can be called directly or from queue worker
 */
export async function processImage(
  params: ProcessImageParams
): Promise<ProcessImageResult> {
  const { jobId, patternId, imageUrl, userId } = params;
  const startTime = Date.now();

  try {
    logger.info("Starting image processing", {
      job_id: jobId,
      pattern_id: patternId,
      user_id: userId,
    });

    // Get pattern with CSV schema
    const { data: pattern, error: patternError } = await supabaseServer
      .from("patterns")
      .select("id, user_id, format, json_schema, csv_schema, csv_delimiter, yaml_schema, xml_schema, plain_text_schema, instructions, model_profile")
      .eq("id", patternId)
      .single();

    if (patternError || !pattern) {
      throw new Error(`Pattern not found: ${patternId}`);
    }

    // Import orchestrator for proper format handling
    const { inferManifest: orchestratorInferManifest } = await import("@/llm/orchestrator");

    // Extract filename from imageUrl for better AI context
    const imageFilename = imageUrl.split('/').pop() || 'image';

    // DIVINE RULE: Infer manifest using ALL format-specific schemas
    const { manifest, manifestString, latencyMs } = await orchestratorInferManifest({
      imageUrl,
      imageFilename,
      instructions: pattern.instructions,
      format: pattern.format as any,
      jsonSchema: pattern.json_schema || undefined,
      csvSchema: pattern.csv_schema || undefined,
      csvDelimiter: (pattern.csv_delimiter || "comma") as "comma" | "semicolon",
      yamlSchema: pattern.yaml_schema || undefined,
      xmlSchema: pattern.xml_schema || undefined,
      plainTextSchema: pattern.plain_text_schema || undefined,
      modelProfile: (pattern.model_profile || "managed-default") as any,
    });

    logger.info("Manifest inferred successfully", {
      job_id: jobId,
      latency_ms: latencyMs,
      manifest_keys: Object.keys(manifest),
    });

    // Update job with success
    await updateJobStatus(jobId, "succeeded", {
      manifest,
      latencyMs,
    });

    // Send webhook notification
    await sendWebhookNotification(pattern as Pattern, {
      event: "job.succeeded",
      job_id: jobId,
      pattern_id: patternId,
      manifest,
      error: null,
    });

    // 🔥 DELETE IMAGE (Privacy & Storage Cost Optimization)
    await deleteImageAfterProcessing(imageUrl, jobId);

    const totalLatency = Date.now() - startTime;
    logger.info("Image processing completed successfully", {
      job_id: jobId,
      total_latency_ms: totalLatency,
    });

    return {
      success: true,
      manifest,
      latencyMs: totalLatency,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    const latencyMs = Date.now() - startTime;

    logger.error("Image processing failed", {
      job_id: jobId,
      error: errorMessage,
      latency_ms: latencyMs,
    });

    // Update job with failure
    await updateJobStatus(jobId, "failed", {
      error: errorMessage,
      latencyMs,
    });

    // Send failure webhook
    const { data: pattern } = await supabaseServer
      .from("patterns")
      .select("id, user_id, format, json_schema, instructions")
      .eq("id", patternId)
      .single();

    if (pattern) {
      await sendWebhookNotification(pattern as Pattern, {
        event: "job.failed",
        job_id: jobId,
        pattern_id: patternId,
        manifest: null,
        error: errorMessage,
      });
    }

    return {
      success: false,
      error: errorMessage,
      latencyMs,
    };
  }
}


/**
 * Delete image from storage after successful processing (Privacy & Cost)
 */
async function deleteImageAfterProcessing(
  imageUrl: string,
  jobId: string
): Promise<void> {
  try {
    // Extract path from URL
    // Format: https://.../storage/v1/object/public/images/USER_ID/FILENAME.png
    const pathMatch = imageUrl.match(/\/images\/(.+)$/);
    if (!pathMatch) {
      logger.warn("Could not extract image path from URL", {
        job_id: jobId,
        image_url: imageUrl.substring(0, 50),
      });
      return;
    }

    const imagePath = pathMatch[1];

    const { error } = await supabaseServer.storage
      .from("images")
      .remove([imagePath]);

    if (error) {
      throw error;
    }

    logger.info("Image deleted after successful processing", {
      job_id: jobId,
      path: imagePath,
      privacy_compliant: true,
      storage_optimized: true,
    });
  } catch (error) {
    // Log but don't fail the job
    logger.warn("Failed to delete image", {
      job_id: jobId,
      error: error instanceof Error ? error.message : String(error),
      note: "Job succeeded but image cleanup failed",
    });
  }
}

/**
 * Update job status in database
 */
async function updateJobStatus(
  jobId: string,
  status: "running" | "succeeded" | "failed",
  updates: {
    manifest?: Record<string, unknown>;
    error?: string;
    latencyMs?: number;
  } = {}
): Promise<void> {
  const now = new Date().toISOString();

  const updateData: Record<string, unknown> = {
    status,
    ...(updates.manifest && { manifest: updates.manifest }),
    ...(updates.error && { error: updates.error }),
    ...(updates.latencyMs && { latency_ms: updates.latencyMs }),
    ...(status === "running" && { started_at: now }),
    ...(["succeeded", "failed"].includes(status) && { completed_at: now }),
  };

  const { error } = await supabaseServer
    .from("jobs")
    .update(updateData)
    .eq("id", jobId);

  if (error) {
    logger.error("Failed to update job status", {
      job_id: jobId,
      status,
      error: error.message,
    });
    throw error;
  }
}

/**
 * Send webhook notification
 */
async function sendWebhookNotification(
  pattern: Pattern,
  payload: {
    event: string;
    job_id: string;
    pattern_id: string;
    manifest: Record<string, unknown> | null;
    error: string | null;
  }
): Promise<void> {
  try {
    // Get webhooks for this user and event
    const { data: webhooks } = await supabaseServer
      .from("webhooks")
      .select("id, url, secret")
      .eq("user_id", pattern.user_id)
      .eq("is_active", true)
      .contains("events", [payload.event]);

    if (!webhooks || webhooks.length === 0) {
      return;
    }

    const fullPayload = {
      ...payload,
      timestamp: new Date().toISOString(),
    };

    // PERFORMANCE: Send all webhooks in parallel using Promise.allSettled
    // Each webhook delivery is independent and should not block others
    const webhookPromises = webhooks.map(async (webhook) => {
      const webhookStart = Date.now();
      try {
        // Sign payload
        const signature = await signPayload(fullPayload, webhook.secret);

        // Deliver webhook with 30s timeout
        const response = await fetch(webhook.url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-ImgGo-Signature": signature,
            "User-Agent": "ImgGo-Webhook/1.0",
          },
          body: JSON.stringify(fullPayload),
          signal: AbortSignal.timeout(30000), // 30s timeout per webhook
        });

        // Check response status
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        // Update last triggered timestamp
        await supabaseServer
          .from("webhooks")
          .update({ last_triggered_at: new Date().toISOString() })
          .eq("id", webhook.id);

        const deliveryTime = Date.now() - webhookStart;
        logger.info("Webhook delivered successfully", {
          webhook_id: webhook.id,
          webhook_url: webhook.url,
          event: payload.event,
          job_id: payload.job_id,
          delivery_time_ms: deliveryTime,
          http_status: response.status,
        });

        return { success: true, webhookId: webhook.id };
      } catch (error) {
        const deliveryTime = Date.now() - webhookStart;
        const errorMessage = error instanceof Error ? error.message : String(error);

        logger.error("Webhook delivery failed", {
          webhook_id: webhook.id,
          webhook_url: webhook.url,
          event: payload.event,
          job_id: payload.job_id,
          error: errorMessage,
          delivery_time_ms: deliveryTime,
        });

        return { success: false, webhookId: webhook.id, error: errorMessage };
      }
    });

    // Wait for all webhooks to complete (success or failure)
    const results = await Promise.allSettled(webhookPromises);

    // Track delivery metrics
    const successCount = results.filter(
      (r) => r.status === "fulfilled" && r.value.success
    ).length;
    const failureCount = results.length - successCount;

    logger.info("Webhook delivery batch completed", {
      event: payload.event,
      job_id: payload.job_id,
      total_webhooks: webhooks.length,
      successful: successCount,
      failed: failureCount,
    });
  } catch (error) {
    logger.error("Webhook send failed", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Sign webhook payload with HMAC-SHA256
 */
async function signPayload(
  payload: Record<string, unknown>,
  secret: string
): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(JSON.stringify(payload));

  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign("HMAC", key, data);
  const hashArray = Array.from(new Uint8Array(signature));
  const hashHex = hashArray
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return `sha256=${hashHex}`;
}

/**
 * Infer JSON Schema type from a value with comprehensive type detection
 */
function inferTypeFromValue(value: unknown): Record<string, unknown> {
  if (value === null || value === undefined) {
    return { type: "null" };
  }

  if (typeof value === "boolean") {
    return { type: "boolean" };
  }

  if (typeof value === "number") {
    if (Number.isInteger(value)) {
      return { type: "integer" };
    }
    return { type: "number" };
  }

  if (typeof value === "string") {
    // ISO 8601 date-time
    const isoDateTimePattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/;
    if (isoDateTimePattern.test(value)) {
      return { type: "string", format: "date-time" };
    }

    // ISO 8601 date
    const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;
    if (isoDatePattern.test(value)) {
      return { type: "string", format: "date" };
    }

    // Email
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (emailPattern.test(value)) {
      return { type: "string", format: "email" };
    }

    // URI
    const uriPattern = /^https?:\/\/.+/;
    if (uriPattern.test(value)) {
      return { type: "string", format: "uri" };
    }

    // UUID
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (uuidPattern.test(value)) {
      return { type: "string", format: "uuid" };
    }

    return { type: "string" };
  }

  if (Array.isArray(value)) {
    if (value.length > 0) {
      return {
        type: "array",
        items: inferTypeFromValue(value[0]),
      };
    }
    return { type: "array", items: { type: "string" } };
  }

  if (typeof value === "object") {
    const properties: Record<string, unknown> = {};
    const required: string[] = [];

    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      properties[key] = inferTypeFromValue(val);
      required.push(key);
    }

    return {
      type: "object",
      properties,
      required,
      additionalProperties: false,
    };
  }

  return { type: "string" };
}

/**
 * Convert example data to JSON Schema, or use existing schema if valid
 */
function createStructuredOutputSchema(
  jsonSchema: Record<string, unknown>
): Record<string, unknown> {
  // If it's already a valid JSON Schema (has "properties" field)
  if (jsonSchema.properties && typeof jsonSchema.properties === "object") {
    return {
      type: "object",
      properties: jsonSchema.properties,
      required: (jsonSchema.required as string[]) || [],
      additionalProperties: false,
    };
  }

  // Otherwise, treat it as example data and infer schema
  logger.debug("Inferring JSON Schema from example data", {
    example_keys: Object.keys(jsonSchema),
  });

  const properties: Record<string, unknown> = {};
  const required: string[] = [];

  for (const [key, value] of Object.entries(jsonSchema)) {
    properties[key] = inferTypeFromValue(value);
    required.push(key);
  }

  const inferredSchema = {
    type: "object",
    properties,
    required,
    additionalProperties: false,
  };

  logger.debug("Inferred JSON Schema", {
    schema_preview: JSON.stringify(inferredSchema).substring(0, 300),
  });

  return inferredSchema;
}

/**
 * Default schema when no custom schema provided
 */
function createDefaultSchema(): Record<string, unknown> {
  return {
    type: "object",
    properties: {
      analysis: {
        type: "string",
        description: "Comprehensive analysis of the image",
      },
      extracted_data: {
        type: "object",
        description: "Key-value pairs of extracted information",
        additionalProperties: true,
      },
    },
    required: ["analysis", "extracted_data"],
    additionalProperties: false,
  };
}
