import type { Page, SectionNode } from '@fieldia/core';
import { detach, setRowColumns, setSpan, tidy } from './layout-ops';
import { across, contains, isRow, listOf, locate, nameOf, nodeOf, spanOf, type Holder, type Part } from './layout-tree';
import { Refusal } from './refusal';

/**
 * Moving parts in reading order, as the outline moves them: into a group, a
 * tab, tabs (a tab among its tabs) or a survey's page, at a place in its
 * list — the place counted in the list as it is, the parts moved still in
 * it, as a drop line between two rows says. Nothing is put side by side on
 * the way: a part lands in the list as it is, no wider than the columns
 * there; a row of parts on the page takes one more column (four at most)
 * and closes up when one leaves; an arrangement left holding one part folds
 * away (layout-ops.ts's `tidy`). A part picked inside another part picked
 * goes along with it.
 */

/** The parts to move, by id, in reading order: none inside another of them. */
function movingSpots(page: Page, ids: string[]) {
  const spots = [...new Set(ids)].map((id) => {
    const at = locate(page, id);
    if (!at) throw new Refusal(`There is no part “${id}”`);
    return at;
  });
  const outer = spots.filter((s) => !spots.some((o) => o !== s && contains(page, o.node.id, s.node.id)));
  const order = new Map([...allParts(page.layout as Holder)].map((id, i) => [id, i]));
  return outer.sort((a, b) => (order.get(a.node.id) ?? 0) - (order.get(b.node.id) ?? 0));
}

/** Every part's id, in reading order. */
function* allParts(holder: Holder): Generator<string> {
  for (const part of listOf(holder) ?? []) {
    yield part.id;
    yield* allParts(part as Holder);
  }
}

/** Why these parts cannot go into `parentId`, or null when they can. */
export function moveRefusal(page: Page, ids: string[], parentId: string): string | null {
  try {
    check(page, ids, parentId);
    return null;
  } catch (error) {
    if (error instanceof Refusal) return error.message;
    throw error;
  }
}

function check(page: Page, ids: string[], parentId: string) {
  if (!ids.length) throw new Refusal('Pick a part to move');
  const spots = movingSpots(page, ids);
  const parent = nodeOf(page, parentId);
  if (!parent) throw new Refusal(`There is no part “${parentId}”`);
  const wizard = page.layout.type === 'wizard';
  for (const { node, parent: from } of spots) {
    // A survey's page sits in the page's own list, as a part does.
    const step = (node as { type: string }).type === 'step';
    if (node.type === 'tab') {
      if (parent.type === 'tab') throw new Refusal('A tab holds parts, not other tabs');
      if (parent.id !== from.id) throw new Refusal('A tab moves only among its tabs');
    } else if (parent.type === 'tabs') throw new Refusal('Put it in one of the tabs');
    if (wizard && step && parent.id !== page.layout.id) throw new Refusal('A page holds questions, not other pages');
    if (wizard && !step && parent.id === page.layout.id) throw new Refusal('A question goes on a page');
    if (contains(page, node.id, parentId)) throw new Refusal('A part cannot go inside itself');
  }
  if (!listOf(parent)) throw new Refusal(`“${nameOf(page, parent)}” holds no parts`);
  const coming = spots.filter((s) => s.parent.id !== parentId).length;
  if (isRow(page, parent) && parent.children.length + coming > 4) throw new Refusal('A row holds four');
  return spots;
}

/** The first part at or after `index` that is not moving: what the moved parts go before; null for the end. */
function anchorOf(list: readonly Part[], index: number, moving: ReadonlySet<string>): Part | null {
  return list.slice(Math.max(0, index)).find((p) => !moving.has(p.id)) ?? null;
}

/** Move the parts into `parentId` before the part now at `index` (or at its end). Returns them, in reading order. */
export function moveParts(page: Page, ids: string[], parentId: string, index: number): string[] {
  const spots = check(page, ids, parentId);
  const parent = nodeOf(page, parentId) as Holder;
  const moving = new Set(spots.map((s) => s.node.id));
  const anchor = anchorOf(parent.children, index, moving);
  // A row of parts on the page: each part one column of it, and the row as many columns as it has parts.
  const row = isRow(page, parent);
  for (const { node } of spots) detach(page, node.id);
  const cols = across(page, parent);
  for (const { node } of spots) setSpan(node, row ? 1 : Math.min(spanOf(node), cols));
  const at = anchor ? parent.children.indexOf(anchor) : parent.children.length;
  parent.children.splice(at, 0, ...spots.map((s) => s.node));
  if (row) setRowColumns(parent as SectionNode, parent.children.length);
  tidy(page);
  return spots.map((s) => s.node.id);
}

/** Where the parts would go, in the words the drag chip says: “into “Home address”, before “City””. */
export function describeMove(page: Page, ids: string[], parentId: string, index: number): string {
  const refused = moveRefusal(page, ids, parentId);
  if (refused) return refused;
  const spots = movingSpots(page, ids);
  const parent = nodeOf(page, parentId) as Holder;
  const moving = new Set(spots.map((s) => s.node.id));
  const anchor = anchorOf(parent.children, index, moving);
  const name = (part: Part) => `“${nameOf(page, part)}”`;
  if (spots.every((s) => s.parent.id === parentId)) {
    const rest = parent.children.filter((p) => !moving.has(p.id));
    const at = anchor ? rest.indexOf(anchor) : rest.length;
    const after = [...rest.slice(0, at), ...spots.map((s) => s.node), ...rest.slice(at)];
    if (after.every((p, i) => p === parent.children[i])) return spots.length === 1 ? 'where it is' : 'where they are';
    // Down the list, they go after the part they pass; up it, before the part they pass.
    const was = parent.children.slice(0, parent.children.indexOf(spots[0].node)).filter((p) => !moving.has(p.id)).length;
    return anchor && at <= was ? `before ${name(anchor)}` : `after ${name(rest[at - 1])}`;
  }
  const into = parentId === page.layout.id ? 'onto the page' : `into ${name(parent as Part)}`;
  return anchor ? `${into}, before ${name(anchor)}` : `${into}, at the end`;
}
