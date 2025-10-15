/**
 * OpenAI provider for ImgGo - COMPLETE IMPLEMENTATION
 * All formats: JSON, Plain Text, CSV, XML, YAML with schema-exact responses
 */

import OpenAI from "openai";
import { ManifestFormat } from "@/lib/formatConverter";
import { logger } from "@/lib/logger";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const MODEL = "gpt-4o-2024-08-06"; // Supports structured outputs

export async function generateTemplate(
  instructions: string,
  format: ManifestFormat,
  jsonSchema?: Record<string, unknown>,
  csvDelimiter?: "comma" | "semicolon"
): Promise<string> {
  logger.info("Generating template with OpenAI", {
    format,
    has_schema: Boolean(jsonSchema),
    instructions_length: instructions.length
  });

  try {
    // Build system prompt based on format
    let systemPrompt = `You are an expert at creating data extraction schemas.
Generate a ${format.toUpperCase()} template/schema based on the user's instructions.
The template should define the structure for extracting data from images.`;

    // Add format-specific guidelines
    switch (format) {
      case "json":
        systemPrompt += `\n\nFor JSON:
- Create a valid JSON Schema (Draft 7) or a realistic JSON example
- Include all fields mentioned in instructions
- Use appropriate data types (string, number, boolean, array, object)
- Add descriptions for clarity
- Make it ready for image data extraction`;
        break;

      case "csv":
        systemPrompt += `\n\nFor CSV:
- Create a CSV header row with all column names
- Add 2-3 example data rows with realistic placeholder values
- Use ${csvDelimiter === "semicolon" ? "semicolon (;)" : "comma (,)"} as delimiter
- Keep it simple and tabular
- Column names should match the data fields in instructions`;
        break;

      case "yaml":
        systemPrompt += `\n\nFor YAML:
- Create a valid YAML structure with proper indentation
- Include all fields mentioned in instructions
- Use realistic placeholder values
- Use proper YAML syntax (key: value, lists with -)
- Make it readable and well-structured`;
        break;

      case "xml":
        systemPrompt += `\n\nFor XML:
- Create a valid XML structure with root element
- Include all fields mentioned in instructions
- Use descriptive tag names
- Add realistic placeholder values
- Start with <?xml version="1.0" encoding="UTF-8"?>`;
        break;

      case "text":
        systemPrompt += `\n\nFor Plain Text:
- Create a markdown-style structure with headings
- Use ## for main sections based on instructions
- Include realistic placeholder values under each heading
- Keep it human-readable and well-organized`;
        break;
    }

    systemPrompt += `\n\nIMPORTANT:
- Respond ONLY with the ${format.toUpperCase()} content, no explanations
- No markdown code blocks (no \`\`\`), just raw ${format.toUpperCase()}
- Make it complete and ready to use
- Use realistic placeholder values, not "example" or "placeholder"`;

    const userPrompt = jsonSchema
      ? `Instructions: ${instructions}\n\nExisting JSON Schema:\n${JSON.stringify(jsonSchema, null, 2)}\n\nGenerate a ${format.toUpperCase()} template based on this schema and instructions.`
      : `Instructions: ${instructions}\n\nGenerate a complete ${format.toUpperCase()} template for extracting this data from images.`;

    const response = await openai.chat.completions.create({
      model: MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.3, // Low for consistency
      max_tokens: 2000,
    });

    const content = response.choices[0]?.message?.content?.trim();
    if (!content) {
      throw new Error("No content in OpenAI response");
    }

    // Remove markdown code blocks if AI added them despite instructions
    let cleanedContent = content;
    const codeBlockRegex = /^```(?:\w+)?\s*\n/;
    if (codeBlockRegex.test(content)) {
      cleanedContent = content
        .replace(/^```(?:\w+)?\s*\n/, "")
        .replace(/\n```\s*$/, "")
        .trim();
    }

    // Sanitize field names: replace spaces with underscores in all formats
    cleanedContent = sanitizeFieldNames(cleanedContent, format);

    logger.info("Template generated successfully", {
      format,
      template_length: cleanedContent.length,
      tokens: response.usage?.total_tokens,
    });

    return cleanedContent;
  } catch (error) {
    logger.error("Template generation failed in OpenAI provider", {
      format,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Infer manifest from image - COMPLETE IMPLEMENTATION FOR ALL FORMATS
 */
export async function inferManifest(
  imageUrl: string,
  instructions: string,
  format: ManifestFormat,
  jsonSchema?: Record<string, unknown>,
  csvSchema?: string,
  csvDelimiter?: "comma" | "semicolon",
  imageFilename?: string,
  plainTextSchema?: string
): Promise<{
  manifest: Record<string, unknown>;
  latencyMs: number;
  tokensUsed?: number;
}> {
  const startTime = Date.now();

  try {
    logger.info("Inferring manifest from image", {
      image_url_hash: hashUrl(imageUrl),
      format,
      has_filename: Boolean(imageFilename),
    });

    // ========================================================================
    // PLAIN TEXT: Structured Output (JSON internally) → Markdown (externally)
    // ========================================================================
    if (format === "text" && plainTextSchema) {
      const headings = parsePlainTextTemplateHeadings(plainTextSchema);
      const structuredSchema = createPlainTextStructuredSchema(headings);

      logger.info("Plain text with structured output", {
        headings_count: headings.length,
        headings: headings.map(h => h.heading)
      });

      const systemPrompt = `You are an expert image analysis AI that extracts structured data from images.
Analyze the image carefully and extract information for each requested field.
If information is not visible in the image, respond with "Not visible" for that field.`;

      const userPrompt = `${instructions}
${imageFilename ? `\nImage Filename: ${imageFilename}` : ''}

Analyze this image and provide information for each of the following fields:
${headings.map(h => `- ${h.heading}`).join('\n')}

Extract precise, factual information from the image. If something is not visible or unclear, use "Not visible".`;

      const response = await openai.chat.completions.create({
        model: MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              { type: "text", text: userPrompt },
              { type: "image_url", image_url: { url: imageUrl, detail: "high" } },
            ],
          },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "plain_text_structured",
            strict: true,
            schema: structuredSchema,
          },
        },
        temperature: 0.2,
        max_tokens: 4000,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) throw new Error("No content in OpenAI response");

      const jsonResponse = JSON.parse(content);
      const markdownContent = convertJsonToMarkdown(jsonResponse, headings);

      const latencyMs = Date.now() - startTime;
      logger.info("Plain text manifest inferred (structured)", {
        latency_ms: latencyMs,
        tokens: response.usage?.total_tokens,
      });

      return {
        manifest: { text: markdownContent },
        latencyMs,
        tokensUsed: response.usage?.total_tokens,
      };
    }

    // ========================================================================
    // XML/YAML: Schema-Guided Prompting (No Structured Output Available)
    // ========================================================================
    if (format === "xml" || format === "yaml") {
      const formatUpper = format.toUpperCase();
      const schemaExample = jsonSchema; // This contains the XML/YAML example schema

      if (!schemaExample) {
        throw new Error(`${formatUpper} format requires a schema example`);
      }

      // Convert object schema to string if needed
      const schemaString = typeof schemaExample === 'string' 
        ? schemaExample 
        : JSON.stringify(schemaExample, null, 2);

      const systemPrompt = `You are an expert image analysis AI that generates ${formatUpper} output following an exact schema structure.

CRITICAL RULES FOR ${formatUpper} OUTPUT:
1. The schema shows EXAMPLE VALUES - your job is to REPLACE VALUES with actual image data
2. PRESERVE EXACT STRUCTURE: Keep every tag/key, nesting level, and hierarchy identical
3. DO NOT add, remove, or reorder any elements
4. DO NOT change tag/key names or capitalization
5. If data is not visible in image, use: "Not visible", "Unknown", or appropriate empty value
6. Start directly with ${formatUpper} (<?xml?> for XML, --- for YAML)
7. NO explanations, NO markdown code blocks, NO comments
8. Output ONLY valid ${formatUpper}, nothing else`;

      const userPrompt = `${instructions}
${imageFilename ? `\nImage Filename: ${imageFilename}` : ''}

SCHEMA TO FOLLOW (values are examples - replace with image data, keep structure):
\`\`\`${format}
${schemaString}
\`\`\`

Analyze the image and generate ${formatUpper} output following the schema structure EXACTLY.
Remember: Change ONLY the values, keep ALL structure/tags/keys identical.`;

      const response = await openai.chat.completions.create({
        model: MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              { type: "text", text: userPrompt },
              { type: "image_url", image_url: { url: imageUrl, detail: "high" } },
            ],
          },
        ],
        temperature: 0.1, // Very low for structural consistency
        max_tokens: 4000,
      });

      const content = response.choices[0]?.message?.content?.trim();
      if (!content) throw new Error("No content in OpenAI response");

      // Remove markdown code blocks if LLM added them
      let cleanedContent = content;
      const codeBlockRegex = new RegExp(`^\`\`\`(?:${format})?\\s*\\n`, 'i');
      if (codeBlockRegex.test(content)) {
        cleanedContent = content
          .replace(codeBlockRegex, "")
          .replace(/\n```\s*$/, "")
          .trim();
      }

      const latencyMs = Date.now() - startTime;
      logger.info(`${formatUpper} manifest inferred (schema-guided)`, {
        latency_ms: latencyMs,
        tokens: response.usage?.total_tokens,
        preview: cleanedContent.substring(0, 100),
      });

      // Use _raw marker so formatConverter doesn't wrap it
      return {
        manifest: { _raw: cleanedContent, _format: format },
        latencyMs,
        tokensUsed: response.usage?.total_tokens,
      };
    }

    // ========================================================================
    // CSV: Dynamic Schema from Headers
    // ========================================================================
    if (format === "csv" && csvSchema) {
      const delimiter = csvDelimiter === "semicolon" ? ";" : ",";
      const firstLine = csvSchema.split('\n')[0];
      if (!firstLine) {
        throw new Error("CSV schema is empty or missing header row");
      }
      const headers = firstLine.split(delimiter).map(h => h.trim());

      logger.info("CSV inference with dynamic schema", { headers, delimiter });

      const properties: Record<string, unknown> = {};
      const required: string[] = [];

      headers.forEach(header => {
        const propName = header.toLowerCase().replace(/[^a-z0-9]/g, '_');
        properties[propName] = {
          type: "string",
          description: `Value for column: ${header}`
        };
        required.push(propName);
      });

      const schema = {
        type: "object",
        properties: {
          rows: {
            type: "array",
            description: "Array of data rows matching CSV headers",
            items: {
              type: "object",
              properties,
              required,
              additionalProperties: false
            }
          }
        },
        required: ["rows"],
        additionalProperties: false
      };

      const systemPrompt = `You are an expert at extracting structured data from images into CSV format.
Extract data matching these EXACT column headers: ${headers.join(', ')}
Create one object per data row/item you observe.`;

      const userPrompt = `${instructions}

CSV Headers: ${headers.join(delimiter + ' ')}
${imageFilename ? `\nImage Filename: ${imageFilename}` : ''}

Extract all data matching these columns from the image.`;

      const response = await openai.chat.completions.create({
        model: MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              { type: "text", text: userPrompt },
              { type: "image_url", image_url: { url: imageUrl, detail: "high" } },
            ],
          },
        ],
        response_format: {
          type: "json_schema",
          json_schema: { name: "csv_extraction", strict: true, schema },
        },
        temperature: 0.2,
        max_tokens: 4000,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) throw new Error("No content in OpenAI response");

      const manifest = JSON.parse(content);
      const latencyMs = Date.now() - startTime;

      logger.info("CSV manifest inferred (structured)", {
        latency_ms: latencyMs,
        tokens: response.usage?.total_tokens,
      });

      return { manifest, latencyMs, tokensUsed: response.usage?.total_tokens };
    }

    // ========================================================================
    // JSON (Default): Structured Output with JSON Schema
    // ========================================================================
    const schema = jsonSchema
      ? createStructuredOutputSchema(jsonSchema)
      : createDefaultSchema();

    const systemPrompt = `You are an expert image analysis AI that extracts structured data from images.
Analyze carefully and extract information according to instructions.
Be precise. Use null for unavailable data. Follow schema exactly.`;

    const userPrompt = `${instructions}
${imageFilename ? `\nImage Filename: ${imageFilename}` : ''}

Analyze this image and extract information in the exact schema structure.`;

    const response = await openai.chat.completions.create({
      model: MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: [
            { type: "text", text: userPrompt },
            { type: "image_url", image_url: { url: imageUrl, detail: "high" } },
          ],
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: { name: "image_analysis", strict: true, schema },
      },
      temperature: 0.2,
      max_tokens: 4000,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error("No content in OpenAI response");

    const manifest = JSON.parse(content);
    const latencyMs = Date.now() - startTime;

    logger.info("Manifest inferred (JSON structured)", {
      latency_ms: latencyMs,
      tokens: response.usage?.total_tokens,
    });

    return { manifest, latencyMs, tokensUsed: response.usage?.total_tokens };

  } catch (error) {
    const latencyMs = Date.now() - startTime;
    logger.error("Manifest inference failed", error, {
      latency_ms: latencyMs,
      image_url_hash: hashUrl(imageUrl),
    });
    throw new Error(
      `Manifest inference failed: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

// ========================================================================
// HELPER FUNCTIONS
// ========================================================================

interface HeadingInfo {
  heading: string;
  level: number;
  propName: string;
}

/**
 * Parse plain text template headings
 */
function parsePlainTextTemplateHeadings(template: string): HeadingInfo[] {
  const lines = template.split('\n');
  const headings: HeadingInfo[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('#')) continue;

    const match = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (match && match[1] && match[2]) {
      const level = match[1].length;
      const heading = match[2].trim();
      const propName = heading
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .replace(/\s+/g, '_');
      
      headings.push({ heading, level, propName });
    }
  }

  return headings;
}

/**
 * Create JSON Schema from plain text headings
 */
function createPlainTextStructuredSchema(headings: HeadingInfo[]): Record<string, unknown> {
  const properties: Record<string, unknown> = {};
  const required: string[] = [];

  for (const { propName, heading } of headings) {
    properties[propName] = {
      type: "string",
      description: `Content for: ${heading}`
    };
    required.push(propName);
  }

  return {
    type: "object",
    properties,
    required,
    additionalProperties: false
  };
}

/**
 * Convert JSON to markdown
 */
function convertJsonToMarkdown(json: Record<string, unknown>, headings: HeadingInfo[]): string {
  const lines: string[] = [];

  for (const { heading, level, propName } of headings) {
    const prefix = '#'.repeat(level);
    const value = json[propName] || "Not visible";
    
    lines.push(`${prefix} ${heading}`);
    lines.push(String(value));
    lines.push(''); // Empty line between sections
  }

  return lines.join('\n').trim();
}

/**
 * Create structured output schema from JSON Schema
 */
function createStructuredOutputSchema(jsonSchema: Record<string, unknown>): Record<string, unknown> {
  if (isExampleJson(jsonSchema)) {
    return convertExampleToJsonSchema(jsonSchema);
  }

  const processSchema = (schema: any): any => {
    if (!schema || typeof schema !== 'object') return schema;

    if (schema.type === 'object') {
      return {
        ...schema,
        additionalProperties: false,
        properties: schema.properties 
          ? Object.fromEntries(
              Object.entries(schema.properties).map(([key, val]) => [
                key,
                processSchema(val)
              ])
            )
          : {},
      };
    }

    if (schema.type === 'array' && schema.items) {
      return {
        ...schema,
        items: processSchema(schema.items)
      };
    }

    return schema;
  };

  const processed = processSchema(jsonSchema);
  return {
    type: "object",
    properties: processed.properties || {},
    required: (processed.required as string[]) || [],
    additionalProperties: false,
  };
}

function isExampleJson(input: Record<string, unknown>): boolean {
  if (input.type) return false;
  if (input.properties && typeof input.properties === "object") return false;
  
  for (const value of Object.values(input)) {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const obj = value as Record<string, unknown>;
      if (obj.type || obj.properties) return false;
    }
  }
  return true;
}

