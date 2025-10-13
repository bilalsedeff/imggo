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
    // Generate as JSON first (structured)
    const jsonTemplate =
      modelProfile === "oss-detector"
        ? await oss.generateTemplateOSS(instructions, "json")
        : await openai.generateTemplate(instructions, "json", jsonSchema);

    // Convert to requested format
    if (format === "json") {
      return jsonTemplate;
    }

    // Parse JSON and convert
    const parsed = JSON.parse(jsonTemplate);
    return convertFormat(parsed, format);
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
        csvDelimiter
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

    // YAML: Parse user's YAML template and extract schema
    if (format === "yaml" && yamlSchema) {
      try {
        const parsedYaml = yaml.load(yamlSchema) as Record<string, unknown>;
        effectiveJsonSchema = parsedYaml; // Use parsed YAML as JSON schema template
        logger.info("Using YAML schema for inference", {
          schema_keys: Object.keys(parsedYaml),
        });
      } catch (error) {
        logger.warn("Failed to parse YAML schema, falling back to json_schema", { error });
      }
    }

    // XML: Parse user's XML template and extract schema
    if (format === "xml" && xmlSchema) {
      try {
        const parsedXml = xmlJs.xml2js(xmlSchema, { compact: true }) as Record<string, unknown>;
        effectiveJsonSchema = parsedXml; // Use parsed XML as JSON schema template
        logger.info("Using XML schema for inference", {
          schema_keys: Object.keys(parsedXml),
        });
      } catch (error) {
        logger.warn("Failed to parse XML schema, falling back to json_schema", { error });
      }
    }

    // Plain Text: Extract headings from markdown template
    if (format === "text" && plainTextSchema) {
      try {
        const headings = extractMarkdownHeadings(plainTextSchema);
        // Create JSON schema from headings
        const properties: Record<string, unknown> = {};
        headings.forEach(heading => {
          const key = heading.text.toLowerCase().replace(/[^a-z0-9]/g, '_');
          properties[key] = {
            type: "string",
            description: heading.text
          };
        });
        effectiveJsonSchema = {
          type: "object",
          properties,
          required: Object.keys(properties),
          additionalProperties: false
        };
        logger.info("Using Plain Text schema for inference", {
          headings: headings.map(h => h.text),
        });
      } catch (error) {
        logger.warn("Failed to parse Plain Text schema, falling back to json_schema", { error });
      }
    }

    // Infer as JSON with effective schema
    result =
      modelProfile === "oss-detector"
        ? await oss.inferManifestOSS(imageUrl, instructions, "json", effectiveJsonSchema)
        : await openai.inferManifest(imageUrl, instructions, "json", effectiveJsonSchema);

    // Convert to requested format
    const manifestString =
      format === "json"
        ? JSON.stringify(result.manifest, null, 2)
        : convertFormat(result.manifest, format);

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
      // Convert header to property name (same logic as in openai.ts)
      const propName = header.toLowerCase().replace(/[^a-z0-9]/g, '_');
      const value = row[propName];
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
