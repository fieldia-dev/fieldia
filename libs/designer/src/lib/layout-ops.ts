import type { ColumnCount, ColumnsByWidth, Field, LayoutNode, Page, SectionNode, TabsNode } from '@fieldia/core';
import type { DesignerWords } from './designer-words';
import { en } from './locales/en';
import { kindById, type QuestionKind } from './kinds';
import { across, colsOf, contains, isRow, isSection, isWrapper, listOf, locate, nameOf, nodeOf, rowsOf, seenAs, setSpan, spanOf, SPANNED, type Holder, type Part, type Spot } from './layout-tree';
import { besideIn, besideWords, columnInside, fill, inTwelfths, isGroup, keepsFull, laidInTwelfths, landingSpan, putAt, resize, shares, toTwelfths, TWELVE, type Beside } from './layout-twelfths';
import { allIds, containers, nextName, shownFields } from './page-tree';
import { Refusal } from './refusal';
import { answersName, freeFieldName } from './saved-forms';

/**
 * Laying a page out by dropping parts where they go, as the approved mockup
 * does (the way Grafloria's split board drops): beside a part, under it, into
 * a group, or as a new full-width row of a grid. A page keeps order and
 * widths, never positions, so each drop is worked out as which list a part
 * goes in, where, and how wide.
 *
 * Parts go side by side, or one under another, in arrangements (see
 * layout-tree.ts); beside a part in a group, its row divides in twelfths (see
 * layout-twelfths.ts). After every drop the page is tidied: an arrangement
 * left holding one part or none folds away, and so does a column in a column.
 */

/** Where a dragged part lands; `at` puts it at a place in a list as it is, as a key moving it along its list does. */
export type Drop =
  | { how: 'into'; container: string }
  | { how: 'beside' | 'under'; target: string; after: boolean; whole?: boolean }
  | { how: 'row'; container: string; index: number }
  | { how: 'at'; container: string; index: number }
  /** A new column inside a group, beside all its rows: its padding at either side, as Grafloria splits a section's content. */
  | { how: 'column'; container: string; after: boolean };

/** What the toolbox adds besides fields: groups, tabs, and the blocks between fields. */
export type BlockKind = 'group' | 'side' | 'tabs' | 'heading' | 'text' | 'divider' | 'spacer' | 'image' | 'button';

/** A new part: a field of a kind, a field of the backend's model, or a block. */
export type NewPart = { kind: string } | { field: string } | { block: BlockKind };

/** Where a part is added without a drop: after a part, or in a group or a tab — at a place, or at its end. */
export interface Where {
  after?: string;
  parent?: string;
  index?: number;
}

/** What the store lends a layout edit: the backend's model, to put its fields on the page as it has them. */
export interface LayoutContext {
  model: Record<string, Field>;
  /** The designer's words, for the words a new part starts with. English unless given. */
  words?: DesignerWords;
}

/** What a drop means, in the words the drag chip says. */
export function describeDrop(page: Page, drop: Drop, moving?: string, words: DesignerWords = en): string {
  const w = words.layout;
  const named = (node: Part | Holder | null) => nameOf(page, node, words);
  if (drop.how === 'column') {
    const plan = columnPlan(page, drop, moving);
    if (plan.how !== 'wrap') return describeDrop(page, plan.drop, moving, words);
    return w.columnInside(named(nodeOf(page, drop.container)), !!drop.after);
  }
  if (drop.how === 'into') {
    const box = nodeOf(page, drop.container);
    return box?.id === page.layout.id ? w.intoThePage : w.into(named(box));
  }
  if (drop.how === 'row' || drop.how === 'at') {
    const box = nodeOf(page, drop.container);
    const next = (listOf(box ?? undefined) ?? []).filter((c) => c.id !== moving)[drop.index];
    if (drop.how === 'at') return next ? w.before(named(next)) : w.atEndOf(named(box));
    return next ? w.newRowAbove(named(next)) : w.newRowAtEnd(named(box));
  }
  const target = nodeOf(page, drop.target);
  if (!target) return '';
  // A row of parts takes one more column: name the part it goes next to.
  if (drop.how === 'beside' && isRow(page, target)) {
    const edge = drop.after ? target.children[target.children.length - 1] : target.children[0];
    return w.beside(words.parts.quote(named(edge)), true);
  }
  const plan = besidePlan(page, drop, moving);
  if (plan) return besideWords(page, plan, target as Part, drop.after, words);
  const whole = !!drop.whole;
  const name = seenAs(page, target, words);
  if (drop.how === 'beside') return w.beside(name, whole);
  return drop.after ? w.under(name, whole) : w.above(name, whole);
}

