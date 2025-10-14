/**
 * Pattern Service - Business logic for pattern management
 */

import { supabaseServer } from "@/lib/supabase-server";
import { Database } from "@/lib/database.types";
import { logger } from "@/lib/logger";
import { insertRow, updateRow, updateRowNoReturn, callRpc } from "@/lib/supabase-helpers";
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

    const { data, error } = await insertRow(supabaseServer, "patterns", {
      user_id: userId,
      name: input.name,
      format: input.format,
      instructions: input.instructions,
      json_schema: (input.json_schema || null) as Database["public"]["Tables"]["patterns"]["Insert"]["json_schema"],
      yaml_schema: input.yaml_schema || null,
      xml_schema: input.xml_schema || null,
      csv_schema: input.csv_schema || null,
      plain_text_schema: input.plain_text_schema || null,
      model_profile: input.model_profile,
      version: input.version ?? 1, // Use input version (0 for drafts, 1+ for published)
      is_active: input.is_active ?? true, // Use input is_active (false for drafts, true for published)
      parent_pattern_id: input.parent_pattern_id || null, // Link to parent pattern for draft versioning
    });

    if (error) {
      logger.error("Failed to create pattern", error, {
        user_id: userId,
        name: input.name,
      });

      // Check for duplicate name constraint violation
      if (error.code === "23505" && error.message.includes("patterns_name_user_unique")) {
        throw new Error(`A pattern with the name "${input.name}" already exists. Please choose a different name.`);
      }

      throw new Error(`Failed to create pattern: ${error.message}`);
    }

    if (!data) {
      throw new Error("No data returned from pattern creation");
    }

    // Only create version record for published patterns (version >= 1)
    // Drafts (version = 0) don't get version records until published
    if ((input.version ?? 1) >= 1) {
      await insertRow(supabaseServer, "pattern_versions", {
        pattern_id: data.id,
        version: input.version ?? 1,
        json_schema: (input.json_schema || null) as Database["public"]["Tables"]["pattern_versions"]["Insert"]["json_schema"],
        yaml_schema: input.yaml_schema || null,
        xml_schema: input.xml_schema || null,
        csv_schema: input.csv_schema || null,
        plain_text_schema: input.plain_text_schema || null,
        instructions: input.instructions,
        format: input.format,
      });
    }

    logger.info("Pattern created", {
      pattern_id: data.id,
      user_id: userId,
      version: data.version,
      is_draft: data.version === 0,
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

    // Build update object with only defined fields
    const updateData: Record<string, unknown> = {};
    if (input.name) updateData.name = input.name;
    if (input.format) updateData.format = input.format;
    if (input.instructions) updateData.instructions = input.instructions;
    if (input.json_schema !== undefined) updateData.json_schema = input.json_schema;
    if (input.is_active !== undefined) updateData.is_active = input.is_active;

    // Note: We need to verify user_id separately since our helper only supports single condition
    // First verify ownership
    const { data: existingPattern } = await supabaseServer
      .from("patterns")
      .select("id")
      .eq("id", patternId)
      .eq("user_id", userId)
      .single();

    if (!existingPattern) {
      throw new Error("Pattern not found or access denied");
    }

    const { data, error } = await updateRow(
      supabaseServer,
      "patterns",
      updateData,
      { column: "id", value: patternId }
    );

    if (error) {
      logger.error("Failed to update pattern", error, { pattern_id: patternId });
      throw error;
    }

    if (!data) {
      throw new Error("No data returned from pattern update");
    }

    return data as Pattern;
  } catch (error) {
    logger.error("Exception updating pattern", error);
    throw error;
  }
}

/**
 * Delete pattern (hard delete)
 */
