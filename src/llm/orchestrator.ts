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
 * Infer manifest from image
 */
export async function inferManifest(params: {
  imageUrl: string;
  instructions: string;
  format: ManifestFormat;
  jsonSchema?: Record<string, unknown>;
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
    modelProfile = "managed-default",
  } = params;

  try {
    // Always infer as JSON first (structured)
    const result =
      modelProfile === "oss-detector"
        ? await oss.inferManifestOSS(imageUrl, instructions, "json", jsonSchema)
        : await openai.inferManifest(imageUrl, instructions, "json", jsonSchema);

    // Convert to requested format
    const manifestString =
      format === "json"
        ? JSON.stringify(result.manifest, null, 2)
        : convertFormat(result.manifest, format);

    return {
      manifest: result.manifest,
      manifestString,
      latencyMs: result.latencyMs,
      tokensUsed: result.tokensUsed,
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

function arrayToCSV(items: Record<string, unknown>[]): string {
  if (items.length === 0) return "";

  const keys = Object.keys(items[0] || {});
  const header = keys.join(",");
  const rows = items.map((item) =>
    keys.map((key) => escapeCsvValue(item[key])).join(",")
  );

  return [header, ...rows].join("\n");
}

function escapeCsvValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
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
