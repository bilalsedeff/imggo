/**
 * API Keys Management Routes
 * POST /api/api-keys - Create new API key
 * GET /api/api-keys - List user's API keys
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuthOrApiKey } from "@/lib/auth-unified";
import { createApiKey, listApiKeys } from "@/services/apiKeyService";
import { logger } from "@/lib/logger";
import { z } from "zod";

// ============================================================================
// REQUEST SCHEMAS
// ============================================================================

const CreateApiKeySchema = z.object({
  name: z.string().min(1).max(100),
  environment: z.enum(["test", "live"]),
  scopes: z.array(z.string()).min(1),
  expiresAt: z.string().datetime().optional(),
  ipWhitelist: z.array(z.string().ip()).optional(),
});

// ============================================================================
// POST - Create API Key
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    // Require session auth (not API key) for creating API keys
    const authContext = await requireAuthOrApiKey(request);

    // Only allow session auth to create API keys (security: prevent API key from creating more keys)
    if (authContext.authType !== "session") {
      return NextResponse.json(
        {
          error: "API keys cannot create other API keys",
          message: "Please login to the dashboard to manage API keys",
        },
        { status: 403 }
      );
    }

    // Parse request body
    const body = await request.json();
    const input = CreateApiKeySchema.parse(body);

    logger.info("Creating API key", {
      user_id: authContext.userId,
      name: input.name,
      environment: input.environment,
      scopes_count: input.scopes.length,
    });

    // Create the API key
    const result = await createApiKey({
      userId: authContext.userId,
      name: input.name,
      environment: input.environment,
      scopes: input.scopes,
      expiresAt: input.expiresAt,
      ipWhitelist: input.ipWhitelist,
    });

    logger.info("API key created successfully", {
      key_id: result.id,
      user_id: authContext.userId,
      prefix: result.keyPrefix,
    });

    // Return the plain key (SHOW ONCE!)
    return NextResponse.json(
      {
        success: true,
        data: {
          id: result.id,
          key: result.key, // ⚠️ ONLY TIME THIS IS SHOWN
          key_prefix: result.keyPrefix,
          name: result.metadata.name,
          environment: result.metadata.environment,
          scopes: result.metadata.scopes,
          created_at: result.metadata.created_at,
        },
        warning: "Save this API key now. You won't be able to see it again!",
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: "Validation error",
          details: error.errors,
        },
        { status: 400 }
      );
    }

    logger.error("Failed to create API key", {
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      {
        error: "Failed to create API key",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// GET - List API Keys
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const authContext = await requireAuthOrApiKey(request);

    logger.debug("Listing API keys", {
      user_id: authContext.userId,
      auth_type: authContext.authType,
    });

    const apiKeys = await listApiKeys(authContext.userId);

    return NextResponse.json({
      success: true,
      data: apiKeys.map((key) => ({
        id: key.id,
        name: key.name,
        key_prefix: key.key_prefix, // Only prefix, never full key
        environment: key.environment,
        scopes: key.scopes,
        last_used_at: key.last_used_at,
        last_used_ip: key.last_used_ip,
        expires_at: key.expires_at,
        created_at: key.created_at,
      })),
    });
  } catch (error) {
    logger.error("Failed to list API keys", {
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      {
        error: "Failed to list API keys",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
