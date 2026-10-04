import type { Page, PageLook, SectionNode, TabsNode } from '@fieldia/core';
import { andList, isSection, isWrapper, listOf, nameOf, rowsOf, seenAs, spanOf, type Holder, type Part } from './layout-tree';

/**
 * What changed in a page's layout, in the words a person would use for what
 * they did: put a part beside another, grouped some, made tabs, ungrouped,
 * set columns, widths and looks — and blocks added, removed or reworded.
 *
 * Arrangements are not groups to a person: they only lay parts side by side,
 * so a part's group is the nearest one that is not an arrangement, and a part
 * has moved when it is in another group, or out of its order in its own.
 */

/** Where each part sits as a person sees it. */
export interface Placements {
  /** Each part's group, tab, step or page. */
  holder: Map<string, Holder>;
  /** Each part's own parent: its group, or the arrangement it is in. */
  parent: Map<string, Holder>;
  /** Each group's parts, in reading order (arrangements read through). */
  order: Map<string, string[]>;
  /** Every part, group, tab and arrangement, by id. */
  node: Map<string, Part | Holder>;
}

export function placements(page: Page): Placements {
  const out: Placements = { holder: new Map(), parent: new Map(), order: new Map(), node: new Map([[page.layout.id, page.layout as Holder]]) };
  const walk = (box: Holder, named: Holder) => {
    for (const child of box.children) {
      out.node.set(child.id, child);
      // A tab and a step are each a group of their own; an arrangement is read through.
      if (child.type === 'tab' || (child.type as string) === 'step') {
        walk(child as Holder, child as Holder);
        continue;
      }
      out.parent.set(child.id, box);
      if (isWrapper(child)) {
        walk(child as Holder, named);
        continue;
      }
      out.holder.set(child.id, named);
      out.order.set(named.id, [...(out.order.get(named.id) ?? []), child.id]);
      if (listOf(child)) walk(child as Holder, child as Holder);
    }
  };
  if (listOf(page.layout)) walk(page.layout as Holder, page.layout as Holder);
  return out;
}

export interface LayoutChanges {
  /** The layout's own lines, in the order they are said. */
  lines: string[];
  /** Parts, groups and tabs these lines speak for: they need no line of their own for being added, removed or moved. */
  said: Set<string>;
  /** Where a new part went, when it went beside or under another: "beside “First name”". */
  placed: Map<string, string>;
  before: Placements;
  after: Placements;
}

/** The longest run of ids both lists keep in the same order. */
function keptInOrder(a: string[], b: string[]): Set<string> {
  const t = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) for (let j = b.length - 1; j >= 0; j--) t[i][j] = a[i] === b[j] ? t[i + 1][j + 1] + 1 : Math.max(t[i + 1][j], t[i][j + 1]);
  const kept = new Set<string>();
  for (let i = 0, j = 0; i < a.length && j < b.length; ) {
    if (a[i] === b[j]) {
      kept.add(a[i]);
      i++;
      j++;
    } else if (t[i + 1][j] >= t[i][j + 1]) i++;
    else j++;
  }
  return kept;
}

/** A part's name in quotes; an arrangement's, by what it holds. */
const quoted = (page: Page, node: Part | Holder) => seenAs(page, node);

/** Where a part sits next to another: beside the one sharing its row, or under or above the next in a column. */
function nearby(page: Page, parent: Holder | undefined, node: Part): string | null {
  if (!isSection(parent)) return null;
  const rows = rowsOf(page, parent);
  const row = rows.find((r) => r.items.includes(node));
  const at = row?.items.indexOf(node) ?? -1;
  const mate = row?.items[at - 1] ?? row?.items[at + 1];
  if (mate) return `beside ${quoted(page, mate)}`;
  if (!isWrapper(parent) || rows.some((r) => r.items.length > 1)) return null;
  const index = parent.children.indexOf(node as SectionNode['children'][number]);
  return index > 0 ? `under ${quoted(page, parent.children[index - 1])}` : `above ${quoted(page, parent.children[1])}`;
}

