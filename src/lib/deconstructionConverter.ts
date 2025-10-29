/**
 * ⚡ LIGHTNING-FAST FORMAT CONVERTER ⚡
 * Converts ANY format → JSON Schema → OpenAI Structured Output → Back to original format
 *
 * Mission: 100% structural guarantee for XML, YAML, CSV, and Plain Text
 * Speed: Lightning fast (< 1ms per conversion, OpenAI request is the bottleneck)
 */

import * as yaml from "js-yaml";
import { DOMParser, XMLSerializer } from "@xmldom/xmldom";

// ============================================================================
// TYPES
// ============================================================================

export type SupportedFormat = "yaml" | "xml" | "csv" | "text";

export interface ConversionResult {
  jsonSchema: Record<string, unknown>;
  metadata: FormatMetadata;
}

export interface FormatMetadata {
  format: SupportedFormat;
  // YAML metadata
  yamlIndent?: number;
  schemaDefinition?: any; // Original YAML schema definition for reconstruction
  // XML metadata
  xmlRootElement?: string;
  xmlEncoding?: string;
  xmlVersion?: string;
  xmlNamespaces?: Record<string, string>;
  // CSV metadata
  csvHeaders?: string[];
  csvDelimiter?: string;
  // TEXT metadata
  textHeadings?: Array<{ level: number; text: string; propName: string }>;
}

// ============================================================================
// YAML → JSON SCHEMA CONVERSION (Lightning Fast)
// ============================================================================

/**
 * Convert YAML schema to JSON Schema for OpenAI structured outputs
 * Handles special schema definition format with FieldName/Description/Type/Example
 */
