import type { Page } from '@fieldia/core';
import { isWrapper, listOf, locate, nameOf, type Holder } from './layout-tree';
import { partsInOrder } from './outline-moves';

/**
 * Moving the rows picked in the outline from the keyboard, in reading order:
 *
 *  Alt+↑ / Alt+↓   before the part above them, or after the part below, in
 *                  their own list — out of an arrangement at its edge, and on
 *                  to the page before or after for a survey's question;
 *  Alt+←           out of their group, after it (out of a tab, after its tabs);
 *  Alt+→           into the group just before them, at its end (into the
 *                  last tab of tabs);
 *
 * mirrored right to left. No DOM, and no edit: it says where they would go,
 * as a place for `moveParts`, or in words why they cannot.
 */

export type KeyPlace = { parent: string; index: number } | { said: string };

/** Where Alt and an arrow would take the parts; null when the key is not one of these. */
export function outlineKeyMove(page: Page, ids: string[], key: { key: string; altKey: boolean }, rtl: boolean): KeyPlace | null {
  if (!key.altKey || !ids.length || !['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(key.key)) return null;
  // A part picked inside another part picked goes with it.
  const outer = partsInOrder(page, ids);
  if (!outer.length) return null;
  if (outer.some((s) => s.list !== outer[0].list)) return { said: 'Pick parts in the same group to move them together' };
  const { parent, list } = outer[0];
  const indexes = outer.map((s) => s.index);
  const first = Math.min(...indexes);
  const last = Math.max(...indexes);
  const one = outer.length === 1;
  const it = one ? 'It is' : 'They are';
  const them = one ? 'it' : 'them';
  const root = page.layout as Holder;
  const wizard = root.type === 'wizard';
  const name = (holder: Holder) => `“${nameOf(page, holder)}”`;
  const holderOf = (holder: Holder) => locate(page, holder.id);

  if (key.key === 'ArrowUp' || key.key === 'ArrowDown') {
    const down = key.key === 'ArrowDown';
    if (down ? last < list.length - 1 : first > 0) return { parent: parent.id, index: down ? last + 2 : first - 1 };
    // At the edge of an arrangement — there only to lay parts out — they step out of it.
    const around = isWrapper(parent) ? holderOf(parent) : null;
    if (around) return { parent: around.parent.id, index: around.index + (down ? 1 : 0) };
    // A survey's question goes on to the next page, or back to the page before.
    if (wizard && parent.id !== root.id) {
      const steps = root.children as Holder[];
      const step = steps.findIndex((s) => s.id === parent.id);
      const next = steps[step + (down ? 1 : -1)];
      if (next) return { parent: next.id, index: down ? 0 : next.children.length };
      return { said: `${it} at the ${down ? 'bottom of the last' : 'top of the first'} page` };
    }
    if (parent.id === root.id) return { said: `${it} at the ${down ? 'bottom' : 'top'} of the page` };
    return { said: `${it} at the ${down ? 'bottom' : 'top'} of ${name(parent)}: Alt+${rtl ? '→' : '←'} takes ${them} out` };
  }

  const outward = (key.key === 'ArrowLeft') !== rtl;
  if (outward) {
    if (parent.id === root.id) return { said: `${it} on the page itself, in no group` };
    if (wizard && root.children.some((s) => s.id === parent.id)) return { said: 'A question goes on a page' };
    if (parent.type === 'tabs') return { said: 'A tab moves only among its tabs' };
    // Out of a tab: after its tabs.
    const from = parent.type === 'tab' ? (locate(page, parent.id)?.parent as Holder) : parent;
    const around = holderOf(from);
    if (!around) return { said: `${it} on the page itself, in no group` };
    return { parent: around.parent.id, index: around.index + 1 };
  }
  const before = list[first - 1];
  const into = before?.type === 'tabs' ? before.children[before.children.length - 1] : before;
  const inner = into ? listOf(into) : null;
  if (!into || !inner) return { said: `There is no group before ${them} to put ${them} in` };
  return { parent: into.id, index: inner.length };
}
