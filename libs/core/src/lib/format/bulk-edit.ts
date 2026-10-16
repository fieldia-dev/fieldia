import type { Field } from './field';
import type { ListNode } from './layout';
import type { Page } from './page';

/**
 * The kinds of field one value can set in many records at once (a list's
 * `bulkEdit`): words, numbers, money, yes or no, a day, a choice and a link.
 * Never a table of lines, links, files, formatted text, JSON or properties,
 * which one value would wipe or cannot say.
 */
export const BULK_KINDS: ReadonlySet<string> = new Set(['char', 'text', 'integer', 'float', 'monetary', 'boolean', 'date', 'datetime', 'selection', 'many2one']);

/** Whether a field can be set in many records at once: of such a kind, neither read-only nor worked out from others. */
export function bulkSettable(def: Field | undefined): boolean {
  return !!def && BULK_KINDS.has(def.type) && def.readonly !== true && !def.compute;
}

/**
 * The fields a list's Edit offers, in order: none unless the list says
 * `bulkEdit`; with true, its columns that can be set; with a list, those of
 * it that can.
 */
export function bulkEditFields(page: Page, list: ListNode): string[] {
  const named = list.bulkEdit === true ? list.columns : Array.isArray(list.bulkEdit) ? list.bulkEdit : [];
  return [...new Set(named)].filter((name) => bulkSettable(page.fields[name]));
}
