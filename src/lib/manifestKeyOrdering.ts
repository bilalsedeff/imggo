/**
 * Manifest Key Ordering Utility
 *
 * PostgreSQL JSONB doesn't preserve key order - it stores objects in an optimized
 * binary format. This utility reorders manifest keys to match the user's defined
 * schema order (DIVINE RULE) when reading from the database.
 */

/**
 * Re-order manifest keys to match schema's required array order (DIVINE RULE)
 * This ensures field order is EXACTLY as user defined in Pattern Studio
 *
 * @param manifest - The manifest object to reorder
 * @param schema - The JSON Schema with required array defining key order
 * @returns Reordered manifest with keys matching schema order
 */
export function reorderManifestKeys(manifest: any, schema: any): any {
  if (typeof manifest !== 'object' || manifest === null || Array.isArray(manifest)) {
    return manifest;
  }

  // Get required order from schema
  const requiredOrder = schema?.required || [];
  const properties = schema?.properties || {};

  // Create new object with keys in required order
  const reordered: Record<string, any> = {};

  // First, add keys in required order
  for (const key of requiredOrder) {
    if (key in manifest) {
      const value = manifest[key];
      const propSchema = properties[key];

      // Recursively reorder nested objects
      if (propSchema && typeof value === 'object' && !Array.isArray(value)) {
        reordered[key] = reorderManifestKeys(value, propSchema);
      } else if (Array.isArray(value) && propSchema?.items) {
        // Reorder objects in arrays
        reordered[key] = value.map((item: any) =>
          typeof item === 'object' && !Array.isArray(item)
            ? reorderManifestKeys(item, propSchema.items)
            : item
        );
      } else {
        reordered[key] = value;
      }
    }
  }

  // Then add any remaining keys not in required (shouldn't happen with strict mode)
  for (const key of Object.keys(manifest)) {
    if (!(key in reordered)) {
      reordered[key] = manifest[key];
    }
  }

  return reordered;
}

/**
 * Create a structured output schema from pattern's json_schema
 * Handles both malformed (properties at root) and well-formed schemas
 *
 * @param jsonSchema - The json_schema from pattern
 * @returns Structured schema with properties and required fields
 */
export function createStructuredOutputSchema(
  jsonSchema: Record<string, unknown>
): Record<string, unknown> {
  // If it's already a valid JSON Schema (has "properties" field at root)
  if (jsonSchema.properties && typeof jsonSchema.properties === "object") {
    return {
      type: "object",
      properties: jsonSchema.properties,
      required: (jsonSchema.required as string[]) || [],
      additionalProperties: false,
    };
  }

  // Detect malformed schema where properties are at top level
  const allKeysAreSchemas = Object.values(jsonSchema).every(
    val => val && typeof val === "object" && "type" in val
  );

  if (allKeysAreSchemas && Object.keys(jsonSchema).length > 0) {
    // Extract required fields
    const required: string[] = [];
    for (const key of Object.keys(jsonSchema)) {
      if (key !== "patternName") { // patternName is metadata
        required.push(key);
      }
    }

    return {
      type: "object",
      properties: jsonSchema,
      required,
      additionalProperties: false,
    };
  }

  // Otherwise return as-is (might be example data)
  return jsonSchema;
}
