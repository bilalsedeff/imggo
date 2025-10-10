/**
 * API request/response schemas for ImgGo
 */

import { z } from "zod";
import { JobStatusSchema } from "./manifest";

/**
 * Common response wrappers
 */

export const SuccessResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    success: z.literal(true),
    data: dataSchema,
  });

export const ErrorResponseSchema = z.object({
  success: z.literal(false),
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.record(z.unknown()).optional(),
  }),
});

export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;

/**
 * Pagination
 */
const BasePaginationQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  per_page: z.coerce.number().int().positive().max(100).optional().default(20),
});

export const PaginationQuerySchema = BasePaginationQuerySchema.transform((data) => ({
  page: data.page ?? 1,
  per_page: data.per_page ?? 20,
}));

export type PaginationQuery = z.infer<typeof PaginationQuerySchema>;

export const PaginatedResponseSchema = <T extends z.ZodTypeAny>(
  itemSchema: T
) =>
  z.object({
    data: z.array(itemSchema),
    pagination: z.object({
      page: z.number().int(),
      per_page: z.number().int(),
      total: z.number().int(),
      total_pages: z.number().int(),
    }),
  });

/**
 * List patterns query
 */
export const ListPatternsQuerySchema = BasePaginationQuerySchema.extend({
  is_active: z.coerce.boolean().optional(),
}).transform((data) => ({
  page: data.page ?? 1,
  per_page: data.per_page ?? 20,
  is_active: data.is_active,
}));

export type ListPatternsQuery = z.infer<typeof ListPatternsQuerySchema>;

/**
 * List jobs query
 */
export const ListJobsQuerySchema = BasePaginationQuerySchema.extend({
  pattern_id: z.string().uuid().optional(),
  status: JobStatusSchema.optional(),
}).transform((data) => ({
  page: data.page ?? 1,
  per_page: data.per_page ?? 20,
  pattern_id: data.pattern_id,
  status: data.status,
}));

export type ListJobsQuery = z.infer<typeof ListJobsQuerySchema>;

/**
 * Signed upload URL request
 */
export const CreateSignedUploadUrlRequestSchema = z.object({
  path: z
    .string()
    .min(1)
    .regex(/^[a-zA-Z0-9/_\-\.]+$/, "Invalid file path")
    .describe("File path in storage bucket"),
  content_type: z.string().default("image/jpeg"),
});

export type CreateSignedUploadUrlRequest = z.infer<
  typeof CreateSignedUploadUrlRequestSchema
>;

/**
 * Signed upload URL response
 */
export const CreateSignedUploadUrlResponseSchema = z.object({
  url: z.string().url(),
  token: z.string(),
  expires_at: z.string().datetime(),
  upload_path: z.string(),
});

export type CreateSignedUploadUrlResponse = z.infer<
  typeof CreateSignedUploadUrlResponseSchema
>;

/**
 * Webhook registration
 */
export const WebhookCreateSchema = z.object({
  url: z.string().url("Invalid webhook URL"),
  events: z
    .array(z.enum(["job.succeeded", "job.failed"]))
    .min(1, "At least one event required")
    .default(["job.succeeded", "job.failed"]),
  secret: z.string().min(16, "Secret must be at least 16 characters").optional(),
});

export type WebhookCreateInput = z.infer<typeof WebhookCreateSchema>;

export const WebhookUpdateSchema = z.object({
  url: z.string().url("Invalid webhook URL").optional(),
  events: z.array(z.enum(["job.succeeded", "job.failed"])).optional(),
  is_active: z.boolean().optional(),
});

export type WebhookUpdateInput = z.infer<typeof WebhookUpdateSchema>;

export const WebhookSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  url: z.string().url(),
  events: z.array(z.string()),
  is_active: z.boolean(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  last_triggered_at: z.string().datetime().nullable(),
});

export type Webhook = z.infer<typeof WebhookSchema>;

/**
 * API Key schemas
 */
export const ApiKeyCreateSchema = z.object({
  name: z.string().min(1).max(255),
  scopes: z.array(z.string()).default(["patterns:read", "patterns:ingest"]),
  expires_at: z.string().datetime().optional(),
});

export type ApiKeyCreateInput = z.infer<typeof ApiKeyCreateSchema>;

export const ApiKeyResponseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  key: z.string(),
  scopes: z.array(z.string()),
  created_at: z.string().datetime(),
  expires_at: z.string().datetime().nullable(),
});

export type ApiKeyResponse = z.infer<typeof ApiKeyResponseSchema>;

/**
 * Health check response
 */
export const HealthCheckResponseSchema = z.object({
  status: z.enum(["healthy", "degraded", "unhealthy"]),
  timestamp: z.string().datetime(),
  services: z.object({
    database: z.enum(["up", "down"]),
    storage: z.enum(["up", "down"]),
    queue: z.enum(["up", "down"]),
  }),
});

export type HealthCheckResponse = z.infer<typeof HealthCheckResponseSchema>;