/** Beside a part in a group: where its row puts the part dropped (see layout-twelfths.ts); null for a drop the other rules take. */
function besidePlan(page: Page, drop: Drop, moving?: string, node?: Part): Beside | null {
  if (drop.how !== 'beside') return null;
  const at = locate(page, drop.target);
  const kind = node?.type ?? (moving ? locate(page, moving)?.node.type : undefined);
  if (!at || !isGroup(at.parent) || !SPANNED.has(at.node.type) || (kind && !SPANNED.has(kind)) || moving === drop.target) return null;
  return besideIn(page, at.parent, at.node, moving);
}

/**
 * What a new column inside a group comes to: with its rows wrapped, the part
 * beside them all; a group of one row is joined at that row's end (or start),
 * and an empty group takes the part. `moving` is left out of the rows.
 */
function columnPlan(page: Page, drop: { container: string; after: boolean }, moving?: string): { how: 'wrap' } | { how: 'joins'; drop: Drop } {
  const group = nodeOf(page, drop.container) as SectionNode;
  const rows = rowsOf(page, group, moving);
  if (!rows.length) return { how: 'joins', drop: { how: 'into', container: drop.container } };
  if (rows.length > 1) return { how: 'wrap' };
  const row = rows[0].items;
  return { how: 'joins', drop: { how: 'beside', target: (drop.after ? row[row.length - 1] : row[0]).id, after: drop.after } };
}

// ---- changing the page --------------------------------------------------------------------------------

export { SPANNED, setSpan };

/** Columns written as plainly as they can be: a number when only the widest is given. */
export function columnsValue(wide: number, medium?: number, narrow?: number): ColumnCount | ColumnsByWidth {
  const by: ColumnsByWidth = { wide: wide as ColumnCount };
  if (medium) by.medium = medium as ColumnCount;
  if (narrow) by.narrow = narrow as ColumnCount;
  return by.medium || by.narrow ? by : by.wide;
}

/** A row's columns, one per part (four at most); the narrower widths never more than that. */
export function setRowColumns(section: SectionNode, count: number): void {
  const wide = Math.max(1, Math.min(4, count));
  const given = section.columns;
  section.columns = typeof given === 'object' ? columnsValue(wide, given.medium && Math.min(given.medium, wide), given.narrow && Math.min(given.narrow, wide)) : wide as ColumnCount;
}

/** Take a part out of where it is; a row it leaves closes up — in a group that keeps its rows full, the rest of it widening to fill it. */
export function detach(page: Page, id: string): void {
  const at = locate(page, id);
  if (!at) return;
  const wasRow = isRow(page, at.parent);
  const group = at.parent;
  const rest = inTwelfths(group) && keepsFull(group) ? rowsOf(page, group).find((r) => r.items.includes(at.node))?.items.filter((p) => p !== at.node) : undefined;
  at.list.splice(at.index, 1);
  if (wasRow && at.parent.children.length >= 2) setRowColumns(at.parent as SectionNode, at.parent.children.length);
  if (rest) fill(rest);
}

/** Where a part on the page comes from: the columns of its grid, and whether they are twelfths. */
export function cameFrom(page: Page, id: string): { cols: number; twelfths: boolean } | undefined {
  const at = locate(page, id);
  return at ? { cols: across(page, at.parent), twelfths: laidInTwelfths(page, at.parent) } : undefined;
}

