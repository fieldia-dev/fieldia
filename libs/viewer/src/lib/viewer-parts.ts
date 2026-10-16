import type { ButtonNode, Field, FieldNode, Page, SectionNode, SheetTitle } from '@fieldia/core';
import { businessPart, choicePart, datePart, filesPart, lazyPart, linesPart, pathPart, phonePart, phoneSettings, quietPart, slotsPart, surveyPart, textPart, themesPart, widgetPart, type Part, type WidgetFactory } from '@fieldia/widgets';
import { isRichButton } from './button-parts';
import type * as FiltersModule from './filters-part';
import type * as HeadModule from './head-part';
import type * as ImportModule from './import-part';
import type * as ListModule from './list-part';
import { workHeading } from './section-head';

/** The head part: a record's head, split and toggled buttons, a group's work heading, the inset dialog's window tools. */
export type HeadPart = typeof HeadModule;
/** The filters part: a list's filter bar. */
export type FiltersPart = typeof FiltersModule;
/** The list part: a list screen, its search bar and its stylesheet. */
export type ListPart = typeof ListModule;
/** The import part: a list's Import, its dialog and its stylesheet. */
export type ImportPart = typeof ImportModule;

/** A work item's record and its window, loaded the first time a page draws a head, a split button, a work heading or the inset dialog. */
export const headPart: Part<HeadPart> = lazyPart('head', () => import('./head-part'));
/** A list's filter bar, loaded the first time a list draws one. */
export const filtersPart: Part<FiltersPart> = lazyPart('filters', () => import('./filters-part'));
/** A list screen — its table, search bar, pager and switcher — loaded the first time a page draws a list. */
export const listPart: Part<ListPart> = lazyPart('list', () => import('./list-part'));
/** A list's Import — a file read, its columns matched, its rows checked and written — loaded the first time Import is pressed. */
export const importPart: Part<ImportPart> = lazyPart('import', () => import('./import-part'));

/**
 * Puts the list's look in a document, as a list does the first time it is drawn: at once when the list part has come,
 * else as soon as it comes (settled then; a part that cannot come puts none). For what draws a list's look without the
 * list: the designer's canvas.
 */
export function installListStyles(doc: Document): Promise<void> {
  const loaded = listPart.loaded;
  if (loaded) {
    loaded.installListStyles(doc);
    return Promise.resolve();
  }
  return listPart.load().then(
    (part) => part.installListStyles(doc),
    () => undefined
  );
}

/** Every part the viewer can draw from, its own and its widgets'. */
const EVERY_PART: readonly Part[] = [headPart, listPart, importPart, filtersPart, textPart, pathPart, choicePart, datePart, linesPart, businessPart, filesPart, surveyPart, phonePart, slotsPart, themesPart, quietPart];

/** A group holding a Markdown text alone, whose Edit and Done its heading takes: drawn with the work heading's tools. */
const markdownAlone = (node: SectionNode) => {
  const only = node.children.length === 1 ? node.children[0] : undefined;
  return !!node.title && only?.type === 'field' && only.options?.['editor'] === 'markdown';
};

/**
 * The parts a page draws from (parts.ts in @fieldia/widgets): the head part for
 * a record's head, a button split, toggled or shown by its icon alone, or a
 * group's work heading; the list part for a list, and the filters part beside
 * it for its filter bar; and the
 * widgets' own for the fields that need them (a work item's text, a links box,
 * a path picker, a choice in Fieldia's own list, a date's box and calendar, a table of lines or of a many2many's
 * records, a business widget, a file, a picture, a signature or a PDF field, the survey kinds, booking slots) — unless the app's
 * `widgets` draw those fields; and those the app's `slots` name for the slots the page has (a Discussion's). The
 * page's own look's too: the themes part for the theme it names, and the quiet look's for its quiet skin, or a group
 * or a field it marks quiet. (A theme or a skin the app gives the viewer is worn as its part comes: look-parts.ts in
 * @fieldia/widgets.)
 *
 * A sheet's statusbar is drawn as a field with `"widget": "statusbar"` is (viewer.ts), so it asks for that widget's
 * part — the business part — as such a field would, unless the app's `widgets` draw it, or the sheet has a head,
 * which draws no statusbar.
 *
 * A table's lines draw each cell with its column's widget (as its cells say: a time of day, a path picker, a photo,
 * a progress bar), so their columns' parts are the page's too; a sheet's title draws the fields it names (its avatar:
 * a picture field); and a properties field, itself in the survey part, may hold a date — one added in place, or worked
 * out from its value — whatever the page names, so it asks for the date part too (never a file: a property holds none).
 *
 * A phone field is read the world over where its page's `phone` or its own options say so, and a list's phone column
 * then writes its numbers as people read them: both ask for the phone part.
 */
export function partsFor(page: Page, widgets: Record<string, WidgetFactory> = {}, slots: Record<string, { readonly parts?: readonly Part[] }> = {}): Part[] {
  const found = new Set<Part>();
  const fieldParts = (field: Field, node: FieldNode): void => {
    const part = widgetPart(field, node, widgets, page);
    if (part) found.add(part);
    // Its rows are drawn with each kind's widget: a date's, unless the app draws dates.
    const dated = field.type === 'properties' ? widgetPart({ type: 'date', label: field.label }, { type: 'field', id: node.id, field: node.field }, widgets, page) : undefined;
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
    // A sheet's statusbar, drawn unless its head is (which shows the state its own way).
    const bar = node.type === 'sheet' && !node['head'] ? (node['statusbar'] as { field?: unknown } | undefined) : undefined;
    if (bar && typeof bar.field === 'string' && page.fields[bar.field]) fieldParts(page.fields[bar.field], { type: 'field', id: '#statusbar', field: bar.field, widget: 'statusbar' });
    // A sheet's title names its fields rather than placing them: the title, its subtitle and its avatar (a picture).
    const title = node.type === 'sheet' ? (node['title'] as SheetTitle | undefined) : undefined;
    for (const [name, id] of [[title?.field, '#title'], [title?.subtitleField, '#subtitle'], [title?.avatarField, '#avatar']] as const) {
      const field = name ? page.fields[name] : undefined;
      if (field && name) fieldParts(field, { type: 'field', id, field: name });
    }
    if (node.type === 'sheet' && node['head']) found.add(headPart);
    else if (node.type === 'button' && isRichButton(node as unknown as ButtonNode)) found.add(headPart);
    else if (node.type === 'section' && Array.isArray(node['children']) && (workHeading(node as unknown as SectionNode) || markdownAlone(node as unknown as SectionNode))) found.add(headPart);
    else if (node.type === 'list') {
      found.add(listPart);
      if (node['search'] === 'fields') found.add(filtersPart);
      if (phoneColumns(page, node as { columns?: unknown; cells?: unknown }).length) found.add(phonePart);
    }
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

/** A list's columns whose numbers it writes as people read them: those it shows as a phone (`cells.<field>.widget`), where its page or the cell's options say so. */
export function phoneColumns(page: Page, list: { columns?: unknown; cells?: unknown }): string[] {
  const cells = (list.cells ?? {}) as Record<string, { widget?: string; options?: Record<string, unknown> } | undefined>;
  const columns = Array.isArray(list.columns) ? (list.columns as unknown[]).filter((name): name is string => typeof name === 'string') : [];
  return columns.filter((name) => cells[name]?.widget === 'phone' && page.fields[name]?.type === 'char' && phoneSettings(page, cells[name]?.options) !== null);
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
