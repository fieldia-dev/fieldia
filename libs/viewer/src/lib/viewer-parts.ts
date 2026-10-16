import type { ButtonNode, Field, FieldNode, Page, SectionNode } from '@fieldia/core';
import { choicePart, datePart, lazyPart, pathPart, quietPart, textPart, themesPart, widgetPart, type Part, type WidgetFactory } from '@fieldia/widgets';
import { isRichButton } from './button-parts';
import type * as FiltersModule from './filters-part';
import type * as HeadModule from './head-part';
import { workHeading } from './section-head';

/** The head part: a record's head, split and toggled buttons, a group's work heading, the inset dialog's window tools. */
export type HeadPart = typeof HeadModule;
/** The filters part: a list's filter bar. */
export type FiltersPart = typeof FiltersModule;

/** A work item's record and its window, loaded the first time a page draws a head, a split button, a work heading or the inset dialog. */
export const headPart: Part<HeadPart> = lazyPart('head', () => import('./head-part'));
/** A list's filter bar, loaded the first time a list draws one. */
export const filtersPart: Part<FiltersPart> = lazyPart('filters', () => import('./filters-part'));

/** Every part the viewer can draw from, its own and its widgets'. */
const EVERY_PART: readonly Part[] = [headPart, filtersPart, textPart, pathPart, choicePart, datePart, themesPart, quietPart];

/** A group holding a Markdown text alone, whose Edit and Done its heading takes: drawn with the work heading's tools. */
const markdownAlone = (node: SectionNode) => {
  const only = node.children.length === 1 ? node.children[0] : undefined;
  return !!node.title && only?.type === 'field' && only.options?.['editor'] === 'markdown';
};

/**
 * The parts a page draws from (parts.ts in @fieldia/widgets): the head part for
 * a record's head, a button split, toggled or shown by its icon alone, or a
 * group's work heading; the filters part for a list's filter bar; and the
 * widgets' own for the fields that need them (a work item's text, a links box,
 * a path picker, a choice in Fieldia's own list, a date's box and calendar) — unless the app's `widgets` draw those
 * fields; and those the app's `slots` name for the slots the page has (a Discussion's). The page's own look's too:
 * the themes part for the theme it names, and the quiet look's for its quiet skin, or a group or a field it marks quiet.
 * (A theme or a skin the app gives the viewer is worn as its part comes: look-parts.ts in @fieldia/widgets.)
 *
 * A table's lines draw each cell with its column's widget (as its cells say: a time of day, a path picker), so their
 * columns' parts are the page's too; and a properties field may hold a date — one added in place, or worked out from
 * its value — whatever the page names, so it asks for the date part.
 */
export function partsFor(page: Page, widgets: Record<string, WidgetFactory> = {}, slots: Record<string, { readonly parts?: readonly Part[] }> = {}): Part[] {
  const found = new Set<Part>();
  const fieldParts = (field: Field, node: FieldNode): void => {
    const part = widgetPart(field, node, widgets);
    if (part) found.add(part);
    // Its rows are drawn with each kind's widget: a date's, unless the app draws dates.
    const dated = field.type === 'properties' ? widgetPart({ type: 'date', label: field.label }, { type: 'field', id: node.id, field: node.field }, widgets) : undefined;
    if (dated) found.add(dated);
    if (field.type !== 'one2many' || !field.fields) return;
    for (const [column, sub] of Object.entries(field.fields)) {
      const cell = node.cells?.[column];
      fieldParts(sub as Field, { type: 'field', id: `${node.id}.${column}`, field: column, ...(cell?.widget ? { widget: cell.widget } : {}), ...(cell?.options ? { options: cell.options } : {}) });
    }
  };
  const visit = (value: unknown): void => {
    if (Array.isArray(value)) {
      for (const item of value) visit(item);
      return;
    }
    if (!value || typeof value !== 'object') return;
    const node = value as { type?: unknown; [key: string]: unknown };
    // A group or a field that asks for the quiet look.
    if (node['quiet'] === true) found.add(quietPart);
    if (node.type === 'sheet' && node['head']) found.add(headPart);
    else if (node.type === 'button' && isRichButton(node as unknown as ButtonNode)) found.add(headPart);
    else if (node.type === 'section' && Array.isArray(node['children']) && (workHeading(node as unknown as SectionNode) || markdownAlone(node as unknown as SectionNode))) found.add(headPart);
    else if (node.type === 'list' && node['search'] === 'fields') found.add(filtersPart);
    else if (node.type === 'slot' && typeof node['name'] === 'string') for (const part of slots[node['name']]?.parts ?? []) found.add(part);
    else if (node.type === 'field' && typeof node['field'] === 'string') {
      const field = page.fields[node['field']];
      if (field) fieldParts(field, node as unknown as FieldNode);
    }
    for (const key of Object.keys(node)) {
      const child = node[key];
      if (child && typeof child === 'object') visit(child);
    }
  };
  visit(page.layout);
  if (page.look?.theme) found.add(themesPart);
  if (page.look?.skin === 'quiet') found.add(quietPart);
  return [...found];
}

/**
 * The parts a page draws from, loaded — or, with no page, every part. The
 * viewer and its dialogs wait for a page's parts themselves before they draw
 * it; this is for an app that wants them in before it mounts, so the page is
 * drawn whole the moment it is mounted. Rejects when one could not come (the
 * viewer then draws plainly what it would have drawn from it). A theme or the
 * quiet skin the app itself gives the viewer is not the page's: its part is
 * `themesPart` or `quietPart` (@fieldia/widgets), `.load()`ed the same way.
 */
export async function loadParts(page?: Page, widgets?: Record<string, WidgetFactory>, slots?: Record<string, { readonly parts?: readonly Part[] }>): Promise<void> {
  await Promise.all((page ? partsFor(page, widgets, slots) : EVERY_PART).map((part) => part.load()));
}