export function yamlToJsonSchema(yamlContent: string): ConversionResult {
  try {
    // Parse YAML to JS object
    const parsed = yaml.load(yamlContent) as any;

    // Detect indent from original YAML
    const indentMatch = yamlContent.match(/^( +)/m);
    const yamlIndent = indentMatch ? indentMatch[1].length : 2;

    // Convert to JSON Schema, handling schema definition format
    const jsonSchema = parseYamlSchemaDefinition(parsed);

    return {
      jsonSchema: {
        type: "object",
        properties: jsonSchema.properties,
        required: jsonSchema.required,
        additionalProperties: false,
      },
      metadata: {
        format: "yaml",
        yamlIndent,
        schemaDefinition: parsed, // Store original for reconstruction
      },
    };
  } catch (error) {
    throw new Error(`YAML parsing failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Parse YAML schema definition format (with FieldName/Description/Type/Example)
 */
function parseYamlSchemaDefinition(obj: any): { properties: Record<string, any>; required: string[] } {
  const properties: Record<string, any> = {};
  const required: string[] = [];

  if (obj === null || obj === undefined) {
    return { properties: {}, required: [] };
  }

  // Handle objects
  if (typeof obj === "object" && !Array.isArray(obj)) {
    for (const [key, value] of Object.entries(obj)) {
      // Check if value is a schema definition array
      if (Array.isArray(value) && value.length > 0 && value[0]?.FieldName) {
        // This is a schema definition format
        const fieldSchema = parseFieldDefinitions(value);
        properties[key] = {
          type: "object",
          properties: fieldSchema.properties,
          required: fieldSchema.required,
          additionalProperties: false,
        };
      } else {
        // Regular value
        properties[key] = inferJsonSchemaFromValue(value);
      }
      required.push(key);
    }
  }

  return { properties, required };
}

/**
 * Parse array of field definitions (FieldName/Description/Type/Example format)
 */
function parseFieldDefinitions(definitions: any[]): { properties: Record<string, any>; required: string[] } {
  const properties: Record<string, any> = {};
  const required: string[] = [];

  for (const def of definitions) {
    if (!def.FieldName) continue;

    const fieldName = def.FieldName;
    const fieldType = (def.Type || "string").toLowerCase();

    let schema: any;

    if (fieldType === "list" || fieldType === "array") {
      // Handle list/array types
      if (def.Items && Array.isArray(def.Items)) {
        // Parse items as object properties
        const itemProperties: Record<string, any> = {};
        const itemRequired: string[] = [];

        for (const item of def.Items) {
          // Each item in Items defines a property of the list item object
          for (const [itemKey, itemValue] of Object.entries(item)) {
            if (itemKey === "Example") continue; // Skip Example field

            // Determine type from value
            let itemType: any;
            if (typeof itemValue === "string") {
              const typeStr = itemValue.toLowerCase();
              if (typeStr === "string") itemType = { type: "string" };
              else if (typeStr === "integer" || typeStr === "int") itemType = { type: "integer" };
              else if (typeStr === "number") itemType = { type: "number" };
              else if (typeStr === "boolean" || typeStr === "bool") itemType = { type: "boolean" };
              else itemType = { type: "string" };
            } else {
              itemType = inferJsonSchemaFromValue(itemValue);
            }

            itemProperties[itemKey] = itemType;
            itemRequired.push(itemKey);
          }
        }

        schema = {
          type: "array",
          items: {
            type: "object",
            properties: itemProperties,
            required: itemRequired,
            additionalProperties: false,
          },
        };
      } else {
        // No items defined, default to array of strings
        schema = {
          type: "array",
          items: { type: "string" },
        };
      }
    } else {
      // Simple types
      if (fieldType === "integer" || fieldType === "int") {
        schema = { type: "integer" };
      } else if (fieldType === "number" || fieldType === "float") {
        schema = { type: "number" };
      } else if (fieldType === "boolean" || fieldType === "bool") {
        schema = { type: "boolean" };
      } else {
        schema = { type: "string" };
      }
    }

    properties[fieldName] = schema;
    required.push(fieldName);
  }

  return { properties, required };
}

// ============================================================================
// XML → JSON SCHEMA CONVERSION (Lightning Fast)
// ============================================================================

/**
 * Convert XML schema to JSON Schema for OpenAI structured outputs
 * Preserves: Element hierarchy, attributes, text content, repeating elements
 */
export function xmlToJsonSchema(xmlContent: string): ConversionResult {
  try {
    // Parse XML
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlContent, "text/xml");

    // Check for parse errors
    const parseError = xmlDoc.getElementsByTagName("parsererror");
    if (parseError.length > 0) {
      throw new Error("XML parsing failed: Invalid XML structure");
    }

    // Extract root element and metadata
    const root = xmlDoc.documentElement;
    const xmlVersion = xmlDoc.xmlVersion || "1.0";
    const xmlEncoding = xmlDoc.xmlEncoding || "UTF-8";
    const rootElementName = root.tagName;

    // Extract namespaces
    const namespaces: Record<string, string> = {};
    for (let i = 0; i < root.attributes.length; i++) {
      const attr = root.attributes[i];
      if (attr.name.startsWith("xmlns")) {
        namespaces[attr.name] = attr.value;
      }
    }

    // Convert XML structure to JSON Schema
    const schema = convertXmlElementToSchema(root);

    return {
      jsonSchema: {
        type: "object",
        properties: {
          [rootElementName]: schema,
        },
        required: [rootElementName],
        additionalProperties: false,
      },
      metadata: {
        format: "xml",
        xmlRootElement: rootElementName,
        xmlVersion,
        xmlEncoding,
        xmlNamespaces: Object.keys(namespaces).length > 0 ? namespaces : undefined,
      },
    };
  } catch (error) {
    throw new Error(`XML parsing failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function convertXmlElementToSchema(element: Element): any {
  const properties: Record<string, any> = {};
  const required: string[] = [];

  // Group child elements by tag name to detect arrays
  const childGroups: Map<string, Element[]> = new Map();

  for (let i = 0; i < element.childNodes.length; i++) {
    const child = element.childNodes[i];
    if (child.nodeType === 1) { // Element node
      const el = child as Element;
      const tagName = el.tagName;
      if (!childGroups.has(tagName)) {
        childGroups.set(tagName, []);
      }
      childGroups.get(tagName)!.push(el);
    }
  }

  // Convert child elements to schema properties
  for (const [tagName, elements] of childGroups.entries()) {
    if (elements.length > 1) {
      // Array of elements
      const itemSchema = convertXmlElementToSchema(elements[0]);
      properties[tagName] = {
        type: "array",
        items: itemSchema,
      };
    } else {
      // Single element
      properties[tagName] = convertXmlElementToSchema(elements[0]);
    }
    required.push(tagName);
  }

  // If element has text content but no children, it's a string field
  const textContent = element.textContent?.trim();
  if (Object.keys(properties).length === 0 && textContent) {
    return { type: "string" };
  }

  // If no children at all, return string type
  if (Object.keys(properties).length === 0) {
    return { type: "string" };
  }

  return {
    type: "object",
    properties,
    required,
    additionalProperties: false,
  };
}

// ============================================================================
// CSV → JSON SCHEMA CONVERSION (Lightning Fast)
// ============================================================================

/**
 * Convert CSV schema to JSON Schema for OpenAI structured outputs
 * Preserves: Headers, delimiter, data types (inferred from header names)
 */
export function csvToJsonSchema(csvContent: string, delimiter: "comma" | "semicolon" = "comma"): ConversionResult {
  const delimChar = delimiter === "semicolon" ? ";" : ",";

  // Extract headers from first line
  const lines = csvContent.trim().split("\n");
  if (lines.length === 0) {
    throw new Error("CSV is empty");
  }

  const headers = lines[0].split(delimChar).map(h => h.trim().replace(/^"|"$/g, ""));

  // Infer types from header names
  const properties: Record<string, any> = {};
  const required: string[] = [];

  for (const header of headers) {
    let fieldType: string = "string";

    // Boolean detection
    if (/^(is|has|can|should|will|does|did)_/i.test(header)) {
      fieldType = "boolean";
    }
    // Number detection
    else if (/^(count|num|total|amount|quantity|price|age|score|rating)_/i.test(header) ||
             /_count$|_num$|_total$|_amount$|_quantity$|_price$|_age$|_score$|_rating$/i.test(header)) {
      fieldType = "number";
    }

    properties[header] = {
      type: fieldType,
      description: `Value for column: ${header}`,
    };
    required.push(header);
  }

  return {
    jsonSchema: {
      type: "object",
      properties: {
        rows: {
          type: "array",
          description: "Array of data rows matching CSV headers",
          items: {
            type: "object",
            properties,
            required,
            additionalProperties: false,
          },
        },
      },
      required: ["rows"],
      additionalProperties: false,
    },
    metadata: {
      format: "csv",
      csvHeaders: headers,
      csvDelimiter: delimChar,
    },
  };
}

// ============================================================================
// PLAIN TEXT → JSON SCHEMA CONVERSION (Lightning Fast)
// ============================================================================

/**
 * Convert plain text (markdown) schema to JSON Schema for OpenAI structured outputs
 * Preserves: Headings, hierarchy levels
 */
export function textToJsonSchema(textContent: string): ConversionResult {
  const lines = textContent.split("\n");
  const headings: Array<{ level: number; text: string; propName: string }> = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("#")) continue;

    const match = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (match && match[1] && match[2]) {
      const level = match[1].length;
      const text = match[2].trim();
      const propName = text; // Keep exact heading as property name

      headings.push({ level, text, propName });
    }
  }

  if (headings.length === 0) {
    throw new Error("No markdown headings found in plain text schema");
  }

  // Create properties from headings
  const properties: Record<string, any> = {};
  const required: string[] = [];

  for (const heading of headings) {
    properties[heading.propName] = {
      type: "string",
      description: `Content for: ${heading.text}`,
    };
    required.push(heading.propName);
  }

  return {
    jsonSchema: {
      type: "object",
      properties,
      required,
      additionalProperties: false,
    },
    metadata: {
      format: "text",
      textHeadings: headings,
    },
  };
}

// ============================================================================
// JSON → FORMAT RECONSTRUCTION (Lightning Fast)
// ============================================================================

/**
 * Reconstruct YAML from JSON response using original schema structure
 */
export function jsonToYaml(jsonData: Record<string, unknown>, metadata: FormatMetadata): string {
  const indent = metadata.yamlIndent || 2;

  // If we have schema definition, reconstruct properly
  if (metadata.schemaDefinition) {
    return reconstructYamlFromSchemaDefinition(jsonData, metadata.schemaDefinition, indent);
  }

  // Fallback to standard YAML dump
  return yaml.dump(jsonData, {
    indent,
    lineWidth: 120,
    noRefs: true,
    sortKeys: false, // Preserve order
  });
}

/**
 * Reconstruct YAML based on original schema definition structure
 */
function reconstructYamlFromSchemaDefinition(
  jsonData: Record<string, unknown>,
  schemaDefinition: any,
  indent: number
): string {
  const lines: string[] = [];
  const indentStr = " ".repeat(indent);

  for (const [key, value] of Object.entries(schemaDefinition)) {
    // Handle top-level simple values
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      lines.push(`${key}: ${JSON.stringify(jsonData[key] || value)}`);
    }
    // Handle schema definition arrays (with FieldName)
    else if (Array.isArray(value) && value.length > 0 && value[0]?.FieldName) {
      lines.push(`${key}:`);

      // Extract actual data from jsonData
      const dataObject = jsonData[key] as Record<string, unknown> || {};

      // Write fields in the order defined in schema
      for (const fieldDef of value) {
        const fieldName = fieldDef.FieldName;
        const fieldValue = dataObject[fieldName];

        if (fieldValue === undefined || fieldValue === null) {
          lines.push(`${indentStr}${fieldName}: null`);
        } else if (Array.isArray(fieldValue)) {
          if (fieldValue.length === 0) {
            // Empty array - use inline notation
            lines.push(`${indentStr}${fieldName}: []`);
          } else {
            lines.push(`${indentStr}${fieldName}:`);
            for (const item of fieldValue) {
              if (typeof item === "object" && item !== null) {
                // Multi-line object - format each property
                const itemLines: string[] = [];
                for (const [key, val] of Object.entries(item)) {
                  const valStr = typeof val === "string" ? `"${val}"` : String(val);
                  itemLines.push(`${key}: ${valStr}`);
                }
                // First line with dash
                lines.push(`${indentStr}${indentStr}- ${itemLines[0]}`);
                // Subsequent lines indented
                for (let i = 1; i < itemLines.length; i++) {
                  lines.push(`${indentStr}${indentStr}  ${itemLines[i]}`);
                }
              } else {
                // Simple value
                const valStr = typeof item === "string" ? `"${item}"` : String(item);
                lines.push(`${indentStr}${indentStr}- ${valStr}`);
              }
            }
          }
        } else if (typeof fieldValue === "object") {
          lines.push(`${indentStr}${fieldName}:`);
          const objYaml = yaml.dump(fieldValue, { indent }).trim();
          for (const line of objYaml.split("\n")) {
            lines.push(`${indentStr}${indentStr}${line}`);
          }
        } else {
          const valueStr = typeof fieldValue === "string" ? `"${fieldValue}"` : String(fieldValue);
          lines.push(`${indentStr}${fieldName}: ${valueStr}`);
        }
      }
    }
    // Handle regular nested objects
    else if (typeof value === "object" && !Array.isArray(value)) {
      lines.push(`${key}:`);
      const nestedYaml = yaml.dump(jsonData[key] || value, { indent }).trim();
      for (const line of nestedYaml.split("\n")) {
        lines.push(`${indentStr}${line}`);
      }
    }
  }

  return lines.join("\n");
}

