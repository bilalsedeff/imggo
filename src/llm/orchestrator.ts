/**
 * LLM Orchestrator for ImgGo
 * Routes requests to appropriate provider and handles format conversion
 */

import { ManifestFormat } from "@/schemas/pattern";
import * as openai from "./providers/openai";
import * as oss from "./providers/oss";
import { logger } from "@/lib/logger";
import * as yaml from "js-yaml";
import * as xmlJs from "xml-js";
import { validateXmlStructure } from "./validators/xmlValidator";
import { validateYamlStructure } from "./validators/yamlValidator";
import { validatePlainTextStructure } from "./validators/plainTextValidator";

export type ModelProfile = "managed-default" | "oss-detector";

/**
 * Generate template based on pattern
 */
export async function generateTemplate(
  instructions: string,
  format: ManifestFormat,
  jsonSchema?: Record<string, unknown>,
  modelProfile: ModelProfile = "managed-default"
): Promise<string> {
  try {
    // For CSV, YAML, XML, and Plain Text - generate directly in target format
    // JSON conversion doesn't work well for these formats
    if (format === "csv" || format === "yaml" || format === "xml" || format === "text") {
      return modelProfile === "oss-detector"
        ? await oss.generateTemplateOSS(instructions, format)
        : await openai.generateTemplate(instructions, format, jsonSchema);
    }

    // For JSON - generate as JSON
    const jsonTemplate =
      modelProfile === "oss-detector"
        ? await oss.generateTemplateOSS(instructions, "json")
        : await openai.generateTemplate(instructions, "json", jsonSchema);

    return jsonTemplate;
  } catch (error) {
    logger.error("Template generation failed in orchestrator", error);
    throw error;
  }
}

/**
 * Infer manifest from image - DIVINE RULE: Always use user's approved schema
 */
