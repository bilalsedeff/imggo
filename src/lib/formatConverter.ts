/**
 * Format Converter - Convert JSON manifest to different formats
 * Supports: JSON, YAML, XML, CSV, TEXT
 */

import yaml from "js-yaml";
import { json2xml } from "xml-js";
import { Parser } from "json2csv";

export type ManifestFormat = "json" | "yaml" | "xml" | "csv" | "text";

/**
 * Convert JSON manifest to specified format
 *
 * @param manifest - JSON manifest object
 * @param format - Target format
 * @returns Formatted string
 */
export function convertManifest(
  manifest: Record<string, unknown>,
  format: ManifestFormat
): string {
  switch (format) {
    case "json":
      return JSON.stringify(manifest, null, 2);

    case "yaml":
      return convertToYAML(manifest);

    case "xml":
      return convertToXML(manifest);

    case "csv":
      return convertToCSV(manifest);

    case "text":
      return convertToText(manifest);

    default:
      // Fallback to JSON
      return JSON.stringify(manifest, null, 2);
  }
}

/**
 * Convert JSON to YAML
 */
function convertToYAML(manifest: Record<string, unknown>): string {
  try {
    return yaml.dump(manifest, {
      indent: 2,
      lineWidth: -1, // No line wrapping
      noRefs: true,
    });
  } catch (error) {
    throw new Error(`Failed to convert to YAML: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Convert JSON to XML
 */
function convertToXML(manifest: Record<string, unknown>): string {
  try {
    const wrapped = {
      manifest,
    };

    const xml = json2xml(JSON.stringify(wrapped), {
      compact: true,
      spaces: 2,
      ignoreComment: true,
      ignoreDeclaration: false,
    });

    return `<?xml version="1.0" encoding="UTF-8"?>\n${xml}`;
  } catch (error) {
    throw new Error(`Failed to convert to XML: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Convert JSON to CSV
 * Handles both rows-based format (from CSV schema inference) and flat objects
 */
function convertToCSV(manifest: Record<string, unknown>): string {
  try {
    // NEW CSV FORMAT: If manifest has "rows" array, use it directly
    if (manifest.rows && Array.isArray(manifest.rows) && manifest.rows.length > 0) {
      const rows = manifest.rows as Record<string, unknown>[];

      // Extract all unique keys from all rows
      const allKeys = new Set<string>();
      rows.forEach(row => {
        Object.keys(row).forEach(key => allKeys.add(key));
      });

      const fields = Array.from(allKeys);

      const parser = new Parser({
        fields,
        header: true,
      });

      return parser.parse(rows);
    }

    // LEGACY FORMAT: Flatten nested objects for backward compatibility
    const flattened = flattenObject(manifest);

    // Convert to array of objects for CSV
    const data = Object.entries(flattened).map(([key, value]) => ({
      field: key,
      value: String(value),
    }));

    const parser = new Parser({
      fields: ["field", "value"],
      header: true,
    });

    return parser.parse(data);
  } catch (error) {
    throw new Error(`Failed to convert to CSV: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Convert JSON to human-readable plain text
 */
function convertToText(manifest: Record<string, unknown>): string {
  try {
    return formatAsText(manifest, 0);
  } catch (error) {
    throw new Error(`Failed to convert to TEXT: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Flatten nested object to dot notation
 * { a: { b: 1 } } → { "a.b": 1 }
 */
function flattenObject(
  obj: Record<string, unknown>,
  prefix = ""
): Record<string, unknown> {
  const flattened: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    const newKey = prefix ? `${prefix}.${key}` : key;

    if (value && typeof value === "object" && !Array.isArray(value)) {
      Object.assign(flattened, flattenObject(value as Record<string, unknown>, newKey));
    } else {
      flattened[newKey] = value;
    }
  }

  return flattened;
}

/**
 * Format object as human-readable text with indentation
 */
function formatAsText(obj: unknown, indent: number): string {
  const indentStr = "  ".repeat(indent);

  if (obj === null || obj === undefined) {
    return "null";
  }

  if (typeof obj === "boolean") {
    return obj ? "yes" : "no";
  }

  if (typeof obj === "number" || typeof obj === "string") {
    return String(obj);
  }

  if (Array.isArray(obj)) {
    if (obj.length === 0) {
      return "(none)";
    }
    return obj
      .map((item, i) => `${indentStr}- ${formatAsText(item, indent + 1)}`)
      .join("\n");
  }

  if (typeof obj === "object") {
    const entries = Object.entries(obj as Record<string, unknown>);
    if (entries.length === 0) {
      return "(empty)";
    }

    return entries
      .map(([key, value]) => {
        const formattedKey = key.replace(/_/g, " ");
        const formattedValue = formatAsText(value, indent + 1);

        // If value is multiline, put it on next line
        if (formattedValue.includes("\n")) {
          return `${indentStr}${formattedKey}:\n${formattedValue}`;
        }

        return `${indentStr}${formattedKey}: ${formattedValue}`;
      })
      .join("\n");
  }

  return String(obj);
}

/**
 * Get content type for format
 */
export function getContentType(format: ManifestFormat): string {
  switch (format) {
    case "json":
      return "application/json";
    case "yaml":
      return "application/x-yaml";
    case "xml":
      return "application/xml";
    case "csv":
      return "text/csv";
    case "text":
      return "text/plain";
    default:
      return "application/json";
  }
}
