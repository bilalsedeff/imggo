/**
 * Zod schemas for Pattern entity
 */

import { z } from "zod";
import yaml from "js-yaml";
import * as xmlJs from "xml-js";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";

// Extend Zod with OpenAPI capabilities
extendZodWithOpenApi(z);

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
  .regex(/^[a-zA-Z0-9\s\-_()]+$/, "Name contains invalid characters (only letters, numbers, spaces, hyphens, underscores, and parentheses allowed)");

const NO_WHITESPACE_REGEX = /^\S+$/;

function formatPath(path: string, key: string): string {
  return path === "root" ? key : `${path}.${key}`;
}

function collectWhitespaceViolations(value: unknown, path: string, errors: string[]): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectWhitespaceViolations(item, `${path}[${index}]`, errors));
    return;
  }

  if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      if (typeof key === "string" && !NO_WHITESPACE_REGEX.test(key)) {
        const location = formatPath(path, key);
        errors.push(`Field name "${key}" contains whitespace at ${location}. Use letters, numbers, or underscores instead of spaces.`);
      }
      collectWhitespaceViolations(child, formatPath(path, key), errors);
    }
  }
}

export function findWhitespaceViolations(value: unknown): string[] {
  const errors: string[] = [];
  collectWhitespaceViolations(value, "root", errors);
  return errors;
}

function collectXmlElementNames(node: unknown, path: string, errors: string[]): void {
  if (!node) {
    return;
  }

  if (Array.isArray(node)) {
    node.forEach((item, index) => collectXmlElementNames(item, `${path}[${index}]`, errors));
    return;
  }

  if (typeof node === "object") {
    const element = node as { name?: string; elements?: unknown[]; attributes?: Record<string, unknown> };

    if (typeof element.name === "string") {
      if (!NO_WHITESPACE_REGEX.test(element.name)) {
        const location = path === "root" ? element.name : `${path}.${element.name}`;
        errors.push(`Element name "${element.name}" contains whitespace at ${location}. Use underscores or remove spaces.`);
      }

      if (element.attributes) {
        for (const attrName of Object.keys(element.attributes)) {
          if (!NO_WHITESPACE_REGEX.test(attrName)) {
            const location = path === "root" ? element.name : `${path}.${element.name}`;
            errors.push(`Attribute name "${attrName}" contains whitespace at ${location}. Use underscores or remove spaces.`);
          }
        }
      }

      if (Array.isArray(element.elements)) {
        const nextPath = path === "root" ? element.name : `${path}.${element.name}`;
        element.elements.forEach((child, index) => collectXmlElementNames(child, `${nextPath}[${index}]`, errors));
      }
    } else if (element && typeof element === "object") {
      for (const value of Object.values(element)) {
        collectXmlElementNames(value, path, errors);
      }
    }
  }
}

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

// Relaxed instructions for drafts (no minimum)
export const DraftInstructionsSchema = z
  .string()
  .max(PATTERN_LIMITS.INSTRUCTIONS_MAX, `Instructions cannot exceed ${PATTERN_LIMITS.INSTRUCTIONS_MAX} characters`);

/**
 * JSON Schema validation - Hybrid approach
 * Accepts both:
 * 1. Example JSON: { "name": "John", "age": 25 }
 * 2. JSON Schema: { "type": "object", "properties": { ... } }
 *
 * System auto-detects and converts example → schema at inference time
 * Using schemas increases response consistency guarantee
 */
export const JsonSchemaSchema = z
  .unknown()
  .nullable()
  .superRefine((value, ctx) => {
    if (value === null || value === undefined) {
      return;
    }

    if (typeof value !== "object" || Array.isArray(value)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "JSON schema must be an object",
      });
      return;
    }

    const violations = findWhitespaceViolations(value);
    violations.forEach((message) => {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message,
      });
    });
  });

/**
 * Validates YAML syntax - Hybrid approach
 * Accepts both example YAML and YAML Schema
 */
