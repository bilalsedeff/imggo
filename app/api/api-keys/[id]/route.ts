/**
 * API Key Management - Individual Key Operations
 * DELETE /api/api-keys/:id - Revoke API key
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuthOrApiKey } from "@/lib/auth-unified";
import { revokeApiKey } from "@/services/apiKeyService";
import { logger } from "@/lib/logger";

// ============================================================================
// DELETE - Revoke API Key
// ============================================================================

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const authContext = await requireAuthOrApiKey(request);

    // Only allow session auth to revoke API keys
    if (authContext.authType !== "session") {
      return NextResponse.json(
        {
          error: "API keys cannot revoke other API keys",
          message: "Please login to the dashboard to manage API keys",
        },
        { status: 403 }
      );
    }

    const { id: keyId } = await context.params;

    logger.info("Revoking API key", {
      user_id: authContext.userId,
      key_id: keyId,
    });

    // Revoke the key (service ensures only owner can revoke)
    await revokeApiKey(authContext.userId, keyId, "Revoked by user");

    return NextResponse.json({
      success: true,
      message: "API key revoked successfully",
    });
  } catch (error) {
    logger.error("Failed to revoke API key", {
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      {
        error: "Failed to revoke API key",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
