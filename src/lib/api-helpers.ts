/**
 * API Helper utilities for route handlers
 */

import { NextRequest, NextResponse } from "next/server";
import { ZodSchema, ZodError } from "zod";
import { logger } from "./logger";
import { ErrorResponse } from "@/schemas/api";
import { supabaseServer, createServerClient } from "./supabase-server";
import { checkIdempotencyKey } from "./idempotency";

/**
 * Get authenticated user from request
 */
export async function getAuthUser(request: NextRequest): Promise<{
  userId: string;
  email: string;
} | null> {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return null;
    }

    const token = authHeader.substring(7);
    const client = createServerClient(token);

    const {
      data: { user },
      error,
    } = await client.auth.getUser();

    if (error || !user) {
      return null;
    }

    return {
      userId: user.id,
      email: user.email || "",
    };
  } catch {
    return null;
  }
}

/**
 * Require authentication - returns user or throws error response
 */
export async function requireAuth(
  request: NextRequest
): Promise<{ userId: string; email: string }> {
  const user = await getAuthUser(request);
  if (!user) {
    throw new ApiError("Unauthorized", 401, "UNAUTHORIZED");
  }
  return user;
}

/**
 * Parse and validate request body with Zod
 */
export async function parseBody<T>(
  request: NextRequest,
  schema: ZodSchema<T>
): Promise<T> {
  try {
    const body = await request.json();
    return schema.parse(body);
  } catch (error) {
    if (error instanceof ZodError) {
      throw new ApiError(
        "Validation error",
        400,
        "VALIDATION_ERROR",
        error.flatten().fieldErrors
      );
    }
    throw new ApiError("Invalid JSON", 400, "INVALID_JSON");
  }
}

/**
 * Parse and validate query parameters with Zod
 */
export function parseQuery<T>(request: NextRequest, schema: ZodSchema<T>): T {
  try {
    const searchParams = request.nextUrl.searchParams;
    const params = Object.fromEntries(searchParams.entries());
    return schema.parse(params);
  } catch (error) {
    if (error instanceof ZodError) {
      throw new ApiError(
        "Invalid query parameters",
        400,
        "VALIDATION_ERROR",
        error.flatten().fieldErrors
      );
    }
    throw error;
  }
}

/**
 * Custom API Error class
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code: string = "INTERNAL_ERROR",
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * Create success response
 */
export function successResponse<T>(data: T, status = 200): NextResponse {
  return NextResponse.json(
    {
      success: true,
      data,
    },
    { status }
  );
}

/**
 * Create error response
 */
export function errorResponse(
  error: Error | ApiError | unknown,
  requestId?: string
): NextResponse {
  if (error instanceof ApiError) {
    const response: ErrorResponse = {
      success: false,
      error: {
        code: error.code,
        message: error.message,
        details: error.details,
      },
    };

    logger.warn("API error", {
      request_id: requestId,
      code: error.code,
      message: error.message,
    });

    return NextResponse.json(response, {
      status: error.statusCode,
      headers: requestId ? { "X-Request-ID": requestId } : {},
    });
  }

  // Unexpected error
  const message =
    error instanceof Error ? error.message : "Internal server error";

  logger.error("Unexpected API error", error, {
    request_id: requestId,
  });

  const response: ErrorResponse = {
    success: false,
    error: {
      code: "INTERNAL_ERROR",
      message,
    },
  };

  return NextResponse.json(response, {
    status: 500,
    headers: requestId ? { "X-Request-ID": requestId } : {},
  });
}

/**
 * Generate request ID
 */
export function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Handle idempotency for requests
 */
export async function handleIdempotency(
  idempotencyKey: string
): Promise<{ isDuplicate: boolean; existingData?: unknown }> {
  return await checkIdempotencyKey(idempotencyKey, supabaseServer);
}

/**
 * API route wrapper with error handling
 */
export function withErrorHandling(
  handler: (request: NextRequest, context?: { params: Promise<Record<string, string>> }) => Promise<NextResponse>
) {
  return async (
    request: NextRequest,
    context?: { params: Promise<Record<string, string>> }
  ): Promise<NextResponse> => {
    const requestId = generateRequestId();

    try {
      const response = await handler(request, context);

      // Add request ID to response headers
      response.headers.set("X-Request-ID", requestId);

      return response;
    } catch (error) {
      return errorResponse(error, requestId);
    }
  };
}
