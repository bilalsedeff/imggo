/**
 * Patterns API Routes
 * POST /api/patterns - Create pattern
 * GET /api/patterns - List patterns
 */

import { NextRequest } from "next/server";
import {
  withErrorHandling,
  requireAuth,
  parseBody,
  parseQuery,
  successResponse,
} from "@/lib/api-helpers";
import { CreatePatternSchema } from "@/schemas/pattern";
import { ListPatternsQuerySchema } from "@/schemas/api";
import * as patternService from "@/services/patternService";
import { logger } from "@/lib/logger";
import { checkRateLimitOrFail } from "@/middleware/rateLimit";
import OpenAI from "openai";
import { convertManifest, type ManifestFormat } from "@/lib/formatConverter";

const BASE_URL = process.env.APP_BASE_URL || "http://localhost:3000";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export const POST = withErrorHandling(async (request: NextRequest) => {
  const user = await requireAuth(request);

  // Rate limiting check (10 patterns per hour)
  const rateLimitResponse = await checkRateLimitOrFail(
    request,
    "patterns.create"
  );
  if (rateLimitResponse) return rateLimitResponse;

  const input = await parseBody(request, CreatePatternSchema);

  logger.info("Creating pattern via API", {
    user_id: user.userId,
    name: input.name,
    format: input.format,
    has_json_schema: !!input.json_schema,
  });

  // Auto-generate JSON schema if missing (required for all formats)
  if (!input.json_schema) {
    logger.info("Auto-generating JSON schema from instructions", {
      user_id: user.userId,
      pattern_name: input.name,
    });

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o-2024-08-06",
        messages: [
          {
            role: "system",
            content: `You are an expert at creating JSON Schemas for data extraction tasks.
Generate a precise JSON Schema that:
- Has "type": "object" at root
- Includes "properties" with relevant fields based on instructions
- Includes "required" array
- Sets "additionalProperties": false for ALL objects (OpenAI strict mode requirement)
- Uses appropriate data types
- For nested objects, ALWAYS set "additionalProperties": false
- For arrays, include "items" definition

CRITICAL: Every object MUST have "additionalProperties": false

Respond ONLY with the JSON Schema.`,
          },
          {
            role: "user",
            content: `Generate a JSON Schema for: ${input.instructions}`,
          },
        ],
        temperature: 0.2,
        max_tokens: 2000,
      });

      const content = response.choices[0]?.message?.content;
      if (content) {
        const cleaned = content
          .replace(/```json\s*/g, "")
          .replace(/```\s*/g, "")
          .trim();
        const schema = JSON.parse(cleaned);

        // Ensure root has required fields
        schema.type = "object";
        schema.additionalProperties = false;
        if (!schema.properties) schema.properties = {};

        input.json_schema = schema;

        logger.info("JSON schema auto-generated successfully", {
          user_id: user.userId,
          pattern_name: input.name,
        });
      }
    } catch (error) {
      logger.error("Failed to auto-generate JSON schema", error, {
        user_id: user.userId,
        pattern_name: input.name,
      });
      // Continue without schema - will use default schema during inference
    }
  }

  // Generate example data from JSON Schema and convert to target format
  if (input.json_schema && input.format !== "json") {
    logger.info("Generating example data for format-specific schema", {
      user_id: user.userId,
      pattern_name: input.name,
      format: input.format,
    });

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o-2024-08-06",
        messages: [
          {
            role: "system",
            content: `You are an expert at generating realistic example data from JSON Schemas.
Generate example data that:
- Matches the provided JSON Schema exactly
- Uses realistic, contextual values (not placeholders like "string" or "123")
- Follows the schema's structure, types, and constraints
- Returns ONLY the JSON data, no explanations

Respond ONLY with valid JSON.`,
          },
          {
            role: "user",
            content: `Generate realistic example data for this JSON Schema:\n\n${JSON.stringify(input.json_schema, null, 2)}\n\nContext: ${input.instructions}`,
          },
        ],
        temperature: 0.7,
        max_tokens: 2000,
      });

      const content = response.choices[0]?.message?.content;
      if (content) {
        const cleaned = content
          .replace(/```json\s*/g, "")
          .replace(/```\s*/g, "")
          .trim();
        const exampleData = JSON.parse(cleaned);

        // Convert to target format
        const formattedExample = convertManifest(exampleData, input.format as ManifestFormat);

        // Store in appropriate column
        switch (input.format) {
          case "yaml":
            input.yaml_schema = formattedExample;
            break;
          case "xml":
            input.xml_schema = formattedExample;
            break;
          case "csv":
            input.csv_schema = formattedExample;
            break;
          case "text":
            input.plain_text_schema = formattedExample;
            break;
        }

        logger.info("Format-specific schema generated successfully", {
          user_id: user.userId,
          pattern_name: input.name,
          format: input.format,
        });
      }
    } catch (error) {
      logger.error("Failed to generate format-specific schema", error, {
        user_id: user.userId,
        pattern_name: input.name,
        format: input.format,
      });
      // Continue without format-specific schema
    }
  }

  // The input is already transformed by Zod, so it has the correct type
  const pattern = await patternService.createPattern(user.userId, input as import("@/schemas/pattern").CreatePatternInput);

  // Return pattern with endpoint URL
  const patternWithEndpoint = {
    ...pattern,
    endpoint_url: `${BASE_URL}/api/patterns/${pattern.id}/ingest`,
  };

  return successResponse(patternWithEndpoint, 201);
});

export const GET = withErrorHandling(async (request: NextRequest) => {
  const user = await requireAuth(request);

  const query = parseQuery(request, ListPatternsQuerySchema);

  logger.info("Listing patterns via API", {
    user_id: user.userId,
  });

  const { patterns, total } = await patternService.listPatterns(user.userId, {
    isActive: query.is_active,
    page: query.page,
    perPage: query.per_page,
  });

  // Add endpoint URLs
  const patternsWithEndpoints = patterns.map((p) => ({
    ...p,
    endpoint_url: `${BASE_URL}/api/patterns/${p.id}/ingest`,
  }));

  const perPage = query.per_page ?? 20;

  return successResponse({
    data: patternsWithEndpoints,
    pagination: {
      page: query.page ?? 1,
      per_page: perPage,
      total,
      total_pages: Math.ceil(total / perPage),
    },
  });
});
