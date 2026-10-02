/**
 * Extract field names from modifier expressions
 *
 * Used to determine which form fields need to be watched for modifier evaluation.
 * This enables targeted subscriptions instead of watching all form values.
 *
 * @example
 * ```typescript
 * extractFieldNames("state == 'draft'") // ['state']
 * extractFieldNames("state == 'draft' and amount > 100") // ['state', 'amount']
 * extractFieldNames("partner_id.country_id.code == 'US'") // ['partner_id']
 * extractFieldNames(true) // []
 * extractFieldNames(undefined) // []
 * ```
 */

import { tokenize } from './tokenizer';

/**
 * Extract all field names referenced in a modifier expression
 *
 * @param expression - Modifier expression (string, boolean, or undefined)
 * @returns Array of root field names to watch
 */
export function extractFieldNames(expression: string | boolean | undefined): string[] {
  // Non-string expressions don't reference fields
  if (typeof expression !== 'string' || expression.trim() === '') {
    return [];
  }

  try {
    const tokens = tokenize(expression);
    const fields = new Set<string>();

    // Keywords that look like identifiers but aren't field names
    const keywords = new Set(['null', 'true', 'false', 'True', 'False', 'None']);

    tokens.forEach(token => {
      if (token.type === 'IDENTIFIER') {
        // Skip literal keywords
        if (keywords.has(token.value)) {
          return;
        }

        // For nested fields like 'partner_id.country_id.name',
        // we only need to watch the root field 'partner_id'
        const rootField = token.value.split('.')[0];
        fields.add(rootField);
      }
    });

    return Array.from(fields);
  } catch {
    // An expression that cannot be read reads no fields. validatePage reports
    // it, so a validated page never reaches this branch.
    return [];
  }
}

// CRITICAL: Cache to prevent creating new arrays when the result is the same
// WeakMap ensures memory is freed when modifiers object is garbage collected
const extractionCache = new WeakMap<object, string[]>();

// Stable empty array for when there are no fields to extract
const EMPTY_FIELDS_ARRAY: string[] = Object.freeze([]) as unknown as string[];

/**
 * Extract all field names from a modifiers object
 *
 * @param modifiers - Object containing invisible/readonly/required expressions
 * @returns Array of unique root field names to watch
 *
 * @example
 * ```typescript
 * extractFieldNamesFromModifiers({
 *   invisible: "state == 'draft'",
 *   readonly: "amount > 100"
 * }) // ['state', 'amount']
 * ```
 */
export function extractFieldNamesFromModifiers(
  modifiers: Record<string, string | boolean | undefined> | { invisible?: string | boolean; readonly?: string | boolean; required?: string | boolean }
): string[] {
  // Check cache first for stable reference
  const cached = extractionCache.get(modifiers);
  if (cached !== undefined) {
    return cached;
  }

  const allFields = new Set<string>();

  Object.values(modifiers).forEach(expression => {
    const fields = extractFieldNames(expression);
    fields.forEach(field => allFields.add(field));
  });

  // Return stable empty array if no fields
  if (allFields.size === 0) {
    extractionCache.set(modifiers, EMPTY_FIELDS_ARRAY);
    return EMPTY_FIELDS_ARRAY;
  }

  // Freeze the result array to ensure immutability
  const result = Object.freeze(Array.from(allFields)) as string[];
  extractionCache.set(modifiers, result);
  return result;
}