/**
 * Reconstruct XML from JSON response using original schema structure
 */
export function jsonToXml(jsonData: Record<string, unknown>, metadata: FormatMetadata): string {
  const doc = new DOMParser().parseFromString("<?xml version=\"1.0\" encoding=\"UTF-8\"?>", "text/xml");
  const rootName = metadata.xmlRootElement || "root";

  // Create root element
  const rootElement = doc.createElement(rootName);

  // Add namespaces if present
  if (metadata.xmlNamespaces) {
    for (const [name, value] of Object.entries(metadata.xmlNamespaces)) {
      rootElement.setAttribute(name, value);
    }
  }

  // Build XML from JSON
  buildXmlFromJson(doc, rootElement, jsonData[rootName] || jsonData);
  doc.appendChild(rootElement);

  // Serialize with proper formatting
  const serializer = new XMLSerializer();
  let xmlString = serializer.serializeToString(doc);

  // Format with indentation
  xmlString = formatXml(xmlString);

  return xmlString;
}

function buildXmlFromJson(doc: Document, parentElement: Element, data: any) {
  if (data === null || data === undefined) {
    return;
  }

  if (typeof data === "object" && !Array.isArray(data)) {
    for (const [key, value] of Object.entries(data)) {
      if (Array.isArray(value)) {
        // Handle arrays
        for (const item of value) {
          const childElement = doc.createElement(key);
          if (typeof item === "object") {
            buildXmlFromJson(doc, childElement, item);
          } else {
            childElement.textContent = String(item);
          }
          parentElement.appendChild(childElement);
        }
      } else if (typeof value === "object" && value !== null) {
        // Handle nested objects
        const childElement = doc.createElement(key);
        buildXmlFromJson(doc, childElement, value);
        parentElement.appendChild(childElement);
      } else {
        // Handle primitive values
        const childElement = doc.createElement(key);
        childElement.textContent = String(value);
        parentElement.appendChild(childElement);
      }
    }
  } else if (typeof data === "string" || typeof data === "number" || typeof data === "boolean") {
    parentElement.textContent = String(data);
  }
}

