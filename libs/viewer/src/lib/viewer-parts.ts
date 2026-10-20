import { callsPartFunctions, formLimitsPart, functionsPart, hasLimits, hasOptionRules, mapChecksPart, optionRulesPart, signsAnswers, type ButtonNode, type Field, type FieldNode, type Page, type SectionNode, type SheetTitle } from '@fieldia/core';
import { businessPart, choicePart, datePart, evidencePart, filesPart, lazyPart, linesPart, partsOf, pathPart, phonePart, phoneSettings, quietPart, relationsPart, scanPart, scans, slotsPart, surveyPart, textPart, themesPart, widgetPart, type Part, type WidgetFactory } from '@fieldia/widgets';
import { isRichButton } from './button-parts';
import { printPart } from './print';
import type * as AnswersModule from './answers-part';
import type * as CardsModule from './cards-part';
import type * as ColumnsModule from './columns-part';
import type * as DuplicatesModule from './duplicates-part';
import type * as FiltersModule from './filters-part';
import type * as HeadModule from './head-part';
import type * as ImportModule from './import-part';
import type * as LimitsModule from './limits-part';
import type * as ListModule from './list-part';
import { workHeading } from './section-head';

/** The head part: a record's head, split and toggled buttons, a group's work heading, the inset dialog's window tools. */
export type HeadPart = typeof HeadModule;
/** The filters part: a list's filter bar. */
export type FiltersPart = typeof FiltersModule;
/** The list part: a list screen, its search bar and its stylesheet. */
export type ListPart = typeof ListModule;
/** The cards part: a list's rows as cards, on a phone and in its gallery. */
export type CardsPart = typeof CardsModule;
/** The columns part: the columns a person shows, hides, orders and sizes in a list. */
export type ColumnsPart = typeof ColumnsModule;
/** The import part: a list's Import, its dialog and its stylesheet. */
export type ImportPart = typeof ImportModule;
/** The duplicates part: possible duplicates said under the fields they matched on, and the merge's screen. */
export type DuplicatesPart = typeof DuplicatesModule;
/** The answers part: a page's own words that show the answers given, as a sentence says them, and a page of responses' ending. */
export type AnswersPart = typeof AnswersModule;
/** The limits part: a closed form's words in place of its questions, and Continue later. */
export type LimitsPart = typeof LimitsModule;

/** A work item's record and its window, loaded the first time a page draws a head, a split button, a work heading or the inset dialog. */
export const headPart: Part<HeadPart> = lazyPart('head', () => import('./head-part'));
/** A list's filter bar, loaded the first time a list draws one. */
export const filtersPart: Part<FiltersPart> = lazyPart('filters', () => import('./filters-part'));
/** A list screen — its table, search bar, pager and switcher — loaded the first time a page draws a list. */
export const listPart: Part<ListPart> = lazyPart('list', () => import('./list-part'));
/** A list's rows as cards — on a phone, in its gallery — loaded the first time a page draws a list with `card` or `gallery`. */
export const cardsPart: Part<CardsPart> = lazyPart('cards', () => import('./cards-part'));
/** The columns a person shapes, loaded the first time a page draws a list with `optionalColumns`. */
export const columnsPart: Part<ColumnsPart> = lazyPart('columns', () => import('./columns-part'));
/** A list's Import — a file read, its columns matched, its rows checked and written — loaded the first time Import is pressed. */
export const importPart: Part<ImportPart> = lazyPart('import', () => import('./import-part'));
/**
 * Possible duplicates and the merge's screen, loaded the first time a page naming fields in `duplicates` is shown with
 * a source that has `duplicates` — never waited for: what it says comes with the source's answer.
 */
export const duplicatesPart: Part<DuplicatesPart> = lazyPart('duplicates', () => import('./duplicates-part'));
/**
 * What a page says of the answers given — a `{field}` in a label, a help, a choice, a step's title or a button, as a
 * sentence says it — and the ending a page of responses shows once they are sent: loaded before a page that has any
 * is drawn (`showsAnswers`).
 */
export const answersPart: Part<AnswersPart> = lazyPart('answers', () => import('./answers-part'));

