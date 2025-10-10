/**
 * ImgGo Worker - Supabase Edge Function
 * Consumes jobs from PGMQ queue and processes them
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import OpenAI from "https://esm.sh/openai@4";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const openaiApiKey = Deno.env.get("OPENAI_API_KEY")!;
const queueName = Deno.env.get("SUPABASE_PGMQ_QUEUE") || "ingest_jobs";

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
const openai = new OpenAI({ apiKey: openaiApiKey });

const MODEL = "gpt-4o-2024-08-06";
const BATCH_SIZE = 5; // Process 5 jobs per invocation
const VISIBILITY_TIMEOUT = 300; // 5 minutes

interface QueueMessage {
  msg_id: number;
  read_ct: number;
  enqueued_at: string;
  vt: string;
  message: {
    job_id: string;
    pattern_id: string;
    image_url: string;
    extras?: Record<string, unknown>;
  };
}

interface Pattern {
  id: string;
  format: string;
  json_schema: Record<string, unknown> | null;
  instructions: string;
  model_profile: string;
}

Deno.serve(async (_req) => {
  const startTime = Date.now();
  let processedCount = 0;
  let failedCount = 0;

  console.log(JSON.stringify({
    level: "info",
    message: "Worker invoked",
    timestamp: new Date().toISOString(),
  }));

  try {
    // Read messages from queue
    const { data: messages, error: readError } = await supabase.rpc(
      "pgmq_read",
      {
        queue_name: queueName,
        vt: VISIBILITY_TIMEOUT,
        qty: BATCH_SIZE,
      }
    );

    if (readError) {
      console.error(JSON.stringify({
        level: "error",
        message: "Failed to read from queue",
        error: readError,
      }));
      return new Response(
        JSON.stringify({ error: "Failed to read queue" }),
        { status: 500 }
      );
    }

    const queueMessages = (messages || []) as QueueMessage[];

    if (queueMessages.length === 0) {
      console.log(JSON.stringify({
        level: "info",
        message: "No messages in queue",
      }));
      return new Response(
        JSON.stringify({ processed: 0, message: "No jobs to process" }),
        { status: 200 }
      );
    }

    console.log(JSON.stringify({
      level: "info",
      message: `Processing ${queueMessages.length} jobs`,
    }));

    // Process each message
    for (const msg of queueMessages) {
      try {
        await processJob(msg);
        processedCount++;

        // Delete message from queue
        await supabase.rpc("pgmq_delete", {
          queue_name: queueName,
          msg_id: msg.msg_id,
        });
      } catch (error) {
        failedCount++;
        console.error(JSON.stringify({
          level: "error",
          message: "Job processing failed",
          job_id: msg.message.job_id,
          error: error instanceof Error ? error.message : String(error),
        }));

        // Archive failed message
        await supabase.rpc("pgmq_archive", {
          queue_name: queueName,
          msg_id: msg.msg_id,
        });
      }
    }

    const duration = Date.now() - startTime;

    return new Response(
      JSON.stringify({
        success: true,
        processed: processedCount,
        failed: failedCount,
        duration_ms: duration,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error(JSON.stringify({
      level: "error",
      message: "Worker exception",
      error: error instanceof Error ? error.message : String(error),
    }));

    return new Response(
      JSON.stringify({ error: "Worker failed" }),
      { status: 500 }
    );
  }
});

async function processJob(msg: QueueMessage): Promise<void> {
  const { job_id, pattern_id, image_url } = msg.message;
  const jobStartTime = Date.now();

  console.log(JSON.stringify({
    level: "info",
    message: "Processing job",
    job_id,
    pattern_id,
  }));

  // Update job status to running
  await supabase
    .from("jobs")
    .update({ status: "running", started_at: new Date().toISOString() })
    .eq("id", job_id);

  try {
    // Get pattern
    const { data: pattern, error: patternError } = await supabase
      .from("patterns")
      .select("id, format, json_schema, instructions, model_profile, user_id")
      .eq("id", pattern_id)
      .single();

    if (patternError || !pattern) {
      throw new Error(`Pattern not found: ${pattern_id}`);
    }

    // Infer manifest using OpenAI
    const { manifest, latencyMs } = await inferManifest(
      image_url,
      pattern.instructions,
      pattern.json_schema
    );

    // Update job with success
    await supabase
      .from("jobs")
      .update({
        status: "succeeded",
        manifest,
        latency_ms: latencyMs,
        completed_at: new Date().toISOString(),
      })
      .eq("id", job_id);

    console.log(JSON.stringify({
      level: "info",
      message: "Job succeeded",
      job_id,
      latency_ms: latencyMs,
    }));

    // Send webhook
    await sendWebhook(pattern.user_id, {
      event: "job.succeeded",
      job_id,
      pattern_id,
      manifest,
      error: null,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    const latencyMs = Date.now() - jobStartTime;

    console.error(JSON.stringify({
      level: "error",
      message: "Job failed",
      job_id,
      error: errorMessage,
    }));

    // Update job with failure
    await supabase
      .from("jobs")
      .update({
        status: "failed",
        error: errorMessage,
        latency_ms: latencyMs,
        completed_at: new Date().toISOString(),
      })
      .eq("id", job_id);

    // Send failure webhook
    const { data: pattern } = await supabase
      .from("patterns")
      .select("user_id")
      .eq("id", pattern_id)
      .single();

    if (pattern) {
      await sendWebhook(pattern.user_id, {
        event: "job.failed",
        job_id,
        pattern_id,
        manifest: null,
        error: errorMessage,
        timestamp: new Date().toISOString(),
      });
    }

    throw error;
  }
}

async function inferManifest(
  imageUrl: string,
  instructions: string,
  jsonSchema: Record<string, unknown> | null
): Promise<{ manifest: Record<string, unknown>; latencyMs: number }> {
  const startTime = Date.now();

  const schema = jsonSchema
    ? createStructuredOutputSchema(jsonSchema)
    : createDefaultSchema();

  const systemPrompt = `You are an expert image analysis AI that extracts structured data from images.
Analyze the image carefully and extract information according to the user's instructions.

IMPORTANT:
- Be precise and accurate
- If information is not visible or uncertain, use null or indicate uncertainty
- Follow the schema structure exactly
- Extract all requested information`;

  const userPrompt = `${instructions}

Analyze this image and extract the information in the exact structure specified.`;

  const response = await openai.chat.completions.create({
    model: MODEL,
    messages: [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: [
          { type: "text", text: userPrompt },
          {
            type: "image_url",
            image_url: { url: imageUrl, detail: "high" },
          },
        ],
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "image_analysis",
        strict: true,
        schema: schema,
      },
    },
    temperature: 0.2,
    max_tokens: 4000,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error("No content in OpenAI response");
  }

  const manifest = JSON.parse(content);
  const latencyMs = Date.now() - startTime;

  return { manifest, latencyMs };
}

function createStructuredOutputSchema(
  jsonSchema: Record<string, unknown>
): Record<string, unknown> {
  return {
    type: "object",
    properties: jsonSchema.properties || {},
    required: (jsonSchema.required as string[]) || [],
    additionalProperties: false,
  };
}

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

async function sendWebhook(
  userId: string,
  payload: {
    event: string;
    job_id: string;
    pattern_id: string;
    manifest: Record<string, unknown> | null;
    error: string | null;
    timestamp: string;
  }
): Promise<void> {
  try {
    // Get webhooks for this user and event
    const { data: webhooks } = await supabase
      .from("webhooks")
      .select("id, url, secret")
      .eq("user_id", userId)
      .eq("is_active", true)
      .contains("events", [payload.event]);

    if (!webhooks || webhooks.length === 0) {
      return;
    }

    // Send to each webhook
    for (const webhook of webhooks) {
      try {
        const signature = await signPayload(payload, webhook.secret);

        await fetch(webhook.url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-ImgGo-Signature": signature,
            "User-Agent": "ImgGo-Webhook/1.0",
          },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(30000),
        });

        // Update last triggered
        await supabase
          .from("webhooks")
          .update({ last_triggered_at: new Date().toISOString() })
          .eq("id", webhook.id);
      } catch (error) {
        console.error(JSON.stringify({
          level: "error",
          message: "Webhook delivery failed",
          webhook_id: webhook.id,
          error: error instanceof Error ? error.message : String(error),
        }));
      }
    }
  } catch (error) {
    console.error(JSON.stringify({
      level: "error",
      message: "Webhook send failed",
      error: error instanceof Error ? error.message : String(error),
    }));
  }
}

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
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  return `sha256=${hashHex}`;
}