/** An arrangement with nothing of its own to lose: no rule, no label settings, no words. */
const bare = (section: SectionNode) => Object.keys(section).every((key) => ['type', 'id', 'style', 'columns', 'colspan', 'children'].includes(key));

/** Fold away what holds one part or none, and a column inside a column. */
export function tidy(page: Page, holder: Holder = page.layout as Holder): void {
  const list = listOf(holder);
  if (!list) return;
  for (let i = list.length - 1; i >= 0; i--) {
    const node = list[i];
    if (listOf(node)) tidy(page, node as Holder);
    if (!isWrapper(node) || !bare(node)) continue;
    if (!node.children.length) list.splice(i, 1);
    else if (node.children.length === 1) {
      const only = node.children[0];
      setSpan(only, Math.min(spanOf(node), across(page, holder)));
      list.splice(i, 1, only);
    } else if (colsOf(page, node) === 1 && across(page, holder) === 1) list.splice(i, 1, ...node.children);
  }
}

/** A name for each new part, none taken twice in one edit. */
export function namer(page: Page): (prefix: string, sep?: string) => string {
  const ids = allIds(page);
  return (prefix, sep = '-') => {
    const id = nextName((n) => ids.has(n), prefix, sep);
    ids.add(id);
    return id;
  };
}

const arrangement = (id: string, colspan: number, columns: ColumnCount | ColumnsByWidth, children: Part[]): SectionNode => {
  const made: SectionNode = { type: 'section', id, style: 'plain', columns, children: children as LayoutNode[] };
  setSpan(made, colspan);
  return made;
};

/** Put a part where a drop says, then tidy the page. The part may be new, or moved from where it is. */
export function placeAt(page: Page, node: Part, drop: Drop): void {
  const name = namer(page);
  const came = cameFrom(page, node.id);
  if (drop.how === 'column') {
    const plan = columnPlan(page, drop, came && node.id);
    if (plan.how !== 'wrap') return placeAt(page, node, plan.drop);
    if (came) detach(page, node.id);
    columnInside(nodeOf(page, drop.container) as SectionNode, node, drop.after, name('column'), came?.cols ?? 1);
    tidy(page);
    return;
  }
  const plan = besidePlan(page, drop, came && node.id, node);
  if (plan?.how === 'refused') throw new Refusal((w) => w.layout[plan.why]);
  if (plan && drop.how === 'beside') {
    // The group in twelfths first, so the row the part leaves closes up by the group's own rule.
    toTwelfths(locate(page, drop.target)?.parent as SectionNode);
    // Along its own row it only changes places; from elsewhere, the row it leaves closes up.
    if (plan.how === 'reorder') (locate(page, node.id) as Spot).list.splice((locate(page, node.id) as Spot).index, 1);
    else if (came) detach(page, node.id);
    const at = locate(page, drop.target) as Spot;
    at.list.splice(at.index + (drop.after ? 1 : 0), 0, node);
    if (plan.how === 'room') resize(node, plan.span, came?.cols ?? 1);
    else if (plan.how === 'divide') {
      // The row divides equally: halves, thirds or quarters.
      const row = [...plan.row];
      row.splice(row.indexOf(at.node) + (drop.after ? 1 : 0), 0, node);
      const each = shares(row.map(() => 1), TWELVE);
      row.forEach((p, i) => resize(p, each[i], p === node ? (came?.cols ?? 1) : TWELVE));
    }
    tidy(page);
    return;
  }
  if (came) detach(page, node.id);
  if (drop.how === 'into' || drop.how === 'row' || drop.how === 'at') {
    const box = nodeOf(page, drop.container) as Holder;
    const index = drop.how === 'into' ? box.children.length : Math.min(drop.index, box.children.length);
    // A new row is as wide as its grid; a part put at a place keeps its width — its share of the row, into or out of twelfths — no wider than there.
    putAt(page, box, index, [node], (p) => (drop.how === 'row' ? across(page, box) : landingSpan(page, p, box, came)), () => came?.cols);
  } else {
    const at = locate(page, drop.target) as Spot;
    const parent = at.parent;
    const target = at.node;
    const index = at.index + (drop.after ? 1 : 0);
    const cols = across(page, parent);
    const pair = drop.after ? [target, node] : [node, target];
    if (drop.how === 'under') {
      if (cols === 1) {
        setSpan(node, 1);
        at.list.splice(index, 0, node);
      } else {
        // Its cell becomes a column of two: the row keeps its parts, and grows.
        const span = Math.min(spanOf(target), cols);
        setSpan(target, span);
        setSpan(node, span);
        at.list.splice(at.index, 1, arrangement(name('column'), span, span as ColumnCount, pair));
      }
    } else if (isRow(page, target) && target.children.length < 4) {
      // Beside a whole row of parts: one more column of that row, never a row in a row.
      setSpan(node, 1);
      target.children.splice(drop.after ? target.children.length : 0, 0, node as LayoutNode);
      setRowColumns(target, target.children.length);
    } else if (isRow(page, parent) && parent.children.length < 4) {
      setSpan(node, 1);
      at.list.splice(index, 0, node);
      setRowColumns(parent, parent.children.length);
    } else if (cols > 1 && !isRow(page, parent) && (rowsOf(page, parent, node.id).find((r) => r.items.includes(target))?.used ?? cols) < cols) {
      // A free cell in its row: nothing else moves.
      setSpan(node, 1);
      at.list.splice(index, 0, node);
    } else if (cols > 1 && Math.min(spanOf(target), cols) >= 2) {
      // A part two or more columns wide gives half its width: both stay on the columns, nothing else moves.
      const span = Math.min(spanOf(target), cols);
      setSpan(node, Math.floor(span / 2));
      setSpan(target, span - Math.floor(span / 2));
      at.list.splice(index, 0, node);
    } else {
      // One column wide, in a group of four or an arrangement: the two share its cell, side by side (they stack where it is narrow). On the page, a row of two.
      const span = Math.min(spanOf(target), cols);
      setSpan(target, 1);
      setSpan(node, 1);
      at.list.splice(at.index, 1, arrangement(name('side'), span, columnsValue(2, undefined, 1), pair));
    }
  }
  tidy(page);
}

