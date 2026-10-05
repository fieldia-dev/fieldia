import { wideColumns, type FieldNode, type Page, type SectionNode } from '@fieldia/core';
import { kindById, kindOfField } from './kinds';
import { isWrapper, listOf, nameOf, type Part } from './layout-tree';
import { columnId } from './list-commands';

/**
 * The page as the outline's rows: every part in reading order — groups,
 * arrangements, tabs and each tab, a survey's pages, fields, and the blocks
 * between them — each named as a person reads it, with what holds it and
 * whether it holds parts of its own. No DOM: the outline draws these.
 */

export interface OutlineRow {
  id: string;
  /** What a person calls it: a field's label, a group's title, an arrangement's “Side by side”. */
  label: string;
  /** What kind of part it is, in words: “Short answer”, “Group”, “Tab”, “Page”. */
  kind: string;
  /** How deep it sits: 0 at the top. */
  level: number;
  /** Its icon, by name: one of the designer's, or a block's (`block`). */
  icon: string;
  block?: boolean;
  /** The row it sits in; null at the top. */
  parent: string | null;
  /** It holds parts — a group, an arrangement, tabs, a tab, a page — so it folds, and takes parts dropped in. */
  holds: boolean;
  /** How many rows sit right under it. */
  children: number;
  /** Shown only for some answers or records. */
  ruled: boolean;
  /** Always needs an answer. */
  required: boolean;
  /** A group's columns on a desktop, a tablet and a phone: “3·3·1”, a dash where the skin stacks them; and that in words. */
  badge?: string;
  badgeWords?: string;
  /** A part of the layout, which moves: not a sheet's header part or a list's column. */
  movable: boolean;
}

const ruled = (invisible: unknown) => invisible !== undefined && invisible !== null && invisible !== false && invisible !== '';

/** A group's columns at each size of screen, as the badge shows them and in words; nothing for one column. */
function columnsBadge(section: SectionNode): Pick<OutlineRow, 'badge' | 'badgeWords'> {
  const columns = section.columns;
  if (typeof columns !== 'object') return wideColumns(columns) > 1 ? { badge: String(columns), badgeWords: `${columns} columns, stacked on smaller screens as the skin does` } : {};
  const at = (count: number | undefined, screen: string) => (count === undefined ? `${screen} as the skin stacks them` : `${screen} ${count}`);
  return { badge: [columns.wide, columns.medium ?? '–', columns.narrow ?? '–'].join('·'), badgeWords: `Columns: ${at(columns.wide, 'desktop')}, ${at(columns.medium, 'tablet')}, ${at(columns.narrow, 'phone')}` };
}

const BLOCK_KINDS: Record<string, [kind: string, icon: string]> = {
  divider: ['Line', 'divider'],
  spacer: ['Room', 'spacer'],
  image: ['Picture', 'image'],
  button: ['Button', 'button'],
  slot: ['Slot', 'group'],
  form: ['Saved form', 'form'],
};
const TEXT_KINDS: Record<string, [kind: string, icon: string]> = { heading: ['Heading', 'heading'], note: ['Note', 'text'], paragraph: ['Words', 'text'] };