function convertExampleToJsonSchema(example: any): Record<string, unknown> {
  if (example === null) return { type: "null" };
  
  if (Array.isArray(example)) {
    return {
      type: "array",
      items: example.length > 0 ? convertExampleToJsonSchema(example[0]) : { type: "string" }
    };
  }

  if (typeof example === "object") {
    const properties: Record<string, unknown> = {};
    const required: string[] = [];

    for (const [key, value] of Object.entries(example)) {
      properties[key] = convertExampleToJsonSchema(value);
      required.push(key);
    }

    return {
      type: "object",
      properties,
      required,
      additionalProperties: false
    };
  }

  if (typeof example === "string") return { type: "string" };
  if (typeof example === "number") return { type: "number" };
  if (typeof example === "boolean") return { type: "boolean" };

  return { type: "string" };
}

function createDefaultSchema(): Record<string, unknown> {
  return {
    type: "object",
    properties: {
      description: { type: "string", description: "Image description" },
      key_observations: {
        type: "array",
        items: { type: "string" },
        description: "Key observations"
      },
    },
    required: ["description", "key_observations"],
    additionalProperties: false,
  };
}

function hashUrl(url: string): string {
  let hash = 0;
  for (let i = 0; i < url.length; i++) {
    hash = (hash << 5) - hash + url.charCodeAt(i);
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).substring(0, 8);
}

