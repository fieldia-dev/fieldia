/**
 * The outline's keys, as a tree's (the WAI-ARIA tree pattern): ↑ and ↓ go
 * from row to row, → unfolds a row and then goes to its first part, ← folds
 * it and then goes to the row it sits in (mirrored right to left), Home and
 * End go to the ends, and the first letters of a name go to it. Enter picks
 * the row and shows it on the page; Space picks it, or with ⌘ or Ctrl adds
 * it to what is picked. No DOM: the outline does what these say.
 */

/** What a key needs to know of a row on show. */
export interface TreeRow {
  id: string;
  label: string;
  level: number;
  parent: string | null;
  holds: boolean;
  children: number;
}

export type TreeStep =
  /** Go to the row at `to`; with `extend`, the pick reaches from where it began to there. */
  | { to: number; extend: boolean }
  | { fold: string }
  | { unfold: string }
  /** Pick the row on: alone, or added to (or let go from) what is picked; `reveal` shows it on the page. */
  | { pick: 'one' | 'toggle'; reveal: boolean }
  /** A tree's key, with nowhere to go. */
  | { none: true };

type Keys = Pick<KeyboardEvent, 'key' | 'shiftKey' | 'ctrlKey' | 'metaKey' | 'altKey'>;

/** What a key does on the row at `at` of the rows on show; null when it is not the tree's to answer. */
export function treeKey(rows: readonly TreeRow[], at: number, event: Keys, rtl: boolean, folded: ReadonlySet<string>): TreeStep | null {
  if (event.altKey) return null;
  const mod = event.ctrlKey || event.metaKey;
  if (event.key === ' ') return { pick: mod ? 'toggle' : 'one', reveal: false };
  if (mod) return null;
  const go = (to: number): TreeStep => (to < 0 || to >= rows.length ? { none: true } : { to, extend: event.shiftKey });
  const row = rows[at];
  const opens = !!row && row.holds && row.children > 0;
  switch (event.key) {
    case 'ArrowDown':
      return go(at + 1);
    case 'ArrowUp':
      return go(at - 1);
    case 'Home':
      return go(0);
    case 'End':
      return go(rows.length - 1);
    case 'Enter':
      return { pick: 'one', reveal: true };
    case 'ArrowLeft':
    case 'ArrowRight': {
      if (!row) return { none: true };
      const inward = (event.key === 'ArrowRight') !== rtl;
      if (inward) return !opens ? { none: true } : folded.has(row.id) ? { unfold: row.id } : go(at + 1);
      if (opens && !folded.has(row.id)) return { fold: row.id };
      const parent = row.parent === null ? -1 : rows.findIndex((r) => r.id === row.parent);
      return parent === -1 ? { none: true } : go(parent);
    }
    default:
      return null;
  }
}

/**
 * The row the letters typed so far go to: the next whose name starts with
 * them, from the one after the row on (round to the top) for a first letter,
 * from the row on itself for more — so a name typed on stays where it is —
 * and the same letter again goes round the rows starting with it. -1 for none.
 */
export function typeAhead(rows: readonly TreeRow[], at: number, typed: string): number {
  const letters = typed.toLowerCase();
  if (!letters) return -1;
  const again = [...letters].every((c) => c === letters[0]);
  const words = again ? letters[0] : letters;
  const from = again ? at + 1 : at;
  for (let step = 0; step < rows.length; step++) {
    const index = (from + step) % rows.length;
    if (rows[index].label.toLowerCase().startsWith(words)) return index;
  }
  return -1;
}

/** The outline's keys, as the sheet of shortcuts lists them. */
export const OUTLINE_KEYS: [string, string][] = [
  ['↑ / ↓', 'Go to the row before or after'],
  ['← / →', 'Fold or unfold a row, or go to the row it sits in or its first part'],
  ['Home / End', 'Go to the first or the last row'],
  ['A letter', 'Go to the next row whose name starts with it'],
  ['Enter', 'Pick it and show it on the page'],
  ['Space', 'Pick it (⌘ or Ctrl adds it to what is picked)'],
  ['Shift+↑ / ↓', 'Pick the rows on the way too'],
  ['Shift-click', 'Pick every row from the one picked to this one'],
  ['⌘-click', 'Pick one more row, or let it go (Ctrl-click on Windows)'],
  ['Alt+↑ / Alt+↓', 'Move what is picked before the row above it or after the row below'],
  ['Alt+← / Alt+→', 'Take what is picked out of its group, or put it in the group before it'],
  ['Delete', 'Take what is picked off the page'],
];
