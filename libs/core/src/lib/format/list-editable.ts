import { BULK_KINDS } from './bulk-edit';
import type { Field } from './field';
import type { ListNode } from './layout';
import type { Page } from './page';

/**
 * The kinds of field a list's cell changes in place (`ListNode.editable`): words, a paragraph, a number, money, yes or
 * no, a day, a day and a time, a choice, a link and links as tags — each in its own box, with its rules, as a form's
 * field. Never a table of lines, a file or a picture, formatted text, JSON or properties, which a cell has no room for.
 */
export const EDIT_KINDS: ReadonlySet<string> = new Set([...BULK_KINDS, 'many2many']);

/** Whether a field's cell can be changed in place: of such a kind, neither read-only nor worked out from others. */
export function cellChangeable(def: Field | undefined): boolean {
  return !!def && EDIT_KINDS.has(def.type) && def.readonly !== true && !def.compute;
}

/**
 * The columns a list changes in place, in its own order: none unless it says `editable`; with true (or no `fields`),
 * every column a cell can change; with `fields`, those of its columns that can.
 */
export function editableColumns(page: Page, list: ListNode): string[] {
  const editable = list.editable;
  if (!editable) return [];
  const named = editable === true || !editable.fields ? list.columns : editable.fields;
  return list.columns.filter((name) => named.includes(name) && cellChangeable(page.fields[name]));
}