export async function deletePattern(
  patternId: string,
  userId: string
): Promise<void> {
  try {
    logger.info("Deleting pattern", { pattern_id: patternId, user_id: userId });

    // Verify ownership first
    const { data: existingPattern } = await supabaseServer
      .from("patterns")
      .select("id")
      .eq("id", patternId)
      .eq("user_id", userId)
      .single();

    if (!existingPattern) {
      throw new Error("Pattern not found or access denied");
    }

    // Delete related records first to avoid foreign key constraints
    // 1. Delete jobs
    const { error: jobsError } = await supabaseServer
      .from("jobs")
      .delete()
      .eq("pattern_id", patternId);

    if (jobsError) {
      logger.error("Failed to delete jobs", {
        pattern_id: patternId,
        error_message: jobsError.message,
      });
      throw new Error(`Failed to delete jobs: ${jobsError.message}`);
    }

    // 2. Delete pattern versions
    const { error: versionsError } = await supabaseServer
      .from("pattern_versions")
      .delete()
      .eq("pattern_id", patternId);

    if (versionsError) {
      logger.error("Failed to delete pattern versions", {
        pattern_id: patternId,
        error_message: versionsError.message,
      });
      throw new Error(`Failed to delete pattern versions: ${versionsError.message}`);
    }

    // 3. Finally, delete the pattern itself
    const { error } = await supabaseServer
      .from("patterns")
      .delete()
      .eq("id", patternId)
      .eq("user_id", userId);

    if (error) {
      logger.error("Failed to delete pattern", {
        pattern_id: patternId,
        error: error,
        error_message: error.message,
        error_code: error.code,
        error_details: error.details,
      });
      throw new Error(`Failed to delete pattern: ${error.message || JSON.stringify(error)}`);
    }

    logger.info("Pattern deleted successfully", { pattern_id: patternId });
  } catch (error) {
    logger.error("Exception deleting pattern", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    throw error;
  }
}

/**
 * Publish new pattern version
 */
export async function publishPatternVersion(
  patternId: string,
  userId: string,
  instructions: string,
  format: string,
  schemas: {
    json_schema?: Record<string, unknown> | null;
    yaml_schema?: string | null;
    xml_schema?: string | null;
    csv_schema?: string | null;
    plain_text_schema?: string | null;
  }
): Promise<number> {
  try {
    logger.info("Publishing pattern version", {
      pattern_id: patternId,
      user_id: userId,
      format,
    });

    const rpcParams = {
      p_pattern_id: patternId,
      p_user_id: userId,
      p_instructions: instructions,
      p_format: format,
      p_json_schema: (schemas.json_schema || null) as Database["public"]["Functions"]["publish_pattern_version"]["Args"]["p_json_schema"],
      p_yaml_schema: schemas.yaml_schema || null,
      p_xml_schema: schemas.xml_schema || null,
      p_csv_schema: schemas.csv_schema || null,
      p_plain_text_schema: schemas.plain_text_schema || null,
    };

    logger.info("RPC parameters", {
      pattern_id: patternId,
      params: rpcParams
    });

    const { data, error } = await callRpc(supabaseServer, "publish_pattern_version", rpcParams);

    if (error) {
      logger.error("Failed to publish pattern version", {
        pattern_id: patternId,
        error_message: error.message,
        error_details: error.details,
        error_hint: error.hint,
        error_code: error.code,
      });
      throw new Error(`Failed to publish pattern version: ${error.message || JSON.stringify(error)}`);
    }

    if (data === null) {
      throw new Error("No version number returned from publish");
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

/**
 * Get all versions of a pattern
 */
export async function getPatternVersions(
  patternId: string,
  userId: string
): Promise<Array<{
  version: number;
  json_schema: Record<string, unknown> | null;
  yaml_schema: string | null;
  xml_schema: string | null;
  csv_schema: string | null;
  plain_text_schema: string | null;
  instructions: string;
  format: string;
  created_at: string;
}>> {
  try {
    // Verify ownership first
    const { data: existingPattern } = await supabaseServer
      .from("patterns")
      .select("id")
      .eq("id", patternId)
      .eq("user_id", userId)
      .single();

    if (!existingPattern) {
      throw new Error("Pattern not found or access denied");
    }

    // Get all versions ordered by version number descending (newest first)
    const { data, error } = await supabaseServer
      .from("pattern_versions")
      .select("version, json_schema, yaml_schema, xml_schema, csv_schema, plain_text_schema, instructions, format, created_at")
      .eq("pattern_id", patternId)
      .order("version", { ascending: false });

    if (error) {
      logger.error("Failed to get pattern versions", error, { pattern_id: patternId });
      throw error;
    }

    return data || [];
  } catch (error) {
    logger.error("Exception getting pattern versions", error);
    throw error;
  }
}

/**
 * Switch to a specific pattern version
 */
export async function switchToPatternVersion(
  patternId: string,
  userId: string,
  targetVersion: number
): Promise<void> {
  try {
    logger.info("Switching to pattern version", {
      pattern_id: patternId,
      user_id: userId,
      target_version: targetVersion,
    });

    const { error } = await callRpc(supabaseServer, "switch_to_pattern_version", {
      p_pattern_id: patternId,
      p_user_id: userId,
      p_target_version: targetVersion,
    });

    if (error) {
      logger.error("Failed to switch pattern version", {
        pattern_id: patternId,
        target_version: targetVersion,
        error_message: error.message,
        error_details: error.details,
        error_hint: error.hint,
        error_code: error.code,
      });
      throw new Error(`Failed to switch pattern version: ${error.message || JSON.stringify(error)}`);
    }

    logger.info("Pattern version switched", {
      pattern_id: patternId,
      version: targetVersion,
    });
  } catch (error) {
    logger.error("Exception switching pattern version", error);
    throw error;
  }
}
