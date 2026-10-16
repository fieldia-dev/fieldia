import type { Field } from './field';
import type { ListNode } from './layout';
import type { Page } from './page';

/**
 * The kinds of field a spreadsheet's cell can fill (a list's `import`): words,
 * numbers, money, yes or no, a day or a day and time, a choice by its label,
 * a link and links by their names. Never a table of lines, files, formatted
 * text, JSON, properties or a reference, which a cell's words cannot say.
 */
export const IMPORT_KINDS: ReadonlySet<string> = new Set(['char', 'text', 'integer', 'float', 'monetary', 'boolean', 'date', 'datetime', 'selection', 'many2one', 'many2many']);

/** Whether a file's cell can fill a field: of such a kind, neither read-only nor worked out from others. */
export function importable(def: Field | undefined): boolean {
  return !!def && IMPORT_KINDS.has(def.type) && def.readonly !== true && !def.compute;
}

/**
 * The fields a list's Import offers to match a file's columns to, in order:
 * none unless the list says `import`; with true, every field of the page a
 * cell can fill, in the page's order; with a list, those of it that can.
 */
export function importFields(page: Page, list: ListNode): string[] {
  const named = list.import === true ? Object.keys(page.fields) : Array.isArray(list.import) ? list.import : [];
  return [...new Set(named)].filter((name) => importable(page.fields[name]));
}
