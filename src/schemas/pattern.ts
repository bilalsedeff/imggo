/**
 * Zod schemas for Pattern entity
 */

import { z } from "zod";

export const ManifestFormatSchema = z.enum(["json", "yaml", "xml", "csv", "text"]);
export type ManifestFormat = z.infer<typeof ManifestFormatSchema>;

export const ModelProfileSchema = z
  .string()
  .min(1)
  .describe("LLM/VLM provider profile");

export const PatternNameSchema = z
  .string()
  .min(1, "Name is required")
  .max(255, "Name too long")
  .regex(/^[a-zA-Z0-9\s\-_]+$/, "Name contains invalid characters");

export const InstructionsSchema = z
  .string()
  .min(10, "Instructions must be at least 10 characters")
  .max(5000, "Instructions too long");

/**
 * JSON Schema validation (simplified)
 * Full JSON Schema validation would require json-schema library
 */
export const JsonSchemaSchema = z.record(z.unknown()).nullable().optional();

/**
 * Publish Pattern Request
 */
const BaseCreatePatternSchema = z.object({
  name: PatternNameSchema,
  format: ManifestFormatSchema.optional(),
  instructions: InstructionsSchema,
  json_schema: JsonSchemaSchema,
  model_profile: ModelProfileSchema.optional(),
});

export const CreatePatternSchema = BaseCreatePatternSchema.transform((data) => ({
  name: data.name,
  format: (data.format ?? "json") as ManifestFormat,
  instructions: data.instructions,
  json_schema: data.json_schema,
  model_profile: data.model_profile ?? "managed-default",
}));

export type CreatePatternInput = {
  name: string;
  format: ManifestFormat;
  instructions: string;
  json_schema?: Record<string, unknown> | null;
  model_profile: string;
};

/**
 * Update Pattern Request
 */
export const UpdatePatternSchema = z.object({
  name: PatternNameSchema.optional(),
  format: ManifestFormatSchema.optional(),
  instructions: InstructionsSchema.optional(),
  json_schema: JsonSchemaSchema,
  is_active: z.boolean().optional(),
});

export type UpdatePatternInput = z.infer<typeof UpdatePatternSchema>;

/**
 * Pattern Response
 */
export const PatternSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  name: z.string(),
  format: ManifestFormatSchema,
  json_schema: JsonSchemaSchema,
  instructions: z.string(),
  model_profile: z.string(),
  version: z.number().int().positive(),
  is_active: z.boolean(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export type Pattern = z.infer<typeof PatternSchema>;

/**
 * Pattern with endpoint info
 */
export const PatternWithEndpointSchema = PatternSchema.extend({
  endpoint_url: z.string().url(),
});

export type PatternWithEndpoint = z.infer<typeof PatternWithEndpointSchema>;

/**
 * Publish Pattern Version Request
 */
export const PublishPatternVersionSchema = z.object({
  json_schema: JsonSchemaSchema,
  instructions: InstructionsSchema,
});

export type PublishPatternVersionInput = z.infer<
  typeof PublishPatternVersionSchema
>;
