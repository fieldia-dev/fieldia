import {
  addDays,
  dayStarts,
  facetsToFilter,
  firstWeekday,
  groupByFields,
  importFields,
  optionsList,
  ownZone,
  withCarriedOptions,
  recordSentence,
  type AskHow,
  type ButtonNode,
  type DayCount,
  type FilterPeriod,
  type DataSource,
  type Facet,
  type Form,
  type ListNode,
  type Locale,
  type RangeDays,
  type ResolvedFilter as Resolved,
  type Page,
  type RecordId,
  type ResolvedFilter,
  type RunResult,
  type SortOrder,
  type Tone,
  type Values,
  type ViewState,
} from '@fieldia/core';
import { drawIcon, formatNumber, keepsWhole, loadingOver, moneyReads, startLoading, type IconSet, type Loading, type PreferenceStore, type Widget, type WidgetContext, type WidgetDialogs, type WidgetLabels } from '@fieldia/widgets';
import type { El } from './dom';
import { defaultFacets, laterFavourites, startingFacets } from './favourites';
import { filterKit } from './filter-range';
import type { ViewerLabels } from './labels';
import { listCells, plain, rowRules } from './list-cells';
import { daysFilter, periodDays } from './list-days';
import { askBulkValue, bulkOffered, bulkQuestion, lockedOut, writeBulk, type BulkList, type KnownRecord } from './list-bulk';
import { everyId } from './list-every';
import { csvOf, csvSeparator, exportList, saveFile, type ExportFormat, type ExportList, type ExportWhich } from './list-export';
import { groupKey, groupRow, type GroupContext, type GroupKey, type Heading, type Row } from './list-groups';
import { installListStyles } from './list-styles';
import { listTotals } from './list-totals';
import { keepFootRoom, printout, PRINT_MOST } from './list-print';
import { loadPrint, printIntent, printSoon } from './print';
import { searchBar } from './search-bar';
import { markSort, pressedSort, sortWith } from './list-sort';
import { endlessRows } from './list-endless';
import type { SavedViews, ViewsSource } from './saved-views';
import { assistPart, cardsPart, columnsPart, editablePart, filtersPart, importPart, rowsPart, viewsPart, type AssistPart, type ColumnsPart } from './viewer-parts';
import type { EditableRows, NewForm } from './list-editable';
import { xlsxOf, XLSX_TYPE } from './xlsx';

export interface ListContext {
  page: Page;
  node: ListNode;
  form: Form;
  dataSource: DataSource | undefined;
  doc: Document;
  el: El;
  labels: ViewerLabels;
  locale: Locale;
  fill: (template: string, values: Record<string, string | number>) => string;
  /** Run a button's steps, the button busy until they are done. */
  press: (button: HTMLElement, run: () => Promise<RunResult>) => Promise<void>;
  withIcon: (icon: string | undefined, text: string) => (Node | string)[];
  uid: (id: string) => string;
  icons?: IconSet;
  /** Where the list's favourite searches are kept. */
  preferences: PreferenceStore;
  /**
   * A row opened. A promise answered (the record in a dialog, closed): the list asks again once it settles, and its row
   * takes the focus back. Anything else answered is let be, so a handler that returns what it did (a push's count) still fits.
   */
  onOpenRecord?: (id: RecordId, name?: string) => unknown;
  /** Conditions every search keeps: the records this list may show at all. */
  fixedFilter?: ResolvedFilter[];
  /** The search it opens with, chips a person may take away, in place of its default filters and favourite (View all's). */
  search?: Facet[];
  /** Other ways of showing the records, by name: `map` for a list with `map`, `calendar` for one with `calendar`. */
  views?: Record<string, ListViewFactory>;
  /**
   * Another view asked for a new record with these values filled in (a calendar's empty slot pressed: its start and
   * end). A promise answered: the records again once it settles. Without it, a view offers no way to make one.
   */
  onNewRecord?: (values: Values) => unknown;
  /** The clock a period is counted from ("Today", "This week"): the computer's own unless given (the viewer's `now`). */
  now?: () => Date;
  /** Words said over the page, as a toast: an export done, or why it was not. Unsaid without it. */
  say?: (message: string, tone: Tone) => void;
  /**
   * A question answered Yes or No, as a button's confirmation asks it: "Update 24 records?", `how.yes` what Yes does
   * ("Update"). Without it, Edit is not offered.
   */
  ask?: (message: string, how?: AskHow) => Promise<boolean>;
  /** Values asked in a dialog of fields, as a line's own form asks them: Edit's field and value. Without it, Edit is not offered. */
  editValues?: WidgetDialogs['editValues'];
  /**
   * A list inside a record (a related list: list-related.ts): its search a box alone — no menu of filters, groups and
   * favourites — and its search and pager shown only once its records run past a page, or while a search is on.
   */
  inRecord?: boolean;
  /**
   * Taken as each ask goes to the source: its answer is drawn only while what it gives still holds — a related list's
   * `form.recordShown()`, so the records of a record no longer shown are drawn in none.
   */
  shown?: () => () => boolean;
  /** Told how many records the list holds each time it has asked: with no search on, or under one (`searched`). */
  onCount?: (total: number, searched: boolean) => void;
  /** What it says holding no records, with no search on: "No records match." unless given (a related list's "None yet."). */
  none?: string;
  /** The widgets' words, for what a cell draws as a field would: a phone's call and WhatsApp links. Without them, a cell has no links. */
  widgetLabels?: WidgetLabels;
  /**
   * What a list whose cells are changed in place (`editable`) draws with: a row's own form, as the viewer makes one, a
   * field's box, as it draws one, and the dialogs its boxes open. Without the first two, its rows are read and opened.
   */
  newForm?: NewForm;
  drawField?: (context: WidgetContext) => Widget;
  dialogs?: WidgetDialogs;
  /** "Discard your changes?", worded Discard, the focus on Cancel. */
  letGo?: (message: string) => Promise<boolean>;
  /** How it waits for its records (loading.ts in @fieldia/widgets): the page's way, under its own `loading`. Fieldia's without it. */
  loading?: Loading;
  /** Its first wait goes on from one in sight — its page's, while its part came: drawn at once, never after the delay. */
  loadingNow?: boolean;
}

/**
 * What another way of showing a list's records is given, such as the map
 * @fieldia/map draws beside the table: the records the search bar asks for,
 * the records chosen (shared with the table and its buttons), a way to open
 * one, to light its row, and to put a search into the search bar.
 */
export interface ListViewContext {
  page: Page;
  node: ListNode;
  dataSource: DataSource | undefined;
  document: Document;
  locale: Locale;
  icons?: IconSet;
  /** What the search bar and the list's own conditions ask for now. */
  filter(): Resolved[];
  isChosen(id: RecordId): boolean;
  choose(id: RecordId, on: boolean): void;
  /** Open a record as its row's press does: settled once the app is done with it (a dialog closed) and the table has asked again. */
  open?: (id: RecordId) => void | Promise<void>;
  /** Light a record's row in the table; null lights none. */
  highlight(id: RecordId | null): void;
  /** Put a search into the search bar, as a person's own: "In this area". */
  addSearch(search: { label: string; filter: Resolved[] }): void;
  /** The list's order now: the map asks for its records in it, so it shows the same first ones. */
  sort(): SortOrder[];
  /** Put the table and the map in this order, as a header does ("Nearest first"); null puts back the list's own. */
  sortBy(order: SortOrder[] | null): void;
  /** The list's buttons for the records chosen, to offer on one record's card too: "Assign", for this driver alone. */
  actions: { id: string; label: string; style?: ButtonNode['style'] }[];
  /** Press one of them for these records, `button` busy meanwhile: its confirmation, its steps, then the records again. */
  act(id: string, ids: RecordId[], button: HTMLElement): Promise<void>;
  /**
   * Make a new record with these values filled in, as the app makes one (a calendar's empty slot: its start, its end,
   * its person): settled once the app is done, the records asked for again. Absent where the app makes none: a view
   * then offers no way to.
   */
  create?: (values: Values) => Promise<void>;
  /** How the list waits (loading.ts in @fieldia/widgets), its own `loading` over the page's: a map's waits as the list's. */
  loading?: Loading;
}

/** Another way of showing the list's records, made by a ListViewFactory. */
export interface ListViewPart {
  element: HTMLElement;
  /** Ask for the records again: the search changed, or a button changed them. */
  reload(): Promise<void>;
  /** Light a record (its row is under the pointer or the focus); null lights none. */
  highlight(id: RecordId | null): void;
  /** The records chosen changed, in the table or here. */
  chosenChanged(): void;
  /** Shown after being hidden: measure again. */
  shown(): void;
  destroy(): void;
}

/**
 * Another way of showing a list's records, registered by name in the viewer's `listViews`. The list offers it on its
 * switcher when the list has the page option of its name (`map`, `calendar`) unless `offers` says otherwise, in its own
 * words (`label`), and opens on it when `opens` says so. It is made the first time it is shown.
 */
export type ListViewFactory = ((context: ListViewContext) => ListViewPart) & {
  /** Its words on the switcher, in the list's language: "Calendar". Its name unless given. */
  label?: (locale: Locale) => string;
  /** Whether a list offers it. Unless given: when the list has the page option of its name. */
  offers?: (node: ListNode) => boolean;
  /** Whether the list opens on it rather than on its table: as its page option says. */
  opens?: (node: ListNode) => boolean;
};

/** How a record is opened from the app rather than by a row's press. */
export interface OpenRowOptions {
  /** Its row marked open (aria-current, lit) while it is: true, as a press does; false when no row was pressed (the address). */
  lit?: boolean;
}

export interface ListView {
  element: HTMLElement;
  /** Ask for the records again, keeping the page, the order and what is chosen where it still applies. */
  reload(): Promise<void>;
  /**
   * Open a record as its row's press does: the app's onOpenRecord, its row marked open meanwhile (aria-current); once the
   * app's promise settles, the records again and the focus back on its row. For an app that opens one by its address too:
   * `{ lit: false }` leaves the row unmarked, as no row was pressed.
   */
  open(id: RecordId, options?: OpenRowOptions): Promise<void>;
  destroy(): void;
}

/** Numbers line up on the end of their column. */
const NUMBERS = new Set(['integer', 'float', 'monetary']);
/** Fields no list can put in order. */
const UNSORTABLE = new Set(['one2many', 'many2many', 'binary', 'image', 'html', 'json', 'properties']);
/** As wide as a list is when it turns into cards: a phone's, as a table of lines does (520px). */
const NARROW = 520;
const isPromise = (value: unknown): value is Promise<unknown> => !!value && typeof (value as Promise<unknown>).then === 'function';

/**
 * Records as a table: one page at a time, in the order a header asks for, each
 * row opening its record. Chosen rows get the list's buttons, which hand the
 * app their ids. A plain table, so it reads the same in every binding.
 */
