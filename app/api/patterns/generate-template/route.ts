import { NextRequest, NextResponse } from "next/server";
import { generateTemplate } from "@/llm/providers/openai";
import { logger } from "@/lib/logger";
import { requireAuth } from "@/lib/api-helpers";
import { getUserPlan } from "@/services/planService";

export async function POST(request: NextRequest) {
  try {
    // Require authentication
    const user = await requireAuth(request);

    // Get user's plan to check template character limits
    const userPlan = await getUserPlan(user.userId);
    const maxTemplateChars = userPlan.plan.max_template_characters;

    const body = await request.json();
    const {
      name,
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

    // Validate input size against plan limits
    const instructionsLength = instructions?.length || 0;
    const schemaLength = jsonSchema ? JSON.stringify(jsonSchema).length : 0;
    const totalInputSize = instructionsLength + schemaLength;

    if (totalInputSize > maxTemplateChars) {
      return NextResponse.json(
        {
          error: `Template size (${totalInputSize.toLocaleString()} characters) exceeds your plan limit of ${maxTemplateChars.toLocaleString()} characters. Please shorten your instructions or schema, or upgrade your plan.`,
          planLimit: maxTemplateChars,
          currentSize: totalInputSize,
        },
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
        maxTemplateChars,
      });

      // Construct enhanced prompt for follow-up
      promptToUse = `Original Instructions:
${original_instructions}

Current Template:
${current_template}

Follow-up Request:
${follow_up_prompt}

Please modify the current template according to the follow-up request while maintaining the original intent from the original instructions. Return the complete updated template in ${format} format. IMPORTANT: The output must not exceed ${maxTemplateChars} characters.`;
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
        hasName: Boolean(name),
        maxTemplateChars,
      });

      // Include pattern name in prompt if provided
      promptToUse = name && name.trim()
        ? `Pattern Name: ${name}\n\nInstructions: ${instructions}\n\nIMPORTANT: Generate a template that does not exceed ${maxTemplateChars} characters.`
        : `${instructions}\n\nIMPORTANT: Generate a template that does not exceed ${maxTemplateChars} characters.`;
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