/** One part's row. */
function rowOf(page: Page, node: Part, level: number, parent: string | null): OutlineRow {
  const kids = listOf(node);
  const base = { id: node.id, level, parent, holds: !!kids, children: kids?.length ?? 0, ruled: ruled((node as { invisible?: unknown }).invisible), required: false, movable: true };
  switch (node.type) {
    case 'field': {
      const def = page.fields[node.field];
      const kind = def ? kindOfField(def, node) : null;
      const required = def?.required === true || (node as FieldNode).required === true;
      return { ...base, label: nameOf(page, node), kind: kind ? kindById(kind).label : 'Custom', icon: kind ?? 'short-answer', required };
    }
    case 'section': {
      const section: SectionNode = node;
      // Asked of the part as it is: a guard that says no would leave no section to read.
      if (isWrapper(section as unknown)) return { ...base, label: nameOf(page, section), kind: 'Side by side', icon: 'side', block: true, ...columnsBadge(section) };
      return { ...base, label: section.title || 'Untitled section', kind: 'Group', icon: 'section', ...columnsBadge(section) };
    }
    case 'tabs':
      return { ...base, label: 'Tabs', kind: `${node.children.length} tab${node.children.length === 1 ? '' : 's'}`, icon: 'tabs' };
    case 'tab':
      return { ...base, label: node.label || 'Untitled tab', kind: 'Tab', icon: 'tabs', block: true };
    case 'text': {
      const [kind, icon] = TEXT_KINDS[node.style ?? 'paragraph'] ?? TEXT_KINDS['paragraph'];
      return { ...base, label: nameOf(page, node), kind, icon, block: true };
    }
    default: {
      const [kind, icon] = BLOCK_KINDS[node.type] ?? ['Part', 'group'];
      return { ...base, label: nameOf(page, node), kind, icon, block: true };
    }
  }
}

/** The page as rows of a tree, in reading order. */
export function outlineRows(page: Page): OutlineRow[] {
  const root = page.layout;
  const rows: OutlineRow[] = [];
  const fixed = (id: string, label: string, kind: string, icon: string, invisible?: unknown, block = false): OutlineRow => ({ id, label, kind, level: 0, icon, block, parent: null, holds: false, children: 0, ruled: ruled(invisible), required: false, movable: false });
  if (root.type === 'list') return root.columns.map((name) => fixed(columnId(name), page.fields[name]?.label ?? name, 'Column', 'lines'));
  if (root.type === 'wizard') {
    for (const step of root.children) {
      rows.push({ id: step.id, label: step.label || 'Untitled page', kind: 'Page', level: 0, icon: 'section', parent: null, holds: true, children: step.children.length, ruled: ruled(step.invisible), required: false, movable: true });
      for (const node of step.children) walk(node, 1, step.id);
    }
    return rows;
  }
  if (root.type === 'sheet') {
    // The header's parts: picked from here, moved along their own row on the canvas.
    if (root.statusbar) rows.push(fixed('#statusbar', 'Status steps', page.fields[root.statusbar.field]?.label ?? 'Status', 'status'));
    for (const part of root.buttons ?? []) rows.push(fixed(part.id, part.label, 'Button', 'button', part.invisible, true));
    for (const part of root.statButtons ?? []) rows.push(fixed(part.id, part.label, 'Counter', 'number', part.invisible));
    for (const part of root.badges ?? []) rows.push(fixed(part.id, part.label, 'Badge', 'keywords', part.invisible));
  }
  function walk(node: Part, level: number, parent: string | null) {
    rows.push(rowOf(page, node, level, parent));
    for (const child of listOf(node) ?? []) walk(child, level + 1, node.id);
  }
  for (const node of (root as { children?: Part[] }).children ?? []) walk(node, 0, null);
  return rows;
}

/** The rows on show: none inside a folded row, however deep. */
export function shownRows(rows: readonly OutlineRow[], folded: ReadonlySet<string>): OutlineRow[] {
  const shown: OutlineRow[] = [];
  let hiddenBelow = Infinity;
  for (const row of rows) {
    if (row.level > hiddenBelow) continue;
    hiddenBelow = Infinity;
    shown.push(row);
    if (row.holds && row.children && folded.has(row.id)) hiddenBelow = row.level;
  }
  return shown;
}

/** The rows a row sits inside, nearest first. */
export function ancestorsOf(rows: readonly OutlineRow[], id: string): string[] {
  const byId = new Map(rows.map((r) => [r.id, r]));
  const found: string[] = [];
  for (let at = byId.get(id)?.parent ?? null; at !== null; at = byId.get(at)?.parent ?? null) found.push(at);
  return found;
}