export async function inferManifest(params: {
  imageUrl: string;
  imageFilename?: string;
  instructions: string;
  format: ManifestFormat;
  jsonSchema?: Record<string, unknown>;
  csvSchema?: string;
  csvDelimiter?: "comma" | "semicolon";
  yamlSchema?: string;
  xmlSchema?: string;
  plainTextSchema?: string;
  modelProfile?: ModelProfile;
}): Promise<{
  manifest: Record<string, unknown>;
  manifestString: string;
  latencyMs: number;
  tokensUsed?: number;
}> {
  const {
    imageUrl,
    imageFilename,
    instructions,
    format,
    jsonSchema,
    csvSchema,
    csvDelimiter,
    yamlSchema,
    xmlSchema,
    plainTextSchema,
    modelProfile = "managed-default",
  } = params;

  try {
    // DIVINE RULE ENFORCEMENT: Use format-specific schema
    let effectiveJsonSchema = jsonSchema;
    let result: { manifest: Record<string, unknown>; latencyMs: number; tokensUsed?: number };

    // CSV: Parse headers and create schema
    if (format === "csv" && csvSchema) {
      result = await openai.inferManifest(
        imageUrl,
        instructions,
        format,
        jsonSchema,
        csvSchema,
        csvDelimiter,
        imageFilename
      );

      const delimiter = csvDelimiter === "semicolon" ? ";" : ",";
      const manifestString = convertToCSVWithSchema(result.manifest, csvSchema, delimiter);

      return {
        manifest: result.manifest,
        manifestString,
        latencyMs: result.latencyMs,
        tokensUsed: result.tokensUsed,
      };
    }

    // YAML: Keep original YAML schema for the provider (don't convert to JSON)
    if (format === "yaml" && yamlSchema) {
      effectiveJsonSchema = yamlSchema as unknown as Record<string, unknown>; // Pass raw YAML string
      logger.info("Using YAML schema for inference", {
        schema_length: yamlSchema.length,
        schema_preview: yamlSchema.substring(0, 100),
      });
    }

    // XML: Keep original XML schema for the provider (don't convert to JSON)
    if (format === "xml" && xmlSchema) {
      effectiveJsonSchema = xmlSchema as unknown as Record<string, unknown>; // Pass raw XML string
      logger.info("Using XML schema for inference", {
        schema_length: xmlSchema.length,
        schema_preview: xmlSchema.substring(0, 100),
      });
    }

    // Plain Text: Pass directly to provider for special handling
    if (format === "text" && plainTextSchema) {
      logger.info("Using Plain Text schema for inference (direct handling)", {
        has_plain_text_schema: true,
      });

      // Call openai provider with plainTextSchema for special template preservation
      result = await openai.inferManifest(
        imageUrl,
        instructions,
        "text",
        undefined,
        undefined,
        undefined,
        imageFilename,
        plainTextSchema
      );

      // Extract the text from the wrapped manifest
      const textContent = typeof result.manifest === 'object' && 'text' in result.manifest
        ? (result.manifest as { text: string }).text
        : JSON.stringify(result.manifest, null, 2);

      return {
        manifest: result.manifest,
        manifestString: textContent,
        latencyMs: result.latencyMs,
        tokensUsed: result.tokensUsed,
      };
    }

    // Infer with the actual requested format
    // For XML/YAML, pass the format directly so the provider can handle it correctly
    // For CSV, pass both format and schema
    // For JSON, use structured output
    const inferFormat = (format === "xml" || format === "yaml") ? format : 
                        (format === "csv" && csvSchema) ? "csv" : 
                        "json"; // Default to JSON for unknown formats
    
    result =
      modelProfile === "oss-detector"
        ? await oss.inferManifestOSS(imageUrl, instructions, inferFormat, effectiveJsonSchema)
        : await openai.inferManifest(
            imageUrl, 
            instructions, 
            inferFormat, 
            effectiveJsonSchema, 
            csvSchema, 
            csvDelimiter, 
            imageFilename
          );

    // ===== VALIDATION LAYER FOR NON-JSON FORMATS =====
    // JSON/CSV have OpenAI Structured Output guarantees, but YAML/Plain Text need validation
    if (result.manifest && typeof result.manifest === 'object' && '_raw' in result.manifest) {
      const rawContent = (result.manifest as { _raw: string, _format: string })._raw;
      const rawFormat = (result.manifest as { _raw: string, _format: string })._format;

      // YAML Validation
      if (rawFormat === "yaml" && yamlSchema) {
        logger.info("Validating YAML structure against schema");
        const validation = validateYamlStructure(rawContent, yamlSchema);
        
        if (!validation.isValid || validation.warnings.length > 0) {
          const issues = [...validation.errors, ...validation.warnings];
          throw new Error(
            `YAML schema mismatch: ${issues.length > 0 ? issues.join("; ") : "Unknown mismatch"}`
          );
        }

        logger.info("YAML validation passed");
      }

      // Plain Text Validation
      if (rawFormat === "text" && plainTextSchema) {
        logger.info("Validating Plain Text structure against schema");
        const validation = validatePlainTextStructure(rawContent, plainTextSchema);
        
        if (!validation.isValid || validation.warnings.length > 0) {
          const issues = [...validation.errors, ...validation.warnings];
          throw new Error(
            `Plain text schema mismatch: ${issues.length > 0 ? issues.join("; ") : "Unknown mismatch"}`
          );
        }

        logger.info("Plain text validation passed");
      }

      // XML Validation
      if (rawFormat === "xml" && xmlSchema) {
        logger.info("Validating XML structure against schema");
        const validation = await validateXmlStructure(rawContent, xmlSchema);
        
        if (!validation.isValid || validation.warnings.length > 0) {
          const issues = [...validation.errors, ...validation.warnings];
          throw new Error(
            `XML schema mismatch: ${issues.length > 0 ? issues.join("; ") : "Unknown mismatch"}`
          );
        }

        logger.info("XML validation passed");
      }
    }

    // Convert to requested format (if not already in correct format)
    let manifestString: string;
    if (format === "json") {
      manifestString = JSON.stringify(result.manifest, null, 2);
    } else if (format === "csv") {
      const delimiter = csvDelimiter === "semicolon" ? ";" : ",";
      if (csvSchema) {
        manifestString = convertToCSVWithSchema(
          result.manifest,
          csvSchema,
          delimiter
        );
      } else {
        manifestString = convertFormat(result.manifest, format);
      }
    } else if (format === "xml" || format === "yaml") {
      if (format === inferFormat && typeof result.manifest === "object" && "_raw" in result.manifest) {
        manifestString = (result.manifest as { _raw: string })._raw;
      } else {
        manifestString = convertFormat(result.manifest, format);
      }
    } else {
      manifestString = convertFormat(result.manifest, format);
    }

    return {
      manifest: result.manifest,
      manifestString,
      latencyMs: result.latencyMs,
      tokensUsed: "tokensUsed" in result ? (result.tokensUsed as number) : undefined,
    };
  } catch (error) {
    logger.error("Manifest inference failed in orchestrator", error, {
      image_url_hash: hashUrl(imageUrl),
      format,
    });
    throw error;
  }
}

/**
 * Extract markdown headings from plain text schema
 */
