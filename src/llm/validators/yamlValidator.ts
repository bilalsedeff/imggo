/**
 * YAML Schema Validator
 * Validates that the generated YAML matches the user's schema structure
 */

import yaml from 'js-yaml';

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validate YAML structure against user schema
 */
export function validateYamlStructure(
  generatedYaml: string,
  schemaYaml: string
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    // Parse both YAMLs
    const generated = yaml.load(generatedYaml) as Record<string, any>;
    const schema = yaml.load(schemaYaml) as Record<string, any>;

    if (!generated || typeof generated !== 'object') {
      errors.push('Generated YAML is not a valid object');
      return { isValid: false, errors, warnings };
    }

    if (!schema || typeof schema !== 'object') {
      errors.push('Schema YAML is not a valid object');
      return { isValid: false, errors, warnings };
    }

    // Validate structure recursively
    validateStructure(generated, schema, 'root', errors, warnings);

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  } catch (error) {
    errors.push(`YAML parsing failed: ${error instanceof Error ? error.message : String(error)}`);
    return { isValid: false, errors, warnings };
  }
}

/**
 * Recursively validate YAML structure
 */
function validateStructure(
  generated: any,
  schema: any,
  path: string,
  errors: string[],
  warnings: string[]
): void {
  // Handle arrays
  if (Array.isArray(schema)) {
    if (!Array.isArray(generated)) {
      errors.push(`Type mismatch at ${path}: expected array, got ${typeof generated}`);
      return;
    }

    // Validate array items have same structure as schema[0]
    if (schema.length > 0 && generated.length > 0) {
      const schemaItem = schema[0];
      for (let i = 0; i < generated.length; i++) {
        validateStructure(generated[i], schemaItem, `${path}[${i}]`, errors, warnings);
      }
    }
    return;
  }

  // Handle objects
  if (typeof schema === 'object' && schema !== null) {
    if (typeof generated !== 'object' || generated === null) {
      errors.push(`Type mismatch at ${path}: expected object, got ${typeof generated}`);
      return;
    }

    // Check all required keys from schema exist in generated
    for (const key of Object.keys(schema)) {
      if (!(key in generated)) {
        errors.push(`Missing required key: ${path}.${key}`);
        continue;
      }

      // Recursively validate nested objects
      validateStructure(generated[key], schema[key], `${path}.${key}`, errors, warnings);
    }

    // Warn about extra keys in generated (not in schema)
    for (const key of Object.keys(generated)) {
      if (!(key in schema)) {
        warnings.push(`Extra key found (not in schema): ${path}.${key}`);
      }
    }
  }
}

/**
 * Quick validation - check if YAML is parseable
 */
export function quickValidateYaml(yamlString: string): boolean {
  try {
    yaml.load(yamlString);
    return true;
  } catch {
    return false;
  }
}
