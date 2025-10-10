import { NextRequest, NextResponse } from "next/server";
import { generateTemplate } from "@/llm/providers/openai";
import { logger } from "@/lib/logger";
import { requireAuth } from "@/lib/api-helpers";

export async function POST(request: NextRequest) {
  try {
    // Require authentication
    const user = await requireAuth(request);

    const body = await request.json();
    const { instructions, format, jsonSchema } = body;

    if (!instructions || typeof instructions !== "string") {
      return NextResponse.json(
        { error: "Instructions are required" },
        { status: 400 }
      );
    }

    if (!format || !["json", "yaml", "xml", "csv", "text"].includes(format)) {
      return NextResponse.json(
        { error: "Invalid format specified" },
        { status: 400 }
      );
    }

    logger.info("Generating template", {
      user_id: user.userId,
      format,
      instructionsLength: instructions.length,
    });

    // Call OpenAI to generate template
    const template = await generateTemplate(
      instructions,
      format as "json" | "yaml" | "xml" | "csv" | "text",
      jsonSchema
    );

    logger.info("Template generated successfully", { format, templateLength: template.length });

    return NextResponse.json({ template });
  } catch (error) {
    logger.error("Error generating template", { error });

    if (error instanceof Error) {
      return NextResponse.json(
        { error: error.message || "Failed to generate template" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: "Failed to generate template" },
      { status: 500 }
    );
  }
}