export function validateYamlSyntax(text: string): { valid: boolean; error?: string } {
  try {
    const parsed = yaml.load(text);

    if (!parsed || typeof parsed !== "object") {
      return {
        valid: false,
        error: "YAML must define an object structure",
      };
    }

    const violations = findWhitespaceViolations(parsed);
    if (violations.length > 0) {
      return {
        valid: false,
        error: violations[0],
      };
    }

    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      error: `Invalid YAML syntax: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * YAML Schema validator with syntax checking
 */
export const YamlSchemaValidator = z
  .string()
  .max(PATTERN_LIMITS.SCHEMA_MAX, `YAML schema cannot exceed ${PATTERN_LIMITS.SCHEMA_MAX} characters`)
  .refine(
    (text) => {
      const result = validateYamlSyntax(text);
      return result.valid;
    },
    (text) => {
      const result = validateYamlSyntax(text);
      return { message: result.error || "Invalid YAML syntax" };
    }
  )
  .nullable()
  .optional();

/**
 * Validates XML syntax - Hybrid approach
 * Accepts both example XML and XML Schema (XSD)
 */
export function validateXmlSyntax(text: string): { valid: boolean; error?: string } {
  try {
    const parsed = xmlJs.xml2js(text, { compact: false });
    const violations: string[] = [];
    collectXmlElementNames(parsed, "root", violations);

    if (violations.length > 0) {
      return {
        valid: false,
        error: violations[0],
      };
    }

    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      error: `Invalid XML syntax: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * XML Schema validator with syntax checking
 */
export const XmlSchemaValidator = z
  .string()
  .max(PATTERN_LIMITS.SCHEMA_MAX, `XML schema cannot exceed ${PATTERN_LIMITS.SCHEMA_MAX} characters`)
  .refine(
    (text) => {
      const result = validateXmlSyntax(text);
      return result.valid;
    },
    (text) => {
      const result = validateXmlSyntax(text);
      return { message: result.error || "Invalid XML syntax" };
    }
  )
  .nullable()
  .optional();

/**
 * Validates CSV format - Hybrid approach
 * Must have at least headers row
 * Accepts:
 * 1. Headers only: "Name,Age,City"
 * 2. Headers + example rows: "Name,Age,City\nJohn,25,NYC"
 */
export function validateCsvFormat(text: string): { valid: boolean; error?: string } {
  const trimmed = text.trim();

  if (!trimmed) {
    return { valid: false, error: "CSV schema cannot be empty" };
  }

  const lines = trimmed.split('\n');

  if (lines.length === 0) {
    return { valid: false, error: "CSV must have at least a header row" };
  }

  const headerLine = lines[0].trim();

  if (!headerLine) {
    return { valid: false, error: "CSV header row cannot be empty" };
  }

  // Check if headers exist (at least one column)
  const headers = headerLine
    .split(/[,;]/)
    .map((h) => h.trim())
    .filter((h) => h.length > 0);

  if (headers.length === 0) {
    return { valid: false, error: "CSV must have at least one column header" };
  }

  const invalidHeaders = headers.filter((header) => /\s/.test(header));
  if (invalidHeaders.length > 0) {
    return {
      valid: false,
      error: `CSV headers must not contain whitespace: ${invalidHeaders.join(", ")}`,
    };
  }

  return { valid: true };
}

/**
 * CSV Schema validator with format checking
 */
export const CsvSchemaValidator = z
  .string()
  .max(PATTERN_LIMITS.SCHEMA_MAX, `CSV schema cannot exceed ${PATTERN_LIMITS.SCHEMA_MAX} characters`)
  .refine(
    (text) => {
      const result = validateCsvFormat(text);
      return result.valid;
    },
    (text) => {
      const result = validateCsvFormat(text);
      return { message: result.error || "Invalid CSV format" };
    }
  )
  .nullable()
  .optional();

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

  if (headings.length === 0) {
    return { valid: false, error: "Plain Text schema must include at least one heading starting with '#'" };
  }

  if (headings[0].level !== 1) {
    return {
      valid: false,
      error: `First heading must start with a single '#'. Found level ${headings[0].level} on line ${headings[0].line}`,
    };
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
 * Create Pattern Request (with conditional validation for drafts vs published)
 */
const BaseCreatePatternSchema = z.object({
  name: PatternNameSchema,
  format: ManifestFormatSchema.optional(),
  instructions: z.string().max(PATTERN_LIMITS.INSTRUCTIONS_MAX), // Will validate minimum conditionally
  json_schema: JsonSchemaSchema,
  yaml_schema: YamlSchemaValidator,
  xml_schema: XmlSchemaValidator,
  csv_schema: CsvSchemaValidator,
  csv_delimiter: z.enum(["comma", "semicolon"]).optional().default("comma"),
  plain_text_schema: PlainTextSchemaValidator.nullable().optional(),
  model_profile: ModelProfileSchema.optional(),
  version: z.number().int().min(0).optional(), // 0 = draft, 1+ = published
  is_active: z.boolean().optional(), // false = draft, true = published
  parent_pattern_id: z.string().uuid().nullable().optional(), // Link to parent pattern for draft versioning
}).superRefine((data, ctx) => {
  // Only enforce minimum instructions for published patterns (version >= 1)
  const isDraft = data.version === 0;
  if (!isDraft && data.instructions.length < 10) {
    ctx.addIssue({
      code: z.ZodIssueCode.too_small,
      minimum: 10,
      type: "string",
      inclusive: true,
      message: "Instructions must be at least 10 characters for published patterns",
      path: ["instructions"],
    });
  }
});

export const CreatePatternSchema = BaseCreatePatternSchema.transform((data) => ({
  name: data.name,
  format: (data.format ?? "json") as ManifestFormat,
  instructions: data.instructions,
  json_schema: data.json_schema,
  yaml_schema: data.yaml_schema,
  xml_schema: data.xml_schema,
  csv_schema: data.csv_schema,
  csv_delimiter: data.csv_delimiter ?? "comma",
  plain_text_schema: data.plain_text_schema,
  model_profile: data.model_profile ?? "managed-default",
  version: data.version, // Pass through version (0 for drafts)
  is_active: data.is_active, // Pass through is_active (false for drafts)
  parent_pattern_id: data.parent_pattern_id, // Pass through parent pattern ID for draft versioning
})).openapi('CreatePatternRequest', {
  description: 'Request body for creating a new pattern',
  example: {
    name: 'Product Extraction',
    format: 'json',
    instructions: 'Extract product name, brand, price, and availability from product images',
    json_schema: {
      type: 'object',
      properties: {
        product_name: { type: 'string' },
        brand: { type: 'string' },
        price: { type: 'number' },
        in_stock: { type: 'boolean' }
      },
      required: ['product_name'],
      additionalProperties: false
    },
    model_profile: 'managed-default'
  }
});

export type CreatePatternInput = {
  name: string;
  format: ManifestFormat;
  instructions: string;
  json_schema?: Record<string, unknown> | null;
  yaml_schema?: string | null;
  xml_schema?: string | null;
  csv_schema?: string | null;
  csv_delimiter: "comma" | "semicolon";
  plain_text_schema?: string | null;
  model_profile: string;
  version?: number; // 0 = draft, 1+ = published versions
  is_active?: boolean; // false = draft, true = published
  parent_pattern_id?: string | null; // Link to parent pattern for draft versioning
};

/**
 * Update Pattern Request
 */
export const UpdatePatternSchema = z.object({
  name: PatternNameSchema.optional(),
  format: ManifestFormatSchema.optional(),
  instructions: InstructionsSchema.optional(),
  json_schema: JsonSchemaSchema,
  yaml_schema: YamlSchemaValidator,
  xml_schema: XmlSchemaValidator,
  csv_schema: CsvSchemaValidator,
  csv_delimiter: z.enum(["comma", "semicolon"]).optional(),
  plain_text_schema: PlainTextSchemaValidator.optional(),
  is_active: z.boolean().optional(),
  publish_new_version: z.boolean().optional().default(false),
}).openapi('UpdatePatternRequest', {
  description: 'Request body for updating an existing pattern',
  example: {
    name: 'Updated Product Extraction',
    instructions: 'Extract product name, brand, price, stock status, and product condition',
    is_active: true
  }
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
  csv_delimiter: z.enum(["comma", "semicolon"]).optional(),
  plain_text_schema: z.string().nullable().optional(),
  instructions: z.string(),
  model_profile: z.string(),
  version: z.number().int().positive(),
  is_active: z.boolean(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  parent_pattern_id: z.string().uuid().nullable().optional(), // Link to parent pattern for draft versioning
}).openapi('Pattern', {
  description: 'Pattern entity representing an image analysis configuration',
  example: {
    id: '550e8400-e29b-41d4-a716-446655440000',
    user_id: '660e8400-e29b-41d4-a716-446655440000',
    name: 'Product Extraction',
    format: 'json',
    json_schema: {
      type: 'object',
      properties: {
        product_name: { type: 'string' },
        brand: { type: 'string' },
        price: { type: 'number' }
      }
    },
    instructions: 'Extract product details from images',
    model_profile: 'managed-default',
    version: 1,
    is_active: true,
    created_at: '2025-01-15T10:00:00Z',
    updated_at: '2025-01-15T10:00:00Z',
    parent_pattern_id: null
  }
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
