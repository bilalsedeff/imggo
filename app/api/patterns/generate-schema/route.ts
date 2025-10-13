import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { requireAuth } from "@/lib/api-helpers";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    // Require authentication
    const user = await requireAuth(request);

    const body = await request.json();
    const { instructions } = body;

    if (!instructions || typeof instructions !== "string") {
      return NextResponse.json(
        { error: "Instructions are required" },
        { status: 400 }
      );
    }

    logger.info("Generating JSON schema from instructions", {
      user_id: user.userId,
      instructionsLength: instructions.length,
    });

    // Ask LLM to generate JSON Schema from instructions
    const response = await openai.chat.completions.create({
      model: "gpt-4o-2024-08-06",
      messages: [
        {
          role: "system",
          content: `You are an expert at creating JSON Schemas for data extraction tasks.
Given user instructions for image analysis, generate a precise JSON Schema that:
- Follows JSON Schema Draft 7 specification
- Has "type": "object" at root
- Includes "properties" object with relevant fields
- Includes "required" array
- Sets "additionalProperties": false for ALL objects (required for OpenAI strict mode)
- Uses descriptive field names and descriptions
- Includes appropriate data types (string, number, boolean, array, object)
- For arrays, always include "items" definition
- For nested objects, always set "additionalProperties": false

CRITICAL: Every object in the schema MUST have "additionalProperties": false

Respond ONLY with the JSON Schema, no explanations.`,
        },
        {
          role: "user",
          content: `Generate a JSON Schema for this image analysis task:\n\n${instructions}`,
        },
      ],
      temperature: 0.2,
      max_tokens: 2000,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("No content in OpenAI response");
    }

    // Clean markdown code blocks
    const cleaned = content
      .replace(/```json\s*/g, "")
      .replace(/```\s*/g, "")
      .trim();

    // Parse to validate
    const schema = JSON.parse(cleaned);

    // Ensure root has required fields
    if (!schema.type || schema.type !== "object") {
      schema.type = "object";
    }
    if (!schema.properties) {
      schema.properties = {};
    }
    if (schema.additionalProperties !== false) {
      schema.additionalProperties = false;
    }

    logger.info("JSON schema generated successfully", {
      user_id: user.userId,
      schemaSize: JSON.stringify(schema).length,
    });

    return NextResponse.json({ schema });
  } catch (error) {
    logger.error("Error generating schema", { error });

    if (error instanceof Error) {
      return NextResponse.json(
        { error: error.message || "Failed to generate schema" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: "Failed to generate schema" },
      { status: 500 }
    );
  }
}
