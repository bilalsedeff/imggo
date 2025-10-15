/**
 * Plain Text (Markdown) Schema Validator
 * Validates that the generated markdown has all required headings
 */

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validate Plain Text structure against schema
 */
export function validatePlainTextStructure(
  generatedText: string,
  schemaText: string
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Extract headings from both
  const generatedHeadings = extractHeadings(generatedText);
  const schemaHeadings = extractHeadings(schemaText);

  // Check all schema headings exist in generated
  for (const schemaHeading of schemaHeadings) {
    const found = generatedHeadings.some(
      h => h.level === schemaHeading.level && h.text === schemaHeading.text
    );

    if (!found) {
      errors.push(`Missing required heading: ${'#'.repeat(schemaHeading.level)} ${schemaHeading.text}`);
    }
  }

  // Extra headings should fail validation
  for (const genHeading of generatedHeadings) {
    const found = schemaHeadings.some(
      h => h.level === genHeading.level && h.text === genHeading.text
    );

    if (!found) {
      errors.push(`Extra heading found (not in schema): ${'#'.repeat(genHeading.level)} ${genHeading.text}`);
    }
  }

  // Check for preamble (text before first heading)
  const firstHeadingMatch = generatedText.match(/^(.*?)(?=^#)/ms);
  if (firstHeadingMatch && firstHeadingMatch[1] && firstHeadingMatch[1].trim().length > 0) {
    errors.push('Text found before first heading (preamble not allowed)');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Extract headings from markdown text
 */
function extractHeadings(text: string): Array<{ level: number; text: string }> {
  const headings: Array<{ level: number; text: string }> = [];
  const lines = text.split('\n');

  for (const line of lines) {
    const match = line.match(/^(#{1,6})\s+(.+)$/);
    if (match && match[1] && match[2]) {
      headings.push({
        level: match[1].length,
        text: match[2].trim()
      });
    }
  }

  return headings;
}

/**
 * Quick validation - check if text starts with heading (no preamble)
 */
export function quickValidatePlainText(text: string): boolean {
  const trimmed = text.trim();
  return /^#\s/.test(trimmed);
}
