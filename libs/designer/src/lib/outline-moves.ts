import type { Page, SectionNode } from '@fieldia/core';
import { cameFrom, detach, setRowColumns, tidy } from './layout-ops';
import { contains, isRow, listOf, locate, nameOf, nodeOf, type Holder, type Part, type Spot } from './layout-tree';
import { landingSpan, putAt } from './layout-twelfths';
import type { DesignerWords } from './designer-words';
import { en } from './locales/en';
import { Refusal } from './refusal';

/**
 * Moving parts in reading order, as the outline moves them: into a group, a
 * tab, tabs (a tab among its tabs) or a survey's page, at a place in its
 * list — the place counted in the list as it is, the parts moved still in
 * it, as a drop line between two rows says. Nothing is put side by side on
 * the way: a part lands in the list as it is, no wider than the columns
 * there; a row of parts on the page takes one more column (four at most)
 * and closes up when one leaves; in a group in twelfths that keeps its rows
 * full, a part is a row of its own (layout-twelfths.ts); an arrangement left
 * holding one part folds away (layout-ops.ts's `tidy`). A part picked inside
 * another part picked goes along with it.
 */

/** A part's name as a person reads it — a survey's page by its title — in quotes. */
export function quoted(page: Page, part: Part | Holder, words: DesignerWords = en): string {
  const step = (part as { type: string }).type === 'step';
  return words.parts.quote(step ? (part as { label?: string }).label || words.outline.kinds.untitledPage : nameOf(page, part, words));
}

/** The parts named that are on the page, in reading order: none inside another of them, none twice. */
export function partsInOrder(page: Page, ids: string[]): Spot[] {
  const spots = [...new Set(ids)].map((id) => locate(page, id)).filter((s): s is Spot => !!s);
  const outer = spots.filter((s) => !spots.some((o) => o !== s && contains(page, o.node.id, s.node.id)));
  const order = new Map([...allParts(page.layout as Holder)].map((id, i) => [id, i]));
  return outer.sort((a, b) => (order.get(a.node.id) ?? 0) - (order.get(b.node.id) ?? 0));
}

/** The parts to move, in reading order; a refusal naming one not on the page. */
function movingSpots(page: Page, ids: string[]): Spot[] {
  const missing = ids.find((id) => !locate(page, id));
  if (missing !== undefined) throw new Refusal((w) => w.layout.noPart(missing));
  return partsInOrder(page, ids);
}

/** Every part's id, in reading order. */
function* allParts(holder: Holder): Generator<string> {
  for (const part of listOf(holder) ?? []) {
    yield part.id;
    yield* allParts(part as Holder);
  }
}

/** Why these parts cannot go into `parentId`, or null when they can. */
export function moveRefusal(page: Page, ids: string[], parentId: string, words: DesignerWords = en): string | null {
  try {
    check(page, ids, parentId);
    return null;
  } catch (error) {
    if (error instanceof Refusal) return error.in(words);
    throw error;
  }
}

/** A part going into a list: one on the page, from the list it is in; or a new one, from nowhere. */
interface Coming {
  node: Part;
  from: Holder | null;
}

function check(page: Page, ids: string[], parentId: string) {
  if (!ids.length) throw new Refusal((w) => w.outline.pickToMove);
  const spots = movingSpots(page, ids);
  refuse(page, spots.map((s) => ({ node: s.node, from: s.parent })), parentId);
  return spots;
}

/** What the parts go into, or a refusal saying why they cannot. */
function refuse(page: Page, coming: Coming[], parentId: string): Holder {
  const parent = nodeOf(page, parentId);
  if (!parent) throw new Refusal((w) => w.layout.noPart(parentId));
  const wizard = page.layout.type === 'wizard';
  for (const { node, from } of coming) {
    // A survey's page sits in the page's own list, as a part does.
    const step = (node as { type: string }).type === 'step';
    if (node.type === 'tab') {
      if (parent.type === 'tab') throw new Refusal((w) => w.outline.tabNotInTab);
      if (from && parent.id !== from.id) throw new Refusal((w) => w.outline.tabAmongItsTabs);
      if (!from && parent.type !== 'tabs') throw new Refusal((w) => w.outline.tabAmongTabs);
    } else if (parent.type === 'tabs') throw new Refusal((w) => w.outline.inOneOfTheTabs);
    if (wizard && step && parent.id !== page.layout.id) throw new Refusal((w) => w.outline.pageNotInPage);
    if (wizard && !step && parent.id === page.layout.id) throw new Refusal((w) => w.outline.questionOnPage);
    if (from && contains(page, node.id, parentId)) throw new Refusal((w) => w.outline.notInsideItself);
  }
  if (!listOf(parent)) throw new Refusal((w) => w.outline.holdsNoParts(quoted(page, parent, w)));
  const joining = coming.filter((c) => c.from?.id !== parentId).length;
  if (isRow(page, parent) && (parent as Holder).children.length + joining > 4) throw new Refusal((w) => w.layout.rowHoldsFour);
  return parent as Holder;
}