function extractMarkdownHeadings(markdown: string): Array<{ level: number; text: string }> {
  const lines = markdown.split('\n');
  const headings: Array<{ level: number; text: string }> = [];

  lines.forEach(line => {
    const trimmed = line.trim();
    const match = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (match) {
      headings.push({
        level: match[1].length,
        text: match[2].trim()
      });
    }
  });

  return headings;
}

/**
 * Convert JSON manifest to other formats
 */
export function convertFormat(
  data: Record<string, unknown>,
  format: ManifestFormat
): string {
  switch (format) {
    case "json":
      return JSON.stringify(data, null, 2);

    case "yaml":
      return yaml.dump(data, {
        indent: 2,
        lineWidth: 120,
        noRefs: true,
      });

    case "xml":
      return xmlJs.js2xml(data, {
        compact: true,
        spaces: 2,
        ignoreComment: true,
      });

    case "csv":
      return convertToCSV(data);

    case "text":
      return convertToText(data);

    default:
      throw new Error(`Unsupported format: ${format}`);
  }
}

/**
 * Convert JSON to CSV (handles flat or simple nested structures)
 */
function convertToCSV(data: Record<string, unknown>): string {
  // Handle array of objects (common case)
  if (Array.isArray(data)) {
    return arrayToCSV(data);
  }

  // Handle object with array property
  const arrayField = Object.entries(data).find(([_, value]) =>
    Array.isArray(value)
  );
  if (arrayField) {
    return arrayToCSV(arrayField[1] as Record<string, unknown>[]);
  }

  // Handle flat object (single row)
  const keys = Object.keys(data);
  const values = Object.values(data).map((v) => escapeCsvValue(v));
  return `${keys.join(",")}\n${values.join(",")}`;
}

function arrayToCSV(items: Record<string, unknown>[], delimiter: string = ","): string {
  if (items.length === 0) return "";

  const keys = Object.keys(items[0] || {});
  const header = keys.join(delimiter);
  const rows = items.map((item) =>
    keys.map((key) => escapeCsvValue(item[key], delimiter)).join(delimiter)
  );

  return [header, ...rows].join("\n");
}

function escapeCsvValue(value: unknown, delimiter: string = ","): string {
  if (value === null || value === undefined) return "";

  // Handle objects and arrays - serialize as JSON
  if (typeof value === "object") {
    const str = JSON.stringify(value);
    return `"${str.replace(/"/g, '""')}"`;
  }

  const str = String(value);
  if (str.includes(delimiter) || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Convert manifest with CSV schema to proper CSV format
 * Handles the rows array structure from AI and maps to original headers
 */
function convertToCSVWithSchema(
  manifest: Record<string, unknown>,
  csvSchema: string,
  delimiter: string
): string {
  // Extract headers from schema
  const headers = csvSchema.split('\n')[0].split(delimiter).map(h => h.trim());

  // Get rows array from manifest
  const rows = (manifest.rows || []) as Record<string, unknown>[];

  if (rows.length === 0) {
    // Return just headers if no data
    return headers.join(delimiter);
  }

  // Create header row
  const headerRow = headers.join(delimiter);

  // Create data rows
  const dataRows = rows.map(row => {
    return headers.map(header => {
      const value = (row as Record<string, unknown>)[header];
      return escapeCsvValue(value, delimiter);
    }).join(delimiter);
  });

  return [headerRow, ...dataRows].join("\n");
}

/**
 * Convert JSON to human-readable text
 */
function convertToText(data: Record<string, unknown>, indent = 0): string {
  const spacing = "  ".repeat(indent);
  const lines: string[] = [];

  for (const [key, value] of Object.entries(data)) {
    const label = key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

    if (value === null || value === undefined) {
      lines.push(`${spacing}${label}: (empty)`);
    } else if (Array.isArray(value)) {
      lines.push(`${spacing}${label}:`);
      value.forEach((item, i) => {
        if (typeof item === "object" && item !== null) {
          lines.push(`${spacing}  [${i + 1}]`);
          lines.push(convertToText(item as Record<string, unknown>, indent + 2));
        } else {
          lines.push(`${spacing}  - ${item}`);
        }
      });
    } else if (typeof value === "object") {
      lines.push(`${spacing}${label}:`);
      lines.push(convertToText(value as Record<string, unknown>, indent + 1));
    } else {
      lines.push(`${spacing}${label}: ${value}`);
    }
  }

  return lines.join("\n");
}

function hashUrl(url: string): string {
  let hash = 0;
  for (let i = 0; i < url.length; i++) {
    const char = url.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).substring(0, 8);
}
