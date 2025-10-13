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

// Character limits for optimal AI performance
export const PATTERN_LIMITS = {
  INSTRUCTIONS_MAX: 2000,
  SCHEMA_MAX: 5000,
  TOTAL_MAX: 7000,
} as const;

export const InstructionsSchema = z
  .string()
  .min(10, "Instructions must be at least 10 characters")
  .max(PATTERN_LIMITS.INSTRUCTIONS_MAX, `Instructions cannot exceed ${PATTERN_LIMITS.INSTRUCTIONS_MAX} characters`);

/**
 * JSON Schema validation (simplified)
 * Full JSON Schema validation would require json-schema library
 */
export const JsonSchemaSchema = z.record(z.unknown()).nullable().optional();

/**
 * Validates markdown heading structure for Plain Text patterns
 * Rules:
 * 1. Must start with exactly one # (master heading)
 * 2. Subsequent headings can increment by 1 level (# → ##, ## → ###)
 * 3. Can go back to any previous level (### → ##, ### → #)
 * 4. Cannot skip levels (# → ### is invalid, ## → #### is invalid)
 */
export function validateMarkdownHeadings(text: string): { valid: boolean; error?: string } {
  const lines = text.split('\n');
  const headings: { level: number; line: number; text: string }[] = [];

  // Extract all headings
  lines.forEach((line, index) => {
    const trimmed = line.trim();
    const match = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (match) {
      const level = match[1].length;
      headings.push({ level, line: index + 1, text: match[2] });
    }
  });

  // Must have at least one heading
  if (headings.length === 0) {
    return { valid: false, error: "Plain Text pattern must have at least one heading (# Main Heading)" };
  }

  // First heading must be level 1 (single #)
  if (headings[0].level !== 1) {
    return {
      valid: false,
      error: `First heading must be level 1 (single #). Found level ${headings[0].level} at line ${headings[0].line}`,
    };
  }

  // Validate heading progression
  for (let i = 1; i < headings.length; i++) {
    const prev = headings[i - 1];
    const curr = headings[i];

    // Can stay same level or go back to any previous level
    if (curr.level <= prev.level) {
      continue;
    }

    // Can only increment by 1
    if (curr.level > prev.level + 1) {
      return {
        valid: false,
        error: `Invalid heading progression at line ${curr.line}: cannot jump from level ${prev.level} (${"#".repeat(prev.level)}) to level ${curr.level} (${"#".repeat(curr.level)}). Headings must increment by 1 level at a time.`,
      };
    }
  }

  return { valid: true };
}

/**
 * Plain Text Schema with markdown heading validation
 */
export const PlainTextSchemaValidator = z
  .string()
  .max(PATTERN_LIMITS.SCHEMA_MAX, `Schema cannot exceed ${PATTERN_LIMITS.SCHEMA_MAX} characters`)
  .refine(
    (text) => {
      const result = validateMarkdownHeadings(text);
      return result.valid;
    },
    (text) => {
      const result = validateMarkdownHeadings(text);
      return { message: result.error || "Invalid markdown heading structure" };
    }
  );

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
  yaml_schema?: string | null;
  xml_schema?: string | null;
  csv_schema?: string | null;
  plain_text_schema?: string | null;
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
  yaml_schema: z.string().max(PATTERN_LIMITS.SCHEMA_MAX, `YAML schema cannot exceed ${PATTERN_LIMITS.SCHEMA_MAX} characters`).optional(),
  xml_schema: z.string().max(PATTERN_LIMITS.SCHEMA_MAX, `XML schema cannot exceed ${PATTERN_LIMITS.SCHEMA_MAX} characters`).optional(),
  csv_schema: z.string().max(PATTERN_LIMITS.SCHEMA_MAX, `CSV schema cannot exceed ${PATTERN_LIMITS.SCHEMA_MAX} characters`).optional(),
  plain_text_schema: PlainTextSchemaValidator.optional(),
  is_active: z.boolean().optional(),
  publish_new_version: z.boolean().optional().default(false),
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
  yaml_schema: z.string().nullable().optional(),
  xml_schema: z.string().nullable().optional(),
  csv_schema: z.string().nullable().optional(),
  plain_text_schema: z.string().nullable().optional(),
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
