import type { SortOrder } from '@fieldia/core';

/**
 * A list's order by its headers: the keys a person chose, the first leading — a header's press makes its column the
 * one key (pressed again, the other way), a press with Shift adds it after those chosen (pressed again with Shift, the
 * other way; a third time, it goes) — and the list's own order after them, breaking their ties.
 */

/** The keys after a header's press: `adding` with Shift held. `from` is the order the list stands in now, its own included. */
export function pressedSort(from: readonly SortOrder[], field: string, adding: boolean): SortOrder[] {
  // Nearest a place (a map's "Nearest first") is no column's order: a press starts afresh from it.
  const keys = from.filter((order) => !order.near);
  if (!adding) return [{ field, ...(keys[0]?.field === field && !keys[0].desc ? { desc: true } : {}) }];
  const at = keys.findIndex((order) => order.field === field);
  if (at < 0) return [...keys, { field }];
  // Ascending, then descending, then off — never the last key off: it turns back to ascending.
  if (!keys[at].desc) return keys.map((order, i) => (i === at ? { field, desc: true } : order));
  return keys.length > 1 ? keys.filter((_, i) => i !== at) : [{ field }];
}

/** The order a list asks for: the keys chosen, then its own order where it names other fields. */
export const sortWith = (keys: readonly SortOrder[], own: readonly SortOrder[]): SortOrder[] =>
  keys.length ? [...keys, ...own.filter((order) => !keys.some((key) => key.field === order.field))] : [...own];

/**
 * Each header marked with its place in the order: the first key's `aria-sort` (a table says one), each key's
 * `data-sort` for its arrow, and where several keys are chosen, its number beside its words ("2") and what that means
 * to a screen reader ("sorted 2 of 3, descending").
 */
export function markSort(
  headers: ReadonlyMap<string, HTMLElement>,
  keys: readonly SortOrder[],
  words: (n: number, total: number, desc: boolean) => string,
  number: (n: number) => string
): void {
  const several = keys.length > 1;
  for (const [field, th] of headers) {
    const at = keys.findIndex((order) => order.field === field);
    const order = at >= 0 ? keys[at] : null;
    const way = order?.desc ? 'descending' : 'ascending';
    if (order && at === 0) th.setAttribute('aria-sort', way);
    else th.removeAttribute('aria-sort');
    if (order) th.setAttribute('data-sort', way);
    else th.removeAttribute('data-sort');
    const button = th.querySelector(':scope > .fd-list-sort');
    if (!button) continue;
    let rank = button.querySelector<HTMLElement>(':scope > .fd-list-sort-rank');
    let said = button.querySelector<HTMLElement>(':scope > .fd-sr-only');
    if (!order || !several) {
      rank?.remove();
      said?.remove();
      continue;
    }
    const doc = th.ownerDocument;
    if (!rank) {
      rank = doc.createElement('span');
      rank.className = 'fd-list-sort-rank';
      rank.setAttribute('aria-hidden', 'true');
      button.append(rank);
    }
    if (!said) {
      said = doc.createElement('span');
      said.className = 'fd-sr-only';
      button.append(said);
    }
    rank.textContent = number(at + 1);
    // After the header's words, a space apart: a name joins its inline parts as they are.
    said.textContent = ` ${words(at + 1, keys.length, !!order.desc)}`;
  }
}
