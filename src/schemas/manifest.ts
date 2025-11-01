/**
 * Zod schemas for Manifest processing
 */

import { z } from "zod";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";

// Extend Zod with OpenAPI capabilities
extendZodWithOpenApi(z);

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
}).openapi('Job', {
  description: 'Job entity representing an image processing task',
  example: {
    id: '770e8400-e29b-41d4-a716-446655440000',
    pattern_id: '550e8400-e29b-41d4-a716-446655440000',
    image_url: 'https://storage.imggo.ai/uploads/product-image.jpg',
    status: 'succeeded',
    manifest: {
      product_name: 'Wireless Mouse',
      brand: 'Logitech',
      price: 29.99,
      in_stock: true
    },
    error: null,
    latency_ms: 1250,
    created_at: '2025-01-15T10:00:00Z',
    updated_at: '2025-01-15T10:00:01.250Z',
    started_at: '2025-01-15T10:00:00.100Z',
    completed_at: '2025-01-15T10:00:01.250Z',
    idempotency_key: 'unique-request-id-12345',
    requested_by: '660e8400-e29b-41d4-a716-446655440000',
    extras: {
      source: 'mobile-app'
    }
  }
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
}).openapi('IngestRequest', {
  description: 'Request body for submitting an image for processing',
  example: {
    image_url: 'https://storage.imggo.ai/uploads/product-image.jpg',
    extras: {
      source: 'mobile-app',
      user_id: 'usr_123'
    },
    idempotency_key: 'unique-request-id-12345'
  }
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
