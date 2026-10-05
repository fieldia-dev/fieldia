import { wideColumns, type LayoutNode, type Page, type SectionNode, type TabNode } from '@fieldia/core';

/**
 * Reading a page's layout as the designer lays it out: where a part sits,
 * how many columns a group has, the rows its parts fall into, and what a
 * person calls each part.
 *
 * An *arrangement* is a section with no title in the plain style: it is there
 * only to hold parts side by side, or one under another. In a section with
 * columns, an arrangement lays its parts on the columns it covers there, so
 * they line up with everything above and below — unless it is one column wide
 * with columns of its own, when its parts share that one cell.
 */

/** Anything in a list of parts; a tab sits in its tabs' list. */
export type Part = LayoutNode | TabNode;
/** Anything with a list of parts: a section, a tab, tabs, a step, or the page's own layout. */
export type Holder = { id: string; type: string; children: Part[] };
export interface Spot {
  node: Part;
  parent: Holder;
  list: Part[];
  index: number;
}

// ---- reading the page --------------------------------------------------------------------------------

export const listOf = (node: { type: string } | undefined): Part[] | null => {
  const children = (node as { children?: unknown } | undefined)?.children;
  return Array.isArray(children) ? (children as Part[]) : null;
};

/** A part inside a holder, the list it is in, and its place there, however deep. */
export function find(holder: Holder, id: string): Spot | null {
  const list = listOf(holder) ?? [];
  for (let index = 0; index < list.length; index++) {
    const node = list[index];
    if (node.id === id) return { node, parent: holder, list, index };
    const deeper = find(node as Holder, id);
    if (deeper) return deeper;
  }
  return null;
}

/** A part, the list it is in, and its place there, wherever it sits on the page. */
export const locate = (page: Page, id: string): Spot | null => find(page.layout as Holder, id);

/** The part, or the page's own layout, by id. */
export function nodeOf(page: Page, id: string): Part | Holder | null {
  return page.layout.id === id ? (page.layout as Holder) : (locate(page, id)?.node ?? null);
}

/** Whether `inner` is `outer` or sits somewhere inside it. */
export function contains(page: Page, outer: string, inner: string): boolean {
  const node = nodeOf(page, outer);
  return outer === inner || (!!node && !!find(node as Holder, inner));
}

export const isSection = (node: unknown): node is SectionNode => (node as { type?: string } | null)?.type === 'section';

/** An arrangement: a section with no title in the plain style, there only to hold parts side by side or one under another. */
export const isWrapper = (node: unknown): node is SectionNode => isSection(node) && node.style === 'plain' && !node.title;

export const spanOf = (node: Part): number => (node as { colspan?: number }).colspan ?? 1;

/** The parts that take a width; a divider runs across the whole row. */
export const SPANNED = new Set(['field', 'button', 'text', 'section', 'tabs', 'spacer', 'image', 'form']);

/** Set how many columns a part spans; one is the default, and a part that spans nothing (a divider) is left as it is. */
export function setSpan(node: Part, span: number): void {
  if (!SPANNED.has(node.type)) return;
  const own = node as { colspan?: number };
  if (span <= 1) delete own.colspan;
  else own.colspan = span;
}

/** The columns a section has: its own, or — an arrangement in a grid — the ones it covers there. */
export function colsOf(page: Page, section: SectionNode): number {
  if (onTracks(page, section)) return Math.min(spanOf(section), colsOf(page, locate(page, section.id)?.parent as SectionNode));
  return wideColumns(section.columns);
}

/** How many places a list has across: a section's columns, or one for the page, a step and a tab. */
export const across = (page: Page, holder: Holder | Part): number => (isSection(holder) ? colsOf(page, holder) : 1);

/** Whether a part sits in a grid with columns (not on the page, in a tab or in one column). */
export function inGrid(page: Page, node: Part): boolean {
  const parent = locate(page, node.id)?.parent;
  return isSection(parent) && colsOf(page, parent) > 1;
}

