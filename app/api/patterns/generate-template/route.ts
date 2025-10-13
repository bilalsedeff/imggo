import { NextRequest, NextResponse } from "next/server";
import { generateTemplate } from "@/llm/providers/openai";
import { logger } from "@/lib/logger";
import { requireAuth } from "@/lib/api-helpers";

export async function POST(request: NextRequest) {
  try {
    // Require authentication
    const user = await requireAuth(request);

    const body = await request.json();
    const {
      instructions,
      format,
      csvDelimiter,
      jsonSchema,
      original_instructions,
      current_template,
      follow_up_prompt
    } = body;

    // Check if this is a follow-up request
    const isFollowUp = Boolean(original_instructions && current_template && follow_up_prompt);

    if (!format || !["json", "yaml", "xml", "csv", "text"].includes(format)) {
      return NextResponse.json(
        { error: "Invalid format specified" },
        { status: 400 }
      );
    }

    let promptToUse: string;

    if (isFollowUp) {
      // Follow-up request: combine original + current + follow-up
      if (!follow_up_prompt || typeof follow_up_prompt !== "string") {
        return NextResponse.json(
          { error: "Follow-up prompt is required" },
          { status: 400 }
        );
      }

      logger.info("Generating follow-up template", {
        user_id: user.userId,
        format,
        followUpLength: follow_up_prompt.length,
      });

      // Construct enhanced prompt for follow-up
      promptToUse = `Original Instructions:
${original_instructions}

Current Template:
${current_template}

Follow-up Request:
${follow_up_prompt}

Please modify the current template according to the follow-up request while maintaining the original intent from the original instructions. Return the complete updated template in ${format} format.`;
    } else {
      // Initial request
      if (!instructions || typeof instructions !== "string") {
        return NextResponse.json(
          { error: "Instructions are required" },
          { status: 400 }
        );
      }

      logger.info("Generating initial template", {
        user_id: user.userId,
        format,
        instructionsLength: instructions.length,
      });

      promptToUse = instructions;
    }

    // Call OpenAI to generate template
    const template = await generateTemplate(
      promptToUse,
      format as "json" | "yaml" | "xml" | "csv" | "text",
      jsonSchema,
      csvDelimiter as "comma" | "semicolon" | undefined
    );

    logger.info("Template generated successfully", {
      isFollowUp,
      format,
      templateLength: template.length
    });

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