/** Why a drop cannot be made, or null when it can. */
export function dropRefusal(page: Page, drop: Drop, moving?: string, words: DesignerWords = en): string | null {
  const w = words.layout;
  const moved = moving ? locate(page, moving) : null;
  if (moving && !moved) return w.noPart(moving);
  if (moved?.node.type === 'tab') return w.tabMoves;
  if (drop.how === 'column') {
    const group = nodeOf(page, drop.container);
    if (!group) return w.noPart(drop.container);
    if (moving && contains(page, moving, drop.container)) return w.notInsideItself;
    if (!isGroup(group)) return w.columnInGroup;
    const plan = columnPlan(page, drop, moving);
    return plan.how === 'wrap' ? null : dropRefusal(page, plan.drop, moving, words);
  }
  if (drop.how === 'into' || drop.how === 'row' || drop.how === 'at') {
    const box = nodeOf(page, drop.container);
    if (!box) return w.noPart(drop.container);
    if (box.type === 'tabs') return w.putInATab;
    if (!listOf(box)) return w.holdsNoParts(nameOf(page, box, words));
    if (moving && contains(page, moving, drop.container)) return w.notInsideItself;
    return null;
  }
  const at = locate(page, drop.target);
  if (!at) return w.noPart(drop.target);
  if (at.node.type === 'tab') return w.putInATab;
  if (moving === drop.target) return w.notBesideItself;
  if (moving && contains(page, moving, drop.target)) return w.notInsideItself;
  if (drop.how === 'beside') {
    const full = (node: Part | Holder) => isRow(page, node) && node.children.length >= 4 && !node.children.some((c) => c.id === moving);
    if (full(at.node) || (!isRow(page, at.node) && full(at.parent))) return w.rowHoldsFour;
    const plan = besidePlan(page, drop, moving);
    if (plan?.how === 'refused') return w[plan.why];
  }
  return null;
}