/**
 * Whether a page says the answers given in its own words — a `{field}` in a label, a help, a choice, a step's title,
 * a button — or shows an ending once it is sent: what the answers part draws. A text's and an alert's own `{field}`s
 * are drawn without it, as before (on a page with the part, as a sentence says them).
 */
const showsAnswers = (page: Page): boolean =>
  !!page.endings?.length || /\{[A-Za-z_]\w*(\|[^{}]*)?\}/.test(JSON.stringify([page.fields, page.layout], (key, value) => (key === 'text' || key === 'message' ? undefined : value)));

/**
 * A page's opening, closing and limits said as it opens, and Continue later, loaded with the page's parts where it
 * has `limits` or `continueLater`: waited for, so a closed form never shows its questions first.
 */
export const limitsPart: Part<LimitsPart> = lazyPart('limits', () => import('./limits-part'));

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

/**
 * Every part the viewer can draw from, its own and its widgets', and the print part (print.ts), which draws nothing —
 * but the decode part, which reads codes only where a browser reads none itself, as Scan is pressed.
 */
const EVERY_PART: readonly Part[] = [headPart, listPart, cardsPart, columnsPart, importPart, filtersPart, duplicatesPart, answersPart, limitsPart, printPart, textPart, pathPart, choicePart, datePart, linesPart, businessPart, filesPart, evidencePart, surveyPart, phonePart, slotsPart, relationsPart, scanPart, themesPart, quietPart, functionsPart, formLimitsPart, optionRulesPart];

/** A group holding a Markdown text alone, whose Edit and Done its heading takes: drawn with the work heading's tools. */
const markdownAlone = (node: SectionNode) => {
  const only = node.children.length === 1 ? node.children[0] : undefined;
  return !!node.title && only?.type === 'field' && only.options?.['editor'] === 'markdown';
};

/**
 * The parts a page draws from (parts.ts in @fieldia/widgets): the head part for
 * a record's head, a button split, toggled or shown by its icon alone, or a
 * group's work heading; the list part for a list or a related list, and beside
 * a list the filters part for its filter bar, the cards part for its cards
 * (`card`, `gallery`; a related list's `card` too) and the columns part for the
 * columns a person shapes (`optionalColumns`); and the
 * widgets' own for the fields that need them (a work item's text, a links box,
 * a path picker, a choice in Fieldia's own list, a date's box and calendar, a table of lines or of a many2many's
 * records or its cards, a business widget, a file, a picture, a signature or a PDF field, the survey kinds, booking
 * slots, a link to other records — a many2one, a many2many's tags, a reference — and an analytic distribution's links
 * with the business part; and beside the files part, for a signature that signs answers, its evidence's part) — unless the app's
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
 * out from its value — whatever the page names, so it asks for the date part too; and the choice part where one may be
 * a choice of many options, searched: one of its own definitions, or any its data source gives (never a file or a
 * link: a property holds none).
 *
 * A field scanned into with the camera (`options.scan`) — a table's column, a table counted — asks for the scan part,
 * its Scan button's (never the decode part, which comes as Scan is pressed where the browser reads no codes itself).
 *
 * A phone field is read the world over where its page's `phone` or its own options say so, and a list's phone column
 * then writes its numbers as people read them: both ask for the phone part.
 *
 * A page with `limits` or `continueLater` asks for the limits part: a closed form's words stand in place of its
 * questions as it opens, and Continue later sits among its buttons. A page with `limits`, or options with `seats`, asks
 * for its form's too, @fieldia/core's (`formLimitsPart`): when it takes answers and each choice's places, worked out —
 * in the one-tag script, the same script.
 *
 * A page whose formulas call one of Fieldia's functions beyond the plain ones (`age`, `addMonths`, `contains`, `join`,
 * `average`, …) asks for @fieldia/core's functions part, their bodies (`callsPartFunctions`); one whose choices' options
 * show by a condition, or are carried from an earlier question, its options part (`hasOptionRules`).
 */