const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? '' : 's'}`;

/** Columns in words: "3 columns", or "3 columns on a desktop, 1 on a phone". */
function columnsWords(columns: SectionNode['columns']): string {
  if (typeof columns !== 'object') return plural(columns ?? 1, 'column');
  const smaller = [columns.medium ? `${columns.medium} on a tablet` : '', columns.narrow ? `${columns.narrow} on a phone` : ''].filter(Boolean);
  return smaller.length ? `${plural(columns.wide, 'column')} on a desktop, ${smaller.join(', ')}` : plural(columns.wide, 'column');
}

const STYLES: Record<string, string> = { card: 'as a card', plain: 'plain, with no box', line: 'with a line under its title', framed: 'in a frame, its title on it' };
const LABELS: Record<string, string> = { above: 'above their boxes', beside: 'beside their boxes', hidden: 'inside their boxes' };
const LABEL: Record<string, string> = { above: 'above its box', beside: 'beside its box', hidden: 'inside its box' };

/** A block by what it is: "the heading “Before you send”", "a divider". */
function blockWords(page: Page, node: Part): string | null {
  switch (node.type) {
    case 'text':
      return `the ${node.style === 'heading' ? 'heading' : 'words'} “${nameOf(page, node)}”`;
    case 'button':
      return `the button “${node.label}”`;
    case 'image':
      return node.alt ? `the image “${node.alt}”` : 'an image';
    case 'divider':
    case 'spacer':
      return `a ${node.type}`;
    default:
      return null;
  }
}

export function layoutChanges(before: Page, after: Page): LayoutChanges {
  const was = placements(before);
  const now = placements(after);
  const lines: string[] = [];
  const said = new Set<string>();
  const placed = new Map<string, string>();
  const existed = (id: string) => was.node.has(id);
  const stays = (id: string) => now.node.has(id);
  const say = (ids: Iterable<string>) => {
    for (const id of ids) said.add(id);
  };

  // Which parts moved: into another group, or out of their order in their own.
  const moved = new Set<string>();
  for (const [id, holder] of now.holder) if (was.holder.has(id) && was.holder.get(id)?.id !== holder.id) moved.add(id);
  for (const [holder, order] of now.order) {
    const stayed = (ids: string[]) => ids.filter((id) => was.holder.get(id)?.id === holder && now.holder.get(id)?.id === holder);
    const kept = keptInOrder(stayed(was.order.get(holder) ?? []), stayed(order));
    for (const id of stayed(order)) if (!kept.has(id)) moved.add(id);
  }

  // Groups and tabs made of parts already on the page.
  for (const [id, node] of now.node) {
    if (existed(id)) continue;
    if (node.type === 'section' && !isWrapper(node)) {
      const inside = (now.order.get(id) ?? []).filter(existed);
      if (!inside.length) continue;
      lines.push(`Grouped ${inside.length} into “${nameOf(after, node)}”`);
      say([id, ...inside]);
    } else if (node.type === 'tabs') {
      const tabs = (node as TabsNode).children;
      const inside = tabs.flatMap((tab) => now.order.get(tab.id) ?? []).filter(existed);
      if (!inside.length) continue;
      lines.push(`Made ${tabs.length} tabs: ${andList(tabs.map((tab) => `“${tab.label}”`))}`);
      say([id, ...tabs.map((tab) => tab.id), ...inside]);
    }
  }

  // Groups, tabs and arrangements taken away, what they held still on the page.
  for (const [id, node] of was.node) {
    if (stays(id)) continue;
    if (node.type === 'section' && !isWrapper(node)) {
      const out = (was.order.get(id) ?? []).filter(stays);
      if (!out.length) continue;
      lines.push(`Ungrouped “${nameOf(before, node)}”`);
      say([id, ...out]);
    } else if (node.type === 'tabs') {
      const tabs = (node as TabsNode).children;
      const out = tabs.flatMap((tab) => was.order.get(tab.id) ?? []).filter(stays);
      if (!out.length) continue;
      lines.push(`Ungrouped the tabs ${andList(tabs.map((tab) => `“${tab.label}”`))}`);
      say([id, ...tabs.map((tab) => tab.id), ...out]);
    } else if (isWrapper(node)) {
      const held = node.children.map((c) => c.id);
      if (held.length < 2 || held.some((c) => !stays(c) || said.has(c) || moved.has(c) || now.holder.get(c)?.id !== was.holder.get(c)?.id)) continue;
      lines.push(`Ungrouped ${quoted(before, node)}`);
      say(held);
    }
  }

  // Parts put beside or under another; a new one says it where it is added.
  for (const [id, node] of now.node) {
    if (said.has(id) || !now.holder.has(id)) continue;
    const parent = now.parent.get(id);
    const where = nearby(after, parent, node as Part);
    if (!where) continue;
    if (!existed(id)) {
      if (isWrapper(parent)) placed.set(id, where);
    } else if (moved.has(id)) {
      lines.push(`Put ${quoted(after, node)} ${where}`);
      said.add(id);
    }
  }

  // New arrangements of parts that did not move: put side by side, or one under the other.
  for (const [id, node] of now.node) {
    if (existed(id) || !isWrapper(node)) continue;
    const held = node.children.map((c) => c.id);
    if (held.length < 2 || held.some((c) => !existed(c) || said.has(c) || moved.has(c))) continue;
    const column = rowsOf(after, node).every((r) => r.items.length === 1);
    lines.push(`Put ${quoted(after, node)} ${column ? 'one under the other' : 'side by side'}`);
    say(held);
  }

  // Groups, tabs and blocks moved to another group; fields say so themselves.
  for (const id of moved) {
    const node = now.node.get(id) as Part;
    if (said.has(id) || node.type === 'field' || was.holder.get(id)?.id === now.holder.get(id)?.id) continue;
    lines.push(`Moved ${quoted(after, node)} to “${holderName(after, now.holder.get(id) as Holder)}”`);
  }

  // Blocks added, removed, reworded.
  for (const [id, entry] of now.node) {
    const node = entry as Part;
    const words = blockWords(after, node);
    if (!words) continue;
    const old = was.node.get(id) as Part | undefined;
    if (!old) lines.push(`Added ${words}${placed.has(id) ? ` ${placed.get(id)}` : ''}`);
    else if (old.type === 'text' && node.type === 'text' && old.text !== node.text) lines.push(`Changed ${blockWords(before, old)} to “${nameOf(after, node)}”`);
    else if (old.type === 'button' && node.type === 'button' && old.label !== node.label) lines.push(`Renamed the button “${old.label}” to “${node.label}”`);
  }
  for (const [id, node] of was.node) if (!stays(id) && blockWords(before, node as Part)) lines.push(`Removed ${blockWords(before, node as Part)}`);

  // Columns, widths, looks and labels of what is on both.
  for (const [id, entry] of now.node) {
    const node = entry as Part;
    const old = was.node.get(id) as Part | undefined;
    if (!old || old.type !== node.type) continue;
    const name = quoted(after, node);
    if (isSection(node) && isSection(old)) {
      const sameParts = old.children.map((c) => c.id).join() === node.children.map((c) => c.id).join();
      if (JSON.stringify(old.columns) !== JSON.stringify(node.columns) && (!isWrapper(node) || sameParts)) lines.push(`${name}: ${columnsWords(node.columns)}`);
      if ((old.style ?? 'card') !== (node.style ?? 'card')) lines.push(`${name}: drawn ${STYLES[node.style ?? 'card']}`);
      if (old.labels !== node.labels) lines.push(`${name}: labels ${node.labels ? LABELS[node.labels] : 'where the page puts them'}`);
      if (old.labelWidth !== node.labelWidth) lines.push(`${name}: labels ${node.labelWidth ? `${node.labelWidth} px wide` : 'as wide as the page has them'}`);
    }
    if (now.holder.has(id) && !said.has(id) && was.holder.get(id)?.id === now.holder.get(id)?.id && spanOf(old) !== spanOf(node)) {
      lines.push(`${name}: ${plural(spanOf(node), 'column')} wide`);
    }
    if (node.type === 'field' && old.type === 'field' && old.labels !== node.labels) lines.push(`${name}: its label ${node.labels ? LABEL[node.labels] : 'where its group puts it'}`);
    // The words in its empty box, which the panel sets.
    if (node.type === 'field' && old.type === 'field' && (old.placeholder ?? '') !== (node.placeholder ?? '')) lines.push(`${name}: its placeholder changed`);
  }

  return { lines, said, placed, before: was, after: now };
}

/** A group, tab, step or the page, by name. */
export function holderName(page: Page, holder: { id: string; label?: string; title?: string }): string {
  if (holder.id === page.layout.id) return page.title ?? 'the page';
  return holder.label ?? holder.title ?? 'Untitled section';
}

const LOOK: { key: keyof PageLook; words: string; none: string; value?: Record<string, string> }[] = [
  { key: 'accent', words: 'The accent colour', none: 'as the skin has it' },
  { key: 'font', words: 'The font', none: 'as the skin has it', value: { system: 'the system’s' } },
  { key: 'density', words: 'The spacing', none: 'as the skin has it' },
  { key: 'corners', words: 'The corners', none: 'as the skin has them' },
  { key: 'labels', words: 'Where labels sit', none: 'as the skin has them', value: LABELS },
  { key: 'labelWidth', words: 'Labels set beside', none: 'as wide as the skin has them' },
  { key: 'scheme', words: 'The colours', none: 'as the skin has them', value: { auto: 'as the reader’s system has them' } },
];

/** The page's look, setting by setting: "The spacing: comfortable → compact". */
export function lookChanges(before: Page, after: Page): string[] {
  return LOOK.flatMap(({ key, words, none, value }) => {
    const [was, now] = [before.look?.[key], after.look?.[key]];
    if (was === now) return [];
    const say = (v: unknown) => (v === undefined ? none : key === 'labelWidth' ? `${v} px wide` : (value?.[String(v)] ?? String(v)));
    return [`${words}: ${say(was)} → ${say(now)}`];
  });
}