/** The first part at or after `index` that is not moving: what the moved parts go before; null for the end. */
function anchorOf(list: readonly Part[], index: number, moving: ReadonlySet<string>): Part | null {
  return list.slice(Math.max(0, index)).find((p) => !moving.has(p.id)) ?? null;
}

/** Put the parts in `parent` before `anchor` (or at its end), those on the page leaving where they are first; then tidy. */
function put(page: Page, coming: Coming[], parent: Holder, anchor: Part | null): string[] {
  // A row of parts on the page: each part one column of it, and the row as many columns as it has parts.
  const row = isRow(page, parent);
  const came = new Map(coming.map(({ node, from }) => [node, from ? cameFrom(page, node.id) : undefined]));
  for (const { node, from } of coming) if (from) detach(page, node.id);
  const at = anchor ? parent.children.indexOf(anchor) : parent.children.length;
  putAt(page, parent, at, coming.map((c) => c.node), (node) => (row ? 1 : landingSpan(page, node, parent, came.get(node))), (node) => came.get(node)?.cols);
  if (row) setRowColumns(parent as SectionNode, parent.children.length);
  tidy(page);
  return coming.map((c) => c.node.id);
}

/** Move the parts into `parentId` before the part now at `index` (or at its end). Returns them, in reading order. */
export function moveParts(page: Page, ids: string[], parentId: string, index: number): string[] {
  const spots = check(page, ids, parentId);
  const parent = nodeOf(page, parentId) as Holder;
  const anchor = anchorOf(parent.children, index, new Set(spots.map((s) => s.node.id)));
  return put(page, spots.map((s) => ({ node: s.node, from: s.parent })), parent, anchor);
}

/** New parts (pasted) into `parentId`, before the part at `index` (or at its end), as a move puts them. Returns them. */
export function putNewParts(page: Page, nodes: Part[], parentId: string, index: number): string[] {
  const coming = nodes.map((node) => ({ node, from: null }));
  const parent = refuse(page, coming, parentId);
  return put(page, coming, parent, anchorOf(parent.children, index, new Set()));
}

/** Where the parts would go, in the words the drag chip says: “into “Home address”, before “City””. */
export function describeMove(page: Page, ids: string[], parentId: string, index: number, words: DesignerWords = en): string {
  const w = words.outline;
  const refused = moveRefusal(page, ids, parentId, words);
  if (refused) return refused;
  const spots = movingSpots(page, ids);
  const parent = nodeOf(page, parentId) as Holder;
  const moving = new Set(spots.map((s) => s.node.id));
  const anchor = anchorOf(parent.children, index, moving);
  const name = (part: Part) => quoted(page, part, words);
  if (spots.every((s) => s.parent.id === parentId)) {
    const rest = parent.children.filter((p) => !moving.has(p.id));
    const at = anchor ? rest.indexOf(anchor) : rest.length;
    const after = [...rest.slice(0, at), ...spots.map((s) => s.node), ...rest.slice(at)];
    if (after.every((p, i) => p === parent.children[i])) return w.stays(spots.length === 1);
    // Down the list, they go after the part they pass; up it, before the part they pass.
    const was = parent.children.slice(0, parent.children.indexOf(spots[0].node)).filter((p) => !moving.has(p.id)).length;
    return anchor && at <= was ? w.before(name(anchor)) : w.after(name(rest[at - 1]));
  }
  return w.into(parentId === page.layout.id ? null : name(parent as Part), anchor ? name(anchor) : null);
}