/** One column wide with columns of its own: parts sharing one cell, side by side. */
export const sharesOneCell = (section: SectionNode) => spanOf(section) === 1 && wideColumns(section.columns) > 1;

/** An arrangement in a section with columns lays its parts on the columns it covers there. */
export function onTracks(page: Page, section: SectionNode): boolean {
  if (!isWrapper(section) || sharesOneCell(section)) return false;
  const parent = locate(page, section.id)?.parent;
  return isSection(parent) && parent.columns !== undefined && colsOf(page, parent) > 1;
}

/** A row of parts on the page or in a tab: an arrangement with as many columns as parts. */
export function isRow(page: Page, node: Part | Holder | null): node is SectionNode {
  if (!isWrapper(node) || inGrid(page, node) || onTracks(page, node)) return false;
  const cols = colsOf(page, node);
  return cols >= 2 && node.children.length === cols;
}

export interface Row {
  items: Part[];
  used: number;
}

/**
 * The rows a list's parts fall into, in reading order as the grid places them:
 * a part too wide for what is left of a row starts the next. A divider is a
 * line across the whole row.
 */
export const rowsOf = (page: Page, holder: Holder, skip?: string): Row[] => rowsIn(holder.children, across(page, holder), skip);

/** The rows of a list of parts on a grid of `cols` columns. */
export function rowsIn(list: Part[], cols: number, skip?: string): Row[] {
  const rows: Row[] = [];
  let row: Part[] = [];
  let used = 0;
  for (const part of list) {
    if (part.id === skip) continue;
    const span = part.type === 'divider' ? cols : Math.min(spanOf(part), cols);
    if (used + span > cols && row.length) {
      rows.push({ items: row, used });
      row = [];
      used = 0;
    }
    row.push(part);
    used += span;
  }
  if (row.length) rows.push({ items: row, used });
  return rows;
}

// ---- names --------------------------------------------------------------------------------------------

/** Long words cut short, at the end of a word where there is one near. */
function shortened(text: string): string {
  const cut = text.slice(0, 33);
  const end = cut.lastIndexOf(' ');
  return end > 16 ? cut.slice(0, end) : text.slice(0, 32);
}

/** A part's name as a person reads it. */
export function nameOf(page: Page, node: Part | Holder | null): string {
  if (!node) return '';
  if (node.id === page.layout.id) return page.title || 'Page';
  const part = node as Part;
  switch (part.type) {
    case 'field':
      return part.label ?? page.fields[part.field]?.label ?? part.field;
    case 'section': {
      if (part.title) return part.title;
      // Named by how its parts fall: one under another, side by side, or in rows of so many.
      const rows = rowsOf(page, part);
      const most = rows.reduce((n, r) => Math.max(n, r.items.length), 0);
      return most < 2 ? 'Column' : rows.length > 1 ? `${most} columns` : 'Side by side';
    }
    case 'tabs':
      return 'Tabs';
    case 'tab':
      return part.label;
    case 'text':
      return part.text.length > 34 ? `${shortened(part.text)}…` : part.text;
    case 'button':
      return part.label;
    case 'image':
      return part.alt || 'Image';
    case 'slot':
      return part.name;
    case 'form':
      // Its own words, or its answers' name as words: “Address 2”.
      return part.title || `${part.name.charAt(0).toUpperCase()}${part.name.slice(1).replace(/_/g, ' ')}`;
    default:
      return part.type === 'divider' ? 'Divider' : 'Spacer';
  }
}

export const andList = (words: string[]) => (words.length <= 2 ? words.join(' and ') : `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`);

/** A part as people see it: an arrangement is named by what it holds. */
export function seenAs(page: Page, node: Part | Holder): string {
  if (!isWrapper(node)) return `“${nameOf(page, node)}”`;
  return andList(node.children.map((c) => `“${nameOf(page, c)}”`));
}