/**
 * Sanitize field names: Replace spaces with underscores
 * Applies to all formats (JSON keys, CSV headers, YAML keys, XML tags, Plain Text headings)
 */
function sanitizeFieldNames(content: string, format: ManifestFormat): string {
  try {
    switch (format) {
      case "json": {
        // Parse JSON and recursively replace spaces in keys
        const parsed = JSON.parse(content);
        const sanitized = sanitizeJsonKeys(parsed);
        return JSON.stringify(sanitized, null, 2);
      }

      case "csv": {
        // Replace spaces in CSV header row (first line)
        const lines = content.split('\n');
        if (lines.length > 0 && lines[0]) {
          lines[0] = lines[0].replace(/([a-zA-Z0-9]+)\s+([a-zA-Z0-9])/g, '$1_$2');
          // Handle multiple consecutive spaces
          lines[0] = lines[0].replace(/\s+/g, '_');
        }
        return lines.join('\n');
      }

      case "yaml": {
        // Replace spaces in YAML keys (key: value format)
        // Match "key with spaces:" and replace with "key_with_spaces:"
        return content.replace(/^(\s*)([a-zA-Z][a-zA-Z0-9\s]+):/gm, (_match, indent, key) => {
          const sanitizedKey = key.trim().replace(/\s+/g, '_');
          return `${indent}${sanitizedKey}:`;
        });
      }

      case "xml": {
        // Replace spaces in XML tags: <tag name> and </tag name>
        return content
          .replace(/<([a-zA-Z][a-zA-Z0-9\s]+)>/g, (_match, tagName) => {
            const sanitized = tagName.trim().replace(/\s+/g, '_');
            return `<${sanitized}>`;
          })
          .replace(/<\/([a-zA-Z][a-zA-Z0-9\s]+)>/g, (_match, tagName) => {
            const sanitized = tagName.trim().replace(/\s+/g, '_');
            return `</${sanitized}>`;
          });
      }

      case "text": {
        // Replace spaces in markdown headings: ## Heading With Spaces
        return content.replace(/^(#{1,6})\s+(.+)$/gm, (_match, hashes, heading) => {
          const sanitized = heading.trim().replace(/\s+/g, '_');
          return `${hashes} ${sanitized}`;
        });
      }

      default:
        return content;
    }
  } catch (error) {
    // If sanitization fails, return original content
    logger.warn("Field name sanitization failed, using original content", {
      format,
      error: error instanceof Error ? error.message : String(error),
    });
    return content;
  }
}

/**
 * Recursively sanitize JSON object keys
 */
function sanitizeJsonKeys(obj: unknown): unknown {
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeJsonKeys(item));
  }

  if (obj !== null && typeof obj === 'object') {
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      const newKey = key.replace(/\s+/g, '_');
      sanitized[newKey] = sanitizeJsonKeys(value);
    }
    return sanitized;
  }

  return obj;
}

export function zodSchemaToOpenAI<T extends z.ZodTypeAny>(
  zodSchema: T
): Record<string, unknown> {
  const jsonSchema = zodToJsonSchema(zodSchema);
  return createStructuredOutputSchema(jsonSchema);
}
