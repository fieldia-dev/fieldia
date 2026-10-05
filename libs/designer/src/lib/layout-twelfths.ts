import { wideColumns, type ColumnCount, type ColumnsByWidth, type Page, type SectionNode } from '@fieldia/core';
import { across, isSection, isWrapper, locate, nameOf, onTracks, rowsIn, rowsOf, setSpan, sharesOneCell, spanOf, type Holder, type Part, type Row } from './layout-tree';

/**
 * Groups in twelfths, as Bootstrap's and Vueform's rows divide, and as
 * Grafloria's split board fits its panes: each row of a group divides twelve
 * ways, its own way. A part dropped beside another re-divides only that row;
 * a part leaving a row closes it up. A group keeps each row full — its parts
 * sharing the width, a part alone taking all of it — or, saying `rows:
 * 'gaps'`, lets a part keep its width when a neighbour leaves.
 *
 * A group of one to four columns is divided in twelfths the first time an
 * Advanced gesture needs it (a drop beside one of its parts, a gutter or a
 * width handle dragged), inside the same edit: each part as wide as it was,
 * so nothing moves.
 */

export const TWELVE = 12;

/** A group: a section with columns of its own — titled, or drawn — not an arrangement laying parts out. */
export const isGroup = (node: unknown): node is SectionNode => isSection(node) && !isWrapper(node);
/** A group whose rows divide in twelfths. */
export const inTwelfths = (node: unknown): node is SectionNode => isGroup(node) && wideColumns(node.columns) === TWELVE;
/** A group in twelfths, or one of one to four columns that a gesture divides in twelfths. */
export const twelfthsAhead = (node: unknown): node is SectionNode => isGroup(node) && (wideColumns(node.columns) <= 4 || inTwelfths(node));
/** Whether a group keeps each row full, the default, rather than leaving gaps. */
export const keepsFull = (group: SectionNode): boolean => group.rows !== 'gaps';

/** Whether a holder lays its parts in twelfths: a group in twelfths, or an arrangement on one's columns. */
export function laidInTwelfths(page: Page, holder: Holder | Part | null | undefined): boolean {
  if (inTwelfths(holder)) return true;
  return isSection(holder) && onTracks(page, holder) && laidInTwelfths(page, locate(page, holder.id)?.parent);
}

/** How many columns a part takes on a grid of `cols`: a divider all of them. */
const widthOn = (part: Part, cols: number) => (part.type === 'divider' ? cols : Math.min(spanOf(part), cols));

/** Widths scaled to add up to `total`, in whole columns: the largest remainders round up, and each keeps one at least. */
export function shares(spans: number[], total: number): number[] {
  const sum = spans.reduce((a, b) => a + b, 0);
  const exact = spans.map((s) => (s * total) / sum);
  const out = exact.map((e) => Math.max(1, Math.floor(e)));
  let left = total - out.reduce((a, b) => a + b, 0);
  // The largest remainders first; among equals, the earlier.
  const order = exact.map((_, i) => i).sort((a, b) => (exact[b] % 1) - (exact[a] % 1) || a - b);
  for (let k = 0; left > 0; k++, left--) out[order[k % out.length]]++;
  // Each kept one, more than there was room for: the widest give it back.
  for (; left < 0; left++) {
    const i = out.indexOf(out.reduce((a, b) => Math.max(a, b)));
    if (out[i] < 2) break;
    out[i]--;
  }
  return out;
}

/** The columns an arrangement lays its parts on, on a grid of `cols`: those it covers there, unless it shares one; else its own. */
const innerOf = (part: SectionNode, cols: number) => (cols > 1 && !sharesOneCell(part) ? Math.min(spanOf(part), cols) : wideColumns(part.columns));

/** A part made `span` wide, from a grid of `from` columns onto one of `to`: an arrangement lays its own parts on its new columns. */
export function resize(part: Part, span: number, from = TWELVE, to = TWELVE): void {
  if (!isWrapper(part)) return setSpan(part, span);
  const was = innerOf(part, from);
  setSpan(part, span);
  // One twelfth wide with columns of its own, it would share that twelfth: it keeps to it.
  if (span === 1 && to === TWELVE) part.columns = 1;
  relay(part.children, was, innerOf(part, to));
}

