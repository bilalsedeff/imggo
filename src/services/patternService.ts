/**
 * Pattern Service - Business logic for pattern management
 */

import { supabaseServer } from "@/lib/supabase-server";
import { logger } from "@/lib/logger";
import {
  CreatePatternInput,
  UpdatePatternInput,
  Pattern,
} from "@/schemas/pattern";

/**
 * Create a new pattern
 */
export async function createPattern(
  userId: string,
  input: CreatePatternInput
): Promise<Pattern> {
  try {
    logger.info("Creating pattern", { user_id: userId, name: input.name });

    const { data, error } = await supabaseServer
      .from("patterns")
      .insert({
        user_id: userId,
        name: input.name,
        format: input.format,
        instructions: input.instructions,
        json_schema: input.json_schema || null,
        model_profile: input.model_profile,
        version: 1,
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      logger.error("Failed to create pattern", error, {
        user_id: userId,
        name: input.name,
      });
      throw new Error(`Failed to create pattern: ${error.message}`);
    }

    // Create initial version
    await supabaseServer.from("pattern_versions").insert({
      pattern_id: data.id,
      version: 1,
      json_schema: input.json_schema || null,
      instructions: input.instructions,
    });

    logger.info("Pattern created", {
      pattern_id: data.id,
      user_id: userId,
    });

    return data as Pattern;
  } catch (error) {
    logger.error("Exception creating pattern", error);
    throw error;
  }
}

/**
 * Get pattern by ID
 */
export async function getPattern(
  patternId: string,
  userId: string
): Promise<Pattern | null> {
  try {
    const { data, error } = await supabaseServer
      .from("patterns")
      .select("*")
      .eq("id", patternId)
      .eq("user_id", userId)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return null;
      }
      throw error;
    }

    return data as Pattern;
  } catch (error) {
    logger.error("Exception getting pattern", error, { pattern_id: patternId });
    throw error;
  }
}

/**
 * List user's patterns
 */
export async function listPatterns(
  userId: string,
  options: {
    isActive?: boolean;
    page?: number;
    perPage?: number;
  } = {}
): Promise<{ patterns: Pattern[]; total: number }> {
  try {
    const { isActive, page = 1, perPage = 20 } = options;
    const offset = (page - 1) * perPage;

    let query = supabaseServer
      .from("patterns")
      .select("*", { count: "exact" })
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (isActive !== undefined) {
      query = query.eq("is_active", isActive);
    }

    const { data, error, count } = await query.range(offset, offset + perPage - 1);

    if (error) {
      logger.error("Failed to list patterns", error, { user_id: userId });
      throw error;
    }

    return {
      patterns: (data as Pattern[]) || [],
      total: count || 0,
    };
  } catch (error) {
    logger.error("Exception listing patterns", error);
    throw error;
  }
}

/**
 * Update pattern
 */
export async function updatePattern(
  patternId: string,
  userId: string,
  input: UpdatePatternInput
): Promise<Pattern> {
  try {
    logger.info("Updating pattern", { pattern_id: patternId, user_id: userId });

    const { data, error } = await supabaseServer
      .from("patterns")
      .update({
        ...(input.name && { name: input.name }),
        ...(input.format && { format: input.format }),
        ...(input.instructions && { instructions: input.instructions }),
        ...(input.json_schema !== undefined && {
          json_schema: input.json_schema,
        }),
        ...(input.is_active !== undefined && { is_active: input.is_active }),
      })
      .eq("id", patternId)
      .eq("user_id", userId)
      .select()
      .single();

    if (error) {
      logger.error("Failed to update pattern", error, { pattern_id: patternId });
      throw error;
    }

    return data as Pattern;
  } catch (error) {
    logger.error("Exception updating pattern", error);
    throw error;
  }
}

/**
 * Delete (archive) pattern
 */
export async function deletePattern(
  patternId: string,
  userId: string
): Promise<void> {
  try {
    logger.info("Deleting pattern", { pattern_id: patternId, user_id: userId });

    // Soft delete by setting is_active = false
    const { error } = await supabaseServer
      .from("patterns")
      .update({ is_active: false })
      .eq("id", patternId)
      .eq("user_id", userId);

    if (error) {
      logger.error("Failed to delete pattern", error, { pattern_id: patternId });
      throw error;
    }

    logger.info("Pattern deleted", { pattern_id: patternId });
  } catch (error) {
    logger.error("Exception deleting pattern", error);
    throw error;
  }
}

/**
 * Publish new pattern version
 */
export async function publishPatternVersion(
  patternId: string,
  userId: string,
  jsonSchema: Record<string, unknown> | null,
  instructions: string
): Promise<number> {
  try {
    logger.info("Publishing pattern version", {
      pattern_id: patternId,
      user_id: userId,
    });

    const { data, error } = await supabaseServer.rpc("publish_pattern_version", {
      p_pattern_id: patternId,
      p_json_schema: jsonSchema,
      p_instructions: instructions,
    });

    if (error) {
      logger.error("Failed to publish pattern version", error, {
        pattern_id: patternId,
      });
      throw error;
    }

    const newVersion = data as number;
    logger.info("Pattern version published", {
      pattern_id: patternId,
      version: newVersion,
    });

    return newVersion;
  } catch (error) {
    logger.error("Exception publishing pattern version", error);
    throw error;
  }
}