const IMAGE_PLACEHOLDER = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"%3E%3Crect x="3" y="5" width="18" height="14" rx="2" fill="none" stroke="%23888"/%3E%3C/svg%3E';

/** A new block, named so no id is taken twice. */
export function makeBlock(kind: BlockKind, name: (prefix: string) => string, words: DesignerWords = en): LayoutNode {
  const w = words.defaults;
  switch (kind) {
    case 'group':
      return { type: 'section', id: name('section'), title: w.newGroup, columns: columnsValue(2, undefined, 1), children: [] };
    case 'side': {
      const id = name('side');
      const left: SectionNode = { type: 'section', id: name('section'), title: w.left, children: [] };
      const right: SectionNode = { type: 'section', id: name('section'), title: w.right, children: [] };
      return arrangement(id, 1, columnsValue(2, undefined, 1), [left, right]) as LayoutNode;
    }
    case 'tabs': {
      const tabs: TabsNode = { type: 'tabs', id: name('tabs'), children: [] };
      tabs.children.push({ type: 'tab', id: name('tab'), label: w.first, children: [] }, { type: 'tab', id: name('tab'), label: w.second, children: [] });
      return tabs;
    }
    case 'heading':
      return { type: 'text', id: name('heading'), style: 'heading', text: w.newHeading };
    case 'text':
      return { type: 'text', id: name('text'), style: 'paragraph', text: w.helpText };
    case 'button':
      return { type: 'button', id: name('button'), label: w.button, action: 'button', style: 'secondary' };
    case 'image':
      return { type: 'image', id: name('image'), src: IMAGE_PLACEHOLDER, alt: '' };
    case 'divider':
      return { type: 'divider', id: name('divider') };
    case 'spacer':
      return { type: 'spacer', id: name('spacer') };
  }
}

const BLOCKS = new Set<string>(['group', 'side', 'tabs', 'heading', 'text', 'divider', 'spacer', 'image', 'button']);

/** A new part from the toolbox, its field (if any) added to the page's. Refuses what the store's rules refuse. */
export function makePart(page: Page, part: NewPart, context: LayoutContext): LayoutNode {
  const words = context.words ?? en;
  const name = namer(page);
  if ('block' in part) {
    if (!BLOCKS.has(part.block)) throw new Refusal((w) => w.layout.noKindOfPart(part.block));
    return makeBlock(part.block, name, words);
  }
  if ('field' in part) {
    const def = Object.prototype.hasOwnProperty.call(context.model, part.field) ? context.model[part.field] : null;
    if (!def) throw new Refusal((w) => w.refusals.noModelField(part.field));
    if (shownFields(page).has(part.field)) throw new Refusal((w) => w.refusals.onThePageAlready(def.label));
    // A definition the page already keeps for it stays; otherwise the model's.
    page.fields[part.field] = page.fields[part.field] ?? JSON.parse(JSON.stringify(def));
    return { type: 'field', id: name('q'), field: part.field };
  }
  let kind: QuestionKind;
  try {
    kind = kindById(part.kind);
  } catch {
    throw new Refusal((w) => w.layout.noKindOfPart(part.kind));
  }
  if (kind.group === 'records' && page.data.kind === 'responses') throw new Refusal((w) => w.refusals.surveyHasNoRecords);
  const field = freeFieldName(page);
  page.fields[field] = kind.field(words.defaults.untitledQuestion, words);
  return { type: 'field', id: name('q'), field, ...(kind.widget ? { widget: kind.widget } : {}) };
}