/** Parts laid on `from` columns, laid on `to` instead: each row shared out as it was, as wide as it was. */
export function relay(list: Part[], from: number, to: number): void {
  if (from === to) return;
  for (const row of rowsIn(list, from)) {
    const spans = row.items.map((p) => widthOn(p, from));
    const next = shares(spans, Math.max(row.items.length, Math.round((row.used * to) / from)));
    row.items.forEach((p, i) => resize(p, next[i], from, to));
  }
}

/** Parts of a row widened, or narrowed, to fill `total` of a group in twelfths together, as they shared it. */
export function fill(row: Part[], total = TWELVE): void {
  if (!row.length) return;
  const next = shares(row.map((p) => widthOn(p, TWELVE)), total);
  row.forEach((p, i) => resize(p, next[i]));
}

/** Columns at each width: the widest `wide`, each narrower one as `each` says (a plain number when only the widest is given). */
function withWide(columns: SectionNode['columns'], wide: number, each: (n: number) => number): ColumnCount | ColumnsByWidth {
  if (typeof columns !== 'object' || (!columns.medium && !columns.narrow)) return wide as ColumnCount;
  const by: ColumnsByWidth = { wide: wide as ColumnCount };
  if (columns.medium) by.medium = each(columns.medium) as ColumnCount;
  if (columns.narrow) by.narrow = each(columns.narrow) as ColumnCount;
  return by;
}

/** A group of one to four columns divided in twelfths: each part, and each arrangement's parts, as wide as it was. */
export function toTwelfths(group: SectionNode): void {
  const cols = wideColumns(group.columns);
  if (cols === TWELVE) return;
  relay(group.children, cols, TWELVE);
  // A tablet and a phone keep a row's proportions, or stack it.
  group.columns = withWide(group.columns, TWELVE, (n) => (n > 1 ? TWELVE : n));
}

/**
 * A new column inside a group, beside all its rows, as Grafloria splits a
 * section's content: the rows go into an arrangement on half the group's
 * tracks, keeping their shares there, and the part takes the other half.
 * `from` is the columns the part had where it came from.
 */
export function columnInside(group: SectionNode, part: Part, after: boolean, id: string, from = 1): void {
  toTwelfths(group);
  const half = TWELVE / 2;
  const rows: SectionNode = { type: 'section', id, style: 'plain', columns: half as ColumnCount, children: group.children };
  relay(rows.children, TWELVE, half);
  setSpan(rows, half);
  resize(part, half, from);
  group.children = (after ? [rows, part] : [part, rows]) as SectionNode['children'];
}

/** A group in twelfths on one to four columns again: each part as near as wide as it was. */
export function fromTwelfths(group: SectionNode, cols: number): void {
  relay(group.children, TWELVE, cols);
  group.columns = withWide(group.columns, cols, (n) => (n > 1 ? cols : n));
}

/**
 * Where a part dropped beside `target` in a group goes, the group in twelfths
 * (or about to be): along its own row, every width kept; into the room a row
 * that leaves gaps has; else into the row, which divides equally — four to a
 * row. `row` is the target's row without the part dropped.
 */
export type Beside = { how: 'reorder' | 'divide'; row: Part[] } | { how: 'room'; row: Part[]; span: number } | { how: 'refused'; why: string };

export function besideIn(page: Page, group: SectionNode, target: Part, moving?: string): Beside {
  const own = rowsOf(page, group).find((r) => r.items.includes(target)) as Row;
  if (moving && own.items.some((p) => p.id === moving)) return { how: 'reorder', row: own.items.filter((p) => p.id !== moving) };
  const full = keepsFull(group);
  // A part leaving a row that keeps gaps lets the rest move up, as the grid lays them out; a full row closes up and stays a row.
  const row = full ? own.items : (rowsOf(page, group, moving).find((r) => r.items.includes(target)) as Row).items;
  if (row.length >= 4) return { how: 'refused', why: 'A row holds four' };
  const cols = across(page, group);
  const used = (row.reduce((n, p) => n + widthOn(p, cols), 0) * TWELVE) / cols;
  return !full && used < TWELVE ? { how: 'room', row, span: TWELVE - used } : { how: 'divide', row };
}

const PARTS_IN: Record<number, string> = { 2: 'halves', 3: 'thirds', 4: 'quarters' };

