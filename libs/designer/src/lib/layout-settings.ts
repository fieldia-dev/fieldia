import type { ButtonNode, ColumnCount, ColumnsByWidth, LabelPlace, Page, PageLook, SectionNode, TextNode } from '@fieldia/core';
import { columnsValue, setSpan, SPANNED } from './layout-ops';
import { across, isSection, locate, nodeOf, spanOf } from './layout-tree';
import { Refusal } from './refusal';

/**
 * A layout's settings: a group's columns on each size of screen, how wide a
 * part is, how a group looks and where labels sit, and the page's look.
 */

/** How a group looks; `null` takes a setting back. */
export interface SectionLook {
  style?: NonNullable<SectionNode['style']> | null;
  labels?: LabelPlace | null;
  labelWidth?: number | null;
}

/** A change to the page's look; `null` takes a setting back. */
export type LookPatch = { [K in keyof PageLook]?: PageLook[K] | null };

const COUNTS: readonly number[] = [1, 2, 3, 4];

/** A part wider than a section's columns is narrowed to them. */
function narrowTo(section: SectionNode, wide: number): void {
  for (const child of section.children) if (SPANNED.has(child.type) && spanOf(child) > wide) (child as { colspan?: number }).colspan = wide;
}

/** A group's columns: one count, or a count for a desktop, a tablet and a phone (a plain number when only a desktop's is given). */
export function setColumns(page: Page, id: string, columns: ColumnCount | ColumnsByWidth): void {
  const section = nodeOf(page, id);
  if (!isSection(section)) throw new Refusal(`There is no section "${id}"`);
  const { wide, medium, narrow } = typeof columns === 'object' ? columns : { wide: columns, medium: undefined, narrow: undefined };
  if ([wide, medium, narrow].some((n) => n !== undefined && !COUNTS.includes(n))) throw new Refusal('A group has one to four columns');
  if (typeof columns === 'number') {
    // Columns given per width keep their narrower counts, never more than the wide one.
    const given = section.columns;
    section.columns =
      typeof given === 'object'
        ? { wide, ...(given.medium ? { medium: Math.min(given.medium, wide) as ColumnCount } : {}), ...(given.narrow ? { narrow: Math.min(given.narrow, wide) as ColumnCount } : {}) }
        : wide;
  } else {
    if ((medium ?? 0) > wide || (narrow ?? 0) > wide) throw new Refusal('A tablet or a phone shows no more columns than a desktop');
    if ((narrow ?? 0) > (medium ?? 4)) throw new Refusal('A phone shows no more columns than a tablet');
    section.columns = columnsValue(wide, medium, narrow);
  }
  narrowTo(section, wide);
}

const NOUNS: Record<string, string> = { field: 'A field', section: 'A group', tabs: 'Tabs', text: 'Words', button: 'A button', spacer: 'A spacer', image: 'An image' };

/** How many columns a part spans, no more than where it sits has. */
export function setColspan(page: Page, id: string, span: number): void {
  const at = locate(page, id);
  if (!at) throw new Refusal(`There is no part “${id}”`);
  if (at.node.type === 'tab') throw new Refusal('A tab is as wide as its tabs');
  if (!SPANNED.has(at.node.type)) throw new Refusal(`A ${at.node.type} runs across the whole row`);
  const cols = across(page, at.parent);
  if (span > cols) throw new Refusal(`${NOUNS[at.node.type]} cannot be wider than its section's ${cols} columns`);
  setSpan(at.node, span);
}

const LABEL_WIDTH = 'Labels set beside are 60 to 320 px wide';
const labelWidthOk = (width: number | null | undefined) => width === null || width === undefined || (Number.isInteger(width) && width >= 60 && width <= 320);

/** Set or take back each setting given: `null` takes it back, and so does a card, which a group is unless it says otherwise. */
function patch(target: Record<string, unknown>, settings: Record<string, unknown>, defaults: Record<string, unknown> = {}): void {
  for (const [key, value] of Object.entries(settings)) {
    if (value === undefined) continue;
    if (value === null || defaults[key] === value) delete target[key];
    else target[key] = value;
  }
}

/** How a group looks, and where its fields' labels sit. */
export function setSectionLook(page: Page, id: string, look: SectionLook): void {
  const section = nodeOf(page, id);
  if (!isSection(section)) throw new Refusal(`There is no group “${id}”`);
  if (!labelWidthOk(look.labelWidth)) throw new Refusal(LABEL_WIDTH);
  patch(section as unknown as Record<string, unknown>, { style: look.style, labels: look.labels, labelWidth: look.labelWidth }, { style: 'card' });
}

/** Where one field's label sits; `null` for where its group or the page puts labels. */
export function setFieldLabels(page: Page, id: string, place: LabelPlace | null): void {
  const at = locate(page, id);
  if (at?.node.type !== 'field') throw new Refusal(`There is no field “${id}”`);
  if (place) at.node.labels = place;
  else delete at.node.labels;
}

/** The page's look: its colour, font, spacing, corners, labels and scheme. */
export function setLook(page: Page, change: LookPatch): void {
  if (change.accent && !/^#[0-9a-fA-F]{6}$/.test(change.accent)) throw new Refusal('A colour is written #rrggbb, such as #1f7a4d');
  if (!labelWidthOk(change.labelWidth)) throw new Refusal(LABEL_WIDTH);
  const look: Record<string, unknown> = { ...page.look };
  patch(look, change);
  if (Object.keys(look).length) page.look = look as PageLook;
  else delete page.look;
}

/** A block's own words and look: words and how they read, a button's label and look, a picture's address and description. */
export interface BlockPatch {
  text?: string;
  style?: string;
  label?: string;
  src?: string;
  alt?: string;
}

export function updateBlock(page: Page, id: string, patch: BlockPatch): void {
  const node = locate(page, id)?.node;
  if (!node) throw new Refusal(`There is no part “${id}”`);
  if (node.type === 'text') {
    if (patch.label !== undefined || patch.src !== undefined || patch.alt !== undefined) throw new Refusal('Words have text, not a label');
    if (patch.text !== undefined) node.text = patch.text;
    if (patch.style !== undefined) node.style = patch.style as TextNode['style'];
  } else if (node.type === 'button') {
    if (patch.text !== undefined || patch.src !== undefined || patch.alt !== undefined) throw new Refusal('A button has a label, not text');
    if (patch.label !== undefined) node.label = patch.label;
    if (patch.style !== undefined) node.style = patch.style as ButtonNode['style'];
  } else if (node.type === 'image') {
    if (patch.text !== undefined || patch.label !== undefined) throw new Refusal('A picture has an address and a description');
    if (patch.src !== undefined) {
      if (!patch.src.trim()) throw new Refusal('A picture needs its address');
      node.src = patch.src.trim();
    }
    if (patch.alt !== undefined) node.alt = patch.alt;
  } else throw new Refusal('Only words, a button or a picture are changed here');
}

/** Several widths as one edit, such as two parts trading width across the gutter between them; refused whole if any one is. */
export function setWidths(page: Page, widths: { id: string; span: number }[]): void {
  for (const { id, span } of widths) setColspan(page, id, span);
}