/** Drop a part — one on the page, or a new one — where the drop says. Returns its id. */
export function place(page: Page, target: string | NewPart, drop: Drop, context: LayoutContext): string {
  const moving = typeof target === 'string' ? target : undefined;
  if (dropRefusal(page, drop, moving)) throw new Refusal((w) => dropRefusal(page, drop, moving, w) as string);
  const node = moving ? (locate(page, moving) as Spot).node : makePart(page, target as NewPart, context);
  placeAt(page, node, drop);
  return node.id;
}

// ---- several parts at once ----------------------------------------------------------------------------

/** Each part by id, or a refusal naming the one not found. */
function spotsOf(page: Page, ids: string[]): Spot[] {
  return [...new Set(ids)].map((id) => {
    const at = locate(page, id);
    if (!at) throw new Refusal((w) => w.layout.noPart(id));
    return at;
  });
}

/** The parts, in reading order, when they sit in one list — never tabs among their tabs. */
function siblings(page: Page, ids: string[]): Spot[] {
  const spots = spotsOf(page, ids);
  if (!spots.length || new Set(spots.map((s) => s.list)).size !== 1 || spots[0].parent.type === 'tabs') throw new Refusal((w) => w.layout.sameGroup);
  return spots.sort((a, b) => a.index - b.index);
}

/** What a tab made of a part is called: the group's title, the field's label, the words. */
function tabLabel(page: Page, node: LayoutNode): string {
  if (node.type === 'section') return node.title ?? '';
  if (node.type === 'field' || node.type === 'button') return nameOf(page, node);
  return node.type === 'text' ? node.text : '';
}

/**
 * Parts that sit together, in a new group (titled “New group”), side by side
 * (an arrangement), or in tabs, a tab each — where the first of them was.
 * Returns what holds them.
 */
export function wrap(page: Page, ids: string[], kind: 'group' | 'side' | 'tabs', words: DesignerWords = en): string {
  const spots = siblings(page, ids);
  const parent = spots[0].parent;
  const parentCols = across(page, parent);
  const nodes = spots.map((s) => s.node as LayoutNode);
  const name = namer(page);
  let made: LayoutNode;
  if (kind === 'group') {
    const cols = isSection(parent) ? parentCols : Math.min(2, nodes.length);
    made = { type: 'section', id: name('section'), title: words.defaults.newGroup, columns: cols === 1 ? 1 : columnsValue(cols, undefined, 1), children: nodes };
    setSpan(made, parentCols);
  } else if (kind === 'side') {
    if (nodes.length < 2) throw new Refusal((w) => w.layout.twoOrMore);
    if (parentCols > 1) {
      // In a grid: they keep their widths, on the grid's own columns.
      const total = Math.min(parentCols, nodes.reduce((sum, n) => sum + Math.min(spanOf(n), parentCols), 0));
      made = arrangement(name('side'), total, total as ColumnCount, nodes);
    } else {
      const count = Math.min(4, nodes.length);
      for (const n of nodes) setSpan(n, 1);
      made = arrangement(name('side'), parentCols, columnsValue(count, Math.min(2, count), 1), nodes);
    }
  } else {
    const tabs: TabsNode = { type: 'tabs', id: name('tabs'), children: [] };
    nodes.forEach((n, i) => tabs.children.push({ type: 'tab', id: name('tab'), label: tabLabel(page, n) || words.defaults.tab(i + 1), children: [n] }));
    setSpan(tabs, parentCols);
    made = tabs;
  }
  for (const s of [...spots].reverse()) s.list.splice(s.index, 1);
  spots[0].list.splice(spots[0].index, 0, made);
  tidy(page);
  return made.id;
}

/** A group's parts, or every tab's, where it was, no wider than there. Returns them. */
export function ungroup(page: Page, id: string): string[] {
  const at = spotsOf(page, [id])[0];
  const node = at.node;
  if (node.type !== 'section' && node.type !== 'tabs') throw new Refusal((w) => w.layout.onlyUngroup);
  const inner: LayoutNode[] = node.type === 'tabs' ? node.children.flatMap((tab) => tab.children) : node.children;
  const cols = across(page, at.parent);
  for (const part of inner) setSpan(part, Math.min(spanOf(part), cols));
  at.list.splice(at.index, 1, ...inner);
  tidy(page);
  return inner.map((part) => part.id).filter((part) => locate(page, part));
}

