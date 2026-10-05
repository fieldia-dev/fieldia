import type { Page, PageLook, SectionNode, TabsNode } from '@fieldia/core';
import { across, isSection, isWrapper, listOf, nameOf, rowsOf, seenAs, spanOf, type Holder, type Part } from './layout-tree';
import { foldOf } from './group-fold';
import { inTwelfths, laidInTwelfths, rowShare } from './layout-twelfths';
import type { DesignerWords } from './designer-words';
import { en } from './locales/en';

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

/** Where a part sits next to another: beside the one sharing its row, or under or above the next in a column. */
function nearby(page: Page, parent: Holder | undefined, node: Part, words: DesignerWords): string | null {
  if (!isSection(parent)) return null;
  const w = words.changes;
  const quoted = (n: Part | Holder) => seenAs(page, n, words);
  const rows = rowsOf(page, parent);
  const row = rows.find((r) => r.items.includes(node));
  const at = row?.items.indexOf(node) ?? -1;
  const mate = row?.items[at - 1] ?? row?.items[at + 1];
  if (mate) return w.beside(quoted(mate));
  if (!isWrapper(parent) || rows.some((r) => r.items.length > 1)) return null;
  const index = parent.children.indexOf(node as SectionNode['children'][number]);
  return index > 0 ? w.under(quoted(parent.children[index - 1])) : w.above(quoted(parent.children[1]));
}

/** A block by what it is: "the heading “Before you send”", "a divider". */
function blockWords(page: Page, node: Part, words: DesignerWords): string | null {
  const w = words.changes.block;
  switch (node.type) {
    case 'text':
      return node.style === 'heading' ? w.heading(nameOf(page, node, words)) : w.words(nameOf(page, node, words));
    case 'button':
      return w.button(node.label);
    case 'image':
      return node.alt ? w.image(node.alt) : w.anImage;
    case 'divider':
      return w.divider;
    case 'spacer':
      return w.spacer;
    default:
      return null;
  }
}

