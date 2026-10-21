import type { MenuItem } from '@fieldia/core';
import { nextName } from './page-tree';

/**
 * A menu's items as the designer keeps them — the record's gear menu's, a
 * button's menu beside it: a divider, a line between items that does
 * nothing; an item that opens a menu of its own, or the app's, beside it
 * ("Templates ›"), doing nothing itself; any other item, which runs its steps
 * or its action. A menu's list in the panel is saved as rows, each item's
 * other keys kept.
 */

/** A line between a menu's items, with nothing else of its own. */
export const isDivider = (item: MenuItem): boolean => item.type === 'divider';

/** An item that opens a menu of its own (`menu`), or the app's (`menuFrom`), beside it: its items do something, it does not. */
export const opensMenu = (item: MenuItem): boolean => item.menu !== undefined || item.menuFrom !== undefined;

/** Words as an action's name: "Send by email" is `send_by_email`. */
export const actionName = (label: string): string =>
  label
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'action';

/**
 * A row of a menu's list, as the panel saves it: an item's words and the app's
 * action (empty: the action of its words); a divider (`type: "divider"`); an
 * item that opens a menu, by its words alone. A row with the id of an item the
 * menu has keeps that item; one without is a new item.
 */
export interface MenuRow {
  id?: string;
  type?: 'divider';
  label?: string;
  action?: string;
}

/**
 * A menu's items from its list's rows, in the rows' order. An item a row keeps
 * keeps its other keys — its icon, steps, condition — and its shape: a divider
 * stays a line as it is, and an item that opens a menu keeps its menu, only its
 * words changing; any other item takes the row's words and action. A new item
 * is named from `prefix`, never with an id the page or a kept item has (`ids`,
 * the page's, which it adds to).
 */
export function menuOfRows(rows: readonly MenuRow[], kept: readonly MenuItem[], ids: Set<string>, prefix: string): MenuItem[] {
  const keeps = new Map(kept.map((item) => [item.id, item]));
  // The menu's ids are free again but for those its rows keep, which a new item never takes.
  for (const id of keeps.keys()) ids.delete(id);
  for (const row of rows) if (row.id && keeps.has(row.id)) ids.add(row.id);
  return rows.map((row): MenuItem => {
    const own = row.id ? keeps.get(row.id) : undefined;
    const id = own ? own.id : nextName((name) => ids.has(name), prefix, '-');
    ids.add(id);
    if (own && isDivider(own)) return { ...own };
    if (!own && row.type === 'divider') return { id, type: 'divider' };
    const label = row.label ?? own?.label ?? '';
    if (own && opensMenu(own)) return { ...own, label };
    return { ...own, id, label, action: (row.action ?? '').trim() || actionName(label) };
  });
}