/** What a copy's id starts with. */
export const prefixOf = (node: Part): string => (node.type === 'field' ? 'q' : isWrapper(node) ? 'side' : node.type === 'text' && node.style === 'heading' ? 'heading' : node.type);

/** A copy made new: ids of its own, and fields of its own, as a copied question has. */
function renew(page: Page, node: Part, name: (prefix: string) => string): Part {
  node.id = name(prefixOf(node));
  // A copy of a saved form keeps its answers apart: `address_2`.
  if (node.type === 'form') node.name = answersName(page, node.name.replace(/_\d+$/, ''));
  if (node.type === 'field') {
    const field = freeFieldName(page);
    page.fields[field] = JSON.parse(JSON.stringify(page.fields[node.field]));
    node.field = field;
  }
  for (const child of listOf(node) ?? []) renew(page, child, name);
  return node;
}

/** A copy of each part right after it. Returns the copies. */
export function duplicate(page: Page, ids: string[]): string[] {
  const spots = spotsOf(page, ids).filter((s) => s.node.type !== 'tab');
  if (!spots.length) throw new Refusal((w) => w.layout.tabAlone);
  const name = namer(page);
  return spots.map((s) => {
    const copy = renew(page, JSON.parse(JSON.stringify(s.node)), name);
    s.list.splice(s.list.indexOf(s.node) + 1, 0, copy);
    return copy.id;
  });
}

/** Drop the fields nothing on the page shows any more. */
function prune(page: Page): void {
  const shown = shownFields(page);
  for (const name of Object.keys(page.fields)) if (!shown.has(name)) delete page.fields[name];
}

/** Take parts off the page: a row they leave closes up, tabs left with none go too, and so do the fields nothing shows. */
export function remove(page: Page, ids: string[]): void {
  const spots = spotsOf(page, ids);
  const root = page.layout as Holder;
  for (const { node } of spots) {
    const at = locate(page, node.id);
    if (!at) continue; // In one taken off already.
    if (at.parent.type !== 'tabs') detach(page, node.id);
    else {
      at.list.splice(at.index, 1);
      if (!at.list.length) detach(page, at.parent.id);
    }
  }
  tidy(page);
  if (!root.children.length) throw new Refusal((w) => w.refusals.oneStepOrSection);
  prune(page);
}

/** Put a new part after a part, or in a group or a tab at a place (or its end), or at the end of the last container. */
function insert(page: Page, node: LayoutNode, where: Where): void {
  if (where.after) {
    const at = locate(page, where.after);
    if (!at) throw new Refusal((w) => w.layout.noPart(where.after as string));
    if (at.node.type === 'tab') throw new Refusal((w) => w.layout.putInATab);
    putAt(page, at.parent, at.index + 1, [node], (p) => landingSpan(page, p, at.parent));
    return;
  }
  const all = containers(page);
  const box = where.parent ? nodeOf(page, where.parent) : (all[all.length - 1] as Holder | undefined);
  if (box?.type === 'tabs') throw new Refusal((w) => w.layout.putInATab);
  const list = listOf(box ?? undefined);
  if (!list) throw new Refusal((w) => w.layout.noGroupOrTab(String(where.parent)));
  putAt(page, box as Holder, where.index === undefined ? list.length : Math.max(0, Math.min(where.index, list.length)), [node], (p) => landingSpan(page, p, box as Holder));
}

/** A block where a tile is clicked: words, a line, room, a picture, a button, a group or tabs. Returns its id. */
export function addBlock(page: Page, kind: BlockKind, where: Where = {}, words: DesignerWords = en): string {
  if (!BLOCKS.has(kind)) throw new Refusal((w) => w.layout.noKindOfPart(kind));
  const node = makeBlock(kind, namer(page), words);
  insert(page, node, where);
  return node.id;
}
