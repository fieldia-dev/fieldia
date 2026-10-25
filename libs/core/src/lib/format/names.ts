/** Field names and kinds, apart from the schemas so code that runs a form never carries the validation library. */

/**
 * A field name: what expressions and layout nodes use to refer to a field — never a name every object already has
 * (`constructor`, `__proto__`, `prototype`), which a record's values would read as their own.
 */
export const FIELD_NAME = /^(?!(?:constructor|__proto__|prototype)$)[A-Za-z_][A-Za-z0-9_]*$/;

export const FIELD_TYPES = [
  'char',
  'text',
  'html',
  'integer',
  'float',
  'monetary',
  'boolean',
  'date',
  'datetime',
  'selection',
  'binary',
  'image',
  'many2one',
  'many2many',
  'one2many',
  'reference',
  'properties',
  'json',
  'matrix',
] as const;

export type FieldType = (typeof FIELD_TYPES)[number];