export function layoutChanges(before: Page, after: Page, words: DesignerWords = en): LayoutChanges {
  const w = words.changes;
  /** A part's name in quotes; an arrangement's, by what it holds. */
  const quoted = (page: Page, node: Part | Holder) => seenAs(page, node, words);
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
      lines.push(w.grouped(inside.length, nameOf(after, node, words)));
      say([id, ...inside]);
    } else if (node.type === 'tabs') {
      const tabs = (node as TabsNode).children;
      const inside = tabs.flatMap((tab) => now.order.get(tab.id) ?? []).filter(existed);
      if (!inside.length) continue;
      lines.push(w.madeTabs(tabs.length, words.parts.and(tabs.map((tab) => words.parts.quote(tab.label)))));
      say([id, ...tabs.map((tab) => tab.id), ...inside]);
    }
  }

  // Groups, tabs and arrangements taken away, what they held still on the page.
  for (const [id, node] of was.node) {
    if (stays(id)) continue;
    if (node.type === 'section' && !isWrapper(node)) {
      const out = (was.order.get(id) ?? []).filter(stays);
      if (!out.length) continue;
      lines.push(w.ungrouped(nameOf(before, node, words)));
      say([id, ...out]);
    } else if (node.type === 'tabs') {
      const tabs = (node as TabsNode).children;
      const out = tabs.flatMap((tab) => was.order.get(tab.id) ?? []).filter(stays);
      if (!out.length) continue;
      lines.push(w.ungroupedTabs(words.parts.and(tabs.map((tab) => words.parts.quote(tab.label)))));
      say([id, ...tabs.map((tab) => tab.id), ...out]);
    } else if (isWrapper(node)) {
      const held = node.children.map((c) => c.id);
      if (held.length < 2 || held.some((c) => !stays(c) || said.has(c) || moved.has(c) || now.holder.get(c)?.id !== was.holder.get(c)?.id)) continue;
      lines.push(w.ungroupedArrangement(quoted(before, node)));
      say(held);
    }
  }

  // Parts put beside or under another; a new one says it where it is added.
  for (const [id, node] of now.node) {
    if (said.has(id) || !now.holder.has(id)) continue;
    const parent = now.parent.get(id);
    const where = nearby(after, parent, node as Part, words);
    if (!where) continue;
    if (!existed(id)) {
      if (isWrapper(parent)) placed.set(id, where);
    } else if (moved.has(id)) {
      lines.push(w.put(quoted(after, node), where));
      said.add(id);
    }
  }

  // New arrangements of parts that did not move: put side by side, or one under the other.
  for (const [id, node] of now.node) {
    if (existed(id) || !isWrapper(node)) continue;
    const held = node.children.map((c) => c.id);
    if (held.length < 2 || held.some((c) => !existed(c) || said.has(c) || moved.has(c))) continue;
    const column = rowsOf(after, node).every((r) => r.items.length === 1);
    lines.push(column ? w.putUnder(quoted(after, node)) : w.putSide(quoted(after, node)));
    say(held);
  }

  // Groups, tabs and blocks moved to another group; fields say so themselves.
  for (const id of moved) {
    const node = now.node.get(id) as Part;
    if (said.has(id) || node.type === 'field' || was.holder.get(id)?.id === now.holder.get(id)?.id) continue;
    lines.push(w.movedTo(quoted(after, node), holderName(after, now.holder.get(id) as Holder, words)));
  }

  // Blocks added, removed, reworded.
  for (const [id, entry] of now.node) {
    const node = entry as Part;
    const block = blockWords(after, node, words);
    if (!block) continue;
    const old = was.node.get(id) as Part | undefined;
    if (!old) lines.push(w.addedBlock(block, placed.get(id) ?? ''));
    else if (old.type === 'text' && node.type === 'text' && old.text !== node.text) lines.push(w.changedBlockTo(blockWords(before, old, words) as string, nameOf(after, node, words)));
    else if (old.type === 'button' && node.type === 'button' && old.label !== node.label) lines.push(w.renamedButton(old.label, node.label));
    // A picture's address, description, width, place, link or caption.
    else if (old.type === 'image' && node.type === 'image' && JSON.stringify(old) !== JSON.stringify(node)) lines.push(w.changedBlock(block));
  }
  for (const [id, node] of was.node) if (!stays(id) && blockWords(before, node as Part, words)) lines.push(w.removedBlock(blockWords(before, node as Part, words) as string));

  // Columns, widths, looks and labels of what is on both.
  for (const [id, entry] of now.node) {
    const node = entry as Part;
    const old = was.node.get(id) as Part | undefined;
    if (!old || old.type !== node.type) continue;
    const name = quoted(after, node);
    if (isSection(node) && isSection(old)) {
      const sameParts = old.children.map((c) => c.id).join() === node.children.map((c) => c.id).join();
      // Divided in twelfths, every part as wide as it was: said once, not as each width and count.
      if (inTwelfths(node) && !inTwelfths(old)) lines.push(w.twelfths(name));
      else if (JSON.stringify(old.columns) !== JSON.stringify(node.columns) && (!isWrapper(node) || sameParts)) {
        const columns = node.columns;
        lines.push(typeof columns === 'object' ? w.columns(name, columns.wide, columns.medium, columns.narrow) : w.columns(name, columns ?? 1));
      }
      if ((old.rows ?? 'full') !== (node.rows ?? 'full')) lines.push(w.gaps(name, node.rows === 'gaps'));
      if ((old.style ?? 'card') !== (node.style ?? 'card')) lines.push(w.drawn(name, node.style ?? 'card'));
      if (foldOf(old) !== foldOf(node)) lines.push(w.folds(name, foldOf(node)));
      if (old.labels !== node.labels) lines.push(w.labels(name, node.labels ?? ''));
      if (old.labelWidth !== node.labelWidth) lines.push(w.labelWidth(name, node.labelWidth ?? 0));
    }
    // As wide a share of its row before and after — as wide as its group, or the same width in twelfths — its width did not change.
    const share = (page: Page, holder: Holder | undefined, part: Part) => (holder ? Math.min(spanOf(part), across(page, holder)) / across(page, holder) : 0);
    const holder = now.parent.get(id);
    if (now.holder.has(id) && !said.has(id) && was.holder.get(id)?.id === now.holder.get(id)?.id && spanOf(old) !== spanOf(node) && share(before, was.parent.get(id), old) !== share(after, holder, node)) {
      lines.push(laidInTwelfths(after, holder) ? w.share(name, rowShare(spanOf(node), across(after, holder as Holder), words)) : w.columnsWide(name, spanOf(node)));
    }
    if (node.type === 'field' && old.type === 'field' && old.labels !== node.labels) lines.push(w.itsLabel(name, node.labels ?? ''));
    // The words in its empty box, which the panel sets.
    if (node.type === 'field' && old.type === 'field' && (old.placeholder ?? '') !== (node.placeholder ?? '')) lines.push(w.placeholder(name));
  }

  return { lines, said, placed, before: was, after: now };
}

/** A group, tab, step or the page, by name; one whose name is empty yet as untitled. */
export function holderName(page: Page, holder: { id: string; label?: string; title?: string }, words: DesignerWords = en): string {
  if (holder.id === page.layout.id) return page.title || words.changes.thePage;
  return holder.label || holder.title || words.parts.untitledSection;
}

/** The look's settings, in the order a change to them is said. */
const LOOK: (keyof PageLook & keyof DesignerWords['changes']['look'])[] = ['accent', 'font', 'density', 'corners', 'labels', 'labelWidth', 'scheme'];

/** The page's look, setting by setting: "The spacing: comfortable → compact". */
export function lookChanges(before: Page, after: Page, words: DesignerWords = en): string[] {
  const w = words.changes;
  return LOOK.flatMap((key) => {
    const [was, now] = [before.look?.[key], after.look?.[key]];
    if (was === now) return [];
    const say = (v: string | number | undefined) => w.lookValue(key, v ?? null);
    return [w.lookLine(w.look[key], say(was), say(now))];
  });
}