export function listView(context: ListContext): ListView {
  const { node, form, el, labels, fill, locale, doc } = context;
  // A choice carried from an earlier question shows its answers by the labels of every option it may hold.
  const page = withCarriedOptions(context.page);
  /** One of the list's sentences in the words its page names its records by (`records`), else as it says them plainly. */
  const sentence = (noun: string | undefined, words: string) => recordSentence(page.records, noun, words, locale);
  installListStyles(doc);
  const pageSize = node.pageSize ?? 40;
  const defaultSort = node.sort ?? [];
  let sort: SortOrder[] = defaultSort;
  /** The keys a person chose from the headers, the first leading (list-sort.ts); none while the list keeps its own order. */
  let keys: SortOrder[] = [];
  let offset = 0;
  let total = 0;
  /** Rows loaded as the list is scrolled, in place of its pages (`endless`): how many it holds, kept as it asks again. */
  const endless = node.endless === true && context.inRecord !== true;
  let reach = pageSize;
  /** The page of records, when the list is not grouped. */
  let rows: Row[] = [];
  /** Each record's row, for the records on show however they are grouped. */
  const recordOf = new WeakMap<Element, Row>();
  const visible = () => [...body.querySelectorAll('.fd-list-row:not([data-new])')].map((tr) => recordOf.get(tr) as Row);
  // Only a page of records gets this far: the page check refuses a list of anything else.
  const model = page.data.kind === 'record' ? page.data.model : '';
  /**
   * The list's views kept on the app's server, where its source keeps them and its search bar has a menu
   * (saved-views.ts): in place of the favourites the browser keeps, and the list opens on the default one.
   */
  const viewSource = node.search !== 'fields' && context.inRecord !== true && context.dataSource?.views ? (context.dataSource as ViewsSource) : null;
  let facets: Facet[] = context.search ? [...context.search] : viewSource ? defaultFacets(node) : startingFacets(node, context.preferences, page);
  /** In the order they were chosen, which is the order the app gets them. */
  const chosen = new Set<RecordId>();
  /** Each record's version and what the person may do with it, from the rows shown: what Edit sends and keeps to. */
  const known = new Map<string, KnownRecord>();
  /**
   * The records chosen reach past the rows on show: every one that matched (`total`, of which the source gave `got`),
   * or those an Edit could not change. A page turned or the order changed keeps them; a new search, Clear or the
   * header's box lets them go.
   */
  let wide: { total: number; got: number } | null = null;
  /** The rows are under their groups: no page of every match, then. */
  let groupedNow = false;
  /** How many records the search matches: the pager's total, or under groups the groups' counts added up. */
  let matching = 0;
  /** Each new search counts on: ids asked for under one search are no choice in the next. */
  let searches = 0;
  /** A count as the page writes numbers: "1,284". */
  const number = (n: number) => formatNumber(n, 0, locale);
  let asking = 0;
  let destroyed = false;
  /** How it waits (loading.ts): the page's way, its own `loading` over it. */
  const waiting = loadingOver(context.loading, node.loading);
  /** Whether its records were drawn once: a wait after that asks again (`refresh`), else it is the first. */
  let loadedOnce = false;

  /** A box to choose each row, unless the list says none; rows under their parent, when it names the field. */
  const choose = node.choose !== false;
  /** A filter bar of fields over the list (search "fields"): the pager goes under the table. */
  const fieldsSearch = node.search === 'fields';
  /** A list inside a record: a search box alone, it and the pager shown once the records run past a page. */
  const inRecord = context.inRecord === true;
  const parentField = node.parentField && page.fields[node.parentField] ? node.parentField : null;
  const cellOf = (name: string) => node.cells?.[name];
  const leads = Object.values(node.cells ?? {}).flatMap((cell) => (cell.lead ? [cell.lead.field] : []));
  /** What names a record: its first column of words, else its first column. */
  const nameColumn = node.columns.find((name) => page.fields[name].type === 'char') ?? node.columns[0];
  /** How each column draws its cells (list-cells.ts): a pill, chips, a picture, a bar, a phone with its links. */
  const cells = listCells({ page, node, doc, el, locale, icons: context.icons, fill, ...(context.widgetLabels ? { widgetLabels: context.widgetLabels } : {}) });
  const show = cells.words;
  /** Each row's own tone, bold and buttons, read on its record as the form reads one — the person among it; a button's roles the form's. */
  // A row's record read as the form reads one, of this list's fields: a related list's are its own records'.
  const rules = rowRules(page, node, (id, values) => form.recordReads(id, values, page.fields), () => form.today(), (button) => !form.node(button.id).invisible, form.functions);
  /** The cards part, which the page waited for where the list has cards (on a phone, `card`) or a gallery; where it could not come, a table. */
  const cards = node.card || node.gallery ? cardsPart.loaded : undefined;
  /** What a record's card shows. */
  const spec = cards?.cardSpec(page, node, nameColumn) ?? null;
  // The columns, and what an amount needs to be read: its currency, from the record, and what its money look's conditions read ("/month" on a rent);
  // the fields the cells' icons come from, each row's parent, what its card shows and what its own rules read.
  const fields = [...new Set([...node.columns.flatMap((name) => [name, ...moneyReads(page.fields[name])]), ...leads, ...(parentField ? [parentField] : []), ...(cards?.cardReads(spec) ?? []), ...rules.reads])];
  /**
   * Its cells changed in place, where it says `editable` (the editable part, which the page waited for), with a row's own
   * form and a field's box to draw them with, a column a cell can change and a source to save to; else its rows are
   * read and opened, as a list's always were.
   */
  const editPart = node.editable ? editablePart.loaded : undefined;
  // What its worked-out columns are worked out from, asked with the rest: a row's total follows its cells.
  if (editPart) fields.push(...editPart.rowReads(page, node, fields, form.functions));
  /** Its rows' cells changed in place (the editable part's), made with the list's element. */
  let rowEdits: EditableRows | null = null;
  /** Its words keep to the end: a number's, unless its cell says otherwise. */
  const atEnd = (name: string) => (cellOf(name)?.align ? cellOf(name)?.align === 'end' : NUMBERS.has(page.fields[name].type));
  /** Its words one thing, kept on one line on paper: a number, an amount, a day, a phone number. */
  const whole = (name: string) => keepsWhole(page.fields[name]?.type, cellOf(name)?.widget);
  /** A cell's classes: at the end for a number, whole on paper for words read as one. */
  const cellClass = (name: string) => [atEnd(name) ? 'fd-num' : '', whole(name) ? 'fd-whole' : ''].filter(Boolean).join(' ') || undefined;
  /** A column of a given width, its words cut with "…" past it: the person's, in pixels; else the page's, in characters of its words or in pixels. */
  const sized = (cell: HTMLTableCellElement, name: string) => {
    const own = choices?.width(name);
    const width = own ? (`${own}px` as const) : cellOf(name)?.width;
    cell.removeAttribute('data-width');
    cell.removeAttribute('data-width-px');
    if (!width) return cell;
    if (typeof width === 'string') {
      cell.setAttribute('data-width-px', '');
      cell.style.setProperty('--fd-col-px', width);
      return cell;
    }
    cell.setAttribute('data-width', String(width));
    cell.style.setProperty('--fd-col-width', String(width));
    return cell;
  };
  /**
   * The columns a person shows, orders and sizes, where the list lets them: the columns part's, which the page waited
   * for; where it could not come, the page's columns.
   */
  const shaping = node.optionalColumns ? columnsPart.loaded : undefined;
  const choices: ReturnType<ColumnsPart['columnChoices']> =
    shaping?.columnChoices({ page, node, doc, el, labels, fill, locale, preferences: context.preferences, uid: context.uid, icons: context.icons, host: (): HTMLElement => element, changed: (kept) => arrange(kept), ...(context.widgetLabels ? { widgetLabels: context.widgetLabels } : {}) }) ?? null;
  if (spec) cards?.installCardStyles(doc);
  if (choices) shaping?.installColumnStyles(doc);
  /** The columns shown, in their order: the person's, else the page's. */
  const shownColumns = () => choices?.shown() ?? node.columns;
  /** Every column sized: the table keeps their widths, scrolling sideways in its card when wider, the room left after its last. */
  const fixedWidths = () => shownColumns().every((name) => cellOf(name)?.width || choices?.width(name));
  /** Whether a header's press orders the list: not for a ranked list, which keeps its own order. */
  const sortable = node.sortable !== false;
  /** The record open from its row (or by open()), its row marked while it is. */
  let openId: RecordId | null = null;
  /** The columns before the fields': the box to choose a row, and the parents' toggles. */
  const leading = (choose ? 1 : 0) + (parentField ? 1 : 0);

  // ---- days, as the list counts them ----------------------------------------------------

  /**
   * A week from the first day CLDR has for the region (`firstWeekday`: the page's own tag's, else the reader's where the
   * browser asks for the same language, else the one the language is most spoken in — an English page read in Cairo
   * from Saturday, in London from Monday, in New York from Sunday); days told in the page's time zone (its `timeZone`),
   * else the browser's — and a date and time's own days in its own zone, where it names one (the page's is written into
   * each that names none).
   */
  const count: DayCount = { weekStart: firstWeekday(locale, page), timeZone: page.timeZone || ownZone() };
  const zoneOfField = (name: string) => {
    const def = page.fields[name];
    return (def?.type === 'datetime' && def.timeZone) || count.timeZone;
  };
  const now = context.now ?? (() => new Date());
  /** A period ("This month", "Overdue") as the plain conditions any data source reads, counted from now. */
  const periods = (period: FilterPeriod): ResolvedFilter[] => {
    const { from, to } = periodDays(period.is, now(), count);
    return daysFilter(period.field, from, to, page.fields[period.field]?.type === 'datetime' ? 'datetime' : 'date', zoneOfField(period.field));
  };
  /** How a Group By of a date asks for its spans: by the list's week and time zone. */
  const interval = (key: GroupKey) => (key.interval ? { interval: key.interval, weekStart: count.weekStart, timeZone: zoneOfField(key.field) } : {});
  /**
   * A date and time's range of days (a filter bar's, a custom filter's "is between"), as the list counts days: from the
   * first moment of the first day to before the first of the day after the last, in the field's zone.
   */
  const rangeDays: RangeDays = (field, from, last) => {
    if (page.fields[field]?.type !== 'datetime') return null;
    const zone = zoneOfField(field);
    return [...(from ? [{ field, op: '>=' as const, value: dayStarts(from, zone) }] : []), ...(last ? [{ field, op: '<' as const, value: dayStarts(addDays(last, 1), zone) }] : [])];
  };
  /** The conditions a search of these facets makes, the list's fixed ones with them, as the list asks for its records. */
  const searchFilter = (of: Facet[]): ResolvedFilter[] => [...(context.fixedFilter ?? []), ...facetsToFilter(of, node, periods, rangeDays)];
  const currentFilter = () => searchFilter(facets);
  /**
   * How many records a filter finds (`filterCounts`, a filter sheet's Show): the source's totals' count, else its list's
   * total (a page of one); null where it can do neither.
   */
  const countOf = async (filter: ResolvedFilter[]): Promise<number | null> => {
    const source = context.dataSource;
    if (source?.totals) return (await source.totals({ model, filter, totals: {} })).count;
    if (source?.list) return (await source.list({ model, fields: [], filter, sort: [], offset: 0, limit: 1 })).total;
    return null;
  };

  // ---- the table ---------------------------------------------------------------

  const chooseAll = el('input', { type: 'checkbox', class: 'fd-list-checkbox', 'aria-label': labels.selectAll });
  /** Each column's header, by its field. */
  const headers = new Map(
    node.columns.map((name) => {
      const def = page.fields[name];
      // The name's header marked as its cells are, rows under their parent: a theme stands it over the name, past the toggles.
      const th = sized(el('th', { scope: 'col', 'data-field': name, 'data-col': name, class: atEnd(name) ? 'fd-num' : undefined, 'data-name': parentField && name === nameColumn ? '' : undefined }), name);
      // The rule at its header's end, where a theme parts the columns: none, or set in from the column's end.
      const rule = cellOf(name)?.rule;
      if (rule === false) th.setAttribute('data-rule', 'none');
      else if (rule) th.style.setProperty('--fd-rule-in', rule);
      // Words cut short say themselves whole when pointed at: past the characters given, or about a 12px word's 6.5px a letter.
      const width = cellOf(name)?.width;
      const cut = typeof width === 'number' ? def.label.length > width : typeof width === 'string' ? def.label.length * 6.5 > Number.parseInt(width, 10) - 16 : false;
      const head = el('span', { class: 'fd-list-head', title: cut ? def.label : undefined }, def.label);
      if (UNSORTABLE.has(def.type) || !sortable) th.append(head);
      else {
        const button = el('button', { type: 'button', class: 'fd-list-sort' }, head);
        // The header's field leads — with Shift, it joins the keys chosen — and the list's own order breaks the ties.
        const press = (adding: boolean) => {
          keys = pressedSort(keys.length ? keys : sort.slice(0, 1), name, adding);
          sort = sortWith(keys, defaultSort);
          offset = 0;
          reach = pageSize;
          void load();
        };
        button.addEventListener('click', (event) => press(event.shiftKey));
        // Shift with Enter or Space, from the keys: a press made of keys carries no Shift in every browser.
        button.addEventListener('keydown', (event) => {
          if (!event.shiftKey || (event.key !== 'Enter' && event.key !== ' ')) return;
          event.preventDefault();
          press(true);
        });
        th.append(button);
      }
      // Its edge, dragged, sizes the column, where people shape the list's columns; the header, dragged sideways, moves it.
      if (choices) {
        th.append(choices.grip(name, th));
        choices.movable(name, th);
      }
      return [name, th] as const;
    })
  );
  // Every parent opened, or closed, at once.
  const expandAll = el('button', { type: 'button', class: 'fd-list-fold', 'aria-label': labels.expandAll, title: labels.expandAll }, el('span', { 'aria-hidden': 'true' }, '+'));
  const collapseAll = el('button', { type: 'button', class: 'fd-list-fold', 'aria-label': labels.collapseAll, title: labels.collapseAll }, el('span', { 'aria-hidden': 'true' }, '\u2212'));
  const body = el('tbody');
  /** The column after the fields': each row's own buttons, and the header's Columns menu. */
  const trailing = choices || node.rowButtons?.length || editPart?.opens(node, context) ? 1 : 0;
  const tail = el(
    'th',
    { class: 'fd-list-tail', scope: 'col' },
    ...(node.rowButtons?.length ? [el('span', { class: 'fd-list-tail-words' }, labels.rowActions)] : []),
    ...(choices ? [choices.button] : [])
  );
  // The header's box, with its words where the rows are cards and there is no header row over them.
  const headRow = el(
    'tr',
    {},
    ...(choose ? [el('th', { class: 'fd-list-check', scope: 'col' }, spec ? el('label', { class: 'fd-list-check-all' }, chooseAll, el('span', { class: 'fd-list-check-words', 'aria-hidden': 'true' }, labels.selectAll)) : chooseAll)] : []),
    ...(parentField ? [el('th', { class: 'fd-list-tree', scope: 'col' }, el('span', { class: 'fd-list-folds' }, expandAll, collapseAll))] : []),
    ...headers.values(),
    ...(trailing ? [tail] : [])
  );
  // The columns' totals, when the list has any and its source can tell them: a row under the list, the ticked rows'.
  // Made again as the person's columns change, in their order.
  const makeTotals = () => listTotals({ page, node, el, labels, locale, fill, dataSource: context.dataSource, model, leading, trailing, columns: shownColumns(), atEnd, interval });
  let totals = makeTotals();
  const table = el(
    'table',
    { class: 'fd-list-table', 'aria-label': page.title, 'data-sortable': sortable ? undefined : 'false' },
    el('thead', {}, headRow),
    body,
    ...(totals ? [totals.foot] : [])
  );
  // The headers in the person's order, those they hid hidden.
  arrangeRow(headRow);
  const empty = el('p', { class: 'fd-list-empty', hidden: '' }, sentence(labels.noRecordsNoun, labels.noRecords));
  const retry = el('button', { type: 'button', class: 'fd-button fd-button-link' }, labels.retry);
  /** Why, where the source said: "Could not load the customers. The archive is offline." */
  const failedWhy = el('span', {});
  const failed = el('p', { class: 'fd-list-failed', role: 'alert', hidden: '' }, sentence(labels.loadFailedNoun, labels.loadFailed), failedWhy, ' ', retry);
  // In a record, on paper (its pager left off): how many of how many it shows, where they run past a page — "5 of 23".
  const shownOf = inRecord ? el('p', { class: 'fd-list-shown', hidden: '' }) : null;
  retry.addEventListener('click', () => void load());

  /** Mark the row of the record open, and only it. */
  const markOpen = () => {
    for (const tr of body.querySelectorAll<HTMLElement>('.fd-list-row')) {
      if (openId !== null && tr.dataset['id'] === String(openId)) tr.setAttribute('aria-current', 'true');
      else tr.removeAttribute('aria-current');
    }
  };

  /**
   * Open a record from its row; when the app answers with a promise, its row marked open meanwhile (unless `lit` is false),
   * ask again once it settles and go back to its row.
   */
  async function openRow(id: RecordId, lit = true, name?: string) {
    const answer = context.onOpenRecord?.(id, name);
    if (!isPromise(answer)) return;
    if (lit) openId = id;
    markOpen();
    try {
      await answer;
    } catch {
      // The app's own trouble: the list still asks again.
    }
    if (openId === id) openId = null;
    markOpen();
    if (destroyed) return;
    await load();
    // Back on its row, unless the person went somewhere else meanwhile.
    const active = doc.activeElement;
    if (destroyed || (active && active !== doc.body && !element.contains(active))) return;
    [...body.querySelectorAll<HTMLElement>('.fd-list-row')].find((tr) => tr.dataset['id'] === String(id) && !tr.hidden)?.focus();
  }

  /** The row shown next to this one, down or up, past those folded under a parent. */
  const shownBeside = (tr: Element, down: boolean) => {
    let next = down ? tr.nextElementSibling : tr.previousElementSibling;
    while (next && ((next as HTMLElement).hidden || next.classList.contains('fd-list-note') || next.hasAttribute('data-aside'))) next = down ? next.nextElementSibling : next.previousElementSibling;
    return next as HTMLElement | null;
  };

  /** Put the keyboard on a row: a record's row itself, a group's heading or its Show more by its button. */
  const focusRow = (tr: HTMLElement | null) => (tr?.classList.contains('fd-list-row') ? tr : tr?.querySelector<HTMLElement>(':scope > td > button'))?.focus();

  /** The card under this one in a gallery, or over it: in the next line of cards, the nearest across. */
  const cardBeside = (tr: HTMLElement, down: boolean) => {
    const at = tr.getBoundingClientRect();
    const middle = (box: DOMRect) => box.left + box.width / 2;
    let best: HTMLElement | null = null;
    let score = Infinity;
    for (const other of body.querySelectorAll<HTMLElement>(':scope > .fd-list-row')) {
      if (other.hidden || other === tr) continue;
      const box = other.getBoundingClientRect();
      if (down ? box.top <= at.top + 1 : box.top >= at.top - 1) continue;
      const away = Math.abs(box.top - at.top) * 10000 + Math.abs(middle(box) - middle(at));
      if (away < score) [best, score] = [other, away];
    }
    return best;
  };

  /** A row's own button: its steps run with that record alone, as a button for the rows chosen runs with them; then the records again. */
  function rowButton(action: ButtonNode, record: Row): HTMLButtonElement {
    const bare = action.iconOnly && action.icon ? drawIcon(doc, action.icon, context.icons) : null;
    const button = el(
      'button',
      { type: 'button', class: `fd-button fd-button-${action.style ?? 'secondary'} fd-list-row-button`, 'data-action': action.id, ...(bare ? { 'aria-label': action.label, title: action.label } : {}) },
      ...(bare ? [bare] : context.withIcon(action.icon, action.label))
    );
    button.addEventListener('click', (event) => {
      // The button's press, never its row's.
      event.stopPropagation();
      void context.press(button, async () => {
        const result = await form.runAction(action.id, { recordIds: [record.id] });
        await Promise.all([load(), viewParts.reload()]);
        return result;
      });
    });
    return button;
  }

  // ---- the columns a person shapes ---------------------------------------------------

  /** A row's cells in the person's order — those shown, then those hidden, hidden — each at its width, the first shown kept in view. */
  function arrangeRow(tr: HTMLTableRowElement) {
    if (!choices) return;
    const shown = choices.shown();
    const on = new Set(shown);
    const order = choices.order();
    const placed = new Map<string, HTMLTableCellElement>();
    for (const cell of tr.children) {
      const name = cell.getAttribute('data-col');
      if (name) placed.set(name, cell as HTMLTableCellElement);
    }
    const after = tr.querySelector(':scope > .fd-list-card, :scope > .fd-list-tail');
    const wanted = [...shown, ...order.filter((one) => !on.has(one))];
    // Moved only when their order changed: a cell taken out and put back lets go of a drag on its grip.
    const moving = [...placed.keys()].join() !== wanted.filter((name) => placed.has(name)).join();
    for (const name of wanted) {
      const cell = placed.get(name);
      if (!cell) continue;
      cell.hidden = !on.has(name);
      cell.toggleAttribute('data-pin', name === shown[0]);
      sized(cell, name);
      if (moving) tr.insertBefore(cell, after);
    }
  }

  /** How many columns a heading's row spans: the leading ones, those shown, the buttons'. */
  const span = () => leading + shownColumns().length + trailing;
  /**
   * The rows part, which the page waited for where the list's rows open in place (`detail`) or are re-ranked by hand
   * (`sequenceField`); where it could not come, its rows are read and opened, as a list's always were. What a row opens
   * to, drawn as the list draws its cells.
   */
  const rowsKit = node.detail || node.sequenceField || node.loadChildren ? rowsPart.loaded : undefined;
  const details = rowsKit?.detailRows({ page, node, model, dataSource: context.dataSource, el, labels, locale, fill, number, span, cellsOf: (of, list) => listCells({ page: of, node: list, doc, el, locale, icons: context.icons, fill, ...(context.widgetLabels ? { widgetLabels: context.widgetLabels } : {}) }) }) ?? null;
  if (rowsKit) rowsKit.installRowsStyles(doc);
  /** Its rows re-ranked by hand, while it is in their order: by its own rank, ascending, its rows not under groups or parents. */
  const ranked = () => !groupedNow && !parentField && sort[0]?.field === node.sequenceField && !sort[0]?.desc && !sort[0]?.near;
  const ranks =
    rowsKit?.rankRows({
      page,
      node,
      model,
      dataSource: context.dataSource,
      doc,
      el,
      labels,
      fill,
      number,
      ranked,
      rows: () => [...body.querySelectorAll<HTMLTableRowElement>(':scope > .fd-list-row')],
      recordOf: (tr) => recordOf.get(tr),
      known: (id) => known.get(String(id)),
      offset: () => offset,
      total: () => total,
      reload: () => load(),
      ...(context.say ? { say: context.say } : {}),
    }) ?? null;
  // The rank each row moves by, asked with the rest.
  if (ranks && node.sequenceField && !fields.includes(node.sequenceField)) fields.push(node.sequenceField);
  /** A tree too big for a page, its children loaded as a parent opens (`loadChildren`): the rows part's, where it came. */
  const tree =
    parentField && node.loadChildren
      ? (rowsKit?.lazyTree({
          node,
          model,
          dataSource: context.dataSource,
          el,
          labels,
          fill,
          number,
          parentField,
          filter: () => currentFilter(),
          sort: () => sort,
          fields,
          pageSize,
          row: (record) => row(record),
          recordOf: (tr) => recordOf.get(tr),
          span,
          searching: () => facets.some((facet) => facet.kind !== 'groupBy'),
          changed: () => changed(),
          loading: waiting,
        }) ?? null)
      : null;
  // Every parent opened at once would load the whole tree: Expand all is for a tree on its page.
  if (tree) expandAll.hidden = true;
  /** The columns as last drawn, to know when the totals must follow. */
  let drawnColumns = shownColumns().join();

  /** The person's columns changed: every row in their order, the totals with them once they are done, the headings' rows across them. */
  function arrange(kept: boolean) {
    arrangeRow(headRow);
    for (const tr of body.querySelectorAll<HTMLTableRowElement>(':scope > .fd-list-row')) arrangeRow(tr);
    drawShape();
    if (!kept || drawnColumns === shownColumns().join()) return;
    drawnColumns = shownColumns().join();
    for (const cell of body.querySelectorAll<HTMLTableCellElement>(':scope > :is(.fd-list-group, .fd-list-more, .fd-list-note) > td')) cell.colSpan = span();
    details?.spread(body);
    if (!totals) return;
    const next = makeTotals();
    if (!next) return;
    totals.foot.replaceWith(next.foot);
    totals = next;
    totals.refresh(currentFilter());
    totals.ticked([...chosen], currentFilter());
  }

  /** The table's widths: kept as given where every column has one; the first column kept in view past the leading ones. */
  function drawShape() {
    table.toggleAttribute('data-fixed', fixedWidths());
    if (!choices) return;
    const [check, tree] = [headRow.querySelector<HTMLElement>(':scope > .fd-list-check'), headRow.querySelector<HTMLElement>(':scope > .fd-list-tree')];
    const checkWidth = check?.getBoundingClientRect().width ?? 0;
    table.style.setProperty('--fd-pin-tree', `${checkWidth}px`);
    table.style.setProperty('--fd-pin-first', `${checkWidth + (tree?.getBoundingClientRect().width ?? 0)}px`);
  }

  function row(record: Row, level = 0): HTMLTableRowElement {
    known.set(String(record.id), { ...(record.version ? { version: record.version } : {}), ...(record.can ? { can: record.can } : {}) });
    const name = show(nameColumn, record.values) || String(record.id);
    const box = choose ? el('input', { type: 'checkbox', class: 'fd-list-checkbox', 'aria-label': fill(labels.selectRecord, { name }) }) : null;
    if (box) {
      box.checked = chosen.has(record.id);
      box.addEventListener('change', () => {
        if (box.checked) chosen.add(record.id);
        else chosen.delete(record.id);
        drawChoice();
        viewParts.chosenChanged();
      });
    }
    // Its own tone and bold while a condition on its record holds, and the buttons its record shows.
    const tone = rules.any ? rules.tone(record.id, record.values) : null;
    const bold = rules.any && rules.bold(record.id, record.values);
    const own = node.rowButtons?.length ? rules.buttons(record.id, record.values) : [];
    const tr = el(
      'tr',
      {
        class: context.onOpenRecord ? 'fd-list-row fd-list-openable' : 'fd-list-row',
        tabindex: '0',
        'data-id': String(record.id),
        'data-level': level ? String(level) : undefined,
        'data-tone': tone ?? undefined,
        'data-bold': bold ? '' : undefined,
        'aria-current': openId !== null && String(openId) === String(record.id) ? 'true' : undefined,
      },
      ...(box ? [el('td', { class: 'fd-list-check' }, box)] : []),
      ...(parentField ? [el('td', { class: 'fd-list-tree' })] : []),
      ...node.columns.map((column) =>
        sized(el('td', { 'data-col': column, class: cellClass(column), 'data-name': parentField && column === nameColumn ? '' : undefined }, ...cells.draw(column, record.values, name)), column)
      ),
      // Its card, which the table hides and a narrow list or its gallery shows in place of the columns.
      ...(spec && cards ? [cards.drawCard({ page, node, el, locale, cells }, spec, record.values, name)] : []),
      ...(trailing ? [el('td', { class: 'fd-list-tail' }, ...(rowEdits?.openButton(record, name) ?? []), ...own.map((button) => rowButton(button, record)))] : [])
    );
    arrangeRow(tr);
    tr.addEventListener('click', (event) => {
      const cell = (event.target as Element).closest('td');
      // The box's own cell is a bigger target for the box; a parent's toggle is its own.
      if (cell?.classList.contains('fd-list-check')) {
        if (event.target === cell) box?.click();
        return;
      }
      if ((event.target as Element).closest('.fd-list-twisty')) return;
      // A cell changed in place, a card's sheet, a row not made yet: never the record opened.
      if (rowEdits?.pressed(tr, event) || tr.hasAttribute('data-new')) return;
      void openRow(record.id, true, name);
    });
    tr.addEventListener('keydown', (event) => {
      if (event.target !== tr) return;
      // Alt with an arrow: the row moved a place, where the list is ranked by hand.
      if (ranks?.key(tr, event)) return event.preventDefault();
      const forward = tr.closest('[dir]')?.getAttribute('dir') === 'rtl' ? 'ArrowLeft' : 'ArrowRight';
      if (event.key === 'Enter') {
        event.preventDefault();
        // A row whose cells change in place: its first cell opened.
        if (!rowEdits?.enter(tr) && !tr.hasAttribute('data-new')) void openRow(record.id, true, name);
      } else if (event.key === ' ' && box && !tr.hasAttribute('data-new')) {
        event.preventDefault();
        box.click();
      } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        // In a gallery, the card over or under this one; else the row — past the last loaded, the next page first.
        const beside = element.dataset['as'] === 'gallery' ? cardBeside(tr, event.key === 'ArrowDown') : shownBeside(tr, event.key === 'ArrowDown');
        if (!beside && event.key === 'ArrowDown' && endless) void more().then(() => focusRow(shownBeside(tr, true)));
        else focusRow(beside);
      } else if ((event.key === 'ArrowRight' || event.key === 'ArrowLeft') && element.hasAttribute('data-as')) {
        // Cards: the next towards the line's end, the one before towards its start.
        event.preventDefault();
        focusRow(shownBeside(tr, event.key === forward));
      } else if ((event.key === 'ArrowRight' || event.key === 'ArrowLeft') && tr.hasAttribute('data-parent-of')) {
        // A parent opens towards the line's end, closes towards its start: flipped right to left.
        event.preventDefault();
        fold(String(record.id), event.key !== forward);
      } else if ((event.key === 'ArrowRight' || event.key === 'ArrowLeft') && (tree?.key(tr, event.key === forward) || details?.key(tr, event.key === forward))) {
        // What it opens to, opened towards the line's end and closed towards its start.
        event.preventDefault();
      }
    });
    // Under the pointer or the focus: its pin on the map lights up.
    tr.addEventListener('mouseenter', () => viewParts.highlight(record.id));
    tr.addEventListener('mouseleave', () => viewParts.highlight(null));
    tr.addEventListener('focus', () => viewParts.highlight(record.id));
    recordOf.set(tr, record);
    rowEdits?.wire(tr, record);
    details?.wire(tr, record, name);
    ranks?.wire(tr, record, name);
    return tr;
  }

  // ---- rows under their parent -------------------------------------------------------

  /** The parents closed, by id: kept while the list asks again. */
  const closed = new Set<string>();

  /** A page of records with each under its parent, depth first, where the parent is on the page too; the rest at the top. */
  function nest(records: Row[]): HTMLTableRowElement[] {
    // A tree loaded as it opens draws its rows as they come: the rows part puts each under its parent.
    if (!parentField || tree) return records.map((record) => row(record));
    const ids = new Set(records.map((record) => String(record.id)));
    const parentOf = (record: Row) => {
      const parent = plain(record.values[parentField]);
      return parent !== null && parent !== undefined && ids.has(String(parent)) && String(parent) !== String(record.id) ? String(parent) : null;
    };
    const children = new Map<string, Row[]>();
    for (const record of records) {
      const parent = parentOf(record);
      if (parent) children.set(parent, [...(children.get(parent) ?? []), record]);
    }
    const drawn: HTMLTableRowElement[] = [];
    const placed = new Set<string>();
    const place = (record: Row, depth: number, hiddenUnder: boolean) => {
      const id = String(record.id);
      // A loop of parents is drawn once, where it is first met.
      if (placed.has(id)) return;
      placed.add(id);
      const tr = row(record);
      tr.style.setProperty('--fd-depth', String(depth));
      tr.setAttribute('data-depth', String(depth));
      tr.hidden = hiddenUnder;
      const under = children.get(id) ?? [];
      // Before its name: the parent's toggle, or room the size of one, so names line up at each depth — room whether or not
      // this page shows a parent at all, so names keep their place as a filter lets parents in or out.
      const cell = tr.querySelector<HTMLElement>(':scope > td[data-name]');
      if (under.length) {
        // Open or closed said by its toggle: a table's row claims no tree (aria-expanded belongs to a treegrid's rows).
        tr.setAttribute('data-parent-of', String(under.length));
        const twisty = el('button', { type: 'button', class: 'fd-list-twisty', tabindex: '-1', 'aria-expanded': String(!closed.has(id)), 'aria-label': show(nameColumn, record.values) || id });
        twisty.addEventListener('click', () => fold(id, twisty.getAttribute('aria-expanded') === 'true'));
        cell?.prepend(twisty);
      } else cell?.prepend(el('span', { class: 'fd-list-twisty-room', 'aria-hidden': 'true' }));
      drawn.push(tr);
      for (const child of under) place(child, depth + 1, hiddenUnder || closed.has(id));
    };
    for (const record of records) if (!parentOf(record)) place(record, 0, false);
    // Whatever a loop of parents left out, at the top.
    for (const record of records) place(record, 0, false);
    return drawn;
  }

  /** Close a parent, or open it: the rows under it hide, or show as their own parents left them. */
  function fold(id: string, close: boolean) {
    if (close) closed.add(id);
    else closed.delete(id);
    drawFolds();
  }

  function drawFolds() {
    /** The depths of the parents above the row being looked at, and whether any of them is closed. */
    const stack: { depth: number; closed: boolean }[] = [];
    for (const tr of body.querySelectorAll<HTMLElement>(':scope > .fd-list-row[data-depth]')) {
      const depth = Number(tr.dataset['depth']);
      while (stack.length && stack[stack.length - 1].depth >= depth) stack.pop();
      tr.hidden = stack.some((parent) => parent.closed);
      const id = tr.dataset['id'] ?? '';
      const twisty = tr.querySelector(':scope > td > .fd-list-twisty');
      twisty?.setAttribute('aria-expanded', String(!closed.has(id)));
      if (tr.hasAttribute('data-parent-of')) stack.push({ depth, closed: closed.has(id) });
    }
  }

  expandAll.addEventListener('click', () => {
    closed.clear();
    drawFolds();
  });
  collapseAll.addEventListener('click', () => {
    if (tree) return tree.closeAll(body);
    for (const tr of body.querySelectorAll<HTMLElement>(':scope > .fd-list-row[data-parent-of]')) closed.add(tr.dataset['id'] ?? '');
    drawFolds();
  });

  // A row's or the chosen rows' press taken back by its toast's Undo: the records again, as they are now.
  const undone = form.on('run', ({ id }) => {
    if (id.endsWith('.undo') && !destroyed) void Promise.all([load(), viewParts.reload()]);
  });

  // ---- what is chosen, and the buttons for it --------------------------------------

  const chosenCount = el('span', { class: 'fd-list-count', role: 'status' });
  const clear = el('button', { type: 'button', class: 'fd-button fd-button-link' }, labels.clearSelection);
  const buttons = (node.actions ?? []).map((action: ButtonNode) => {
    const button = el('button', { type: 'button', class: `fd-button fd-button-${action.style ?? 'secondary'}`, 'data-node': action.id }, ...context.withIcon(action.icon, action.label));
    // Its confirmation, then its steps with the records chosen; then the records again, as they are now.
    button.addEventListener('click', () =>
      void context.press(button, async () => {
        const result = await form.runAction(action.id, { recordIds: [...chosen] });
        await Promise.all([load(), viewParts.reload()]);
        return result;
      })
    );
    return button;
  });
  // Every record that matches, a press away once each row on show is ticked.
  const every = el('button', { type: 'button', class: 'fd-button fd-button-link fd-list-every', hidden: '' });
  every.addEventListener('click', () => void chooseEvery());
  // Edit: one field set to one value in each record chosen, where the page offers it and the app can ask.
  const bulk = context.editValues && context.ask && bulkOffered({ page, node, dataSource: context.dataSource }) ? { editValues: context.editValues, ask: context.ask } : null;
  const edit = el('button', { type: 'button', class: 'fd-button fd-button-secondary fd-list-edit', hidden: '' }, labels.bulkEdit);
  edit.addEventListener('click', () => void editChosen());
  const selection = el('div', { class: 'fd-list-selection', hidden: '' }, chosenCount, every, ...(bulk ? [edit] : []), ...buttons, clear);
  /** What an Edit could not change, and why, under the bar: kept until it is dismissed or the next Edit. */
  const reportWords = el('p', { class: 'fd-list-report-words' });
  const reportList = el('ul', { class: 'fd-list-report-list' });
  const dismiss = el('button', { type: 'button', class: 'fd-button fd-button-link' }, labels.dismiss);
  // An import's end: the rows not imported in a file to fix, and Undo, beside Dismiss.
  const reportFix = el('button', { type: 'button', class: 'fd-button fd-button-link fd-list-report-fix', hidden: '' }, labels.importDownload);
  const reportUndo = el('button', { type: 'button', class: 'fd-button fd-button-link fd-list-report-undo', hidden: '' }, labels.importUndo);
  const report = el('div', { class: 'fd-list-report', role: 'alert', hidden: '' }, reportWords, reportList, el('div', { class: 'fd-list-report-tools' }, reportFix, reportUndo, dismiss));
  /** What a report's Dismiss gives the focus back to: the button whose work it reports. */
  let reported: HTMLElement = edit;
  dismiss.addEventListener('click', () => {
    report.hidden = true;
    reported.focus();
  });
  /** Let go of every record chosen, those past the page too. */
  const clearAll = () => {
    chosen.clear();
    wide = null;
    for (const box of body.querySelectorAll<HTMLInputElement>('.fd-list-checkbox')) box.checked = false;
    drawChoice();
    viewParts.chosenChanged();
  };
  clear.addEventListener('click', clearAll);
  chooseAll.addEventListener('change', () => {
    // Unticked while every record that matches is chosen: none is, as Clear.
    if (!chooseAll.checked && wide) return clearAll();
    for (const record of visible()) {
      if (chooseAll.checked) chosen.add(record.id);
      else chosen.delete(record.id);
    }
    for (const box of body.querySelectorAll<HTMLInputElement>('.fd-list-checkbox')) box.checked = chooseAll.checked;
    drawChoice();
  });

  function drawChoice() {
    const shown = visible();
    const onPage = shown.filter((record) => chosen.has(record.id)).length;
    chooseAll.checked = shown.length > 0 && onPage === shown.length;
    chooseAll.indeterminate = onPage > 0 && onPage < shown.length;
    selection.hidden = chosen.size === 0;
    // Fewer than matched, where the source stopped short: said, never called all.
    chosenCount.textContent = wide && wide.got < wide.total && chosen.size === wide.got ? fill(labels.selectedOf, { n: number(chosen.size), total: number(wide.total) }) : fill(labels.selected, { n: number(chosen.size) });
    totals?.ticked([...chosen], currentFilter());
    every.hidden = !!wide || groupedNow || !chooseAll.checked || total <= shown.length || !context.dataSource?.list;
    if (!every.hidden && !every.hasAttribute('aria-busy')) every.textContent = fill(sentence(labels.selectAllMatchingNoun, labels.selectAllMatching), { n: number(total) });
    // Edit, where one record chosen at least may be changed as far as the list knows.
    let editable = false;
    for (const id of chosen) {
      if (lockedOut(known.get(String(id)))) continue;
      editable = true;
      break;
    }
    edit.hidden = !bulk || !editable;
    if (!choose) return;
    for (const tr of body.querySelectorAll<HTMLElement>('.fd-list-row')) {
      tr.setAttribute('aria-selected', String(chosen.has((recordOf.get(tr) as Row).id)));
    }
  }

  // ---- pages -------------------------------------------------------------------

  const range = el('span', { class: 'fd-pager-text' });
  const previous = el('button', { type: 'button', class: 'fd-button fd-pager-button', 'aria-label': labels.previousPage }, '‹');
  const next = el('button', { type: 'button', class: 'fd-button fd-pager-button', 'aria-label': labels.nextPage }, '›');
  const pager = el('div', { class: 'fd-pager', role: 'group' }, range, previous, next);
  previous.addEventListener('click', () => {
    offset = Math.max(0, offset - pageSize);
    void load();
  });
  next.addEventListener('click', () => {
    offset += pageSize;
    void load();
  });

  /**
   * How many records the search finds, beside the search where the pager is not beside it — under a filter bar, the
   * pager goes under the rows and shows only past a page: "42 homes", in the page's words for its records. Nothing while
   * none is found (the list says so) or the list could not be asked; none in a record, whose tab and pager count it.
   */
  const found = fieldsSearch && !inRecord ? el('span', { class: 'fd-list-found', role: 'status', hidden: '' }) : null;
  function drawCount() {
    if (!found) return;
    found.hidden = matching === 0 || !failed.hidden;
    const one = matching === 1;
    const words = fill(one ? sentence(labels.groupCountNounOne, labels.groupCountOne) : sentence(labels.groupCountNoun, labels.groupCount), { n: number(matching) });
    if (found.textContent !== words) found.textContent = words;
  }

  function drawPager() {
    drawCount();
    // Under a filter bar, or in a record, the pager shows only when there is more than one page.
    const fits = offset === 0 && total <= pageSize;
    pager.hidden = total === 0 || ((fieldsSearch || inRecord) && fits);
    // In a record, its search too, unless one is on or it is being typed in; and the bar with neither.
    if (inRecord) {
      search.element.hidden = fits && !facets.length && !search.element.contains(doc.activeElement);
      bar.hidden = pager.hidden && search.element.hidden;
    }
    // As the page writes numbers, as the count of those chosen is: "1–10 / 1,284".
    range.textContent = fill(sentence(labels.rangeNoun, labels.range), { from: number(offset + 1), to: number(Math.min(offset + rows.length, total)), total: number(total) });
    if (shownOf) {
      shownOf.hidden = rows.length >= total;
      shownOf.textContent = fill(sentence(labels.relatedShownNoun, labels.relatedShown), { n: number(rows.length), total: number(total) });
    }
    previous.disabled = offset === 0;
    next.disabled = offset + pageSize >= total;
    // Loaded as it is scrolled: its count alone, and Show more at the rows' end while some are left.
    previous.hidden = next.hidden = endless;
    endlessEnd?.drawn(groupedNow || !failed.hidden ? 0 : total - rows.length, fill(labels.loadMore, { n: number(Math.min(pageSize, total - rows.length)) }));
  }

  function drawSort() {
    // The keys chosen, else the list's own first; nearest a place is no column's order.
    const marked = keys.length ? keys : sort.slice(0, 1).filter((order) => !order.near);
    markSort(headers, marked, (n, of, desc) => fill(desc ? labels.sortKeyDown : labels.sortKeyUp, { n: number(n), total: number(of) }), number);
  }

  // ---- asking for the records ------------------------------------------------------

  /** Rows came or went: what is chosen keeps to the records on show, the table's or the map's. */
  function changed() {
    // On a map, a record chosen may be one the table's page does not hold; and every one that matches reaches past the page.
    if ((view === 'list' || view === 'gallery') && !wide) {
      const shown = new Set(visible().map((record) => record.id));
      for (const id of [...chosen]) if (!shown.has(id)) chosen.delete(id);
    }
    drawChoice();
    viewParts.chosenChanged();
  }

  /** The groups under a key of the records a filter keeps, each with its sums where the list totals columns. */
  const headings = async (source: DataSource, key: GroupKey, filter: ResolvedFilter[]): Promise<Heading[]> => {
    const [groups, sums] = await Promise.all([source.groups?.({ model, field: key.field, filter, ...interval(key) }) ?? [], totals?.headings(key, filter)]);
    return groups.map((group) => {
      const said = sums?.get(JSON.stringify(group.value));
      return { ...group, ...(said ? { sums: said.words, ...(said.why ? { sumsWhy: said.why } : {}) } : {}) };
    });
  };

  const grouped = (source: DataSource): GroupContext => ({
    page,
    el,
    labels,
    locale,
    fill,
    dataSource: source,
    model,
    fields,
    columns: span(),
    pageSize,
    count,
    sort: () => sort,
    groups: (key, filter) => headings(source, key, filter),
    recordRow: row,
    step: (tr, down) => focusRow(shownBeside(tr, down)),
    changed,
  });

  async function load(): Promise<void> {
    const mine = ++asking;
    // The rows the person changed, saved as they are left, before the list asks again: what it shows then is saved.
    if (rowEdits) {
      await rowEdits.settle();
      if (mine !== asking || destroyed) return;
    }
    // What the answer is for (a related list's record shown), taken as it is asked.
    const shown = context.shown?.();
    const stale = () => mine !== asking || destroyed || (shown !== undefined && !shown());
    drawSort();
    // Its wait: drawn the first time (a skeleton of its rows unless the page says otherwise), asked again after that (what
    // is shown kept, a bar over it); a wait going on taken over, never drawn twice.
    const wait = startLoading(records, loadedOnce ? 'refresh' : 'first', waiting, { part: node.id, shape: skeletonRows, failed: saidFailed, retry: () => void load(), now: !loadedOnce && context.loadingNow === true });
    let drawn: HTMLTableRowElement[] = [];
    try {
      const filter = currentFilter();
      const grouping = groupByFields(facets).map((text) => groupKey(page, text));
      const source = context.dataSource;
      // The totals of every record the search finds, asked beside them.
      totals?.refresh(filter);
      if (grouping.length && source?.groups && source.list) {
        // Grouped: a row for each value of the first field (or span of a date), each opening into the rest.
        const groups = await headings(source, grouping[0], filter);
        if (stale()) return wait.stop();
        rows = [];
        total = 0;
        groupedNow = true;
        matching = groups.reduce((sum, group) => sum + group.count, 0);
        drawn = groups.map((group) => groupRow(grouped(source), group, 0, filter, grouping));
      } else {
        // Loaded as it is scrolled: every row it held, asked again from the first.
        // A tree loaded as it opens: its records with no parent, while no search is on.
        const answer = source?.list ? await source.list({ model, fields, filter: tree ? [...filter, ...tree.top()] : filter, sort, offset, limit: endless ? Math.max(pageSize, reach) : pageSize, ...(waiting.settings.timeout ? { signal: wait.signal } : {}) }) : { records: [], total: 0 };
        if (stale()) return wait.stop();
        // Past the end, as when the last record of the last page went: back to the page that is left.
        if (!answer.records.length && answer.total > 0 && offset > 0) {
          offset = Math.floor((answer.total - 1) / pageSize) * pageSize;
          return void (await load());
        }
        rows = answer.records;
        total = answer.total;
        matching = total;
        groupedNow = false;
        reach = Math.max(pageSize, rows.length);
        drawn = nest(rows);
      }
    } catch (error) {
      if (stale()) return wait.stop();
      // Said in its place, its own sentence and Retry (`saidFailed`) — or in a toast, what was shown kept — as the page says.
      return wait.fail(error);
    }
    await wait.done(() => drawRows(drawn));
  }

  /** Its rows drawn as its answer came: the person's work kept on them, then whether it holds none, its pager, its count. */
  function drawRows(drawn: HTMLTableRowElement[]) {
    loadedOnce = true;
    failed.hidden = true;
    body.replaceChildren(...drawn);
    // The person's work kept on rows, drawn on them or kept in sight; then whether it holds none.
    rowEdits?.drawn();
    // What the rows open was open before stays so, under them; their grips while the list is in their order.
    details?.drawn(body);
    ranks?.drawn();
    void tree?.drawn(body);
    empty.hidden = drawn.length > 0 || !failed.hidden || !!body.querySelector(':scope > .fd-list-row');
    empty.textContent = context.none && !facets.length ? context.none : sentence(labels.noRecordsNoun, labels.noRecords);
    drawShape();
    drawPager();
    changed();
    context.onCount?.(matching, facets.length > 0);
  }

  /** Its records could not be loaded: none shown, its own sentence and why where the source said, with Retry. */
  function saidFailed(_message: string, _retry: unknown, why: string) {
    rows = [];
    total = 0;
    matching = 0;
    body.replaceChildren();
    failedWhy.textContent = why ? ` ${why}` : '';
    failed.hidden = false;
    empty.hidden = true;
    drawShape();
    drawPager();
    changed();
    return true;
  }

  /**
   * Its rows' skeleton (loading.ts's `shape`): as many rows as a page holds, up to eight, in its own columns — each
   * column a bar where its cells will be, a column hidden by the person hidden here too; a card's shape where its rows
   * are cards (the cards part's sheet). Never read out: the wait is said once.
   */
  const skeletonRows = {
    show: () => {
      const widths = ['72%', '54%', '86%', '40%', '64%', '78%', '48%', '58%'];
      const row = (at: number) =>
        el('tr', { class: 'fd-sk-row', 'aria-hidden': 'true' }, ...[...headRow.children].map((th, column) => {
          const bar = el('span', { class: 'fd-sk' });
          bar.style.inlineSize = widths[(at + column) % widths.length];
          const cell = el('td', {}, bar);
          if ((th as HTMLElement).hidden) cell.hidden = true;
          return cell;
        }));
      body.replaceChildren(...Array.from({ length: Math.min(pageSize, 8) }, (_, at) => row(at)));
      empty.hidden = true;
      failed.hidden = true;
    },
    hide: () => {
      for (const tr of body.querySelectorAll(':scope > .fd-sk-row')) tr.remove();
    },
  };

  /**
   * The next page of rows, where they load as the list is scrolled: put after those it holds — any already there (moved
   * meanwhile) never twice — its count, its grips and what is chosen with them. A list that asked again meanwhile draws
   * them itself; one that cannot be asked says so.
   */
  async function more(): Promise<void> {
    const source = context.dataSource;
    if (!endless || groupedNow || rows.length >= total || !source?.list || !endlessEnd) return;
    const mine = asking;
    // Its wait where the rows will come (`more`): "Loading more…" unless the page says otherwise; a failure said there, with Retry.
    const wait = startLoading(endlessEnd.element, 'more', waiting, { part: node.id, retry: () => void more() });
    let answer: Awaited<ReturnType<NonNullable<DataSource['list']>>>;
    try {
      answer = await source.list({ model, fields, filter: currentFilter(), sort, offset: rows.length, limit: pageSize, ...(waiting.settings.timeout ? { signal: wait.signal } : {}) });
    } catch (error) {
      if (mine !== asking || destroyed) return wait.stop();
      return wait.fail(error);
    }
    if (mine !== asking || destroyed) return wait.stop();
    await wait.done(() => {
      const held = new Set(rows.map((record) => String(record.id)));
      const fresh = answer.records.filter((record) => !held.has(String(record.id)));
      rows = [...rows, ...fresh];
      total = answer.total;
      matching = total;
      reach = rows.length;
      body.append(...nest(fresh));
      ranks?.drawn();
      drawPager();
      changed();
    });
  }
  /** Its rows' end, where they load as it is scrolled: Show more, pressed by itself in sight (list-endless.ts). */
  const endlessEnd = endless ? endlessRows(doc, el, more) : null;
  const searched = (next: Facet[]) => {
    facets = next;
    offset = 0;
    reach = pageSize;
    searches++;
    // Every record that matched the search before is no choice in this one.
    if (wide) {
      wide = null;
      chosen.clear();
    }
    void load();
    void viewParts.reload();
  };
  /** How the list stands, as a saved view keeps it: its search, the keys chosen from its headers, its columns. */
  function viewState(): ViewState {
    return { facets, ...(keys.length ? { sort: keys } : {}), ...(choices ? { columns: choices.state() } : {}) };
  }
  /** A view's order and columns put on; its search comes after, as the menu's own, and the records with it. */
  function putView(state: ViewState) {
    keys = sortable ? (state.sort ?? []).filter((one) => !one.near && headers.has(one.field)) : [];
    sort = sortWith(keys, defaultSort);
    if (choices && state.columns) choices.restore(state.columns);
  }
  /** The views part, asked for as the list opens where its source keeps views, and its views made with it; null where it could not come. */
  const kept: Promise<SavedViews | null> | null = viewSource
    ? viewsPart.load().then(
        (part) => {
          part.installViewStyles(doc);
          return part.savedViews({ page, node, model, source: viewSource, el, labels, fill, doc, state: viewState, put: putView, ...(context.icons ? { icons: context.icons } : {}), ...(context.ask ? { ask: context.ask } : {}), ...(context.say ? { say: context.say } : {}) });
        },
        () => null
      )
    : null;
  // The search bar, or a keyword and a list of values for each of a few fields.
  // The filter bar comes in the filters part, which the viewer has waited for; the search bar where it could not come.
  const filters = node.search === 'fields' ? filtersPart.loaded : undefined;
  const search =
    filters
      ? filters.filterBar({ page, node, doc, el, labels, fill, uid: context.uid, icons: context.icons, preferences: context.preferences, locale, dataSource: context.dataSource, model, fixedFilter: () => context.fixedFilter ?? [], searchFilter, count: countOf, facets, onChange: searched, kit: filterKit, loading: waiting })
      : searchBar({ page, node, doc, el, labels, fill, uid: context.uid, icons: context.icons, preferences: context.preferences, locale, facets, periods, onChange: searched, ...(inRecord ? { menu: false } : {}), ...(node.filterCounts ? { count: countOf, searchFilter } : {}), ...(kept ? { favourites: laterFavourites(kept.then((made) => made?.part ?? null), el) } : {}) });
  // A search in plain words read as filters (`searchToFilter`): a ✦ beside the box while it holds two words or more;
  // pressed, the assist part reads them — loaded then, so a list no one asks never downloads it — and says under the bar
  // what they were read as. Hidden where the source cannot read words.
  const wordsSource = context.dataSource;
  const wordsLine = el('div', { class: 'fd-assist-read', hidden: '' });
  let wordsRead: ReturnType<AssistPart['searchWords']> | null = null;
  const readsWords = !!(node.searchToFilter && !inRecord && wordsSource?.searchToFilter);
  if (readsWords) {
    // Its mark a ✦ in words: the assist part's own icon comes with it.
    const button = el('button', { type: 'button', class: 'fd-button fd-button-link fd-assist-words', title: labels.assistWordsTitle, 'aria-label': labels.assistWordsTitle, hidden: '' }, el('span', { class: 'fd-assist-mark', 'aria-hidden': 'true' }, '✦'), el('span', {}, labels.assistWords));
    const offer = () => {
      button.hidden = search.input.value.trim().split(/\s+/).filter(Boolean).length < 2;
    };
    search.input.addEventListener('input', () => {
      offer();
      wordsRead?.typing();
    });
    button.addEventListener('click', () => {
      void assistPart.load().then(
        (part) => {
          if (destroyed) return;
          wordsRead ??= part.searchWords({ page, node, doc, el, labels, fill, locale, icons: context.icons, dataSource: wordsSource, model, kit: filterKit, bar: search, button, line: wordsLine, offer });
          return wordsRead.read();
        },
        // A part that could not come: the words stay in the box, searched as typed.
        () => undefined
      );
    });
    (search.input.closest('label') ?? search.input).after(button);
  }

  /**
   * The key to the rows' own looks, where the page says what they mean (`rowTones`' labels, `rowBoldLabel`): each
   * tone's swatch and its words, a sample in bold and its words — a list a screen reader reads, named "Key to the rows".
   * Without words, none: a list as 0.25 drew it.
   */
  function rowsKey(): HTMLElement | null {
    const tones = (node.rowTones ?? []).filter((one) => one.label);
    const bold = node.rowBold !== undefined && node.rowBold !== false && node.rowBoldLabel ? node.rowBoldLabel : null;
    if (!tones.length && !bold) return null;
    const item = (mark: HTMLElement, words: string) => el('li', { class: 'fd-list-key-item' }, mark, el('span', {}, words));
    return el(
      'ul',
      { class: 'fd-list-key', 'aria-label': labels.rowsKey },
      ...tones.map((one) => item(el('span', { class: 'fd-list-key-mark', 'data-tone': one.tone, 'aria-hidden': 'true' }), one.label as string)),
      ...(bold ? [item(el('span', { class: 'fd-list-key-mark', 'data-bold': '', 'aria-hidden': 'true' }, 'Aa'), bold)] : [])
    );
  }

  // ---- other views: the map beside the table or instead of it, a calendar, an app's own ----------

  /** The views this list offers, by name, in the order the app registered them: by the page option of its name, unless the view says. */
  const offered = Object.entries(context.views ?? {}).filter(([name, factory]) => (factory.offers ? factory.offers(node) : (node as unknown as Record<string, unknown>)[name] !== undefined));
  const factories = new Map(offered);
  /** The list's own gallery, where it has one: its rows as cards in a grid — unless the app gives a view of that name. */
  const gallery = !!node.gallery && !!spec && !factories.has('gallery');
  /** The table alone, `both` (the table and the map side by side), the gallery, or a view's name. */
  let view: string =
    node.map && factories.has('map') && node.map.view
      ? node.map.view
      : gallery && node.gallery?.opens === 'gallery'
        ? 'gallery'
        : (offered.find(([name, factory]) => name !== 'map' && factory.opens?.(node))?.[0] ?? 'list');
  /** Each view once made: the first time it is shown. */
  const parts = new Map<string, ListViewPart>();
  const holders = new Map(offered.map(([name]) => [name, el('div', { class: name === 'map' ? 'fd-list-addon fd-list-map' : 'fd-list-addon', 'data-addon': name })]));
  /** What the table tells a view, it tells each one made. */
  const viewParts = {
    reload: () => Promise.all([...parts.values()].map((part) => part.reload())).then(() => undefined),
    highlight: (id: RecordId | null) => parts.forEach((part) => part.highlight(id)),
    chosenChanged: () => parts.forEach((part) => part.chosenChanged()),
  };
  /** A new record, as the app makes one: then the records again, in the table and in each view. */
  const newRecord = context.onNewRecord;
  const create = newRecord
    ? async (values: Values) => {
        try {
          await newRecord(values);
        } catch {
          // The app's own trouble: the records are asked for again all the same.
        }
        if (!destroyed) await Promise.all([load(), viewParts.reload()]);
      }
    : undefined;

  function makeView(name: string) {
    const factory = factories.get(name);
    if (parts.has(name) || !factory) return;
    const part = factory({
      page,
      node,
      dataSource: context.dataSource,
      document: doc,
      locale,
      icons: context.icons,
      loading: waiting,
      filter: currentFilter,
      isChosen: (id) => chosen.has(id),
      choose(id, on) {
        if (on) chosen.add(id);
        else chosen.delete(id);
        for (const tr of body.querySelectorAll<HTMLElement>('.fd-list-row')) {
          if (tr.dataset['id'] !== String(id)) continue;
          const box = tr.querySelector<HTMLInputElement>('.fd-list-checkbox');
          if (box) box.checked = on;
        }
        drawChoice();
        viewParts.chosenChanged();
      },
      ...(context.onOpenRecord ? { open: (id: RecordId) => openRow(id) } : {}),
      highlight(id) {
        for (const tr of body.querySelectorAll<HTMLElement>('.fd-list-row')) {
          const hot = id !== null && tr.dataset['id'] === String(id);
          tr.classList.toggle('fd-list-hot', hot);
          if (hot && view === 'both') tr.scrollIntoView({ block: 'nearest' });
        }
      },
      addSearch: ({ label, filter }) => search.add({ kind: 'custom', label, filter }),
      sort: () => sort,
      sortBy(order) {
        sort = order ?? defaultSort;
        keys = order ? order.filter((one) => !one.near) : [];
        offset = 0;
        reach = pageSize;
        void load();
        void viewParts.reload();
      },
      actions: (node.actions ?? []).map((action) => ({ id: action.id, label: action.label, ...(action.style ? { style: action.style } : {}) })),
      act: (id, ids, button) =>
        context.press(button, async () => {
          const result = await form.runAction(id, { recordIds: ids });
          await Promise.all([load(), viewParts.reload()]);
          return result;
        }),
      ...(create ? { create } : {}),
    });
    parts.set(name, part);
    holders.get(name)?.append(part.element);
    void part.reload();
  }

  /** The switcher: the table, its gallery, then each view offered — the map as Map, and List and map. */
  const switches = ['list', ...(gallery ? ['gallery'] : []), ...offered.flatMap(([name]) => (name === 'map' ? ['map', 'both'] : [name]))];
  const words = (name: string) =>
    name === 'list'
      ? labels.viewList
      : name === 'gallery' && gallery
        ? labels.viewGallery
        : name === 'map'
          ? labels.viewMap
          : name === 'both'
            ? labels.viewBoth
            : (factories.get(name)?.label?.(locale) ?? name);
  const viewButtons = switches.map((name) => {
    const button = el('button', { type: 'button', class: 'fd-button fd-list-view', 'data-view': name, 'aria-pressed': 'false' }, words(name));
    button.addEventListener('click', () => showAs(name));
    return button;
  });
  const views = el('div', { class: 'fd-list-views', role: 'group', 'aria-label': labels.showAs }, ...viewButtons);
  views.hidden = !offered.length && !gallery;

  function showAs(next: string) {
    view = switches.includes(next) ? next : 'list';
    element.dataset['view'] = view;
    // A view in place of the table: the table and its pager step aside. The gallery is the table's own rows, as cards.
    element.toggleAttribute('data-alone', view !== 'list' && view !== 'both' && view !== 'gallery');
    for (const button of viewButtons) button.setAttribute('aria-pressed', String(button.dataset['view'] === view));
    const on = view === 'both' ? 'map' : view;
    for (const [name, holder] of holders) holder.toggleAttribute('data-on', name === on);
    drawMode();
    if (view === 'list' || view === 'gallery') return;
    makeView(on);
    parts.get(on)?.shown();
  }

  // ---- cards: on a phone where the list has them, and in its gallery on any width ----------

  const View = doc.defaultView as (Window & typeof globalThis) | null;
  /**
   * Whether the list is as narrow as a phone's (520px or less): its rows are cards there, where it has cards. As narrow
   * as the window, at first — a phone's list is drawn as cards from its first frame — then as wide as it is measured.
   */
  let narrow = !!node.card && !!View && View.innerWidth > 0 && View.innerWidth <= NARROW;
  /** The rows as cards — a gallery's, or a narrow list's — or as a table. */
  function drawMode() {
    const as = view === 'gallery' ? 'gallery' : node.card && spec && narrow ? 'cards' : null;
    if (as) element.setAttribute('data-as', as);
    else element.removeAttribute('data-as');
  }
  /** As wide as it was last measured: drawn so at the next frame, never while the browser tells of sizes (its loop said). */
  let measured = narrow;
  const widths = node.card && spec && View?.ResizeObserver
    ? new View.ResizeObserver(([entry]) => {
        // A list put away (its tab not shown) is no narrower than it was.
        const width = entry.contentRect.width;
        if (!width || measured === width <= NARROW) return;
        measured = width <= NARROW;
        View.requestAnimationFrame(() => {
          if (destroyed || narrow === measured) return;
          narrow = measured;
          drawMode();
        });
      })
    : null;

  // ---- every record that matches, Export and Edit ------------------------------------

  /** How far a long task has got — selecting, exporting, updating — said beside the list's tools, and to a screen reader. */
  const progress = el('span', { class: 'fd-list-progress', role: 'status', 'aria-live': 'polite' });
  /** A button busy while its task runs: pressed again meanwhile, nothing happens. */
  async function busy(button: HTMLElement, run: () => Promise<void>): Promise<void> {
    if (button.hasAttribute('aria-busy')) return;
    button.setAttribute('aria-busy', 'true');
    button.setAttribute('aria-disabled', 'true');
    try {
      await run();
    } finally {
      button.removeAttribute('aria-busy');
      button.removeAttribute('aria-disabled');
      progress.textContent = '';
    }
  }

  /** Every record the search matches, chosen: their ids from the source (list-every.ts), kept as pages turn. */
  function chooseEvery(): Promise<void> {
    const source = context.dataSource;
    if (!source) return Promise.resolve();
    const mine = searches;
    return busy(every, async () => {
      progress.textContent = labels.selectingAll;
      try {
        const { ids, total: matched } = await everyId(source, { model, filter: currentFilter(), sort, field: nameColumn, total });
        // The search changed meanwhile: these were another's.
        if (destroyed || mine !== searches) return;
        for (const id of ids) chosen.add(id);
        wide = { total: Math.max(matched, ids.length), got: ids.length };
        for (const box of body.querySelectorAll<HTMLInputElement>('.fd-list-row .fd-list-checkbox')) box.checked = true;
      } catch {
        context.say?.(sentence(labels.selectAllFailedNoun, labels.selectAllFailed), 'danger');
      }
      drawChoice();
      viewParts.chosenChanged();
    });
  }

  /** The records chosen, in the list's order where it knows it: the rows on show first as they stand, then the rest as chosen. */
  const chosenInOrder = (): RecordId[] => {
    if (wide) return [...chosen];
    const shown = visible().filter((record) => chosen.has(record.id)).map((record) => record.id);
    const placed = new Set(shown.map(String));
    return [...shown, ...[...chosen].filter((id) => !placed.has(String(id)))];
  };

  // Export, in the list's bar: what goes — the rows chosen, or every one that matches — and as which file.
  // Asked for by the page (`export: true`), as Edit is: an app that asks for neither shows no new button.
  const exportOn = node.export === true && !!(context.dataSource?.list || context.dataSource?.exportRecords);
  const exportId = context.uid(`${node.id}-export`);
  // A tray with an arrow into it, unless the app's icons have their own "download".
  const exportIcon = drawIcon(doc, 'download', { download: '<path d="M12 4v10M7.5 9.5L12 14l4.5-4.5"/><path d="M4 15v4.5h16V15"/>', ...context.icons });
  exportIcon?.setAttribute('aria-hidden', 'true');
  const exportButton = el('button', { type: 'button', class: 'fd-button fd-record-gear fd-list-export-button', id: `${exportId}-button`, 'aria-haspopup': 'menu', 'aria-expanded': 'false', 'aria-controls': exportId }, ...(exportIcon ? [exportIcon] : []), labels.export);
  const exportWhat = el('div', { class: 'fd-record-menu-heading fd-list-export-what', id: `${exportId}-what`, role: 'presentation' });
  const formats: [ExportFormat, string][] = [['xlsx', labels.exportExcel], ['csv', labels.exportCsv]];
  const formatItems = formats.map(([format, words]) => {
    const item = el('button', { type: 'button', role: 'menuitem', tabindex: '-1', class: 'fd-record-menu-item', 'data-format': format, 'aria-describedby': `${exportId}-what` }, el('bdi', {}, words));
    item.addEventListener('click', () => {
      closeExport(true);
      void exportAs(format);
    });
    return item;
  });
  const exportMenu = el('div', { class: 'fd-record-menu fd-list-export-menu', role: 'menu', id: exportId, 'aria-labelledby': exportButton.id, hidden: '' }, exportWhat, ...formatItems);
  const exportBox = el('div', { class: 'fd-record-actions fd-list-export' }, exportButton, exportMenu);
  exportBox.hidden = !exportOn;
  const outsideExport = (event: Event) => {
    if (!exportBox.contains(event.target as Node)) closeExport(false);
  };
  function openExport(at: 'first' | 'last') {
    if (!exportMenu.hidden || exportButton.hasAttribute('aria-busy')) return;
    const ids = chosen.size;
    exportWhat.textContent = ids
      ? fill(labels.selected, { n: number(ids) })
      : fill(new Intl.PluralRules(locale).select(matching) === 'one' ? sentence(labels.exportAllNounOne, labels.exportAllOne) : sentence(labels.exportAllNoun, labels.exportAll), { n: number(matching) });
    exportMenu.hidden = false;
    // From the button's start, unless that runs past the screen's edge: then from its end.
    exportMenu.removeAttribute('data-end');
    const box = exportMenu.getBoundingClientRect();
    if (box.right > doc.documentElement.clientWidth - 4 || box.left < 4) exportMenu.setAttribute('data-end', '');
    exportButton.setAttribute('aria-expanded', 'true');
    doc.addEventListener('pointerdown', outsideExport, true);
    (at === 'first' ? formatItems[0] : formatItems[formatItems.length - 1]).focus();
  }
  function closeExport(refocus: boolean) {
    if (exportMenu.hidden) return;
    exportMenu.hidden = true;
    exportButton.setAttribute('aria-expanded', 'false');
    doc.removeEventListener('pointerdown', outsideExport, true);
    if (refocus) exportButton.focus();
  }
  exportButton.addEventListener('click', () => (exportMenu.hidden ? openExport('first') : closeExport(false)));
  exportButton.addEventListener('keydown', (event) => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    openExport(event.key === 'ArrowDown' ? 'first' : 'last');
  });
  exportMenu.addEventListener('keydown', (event) => {
    const at = formatItems.indexOf(doc.activeElement as HTMLButtonElement);
    const to = { ArrowDown: at + 1, ArrowUp: at - 1, Home: 0, End: formatItems.length - 1 }[event.key];
    if (to !== undefined) {
      event.preventDefault();
      formatItems[(to + formatItems.length) % formatItems.length].focus();
    } else if (event.key === 'Escape') {
      // Escape closes the menu, not the dialog round the list.
      event.preventDefault();
      event.stopPropagation();
      closeExport(true);
    } else if (event.key === 'Tab') closeExport(false);
  });

  /** What an export reads of this list. */
  const exportOf = (): ExportList => ({
    model,
    title: page.title || node.id,
    fields: page.fields,
    // As the person shows them, in their order.
    columns: shownColumns(),
    reads: fields,
    dataSource: context.dataSource,
    locale,
    labels,
    doc,
    words: show,
    rtl: element.closest('[dir]')?.getAttribute('dir') === 'rtl',
  });

  /** The rows chosen, or every record that matches, as a file: Excel's or CSV. */
  function exportAs(format: ExportFormat): Promise<void> {
    return busy(exportButton, async () => {
      const ids = chosenInOrder();
      // Every record that matches, chosen whole: asked by the search, as the source finds them.
      const all = !ids.length || (wide !== null && wide.got === wide.total && chosen.size === wide.total);
      const which: ExportWhich = all ? { filter: currentFilter(), sort, count: wide ? wide.total : matching } : { ids, filter: context.fixedFilter ?? [], sort, count: ids.length };
      progress.textContent = fill(labels.exporting, { done: number(0), n: number(which.count) });
      try {
        const end = await exportList(exportOf(), which, format, (done, n) => {
          if (!destroyed) progress.textContent = fill(labels.exporting, { done: number(done), n: number(n) });
        });
        if (destroyed) return;
        if ('message' in end) context.say?.(end.message, 'info');
        else if (end.done < end.total) context.say?.(fill(sentence(labels.exportCutNoun, labels.exportCut), { n: number(end.done), total: number(end.total) }), 'warning');
        else context.say?.(fill(new Intl.PluralRules(locale).select(end.done) === 'one' ? sentence(labels.exportedNounOne, labels.exportedOne) : sentence(labels.exportedNoun, labels.exported), { n: number(end.done) }), 'success');
      } catch {
        if (!destroyed) context.say?.(sentence(labels.exportFailedNoun, labels.exportFailed), 'danger');
      }
    });
  }

  // Print, in the list's bar: every record the search finds on paper, under its Group By headings, with its totals.
  // Asked for by the page (`print: true`), as Export is.
  const printOn = node.print === true && !!context.dataSource?.list;
  // A printer, unless the app's icons have their own "print".
  const printIcon = drawIcon(doc, 'print', { print: '<path d="M7 9V3h10v6"/><path d="M7 17H4.5A1.5 1.5 0 0 1 3 15.5v-5A1.5 1.5 0 0 1 4.5 9h15a1.5 1.5 0 0 1 1.5 1.5v5a1.5 1.5 0 0 1-1.5 1.5H17"/><path d="M7 14h10v7H7z"/>', ...context.icons });
  printIcon?.setAttribute('aria-hidden', 'true');
  const printButton = el('button', { type: 'button', class: 'fd-button fd-record-gear fd-list-print-button' }, ...(printIcon ? [printIcon] : []), labels.printList);
  printButton.hidden = !printOn;
  printButton.addEventListener('click', () => void printAll());
  // A list meant for paper: the print part fetched once the browser has nothing else to do, and as a pointer rests on
  // its Print (print.ts).
  if (printOn) {
    printSoon(doc);
    printIntent(printButton);
  }

  /** Every record that matches on paper: asked of the source (list-print.ts), then the browser's print of it alone. */
  function printAll(): Promise<void> {
    const source = context.dataSource;
    if (!source?.list) return Promise.resolve();
    return busy(printButton, async () => {
      const grouping = groupedNow && source.groups ? groupByFields(facets).map((text) => groupKey(page, text)) : [];
      progress.textContent = fill(labels.printing, { done: number(0), n: number(matching) });
      // The print part, which prints it, asked for as its records are.
      const printer = loadPrint();
      let out: Awaited<ReturnType<typeof printout>>;
      let paper: Awaited<typeof printer>;
      try {
        [out, paper] = await Promise.all([printout(
          {
            page,
            node,
            doc,
            el,
            labels,
            locale,
            fill,
            model,
            dataSource: source,
            // As the person shows them, in their order: as Export writes them.
            columns: shownColumns(),
            reads: fields,
            words: show,
            atEnd,
            whole,
            filter: currentFilter(),
            sort,
            facets,
            grouping,
            groups: (key, filter) => headings(source, key, filter),
            count,
            totals,
            matching,
            now,
          },
          (done, n) => {
            if (!destroyed) progress.textContent = fill(labels.printing, { done: number(done), n: number(n) });
          },
          PRINT_MOST
        ), printer]);
        if (!paper) throw new Error('The print part could not come');
      } catch {
        if (!destroyed) context.say?.(sentence(labels.printFailedNoun, labels.printFailed), 'danger');
        return;
      }
      if (destroyed) return;
      // Its logo drawn before the browser lays the sheet out for paper.
      await Promise.all([...out.sheet.querySelectorAll('img')].map((image) => (typeof image.decode === 'function' ? image.decode().catch(() => undefined) : undefined)));
      if (destroyed) return;
      if (out.done < out.total) context.say?.(fill(sentence(labels.printCutNoun, labels.printCut), { n: number(out.done), total: number(out.total) }), 'warning');
      progress.textContent = '';
      // In the list's place on paper, inside its form: its language, its direction and its accent.
      element.append(out.sheet);
      // Its footer at the foot of every sheet, its room kept there.
      keepFootRoom(out.sheet.querySelector<HTMLElement>(':scope > .fd-print-foot'));
      await paper.printAlone(doc, out.sheet, () => out.sheet.remove());
    });
  }

  /** Edit: the field and its value asked, the question, then each record chosen written; what was not, said under the bar. */
  /** Asked, or writing: a second press meanwhile does nothing. */
  let editing = false;
  async function editChosen(): Promise<void> {
    if (!bulk || editing) return;
    editing = true;
    try {
      const ids = chosenInOrder();
      const n = ids.length;
      const one = new Intl.PluralRules(locale).select(n) === 'one';
      const how: BulkList = { page, node, model, dataSource: context.dataSource, labels, fill, locale, known: (id) => known.get(String(id)) };
      const asked = await askBulkValue(how, bulk.editValues, fill(one ? sentence(labels.bulkTitleNounOne, labels.bulkTitleOne) : sentence(labels.bulkTitleNoun, labels.bulkTitle), { n: number(n) }));
      if (!asked || destroyed) return;
      if (!(await bulk.ask(bulkQuestion(how, n, asked.field, asked.value, number), { yes: labels.bulkApply })) || destroyed) return;
      report.hidden = true;
      // Busy while it writes, not while the person is asked.
      await busy(edit, async () => {
        const { done, failed } = await writeBulk(how, ids, asked.field, asked.value, (at, of) => {
          if (!destroyed) progress.textContent = fill(labels.bulkProgress, { done: number(at), n: number(of) });
        });
        if (destroyed) return;
        // Done for the rest; those not changed stay chosen, past the page if they are, and are named with why.
        chosen.clear();
        wide = null;
        if (failed.length) {
          for (const { id } of failed) chosen.add(id);
          wide = { total: failed.length, got: failed.length };
          const names = await namesOf(failed.map(({ id }) => id));
          if (destroyed) return;
          reportWords.textContent = fill(sentence(labels.bulkSomeNoun, labels.bulkSome), { done: number(done), n: number(n) });
          reportList.replaceChildren(...failed.map(({ id, why }) => el('li', {}, fill(labels.bulkWhy, { name: names.get(String(id)) ?? String(id), why }))));
          reportFix.hidden = reportUndo.hidden = true;
          reported = edit;
          report.hidden = false;
        } else context.say?.(fill(new Intl.PluralRules(locale).select(done) === 'one' ? sentence(labels.bulkDoneNounOne, labels.bulkDoneOne) : sentence(labels.bulkDoneNoun, labels.bulkDone), { n: number(done) }), 'success');
        await Promise.all([load(), viewParts.reload()]);
      });
    } finally {
      editing = false;
    }
  }

  // Import, in the list's bar: records made from an Excel or CSV file, in a dialog of its own (the import part, loaded
  // the first time it is pressed). Asked for by the page (`import`), and only where the source can make records and a
  // field can be filled: a link's by its name where the source can search, a choice the app lists where it lists them.
  const importOffered = importFields(page, node).filter((name) => {
    const def = page.fields[name];
    if (def.type === 'many2one' || def.type === 'many2many') return !!context.dataSource?.search;
    if (def.type === 'selection' && optionsList(def.optionsFrom)) return !!context.dataSource?.options;
    return true;
  });
  const importOn = importOffered.length > 0 && !!(context.dataSource?.createMany || context.dataSource?.save);
  // A tray with an arrow out of it, unless the app's icons have their own "upload".
  const importIcon = drawIcon(doc, 'upload', { upload: '<path d="M12 15V5M7.5 9.5L12 5l4.5 4.5"/><path d="M4 15v4.5h16V15"/>', ...context.icons });
  importIcon?.setAttribute('aria-hidden', 'true');
  const importButton = el('button', { type: 'button', class: 'fd-button fd-record-gear fd-list-import-button', 'aria-haspopup': 'dialog' }, ...(importIcon ? [importIcon] : []), labels.import);
  importButton.hidden = !importOn;
  importButton.addEventListener('click', () => void importFile());

  /** A file's rows made records: the dialog; then the records again, and how it ended said under the bar, with Undo. */
  function importFile(): Promise<void> {
    const source = context.dataSource;
    if (!importOn || !source) return Promise.resolve();
    return busy(importButton, async () => {
      let part;
      try {
        part = await importPart.load();
      } catch {
        context.say?.(sentence(labels.importFailedNoun, labels.importFailed), 'danger');
        return;
      }
      if (destroyed) return;
      const end = await part.openImport({
        page,
        node,
        form,
        model,
        dataSource: source,
        doc,
        from: element,
        labels,
        locale,
        fill,
        number,
        fields: importOffered,
        icons: context.icons,
        files: { xlsxOf, csvOf, csvSeparator, saveFile, xlsxType: XLSX_TYPE },
      });
      if (!end || destroyed) return;
      if ('message' in end) {
        context.say?.(end.message, 'info');
        return;
      }
      const made = end.made.length;
      const one = new Intl.PluralRules(locale).select(made) === 'one';
      reportWords.textContent = end.stopped
        ? fill(sentence(labels.importStoppedNoun, labels.importStopped), { n: number(made), total: number(end.total) })
        : end.notImported.length
          ? fill(sentence(labels.importSomeNoun, labels.importSome), { n: number(made), total: number(end.total) })
          : fill(one ? sentence(labels.importDoneNounOne, labels.importDoneOne) : sentence(labels.importDoneNoun, labels.importDone), { n: number(made) });
      reportList.replaceChildren(...end.notImported.slice(0, 50).map(({ number: row, why }) => el('li', {}, fill(labels.importRow, { n: number(row), why }))));
      reportFix.hidden = !end.notImported.length;
      reportFix.onclick = () => void end.downloadFix(end.notImported);
      const undo = end.undo;
      reportUndo.hidden = !undo || !made || !context.ask;
      reportUndo.onclick = undo ? () => void undoImport(end.made.map(({ id }) => id), undo) : null;
      reported = importButton;
      report.hidden = false;
      await Promise.all([load(), viewParts.reload()]);
    });
  }

  /** The records an import made, deleted again once the person says so; those that could not be, named with why. */
  async function undoImport(ids: RecordId[], undo: (ids: readonly RecordId[], progress: (done: number, total: number) => void) => Promise<{ done: number; failed: { id: RecordId; why: string }[] }>): Promise<void> {
    const one = new Intl.PluralRules(locale).select(ids.length) === 'one';
    if (!context.ask || !(await context.ask(fill(one ? sentence(labels.importUndoAskNounOne, labels.importUndoAskOne) : sentence(labels.importUndoAskNoun, labels.importUndoAsk), { n: number(ids.length) }), { yes: labels.delete })) || destroyed) return;
    await busy(reportUndo, async () => {
      const { done, failed } = await undo(ids, (at, of) => {
        if (!destroyed) progress.textContent = fill(labels.importUndoing, { done: number(at), n: number(of) });
      });
      if (destroyed) return;
      reportFix.hidden = reportUndo.hidden = true;
      if (failed.length) {
        const names = await namesOf(failed.map(({ id }) => id));
        if (destroyed) return;
        reportWords.textContent = fill(sentence(labels.importUndoSomeNoun, labels.importUndoSome), { done: number(done), n: number(ids.length) });
        reportList.replaceChildren(...failed.map(({ id, why }) => el('li', {}, fill(labels.bulkWhy, { name: names.get(String(id)) ?? String(id), why }))));
      } else {
        report.hidden = true;
        context.say?.(fill(new Intl.PluralRules(locale).select(done) === 'one' ? sentence(labels.importUndoneNounOne, labels.importUndoneOne) : sentence(labels.importUndoneNoun, labels.importUndone), { n: number(done) }), 'success');
        importButton.focus();
      }
      await Promise.all([load(), viewParts.reload()]);
    });
  }

  /** Records' names, as the list shows them: from the rows on show, else asked of the source by their ids. */
  async function namesOf(ids: RecordId[]): Promise<Map<string, string>> {
    const names = new Map<string, string>();
    for (const record of visible()) names.set(String(record.id), show(nameColumn, record.values));
    const unknown = ids.filter((id) => !names.get(String(id))).slice(0, 200);
    if (unknown.length && context.dataSource?.list) {
      try {
        const answer = await context.dataSource.list({ model, fields, filter: [...(context.fixedFilter ?? []), { field: 'id', op: 'in', value: unknown }], sort, offset: 0, limit: unknown.length });
        for (const record of answer.records) names.set(String(record.id), show(nameColumn, record.values));
      } catch {
        // Named by their ids, then.
      }
    }
    return names;
  }

  const bar = el('div', { class: 'fd-list-bar' }, search.element, progress, importButton, exportBox, printButton, views, ...(fieldsSearch ? [] : [pager]));
  // How many it finds, in the filter bar's own row beside the keyword it filters by: no row of its own.
  const fieldsBox = found ? search.element.querySelector(':scope > .fd-filter-fields') : null;
  if (found && fieldsBox) fieldsBox.before(found);
  else if (found) bar.append(found);
  const key = rowsKey();
  /** Its records: the table, the end of rows loaded as it is scrolled, what it holds none or could not load, its pager. Where it waits. */
  const records = el('div', { class: 'fd-list-records' }, el('div', { class: 'fd-list-scroll' }, table), ...(endlessEnd ? [endlessEnd.element] : []), ...(shownOf ? [shownOf] : []), empty, failed, ...(fieldsSearch ? [pager] : []));
  const element = el(
    'div',
    {
      class: 'fd-list',
      'data-node': node.id,
      'data-search': fieldsSearch ? 'fields' : undefined,
      'data-choose': choose ? undefined : 'none',
      'data-in-record': inRecord ? '' : undefined,
      // Columns a person shapes: the header and the first column kept in view while the rows scroll under them.
      'data-shaped': choices ? '' : undefined,
      // How wide a gallery's card is at least.
      'data-size': gallery ? (node.gallery?.size ?? 'medium') : undefined,
      // Its rows loaded as it is scrolled.
      'data-endless': endless ? '' : undefined,
    },
    bar,
    // The ✦'s line, where the list offers it alone: any other list is as it was.
    ...(readsWords ? [wordsLine] : []),
    // A list with no box to choose a row has nothing to act on; an import's report is said all the same.
    ...(choose ? [selection] : []),
    report,
    ...(key ? [key] : []),
    el('div', { class: 'fd-list-body' }, records, ...holders.values())
  );
  // Its cells changed in place: Add a line and what a paste did under the table.
  if (editPart) {
    rowEdits = editPart.editableRows({
      list: context,
      page,
      model,
      reads: fields,
      functions: form.functions,
      cells,
      nameColumn,
      element,
      body,
      columns: shownColumns,
      span,
      row,
      saved(record, made) {
        known.set(String(record.id), { ...(record.version ? { version: record.version } : {}), ...(record.can ? { can: record.can } : {}) });
        const at = rows.findIndex((one) => String(one.id) === String(record.id));
        if (at >= 0) rows[at] = record;
        else if (made) rows.push(record);
        if (made) {
          total++;
          matching++;
          drawPager();
          context.onCount?.(matching, facets.length > 0);
        }
        totals?.refresh(currentFilter());
        totals?.ticked([...chosen], currentFilter());
        void viewParts.reload();
      },
      reload: load,
      changed: () => void (empty.hidden = !!body.firstElementChild || !failed.hidden),
      grouped: () => groupedNow,
      open: context.onOpenRecord ? openRow : undefined,
    });
    if (rowEdits) element.querySelector('.fd-list-records > .fd-list-scroll')?.after(rowEdits.element);
  }
  // Where a row moved by hand is said aloud: in the list, there before anything is said in it.
  if (ranks) element.append(ranks.voice);
  // Scrolled sideways, the first column and the Columns menu's cell, held at its ends, are parted from those going under them.
  choices?.scrolls(element.querySelector('.fd-list-scroll') as HTMLElement);
  showAs(view);
  widths?.observe(element);
  drawShape();
  // Its saved views asked first, where the source keeps them: it opens on the default one (its search, order and
  // columns), unless it was opened with a search of its own (View all's).
  const opening = kept?.then((made) => made?.start() ?? null);
  if (opening && !context.search) {
    // Waiting for its views first, as for its records: the records' wait takes it over, never drawn twice.
    const asked = startLoading(records, 'first', waiting, { part: node.id, shape: skeletonRows, now: context.loadingNow === true });
    void opening.then((chosen) => {
      if (destroyed) return asked.stop();
      // Views are kept only where the search bar has its menu: never with a filter bar.
      if (chosen && !filters) {
        putView(chosen.state);
        (search as ReturnType<typeof searchBar>).put(chosen.state.facets);
      } else void load();
      asked.stop();
    });
  } else void load();

  return {
    element,
    reload: async () => {
      await Promise.all([load(), viewParts.reload()]);
    },
    open: (id, options) => openRow(id, options?.lit !== false),
    destroy() {
      destroyed = true;
      rowEdits?.destroy();
      endlessEnd?.destroy();
      undone();
      doc.removeEventListener('pointerdown', outsideExport, true);
      search.destroy();
      wordsRead?.typing();
      widths?.disconnect();
      choices?.destroy();
      parts.forEach((part) => part.destroy());
    },
  };
}
