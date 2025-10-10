/**
 * Zod schemas for Manifest processing
 */

import { z } from "zod";

/**
 * Job statuses
 */
export const JobStatusSchema = z.enum([
  "queued",
  "running",
  "succeeded",
  "failed",
]);
export type JobStatus = z.infer<typeof JobStatusSchema>;

/**
 * Generic manifest schema (will be validated against pattern's JSON schema)
 */
export const ManifestSchema = z.record(z.unknown());
export type Manifest = z.infer<typeof ManifestSchema>;

/**
 * Job entity
 */
export const JobSchema = z.object({
  id: z.string().uuid(),
  pattern_id: z.string().uuid(),
  image_url: z.string().url(),
  status: JobStatusSchema,
  manifest: ManifestSchema.nullable(),
  error: z.string().nullable(),
  latency_ms: z.number().int().nullable(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  started_at: z.string().datetime().nullable(),
  completed_at: z.string().datetime().nullable(),
  idempotency_key: z.string().nullable(),
  requested_by: z.string().uuid().nullable(),
  extras: z.record(z.unknown()).nullable(),
});

export type Job = z.infer<typeof JobSchema>;

/**
 * Ingest request (image URL)
 */
export const IngestRequestSchema = z.object({
  image_url: z.string().url("Invalid image URL"),
  extras: z.record(z.unknown()).optional(),
  idempotency_key: z
    .string()
    .regex(/^[a-zA-Z0-9_-]{1,255}$/, "Invalid idempotency key format")
    .optional(),
});

export type IngestRequest = z.infer<typeof IngestRequestSchema>;

/**
 * Ingest response
 */
export const IngestResponseSchema = z.object({
  job_id: z.string().uuid(),
  status: JobStatusSchema,
  message: z.string().optional(),
});

export type IngestResponse = z.infer<typeof IngestResponseSchema>;

/**
 * Job result (for webhooks and polling)
 */
export const JobResultSchema = z.object({
  job_id: z.string().uuid(),
  pattern_id: z.string().uuid(),
  status: JobStatusSchema,
  manifest: ManifestSchema.nullable(),
  error: z.string().nullable(),
  latency_ms: z.number().int().nullable(),
  created_at: z.string().datetime(),
  completed_at: z.string().datetime().nullable(),
});

export type JobResult = z.infer<typeof JobResultSchema>;

/**
 * Webhook payload
 */
export const WebhookPayloadSchema = z.object({
  event: z.enum(["job.succeeded", "job.failed"]),
  job_id: z.string().uuid(),
  pattern_id: z.string().uuid(),
  manifest: ManifestSchema.nullable(),
  error: z.string().nullable(),
  timestamp: z.string().datetime(),
});

export type WebhookPayload = z.infer<typeof WebhookPayloadSchema>;

/**
 * Template generation request
 */
export const GenerateTemplateRequestSchema = z.object({
  format: z.enum(["json", "yaml", "xml", "csv", "text"]),
  instructions: z.string().min(10),
  json_schema: z.record(z.unknown()).optional(),
});

export type GenerateTemplateRequest = z.infer<
  typeof GenerateTemplateRequestSchema
>;

/**
 * Template generation response
 */
export const GenerateTemplateResponseSchema = z.object({
  template: z.string(),
  format: z.enum(["json", "yaml", "xml", "csv", "text"]),
});

export type GenerateTemplateResponse = z.infer<
  typeof GenerateTemplateResponseSchema
>;
