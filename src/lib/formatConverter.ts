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
 * @param csvDelimiter - CSV delimiter ("comma" or "semicolon"), default "comma"
 * @param csvSchema - CSV schema (for field order)
 * @returns Formatted string
 */
export function convertManifest(
  manifest: Record<string, unknown>,
  format: ManifestFormat,
  csvDelimiter?: "comma" | "semicolon",
  csvSchema?: string
): string {
  // SPECIAL: If manifest contains _raw field (from XML/YAML inference), return it directly
  if ('_raw' in manifest && typeof manifest._raw === 'string') {
    return manifest._raw;
  }

  switch (format) {
    case "json":
      return JSON.stringify(manifest, null, 2);

    case "yaml":
      return convertToYAML(manifest);

    case "xml":
      return convertToXML(manifest);

    case "csv":
      return convertToCSV(manifest, csvDelimiter, csvSchema);

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
 * @param manifest - JSON manifest object
 * @param csvDelimiter - CSV delimiter ("comma" or "semicolon"), default "comma"
 * @param csvSchema - CSV schema template for field order
 */
function convertToCSV(
  manifest: Record<string, unknown>, 
  csvDelimiter?: "comma" | "semicolon",
  csvSchema?: string
): string {
  try {
    const delimiter = csvDelimiter === "semicolon" ? ";" : ",";
    
    // NEW CSV FORMAT: If manifest has "rows" array, use it directly
    if (manifest.rows && Array.isArray(manifest.rows) && manifest.rows.length > 0) {
      const rows = manifest.rows as Record<string, unknown>[];

      // Transform boolean values to "True"/"False" strings for CSV
      const transformedRows = rows.map(row => {
        const transformed: Record<string, unknown> = {};
        Object.entries(row).forEach(([key, value]) => {
          if (typeof value === 'boolean') {
            transformed[key] = value ? 'True' : 'False';
          } else {
            transformed[key] = value;
          }
        });
        return transformed;
      });

      // GET FIELD ORDER FROM CSV SCHEMA (critical for consistent column order)
      let fields: string[];
      if (csvSchema && csvSchema.trim().length > 0) {
        // Parse header row from CSV schema to get correct field order
        const headerLine = csvSchema.split('\n')[0]?.trim();
        if (headerLine) {
          const headers = headerLine.split(delimiter).map(h => 
            // Keep original field names - only remove quotes
            h.trim().replace(/^"|"$/g, '')
          );
          fields = headers;
        } else {
          // Fallback if header line is empty
          const allKeys = new Set<string>();
          transformedRows.forEach(row => {
            Object.keys(row).forEach(key => allKeys.add(key));
          });
          fields = Array.from(allKeys);
        }
      } else {
        // Fallback: extract keys from data (unreliable order, depends on JSON key order)
        const allKeys = new Set<string>();
        transformedRows.forEach(row => {
          Object.keys(row).forEach(key => allKeys.add(key));
        });
        fields = Array.from(allKeys);
      }

      const parser = new Parser({
        fields,
        header: false, // Don't include header row in response (header defined in pattern schema)
        delimiter,
      });

      return parser.parse(transformedRows);
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
      delimiter,
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
    // Special handling: If manifest is wrapped with "text" field (from plain text inference),
    // extract and return the text content directly
    if ('text' in manifest && typeof manifest.text === 'string' && Object.keys(manifest).length === 1) {
      return manifest.text;
    }

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