export function partsFor(page: Page, widgets: Record<string, WidgetFactory> = {}, slots: Record<string, { readonly parts?: readonly Part[] }> = {}): Part[] {
  const found = new Set<Part>();
  // A part made with others (an analytic distribution's, with its links') stands for each of them.
  const add = (part: Part | undefined) => {
    for (const one of part ? partsOf(part) : []) found.add(one);
  };
  const fieldParts = (field: Field, node: FieldNode): void => {
    const part = widgetPart(field, node, widgets, page);
    add(part);
    // A signature that signs answers, drawn by the files part: its evidence's part beside it.
    if (part === filesPart && node.widget === 'signature' && signsAnswers(node)) add(evidencePart);
    // Scanned into with the camera — a field, a table's column, a table counted: its Scan button's part beside it.
    if (scans(node)) add(scanPart);
    // Its rows are drawn with each kind's widget: a date's, unless the app draws dates; and a long choice's, searched —
    // one of the page's own, or any of those the data source gives.
    if (field.type === 'properties') {
      const row = { type: 'field', id: node.id, field: node.field } as const;
      const dated = widgetPart({ type: 'date', label: field.label }, row, widgets, page);
      const choices = field.definitionsFrom ? [widgetPart({ type: 'selection', label: field.label, options: [] }, { ...row, options: { search: true } }, widgets, page)] : (field.definitions ?? []).map((one) => (one.type === 'selection' ? widgetPart({ type: 'selection', label: one.label, options: one.options ?? [] }, row, widgets, page) : undefined));
      for (const part of [dated, ...choices]) add(part);
    }
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
      // Its rows as cards, on a phone or in its gallery; the columns a person shapes.
      if (node['card'] || node['gallery']) found.add(cardsPart);
      if (node['optionalColumns']) found.add(columnsPart);
      if (node['search'] === 'fields') found.add(filtersPart);
      if (phoneColumns(page, node as { columns?: unknown; cells?: unknown }).length) found.add(phonePart);
    }
    // A related list is drawn by the list part's table, its records' phones as its own fields say, its rows as cards
    // on a phone as a list's.
    else if (node.type === 'related') {
      found.add(listPart);
      if (node['card']) found.add(cardsPart);
      const fields = node['fields'] && typeof node['fields'] === 'object' ? (node['fields'] as Page['fields']) : {};
      if (phoneColumns({ ...page, fields }, node as { columns?: unknown; cells?: unknown }).length) found.add(phonePart);
    }
    else if (node.type === 'slot' && typeof node['name'] === 'string') for (const part of slots[node['name']]?.parts ?? []) add(part);
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
  if (showsAnswers(page)) found.add(answersPart);
  // A page's opening, closing and limits, and Continue later: said before its questions, so in before it is drawn.
  if (page.limits || page.continueLater) found.add(limitsPart);
  if (hasLimits(page)) found.add(formLimitsPart);
  if (callsPartFunctions(page)) found.add(functionsPart);
  if (hasOptionRules(page)) found.add(optionRulesPart);
  if (page.look?.theme) found.add(themesPart);
  if (page.look?.skin === 'quiet') found.add(quietPart);
  return [...found];
}

/**
 * The parts whose checks a page's check owes (`PageValidation.later`, in the one-tag script alone: they come with the
 * part that draws what they check): asked for with the page's own, the check run again once they came.
 */
export function owedParts(later: readonly string[] | undefined): Part[] {
  const by: Record<string, Part> = { list: listPart, head: headPart, limits: limitsPart, answers: answersPart, slots: slotsPart, files: filesPart, lines: linesPart, business: businessPart, options: optionRulesPart, mapchecks: mapChecksPart, scan: scanPart };
  return (later ?? []).flatMap((name) => (by[name] ? [by[name]] : []));
}

/** A list's columns whose numbers it writes as people read them: those it shows as a phone (`cells.<field>.widget`), where its page or the cell's options say so. */
export function phoneColumns(page: Page, list: { columns?: unknown; cells?: unknown }): string[] {
  const cells = (list.cells ?? {}) as Record<string, { widget?: string; options?: Record<string, unknown> } | undefined>;
  const columns = Array.isArray(list.columns) ? (list.columns as unknown[]).filter((name): name is string => typeof name === 'string') : [];
  return columns.filter((name) => cells[name]?.widget === 'phone' && page.fields[name]?.type === 'char' && phoneSettings(page, cells[name]?.options) !== null);
}

/**
 * The parts a page draws from, loaded — or, with no page, every part, the
 * print part too (which a page loads as a person means to print: print.ts), but
 * the decode part (`decodePart`, a reader of codes for browsers with none). The
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