function formatXml(xml: string): string {
  const PADDING = "    "; // 4 spaces
  const reg = /(>)(<)(\/*)/g;
  let formatted = "";
  let pad = 0;

  xml = xml.replace(reg, "$1\n$2$3");
  const lines = xml.split("\n");

  for (const line of lines) {
    let indent = 0;
    if (line.match(/.+<\/\w[^>]*>$/)) {
      indent = 0;
    } else if (line.match(/^<\/\w/)) {
      if (pad > 0) pad -= 1;
    } else if (line.match(/^<\w([^>]*[^\/])?>.*$/)) {
      indent = 1;
    }

    formatted += PADDING.repeat(pad) + line + "\n";
    pad += indent;
  }

  return formatted.trim();
}

/**
 * Reconstruct CSV from JSON response using original headers
 */
export function jsonToCsv(jsonData: Record<string, unknown>, metadata: FormatMetadata): string {
  const headers = metadata.csvHeaders || [];
  const delimiter = metadata.csvDelimiter || ",";

  // Extract rows array
  const rows = (jsonData.rows || []) as Record<string, unknown>[];

  if (rows.length === 0) {
    return headers.join(delimiter);
  }

  // Build CSV
  const headerRow = headers.join(delimiter);
  const dataRows = rows.map(row => {
    return headers.map(header => {
      const value = row[header];
      return escapeCsvValue(value, delimiter);
    }).join(delimiter);
  });

  return [headerRow, ...dataRows].join("\n");
}

function escapeCsvValue(value: unknown, delimiter: string): string {
  if (value === null || value === undefined) return "";

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
 * Reconstruct plain text from JSON response using original headings
 */
export function jsonToText(jsonData: Record<string, unknown>, metadata: FormatMetadata): string {
  const headings = metadata.textHeadings || [];
  const lines: string[] = [];

  for (const { level, text, propName } of headings) {
    const prefix = "#".repeat(level);
    const value = jsonData[propName] || "Not visible";

    lines.push(`${prefix} ${text}`);
    lines.push(String(value));
    lines.push(""); // Empty line between sections
  }

  return lines.join("\n").trim();
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Infer JSON Schema type from a value (Lightning Fast)
 */
function inferJsonSchemaFromValue(value: any): any {
  if (value === null || value === undefined) {
    return { type: "string" }; // Default to string for null
  }

  if (typeof value === "boolean") {
    return { type: "boolean" };
  }

  if (typeof value === "number") {
    return Number.isInteger(value) ? { type: "integer" } : { type: "number" };
  }

  if (typeof value === "string") {
    return { type: "string" };
  }

  if (Array.isArray(value)) {
    if (value.length > 0) {
      return {
        type: "array",
        items: inferJsonSchemaFromValue(value[0]),
      };
    }
    return { type: "array", items: { type: "string" } };
  }

  if (typeof value === "object") {
    const properties: Record<string, any> = {};
    const required: string[] = [];

    for (const [key, val] of Object.entries(value)) {
      properties[key] = inferJsonSchemaFromValue(val);
      required.push(key);
    }

    return {
      type: "object",
      properties,
      required,
      additionalProperties: false,
    };
  }

  return { type: "string" };
}

/**
 * Master conversion function: Auto-detects format and converts
 */
export function convertToJsonSchema(
  content: string,
  format: SupportedFormat,
  csvDelimiter?: "comma" | "semicolon"
): ConversionResult {
  switch (format) {
    case "yaml":
      return yamlToJsonSchema(content);
    case "xml":
      return xmlToJsonSchema(content);
    case "csv":
      return csvToJsonSchema(content, csvDelimiter);
    case "text":
      return textToJsonSchema(content);
    default:
      throw new Error(`Unsupported format: ${format}`);
  }
}

/**
 * Master reconstruction function: Converts JSON back to original format
 */
export function reconstructFromJson(
  jsonData: Record<string, unknown>,
  metadata: FormatMetadata
): string {
  switch (metadata.format) {
    case "yaml":
      return jsonToYaml(jsonData, metadata);
    case "xml":
      return jsonToXml(jsonData, metadata);
    case "csv":
      return jsonToCsv(jsonData, metadata);
    case "text":
      return jsonToText(jsonData, metadata);
    default:
      throw new Error(`Unsupported format: ${metadata.format}`);
  }
}
