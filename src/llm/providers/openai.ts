/**
 * OpenAI provider for ImgGo
 * Uses structured outputs with JSON Schema to ensure consistent manifest format
 */

import OpenAI from "openai";
import { zodToJsonSchema } from "zod-to-json-schema";
import { z } from "zod";
import { logger } from "@/lib/logger";
import { ManifestFormat } from "@/schemas/pattern";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const MODEL = "gpt-4o-2024-08-06"; // Supports structured outputs

/**
 * Generate example template based on instructions and format
 */
export async function generateTemplate(
  instructions: string,
  format: ManifestFormat,
  jsonSchema?: Record<string, unknown>,
  csvDelimiter?: "comma" | "semicolon"
): Promise<string> {
  const startTime = Date.now();

  try {
    logger.info("Generating template with OpenAI", { format });

    // Format-specific system prompts
    let systemPrompt: string;
    let userPrompt: string;

    if (format === "text") {
      // Special handling for Plain Text - create STRUCTURED template with consistent headings
      systemPrompt = `You are an expert at creating structured data extraction templates for image analysis.

For Plain Text format, create a STRUCTURED TEMPLATE with CONSISTENT MARKDOWN HEADINGS that will serve as a PATTERN for analyzing EVERY image.

CRITICAL REQUIREMENTS:
1. **Use Markdown Heading Syntax**: # for main sections, ## for sub-sections, ### for sub-sub-sections
2. **Extract Section Names from Instructions**: Identify the key categories/aspects mentioned in the instructions
3. **Create Fixed Structure**: These headings will stay THE SAME for every image analyzed
4. **Use Placeholders**: Under each heading, write "[To be determined from image]" or similar placeholder
5. **Think Pattern/Form**: This is a FORM with fixed sections that will be filled differently for each image
6. **Minimum 1 Heading**: Always have at least one main section

EXAMPLE (for art analysis):
# Art Type
[To be determined from image]

# Historical Period
[To be determined from image]

# Color Palette
[To be determined from image]

# Dominant Emotions
[To be determined from image]

Respond ONLY with the structured template using markdown headings, no explanations.`;

      userPrompt = `User Instructions: ${instructions}

Analyze these instructions and create a STRUCTURED Plain Text template with markdown headings that will be used consistently for analyzing every image. Extract the key analysis categories and create fixed section headings.`;
    } else if (format === "csv") {
      // Special handling for CSV - include delimiter information
      const delimiter = csvDelimiter === "semicolon" ? ";" : ",";
      const delimiterName = csvDelimiter === "semicolon" ? "semicolon" : "comma";

      systemPrompt = `You are an expert at creating data extraction schemas for image analysis.
Given user instructions, create a complete example output in CSV format that demonstrates the expected structure.

The output should be:
- Complete and realistic CSV data
- Use ${delimiterName} (${delimiter}) as the delimiter
- Include a header row with column names
- Follow the specified format exactly
- Match the user's intent from their instructions
- Include all necessary fields
${jsonSchema ? "- Conform to the provided JSON schema" : ""}

CRITICAL: Use ${delimiter} as the delimiter between values, NOT ${delimiter === "," ? "semicolon (;)" : "comma (,)"}.

Respond ONLY with the CSV output, no explanations or markdown code blocks.`;

      userPrompt = `Instructions: ${instructions}
${jsonSchema ? `\nJSON Schema:\n${JSON.stringify(jsonSchema, null, 2)}` : ""}

Generate a complete example CSV output using ${delimiterName} (${delimiter}) as the delimiter:`;
    } else {
      // Default prompt for other formats (JSON, YAML, XML)
      systemPrompt = `You are an expert at creating data extraction schemas for image analysis.
Given user instructions, create a complete example output in ${format.toUpperCase()} format that demonstrates the expected structure.

The output should be:
- Complete and realistic
- Follow the specified format exactly
- Match the user's intent from their instructions
- Include all necessary fields
${jsonSchema ? "- Conform to the provided JSON schema" : ""}

Respond ONLY with the example output, no explanations.`;

      userPrompt = `Instructions: ${instructions}
${jsonSchema ? `\nJSON Schema:\n${JSON.stringify(jsonSchema, null, 2)}` : ""}

Generate a complete example output in ${format.toUpperCase()} format:`;
    }

    const response = await openai.chat.completions.create({
      model: MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.3,
      max_tokens: 2000,
    });

    const template = response.choices[0]?.message?.content?.trim() || "";
    const latency = Date.now() - startTime;

    logger.info("Template generated", {
      latency_ms: latency,
      format,
      tokens: response.usage?.total_tokens,
    });

    return template;
  } catch (error) {
    logger.error("Failed to generate template", error);
    throw new Error(
      `Template generation failed: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

/**
 * Infer manifest from image with structured output
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

    // SPECIAL HANDLING FOR PLAIN TEXT: Preserve exact template structure
    if (format === "text" && plainTextSchema) {
      const systemPrompt = `You are an expert image analysis AI that extracts structured data from images.
Your task is to analyze the image and fill in the provided template with the extracted information.

CRITICAL REQUIREMENTS FOR PLAIN TEXT OUTPUT:
1. PRESERVE THE EXACT TEMPLATE FORMAT - Do not change any headers, structure, or formatting
2. MAINTAIN THE EXACT ORDER of all sections as they appear in the template
3. KEEP ALL MARKDOWN HEADERS (# symbols) exactly as shown in the template
4. OUTPUT ONLY THE FILLED TEMPLATE - Start directly with the first heading (#)
5. NO INTRODUCTORY TEXT (like "I'm unable to see..." or "Here's the analysis:")
6. NO EXPLANATORY PARAGRAPHS before the template
7. NO CONCLUDING REMARKS after the template
8. REPLACE ONLY the placeholder values (like "[To be determined from image]") with actual extracted information
9. If information is not visible in the image, write "Not visible" or "Unknown"
10. Do NOT add, remove, or reorder any sections
11. Do NOT change the capitalization or wording of headers
12. The output must be character-for-character identical to the template structure, with only the values filled in

Example:
Template: "# Book Title\n[To be determined from image]"
Correct output: "# Book Title\nThe Great Gatsby"
WRONG output: "I see a book. # Book Title\nThe Great Gatsby" ❌
WRONG output: "book title: The Great Gatsby" ❌`;

      const userPrompt = `${instructions}

TEMPLATE TO FILL (preserve this exact structure):
${plainTextSchema}

Analyze the image and fill in ONLY the placeholder values in the template above. Keep everything else exactly the same. Start your response directly with the first heading.`;

      // For plain text, use regular completion (no JSON Schema enforcement)
      const response = await openai.chat.completions.create({
        model: MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              { type: "text", text: userPrompt },
              {
                type: "image_url",
                image_url: { url: imageUrl, detail: "high" },
              },
            ],
          },
        ],
        temperature: 0.1, // Lower temperature for more consistent output
        max_tokens: 4000,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error("No content in OpenAI response");
      }

      // Clean output: Remove any text before the first heading
      const cleanedContent = cleanPlainTextOutput(content);

      // For plain text, return as-is (wrapped in manifest object for consistency)
      const manifest = { text: cleanedContent };
      const latencyMs = Date.now() - startTime;

      logger.info("Plain text manifest inferred successfully", {
        latency_ms: latencyMs,
        tokens: response.usage?.total_tokens,
        preview: cleanedContent.substring(0, 200),
        cleaned: content !== cleanedContent, // Log if we had to clean
      });

      return {
        manifest,
        latencyMs,
        tokensUsed: response.usage?.total_tokens,
      };
    }

    // For CSV format with csv_schema, create dynamic schema from headers
    let schema: Record<string, unknown>;
    let systemPrompt: string;
    let userPrompt: string;

    if (format === "csv" && csvSchema) {
      // Parse CSV headers
      const delimiter = csvDelimiter === "semicolon" ? ";" : ",";
      const headers = csvSchema.split('\n')[0].split(delimiter).map(h => h.trim());

      logger.info("CSV inference with schema", { headers, delimiter });

      // Create schema dynamically from headers
      const properties: Record<string, unknown> = {};
      const required: string[] = [];

      headers.forEach(header => {
        // Convert header to valid property name (remove spaces, special chars)
        const propName = header.toLowerCase().replace(/[^a-z0-9]/g, '_');
        properties[propName] = {
          type: "string",
          description: `Value for column: ${header}`
        };
        required.push(propName);
      });

      schema = {
        type: "object",
        properties: {
          rows: {
            type: "array",
            description: "Array of data rows matching the CSV schema",
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

      systemPrompt = `You are an expert image analysis AI that extracts structured data from images into CSV-compatible format.
Analyze the image carefully and extract information according to the user's instructions.

CRITICAL CSV REQUIREMENTS:
- Extract data that matches these EXACT column headers: ${headers.join(', ')}
- Create one object per row of data you extract
- Each object must have properties matching the column names
- Property names: ${headers.map(h => h.toLowerCase().replace(/[^a-z0-9]/g, '_')).join(', ')}
- Be precise and accurate
- If information is not visible, use empty string ""
- Extract ALL visible data that matches the schema`;

      userPrompt = `${instructions}

CSV Column Headers: ${headers.join(delimiter + ' ')}
${imageFilename ? `\nImage Filename: ${imageFilename}` : ''}

Analyze this image and extract all data that matches these columns. Return an array of objects, one for each data point/event you observe.`;

    } else {
      // Default behavior for non-CSV or CSV without schema
      schema = jsonSchema
        ? createStructuredOutputSchema(jsonSchema)
        : createDefaultSchema();

      systemPrompt = `You are an expert image analysis AI that extracts structured data from images.
Analyze the image carefully and extract information according to the user's instructions.

IMPORTANT:
- Be precise and accurate
- If information is not visible or uncertain, use null or indicate uncertainty
- Follow the schema structure exactly
- Extract all requested information`;

      userPrompt = `${instructions}
${imageFilename ? `\nImage Filename: ${imageFilename}` : ''}

Analyze this image and extract the information in the exact structure specified.`;
    }

    const response = await openai.chat.completions.create({
      model: MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: [
            { type: "text", text: userPrompt },
            {
              type: "image_url",
              image_url: { url: imageUrl, detail: "high" },
            },
          ],
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "image_analysis",
          strict: true,
          schema: schema,
        },
      },
      temperature: 0.2,
      max_tokens: 4000,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("No content in OpenAI response");
    }

    const manifest = JSON.parse(content);
    const latencyMs = Date.now() - startTime;

    logger.info("Manifest inferred successfully", {
      latency_ms: latencyMs,
      tokens: response.usage?.total_tokens,
      format,
    });

    return {
      manifest,
      latencyMs,
      tokensUsed: response.usage?.total_tokens,
    };
  } catch (error) {
    const latencyMs = Date.now() - startTime;
    logger.error("Failed to infer manifest", error, {
      latency_ms: latencyMs,
      image_url_hash: hashUrl(imageUrl),
    });
    throw new Error(
      `Manifest inference failed: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

/**
 * Convert example JSON to JSON Schema
 * Infers schema structure from example data
 */
function convertExampleToJsonSchema(example: any): Record<string, unknown> {
  // Handle null
  if (example === null) {
    return { type: "null" };
  }

  // Handle arrays
  if (Array.isArray(example)) {
    return {
      type: "array",
      items: example.length > 0 ? convertExampleToJsonSchema(example[0]) : { type: "string" }
    };
  }

  // Handle objects
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

  // Primitive types
  if (typeof example === "string") return { type: "string" };
  if (typeof example === "number") return { type: "number" };
  if (typeof example === "boolean") return { type: "boolean" };

  // Fallback
  return { type: "string" };
}

/**
 * Detect if input is example JSON (not JSON Schema)
 * JSON Schema has "type" and optionally "properties" at root or nested levels
 */
function isExampleJson(input: Record<string, unknown>): boolean {
  // If it has "type" field at root, it's likely a JSON Schema
  if (input.type) {
    return false;
  }

  // If it has "properties" and "type" is missing, it might be a schema fragment
  if (input.properties && typeof input.properties === "object") {
    return false;
  }

  // Check if any nested object has schema-like structure
  for (const value of Object.values(input)) {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const nested = value as Record<string, unknown>;
      if (nested.type || nested.properties) {
        return false; // Has schema structure
      }
    }
  }

  // Otherwise, it's example JSON
  return true;
}

/**
 * Create structured output schema from JSON Schema
 * Recursively ensures all objects have additionalProperties: false for OpenAI strict mode
 * Also handles conversion of example JSON to JSON Schema
 */
function createStructuredOutputSchema(
  jsonSchema: Record<string, unknown>
): Record<string, unknown> {
  // CRITICAL: Detect if this is example JSON instead of JSON Schema
  if (isExampleJson(jsonSchema)) {
    logger.info("Detected example JSON, converting to JSON Schema");
    const converted = convertExampleToJsonSchema(jsonSchema);
    logger.info("Conversion complete", {
      hasProperties: Boolean(converted && typeof converted === 'object' && 'properties' in converted)
    });
    // Continue processing the converted schema
    jsonSchema = converted as Record<string, unknown>;
  }
  // Recursively process schema to add additionalProperties: false to all objects
  const processSchema = (schema: any): any => {
    if (!schema || typeof schema !== "object") {
      return schema;
    }

    // Handle arrays
    if (schema.type === "array" && schema.items) {
      return {
        ...schema,
        items: processSchema(schema.items),
      };
    }

    // Handle objects
    if (schema.type === "object") {
      const processed: any = {
        ...schema,
        additionalProperties: false, // Always false for OpenAI strict mode
      };

      // Process nested properties
      if (schema.properties && typeof schema.properties === "object") {
        processed.properties = {};
        for (const [key, value] of Object.entries(schema.properties)) {
          processed.properties[key] = processSchema(value);
        }
      }

      return processed;
    }

    // Handle oneOf, anyOf, allOf
    if (schema.oneOf) {
      return { ...schema, oneOf: schema.oneOf.map(processSchema) };
    }
    if (schema.anyOf) {
      return { ...schema, anyOf: schema.anyOf.map(processSchema) };
    }
    if (schema.allOf) {
      return { ...schema, allOf: schema.allOf.map(processSchema) };
    }

    return schema;
  };

  // Start with root object
  const processed = processSchema(jsonSchema);

  // Ensure root is an object with required fields
  return {
    type: "object",
    properties: processed.properties || {},
    required: (processed.required as string[]) || [],
    additionalProperties: false,
  };
}

/**
 * Create default schema when no custom schema provided
 */
function createDefaultSchema(): Record<string, unknown> {
  return {
    type: "object",
    properties: {
      description: {
        type: "string",
        description: "Detailed description of the image content",
      },
      key_observations: {
        type: "array",
        description: "List of key observations from the image",
        items: {
          type: "string",
        },
      },
      metadata: {
        type: "object",
        description: "Additional metadata extracted from the image",
        properties: {
          confidence: {
            type: "string",
            description: "Confidence level of analysis (high, medium, low)",
            enum: ["high", "medium", "low"],
          },
        },
        required: ["confidence"],
        additionalProperties: false,
      },
    },
    required: ["description", "key_observations", "metadata"],
    additionalProperties: false,
  };
}

/**
 * Hash URL for logging (privacy)
 */
function hashUrl(url: string): string {
  let hash = 0;
  for (let i = 0; i < url.length; i++) {
    const char = url.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).substring(0, 8);
}

/**
 * Clean plain text output by removing any content before the first heading
 * LLM sometimes adds explanatory text before the schema - we trim it
 * Ultra-simple: Find first '#', remove everything before it
 */
function cleanPlainTextOutput(output: string): string {
  const firstHashIndex = output.indexOf('#');
  if (firstHashIndex === -1) {
    return output.trim(); // No headings found, return as-is
  }
  return output.substring(firstHashIndex).trim();
}

/**
 * Convert Zod schema to OpenAI structured output format
 */
export function zodSchemaToOpenAI<T extends z.ZodTypeAny>(
  zodSchema: T
): Record<string, unknown> {
  const jsonSchema = zodToJsonSchema(zodSchema);
  return createStructuredOutputSchema(jsonSchema);
}