/** A drop beside a part in a group, in the words the chip says: "between “Customer” and “Visit date” — the row in thirds". */
export function besideWords(page: Page, plan: Beside, target: Part, after: boolean): string {
  if (plan.how === 'refused') return plan.why;
  const name = (p: Part) => `“${nameOf(page, p)}”`;
  if (plan.how === 'room') return `beside ${name(target)}, in the room left`;
  const at = plan.row.indexOf(target) + (after ? 1 : 0);
  const [before, next] = [plan.row[at - 1], plan.row[at]];
  const where = before && next ? `between ${name(before)} and ${name(next)}` : before ? `at the end of the row, after ${name(before)}` : `at the start of the row, before ${name(next)}`;
  return plan.how === 'divide' ? `${where} — the row in ${PARTS_IN[plan.row.length + 1]}` : where;
}

/** The width a part takes where it lands: in or out of twelfths, as wide a share of the row as it had; new in twelfths, the whole row; else no wider than there. */
export function landingSpan(page: Page, part: Part, box: Holder, from?: { cols: number; twelfths: boolean }): number {
  const cols = across(page, box);
  const here = laidInTwelfths(page, box);
  if (!from) return here ? cols : Math.min(spanOf(part), cols);
  if (from.twelfths === here) return Math.min(spanOf(part), cols);
  return Math.max(1, Math.min(cols, Math.round((Math.min(spanOf(part), from.cols) * cols) / from.cols)));
}

/**
 * Put parts in a list at a place, each as wide as `width` says. In a group
 * that keeps its rows full, each is a row of its own, and a row they land in
 * the middle of closes up either side of them.
 */
export function putAt(page: Page, holder: Holder, index: number, parts: Part[], width: (part: Part) => number, from: (part: Part) => number | undefined = () => 1): void {
  const list = holder.children;
  const full = inTwelfths(holder) && keepsFull(holder);
  const split = full && index > 0 ? rowsOf(page, holder).find((r) => r.items.includes(list[index - 1]) && r.items.includes(list[index])) : undefined;
  list.splice(index, 0, ...parts);
  const cols = across(page, holder);
  for (const part of parts) resize(part, full ? TWELVE : width(part), from(part) ?? 1, cols);
  if (!split) return;
  const cut = split.items.indexOf(list[index + parts.length]);
  fill(split.items.slice(0, cut));
  fill(split.items.slice(cut));
}

const FRACTIONS: [number, string][] = [
  [12, 'the whole row'],
  [9, 'three quarters of the row'],
  [8, 'two thirds of the row'],
  [6, 'half the row'],
  [4, 'a third of the row'],
  [3, 'a quarter of the row'],
];

/** The fractions of a row a part in twelfths is offered: in twelfths, as a short word, its label, and its name in a menu. */
export const ROW_PARTS: { span: number; words: string; label: string; name: string }[] = [
  { span: 12, words: 'Whole', label: 'Whole row', name: 'Whole row' },
  { span: 9, words: '¾', label: '¾ of the row', name: 'Three quarters' },
  { span: 8, words: '⅔', label: '⅔ of the row', name: 'Two thirds' },
  { span: 6, words: '½', label: '½ of the row', name: 'Half' },
  { span: 4, words: '⅓', label: '⅓ of the row', name: 'A third' },
  { span: 3, words: '¼', label: '¼ of the row', name: 'A quarter' },
];

/** A part's width as a share of a row of `cols` columns, in words: "half the row", "58% of the row". */
export function rowShare(span: number, cols = TWELVE): string {
  return FRACTIONS.find(([n]) => n * cols === span * TWELVE)?.[1] ?? `${percent(span, cols)}% of the row`;
}

/** A width as a whole percentage of a row. */
export const percent = (span: number, cols = TWELVE): number => Math.round((Math.min(span, cols) / cols) * 100);

/**
 * The widths a part in a group that keeps its rows full can take: the whole
 * row (the rest of it then a row of their own), or what leaves the rest of
 * its row a twelfth each. A part alone in its row takes all of it.
 */
export function widthsFor(page: Page, group: SectionNode, part: Part): (span: number) => boolean {
  if (!keepsFull(group)) return () => true;
  const rest = (rowsOf(page, group).find((r) => r.items.includes(part))?.items.length ?? 1) - 1;
  return (span) => span === TWELVE || (rest > 0 && TWELVE - span >= rest);
}
