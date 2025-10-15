/**
 * XML Schema Validator
 * Validates that the generated XML matches the user's schema structure
 */

import { parseStringPromise } from 'xml2js';

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validate XML structure against user schema
 */
export async function validateXmlStructure(
  generatedXml: string,
  schemaXml: string
): Promise<ValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    // Parse both XMLs
    const generated = await parseStringPromise(generatedXml, { 
      explicitArray: false,
      mergeAttrs: true 
    });
    const schema = await parseStringPromise(schemaXml, { 
      explicitArray: false,
      mergeAttrs: true 
    });

    // Get root element names
    const generatedRoot = Object.keys(generated)[0];
    const schemaRoot = Object.keys(schema)[0];

    // Check if root elements exist
    if (!generatedRoot || !schemaRoot) {
      errors.push('Invalid XML structure: missing root element');
      return { isValid: false, errors, warnings };
    }

    // Validate root element
    if (generatedRoot !== schemaRoot) {
      errors.push(`Root element mismatch: expected '${schemaRoot}', got '${generatedRoot}'`);
      return { isValid: false, errors, warnings };
    }

    // Validate structure recursively
    validateStructure(generated[generatedRoot], schema[schemaRoot], generatedRoot, errors, warnings);

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  } catch (error) {
    errors.push(`XML parsing failed: ${error instanceof Error ? error.message : String(error)}`);
    return { isValid: false, errors, warnings };
  }
}

/**
 * Recursively validate XML structure
 */
function validateStructure(
  generated: any,
  schema: any,
  path: string,
  errors: string[],
  warnings: string[]
): void {
  if (typeof schema === 'object' && schema !== null) {
    // Check all required keys from schema exist in generated
    for (const key of Object.keys(schema)) {
      if (!(key in generated)) {
        errors.push(`Missing required element: ${path}.${key}`);
        continue;
      }

      // Recursively validate nested objects
      if (typeof schema[key] === 'object' && schema[key] !== null) {
        validateStructure(generated[key], schema[key], `${path}.${key}`, errors, warnings);
      }
    }

    // Extra keys in generated (not in schema) are errors
    for (const key of Object.keys(generated)) {
      if (!(key in schema)) {
        errors.push(`Extra element found (not in schema): ${path}.${key}`);
      }
    }
  }
}

/**
 * Quick validation - just check root element
 */
export function quickValidateXml(xml: string, expectedRoot: string): boolean {
  const match = xml.trim().match(/^<(\w+)>/);
  return match ? match[1] === expectedRoot : false;
}
