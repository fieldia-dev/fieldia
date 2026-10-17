import type { Field } from './field';

/**
 * The kinds of field a record is compared by, for possible duplicates (`duplicates` on a page): words (a name, a
 * phone, an email, an id), a number (an id kept as one), a day (a birthday), a choice or a link (a company). Never a
 * table, links, a file, formatted text or JSON, whose likeness is no one value's. Apart from the format's schema
 * (duplicates.ts), so the page's quick check carries no validation library.
 */
export const DUPLICATE_KINDS: ReadonlySet<string> = new Set(['char', 'text', 'integer', 'float', 'date', 'selection', 'many2one']);

/** Whether records may be compared by this field: of such a kind. */
export const comparable = (def: Field | undefined): boolean => !!def && DUPLICATE_KINDS.has(def.type);
