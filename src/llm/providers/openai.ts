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
  jsonSchema?: Record<string, unknown>
): Promise<string> {
  const startTime = Date.now();

  try {
    logger.info("Generating template with OpenAI", { format });

    const systemPrompt = `You are an expert at creating data extraction schemas for image analysis.
Given user instructions, create a complete example output in ${format.toUpperCase()} format that demonstrates the expected structure.

The output should be:
- Complete and realistic
- Follow the specified format exactly
- Match the user's intent from their instructions
- Include all necessary fields
${jsonSchema ? "- Conform to the provided JSON schema" : ""}

Respond ONLY with the example output, no explanations.`;

    const userPrompt = `Instructions: ${instructions}
${jsonSchema ? `\nJSON Schema:\n${JSON.stringify(jsonSchema, null, 2)}` : ""}

Generate a complete example output in ${format.toUpperCase()} format:`;

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
  jsonSchema?: Record<string, unknown>
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
    });

    // Create schema for structured output
    const schema = jsonSchema
      ? createStructuredOutputSchema(jsonSchema)
      : createDefaultSchema();

    const systemPrompt = `You are an expert image analysis AI that extracts structured data from images.
Analyze the image carefully and extract information according to the user's instructions.

IMPORTANT:
- Be precise and accurate
- If information is not visible or uncertain, use null or indicate uncertainty
- Follow the schema structure exactly
- Extract all requested information`;

    const userPrompt = `${instructions}

Analyze this image and extract the information in the exact structure specified.`;

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
 * Create structured output schema from JSON Schema
 */
function createStructuredOutputSchema(
  jsonSchema: Record<string, unknown>
): Record<string, unknown> {
  // OpenAI structured outputs require specific format
  // Ensure schema is compatible
  return {
    type: "object",
    properties: jsonSchema.properties || {},
    required: (jsonSchema.required as string[]) || [],
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
      analysis: {
        type: "string",
        description: "Comprehensive analysis of the image",
      },
      extracted_data: {
        type: "object",
        description: "Key-value pairs of extracted information",
        additionalProperties: true,
      },
    },
    required: ["analysis", "extracted_data"],
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
 * Convert Zod schema to OpenAI structured output format
 */
export function zodSchemaToOpenAI<T extends z.ZodTypeAny>(
  zodSchema: T
): Record<string, unknown> {
  const jsonSchema = zodToJsonSchema(zodSchema);
  return createStructuredOutputSchema(jsonSchema);
}
