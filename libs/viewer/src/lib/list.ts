import {
  facetsToFilter,
  groupByFields,
  type ButtonNode,
  type DataSource,
  type Facet,
  type Form,
  type LineField,
  type ListNode,
  type Locale,
  type ResolvedFilter as Resolved,
  type Page,
  type RecordId,
  type ResolvedFilter,
  type RunResult,
  type SortOrder,
  type Tone,
  type Value,
  type Values,
} from '@fieldia/core';
import { displayValue, drawIcon, formatNumber, moneyReads, type IconSet, type PreferenceStore, type WidgetDialogs } from '@fieldia/widgets';
import type { El } from './dom';
import { startingFacets } from './favourites';
import type { ViewerLabels } from './labels';
import { askBulkValue, bulkOffered, bulkQuestion, lockedOut, writeBulk, type BulkList, type KnownRecord } from './list-bulk';
import { everyId } from './list-every';
import { exportList, type ExportFormat, type ExportList, type ExportWhich } from './list-export';
import { groupRow, type GroupContext, type Row } from './list-groups';
import { installListStyles } from './list-styles';
import { searchBar } from './search-bar';
import { filtersPart } from './viewer-parts';

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
  onOpenRecord?: (id: RecordId) => unknown;
  /** Conditions every search keeps: the records this list may show at all. */
  fixedFilter?: ResolvedFilter[];
  /** Other ways of showing the records, by name: `map` for a list with `map`, `calendar` for one with `calendar`. */
  views?: Record<string, ListViewFactory>;
  /**
   * Another view asked for a new record with these values filled in (a calendar's empty slot pressed: its start and
   * end). A promise answered: the records again once it settles. Without it, a view offers no way to make one.
   */
  onNewRecord?: (values: Values) => unknown;
  /** Words said over the page, as a toast: an export done, or why it was not. Unsaid without it. */
  say?: (message: string, tone: Tone) => void;
  /** A question answered Yes or No, as a button's confirmation asks it: "Update 24 records?". Without it, Edit is not offered. */
  ask?: (message: string) => Promise<boolean>;
  /** Values asked in a dialog of fields, as a line's own form asks them: Edit's field and value. Without it, Edit is not offered. */
  editValues?: WidgetDialogs['editValues'];
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
const TONES = new Set<string>(['info', 'success', 'warning', 'danger', 'muted']);
const COLOUR = /^#[0-9a-fA-F]{6}$/;

/** A link's id, or a value as it is: what a row's parent and a lead's look are found by. */
const plain = (value: Value | undefined): unknown => (value !== null && typeof value === 'object' && !Array.isArray(value) && 'id' in value ? (value as { id: unknown }).id : value);
const isPromise = (value: unknown): value is Promise<unknown> => !!value && typeof (value as Promise<unknown>).then === 'function';

/**
 * Records as a table: one page at a time, in the order a header asks for, each
 * row opening its record. Chosen rows get the list's buttons, which hand the
 * app their ids. A plain table, so it reads the same in every binding.
 */
export function listView(context: ListContext): ListView {
  const { page, node, form, el, labels, fill, locale, doc } = context;
  installListStyles(doc);
  const pageSize = node.pageSize ?? 40;
  const defaultSort = node.sort ?? [];
  let sort: SortOrder[] = defaultSort;
  let offset = 0;
  let total = 0;
  /** The page of records, when the list is not grouped. */
  let rows: Row[] = [];
  /** Each record's row, for the records on show however they are grouped. */
  const recordOf = new WeakMap<Element, Row>();
  const visible = () => [...body.querySelectorAll('.fd-list-row')].map((tr) => recordOf.get(tr) as Row);
  // Only a page of records gets this far: the page check refuses a list of anything else.
  const model = page.data.kind === 'record' ? page.data.model : '';
  let facets: Facet[] = startingFacets(node, context.preferences, page);
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
  /** The rows are under their groups: no count of every match is known then. */
  let groupedNow = false;
  /** Each new search counts on: ids asked for under one search are no choice in the next. */
  let searches = 0;
  /** A count as the page writes numbers: "1,284". */
  const number = (n: number) => formatNumber(n, 0, locale);
  let asking = 0;
  let destroyed = false;

  /** A box to choose each row, unless the list says none; rows under their parent, when it names the field. */
  const choose = node.choose !== false;
  /** A filter bar of fields over the list (search "fields"): the pager goes under the table. */
  const fieldsSearch = node.search === 'fields';
  const parentField = node.parentField && page.fields[node.parentField] ? node.parentField : null;
  const cellOf = (name: string) => node.cells?.[name];
  const leads = Object.values(node.cells ?? {}).flatMap((cell) => (cell.lead ? [cell.lead.field] : []));
  // The columns, and what an amount needs to be read: its currency, from the record, and what its money look's conditions read ("/month" on a rent);
  // the fields the cells' icons come from, and each row's parent.
  const fields = [...new Set([...node.columns.flatMap((name) => [name, ...moneyReads(page.fields[name])]), ...leads, ...(parentField ? [parentField] : [])])];
  const show = (name: string, values: Record<string, Value>) => displayValue(page.fields[name] as LineField, values[name], values, locale);
  /** Its words keep to the end: a number's, unless its cell says otherwise. */
  const atEnd = (name: string) => (cellOf(name)?.align ? cellOf(name)?.align === 'end' : NUMBERS.has(page.fields[name].type));
  /** A column of a given width, its words cut with "…" past it: in characters of its words, or in pixels for the whole column. */
  const sized = (cell: HTMLTableCellElement, name: string) => {
    const width = cellOf(name)?.width;
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
  /** What names a record: its first column of words, else its first column. */
  const nameColumn = node.columns.find((name) => page.fields[name].type === 'char') ?? node.columns[0];
  /** Every column sized: the table keeps their widths, scrolling sideways in its card when wider, the room left after its last. */
  const fixedWidths = node.columns.every((name) => cellOf(name)?.width);
  /** Whether a header's press orders the list: not for a ranked list, which keeps its own order. */
  const sortable = node.sortable !== false;
  /** The record open from its row (or by open()), its row marked while it is. */
  let openId: RecordId | null = null;
  /** The columns before the fields': the box to choose a row, and the parents' toggles. */
  const leading = (choose ? 1 : 0) + (parentField ? 1 : 0);

  // ---- the table ---------------------------------------------------------------

  const chooseAll = el('input', { type: 'checkbox', class: 'fd-list-checkbox', 'aria-label': labels.selectAll });
  const headers = node.columns.map((name) => {
    const def = page.fields[name];
    // The name's header marked as its cells are, rows under their parent: a theme stands it over the name, past the toggles.
    const th = sized(el('th', { scope: 'col', 'data-field': name, class: atEnd(name) ? 'fd-num' : undefined, 'data-name': parentField && name === nameColumn ? '' : undefined }), name);
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
      button.addEventListener('click', () => {
        // The header's field leads; the list's own order breaks the ties.
        const desc = sort[0]?.field === name ? !sort[0].desc : false;
        sort = [{ field: name, ...(desc ? { desc } : {}) }, ...defaultSort.filter((order) => order.field !== name)];
        offset = 0;
        void load();
      });
      th.append(button);
    }
    return th;
  });
  // Every parent opened, or closed, at once.
  const expandAll = el('button', { type: 'button', class: 'fd-list-fold', 'aria-label': labels.expandAll, title: labels.expandAll }, el('span', { 'aria-hidden': 'true' }, '+'));
  const collapseAll = el('button', { type: 'button', class: 'fd-list-fold', 'aria-label': labels.collapseAll, title: labels.collapseAll }, el('span', { 'aria-hidden': 'true' }, '\u2212'));
  const body = el('tbody');
  const table = el(
    'table',
    { class: 'fd-list-table', 'aria-label': page.title, 'data-fixed': fixedWidths ? '' : undefined, 'data-sortable': sortable ? undefined : 'false' },
    el(
      'thead',
      {},
      el(
        'tr',
        {},
        ...(choose ? [el('th', { class: 'fd-list-check', scope: 'col' }, chooseAll)] : []),
        ...(parentField ? [el('th', { class: 'fd-list-tree', scope: 'col' }, el('span', { class: 'fd-list-folds' }, expandAll, collapseAll))] : []),
        ...headers
      )
    ),
    body
  );
  const empty = el('p', { class: 'fd-list-empty', hidden: '' }, labels.noRecords);
  const retry = el('button', { type: 'button', class: 'fd-button fd-button-link' }, labels.retry);
  const failed = el('p', { class: 'fd-list-failed', role: 'alert', hidden: '' }, labels.loadFailed, ' ', retry);
  retry.addEventListener('click', () => void load());

  /** A cell's words, with what its column draws before them: a state's dot, a kind's icon. */
  function cellContent(name: string, values: Record<string, Value>): Node[] {
    const cell = cellOf(name);
    const words = show(name, values);
    const before: Node[] = [];
    const look = cell?.lead?.looks[String(plain(values[cell.lead.field]))];
    const leadIcon = look ? drawIcon(doc, look.icon, context.icons) : null;
    if (leadIcon) {
      leadIcon.setAttribute('aria-hidden', 'true');
      leadIcon.classList.add('fd-list-lead');
      if (look?.colour) leadIcon.style.color = look.colour;
      before.push(leadIcon);
    }
    if (cell?.widget === 'dot' && words) {
      // Its colour by value: the page's own, else its tone, else grey.
      const value = String(plain(values[name]));
      const colours = (cell.options?.['colours'] ?? {}) as Record<string, unknown>;
      const tones = (cell.options?.['tones'] ?? {}) as Record<string, unknown>;
      const colour = typeof colours[value] === 'string' && COLOUR.test(colours[value] as string) ? (colours[value] as string) : null;
      const tone = typeof tones[value] === 'string' && TONES.has(tones[value] as string) ? (tones[value] as Tone) : 'muted';
      const dot = el('span', { class: 'fd-list-dot', 'aria-hidden': 'true', 'data-tone': colour ? undefined : tone });
      if (colour) dot.style.setProperty('--fd-dot', colour);
      before.push(dot);
    }
    // Each value in its own direction: a phone number or an amount reads left to right on a right-to-left page.
    return [...before, el('bdi', {}, words)];
  }

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
  async function openRow(id: RecordId, lit = true) {
    const answer = context.onOpenRecord?.(id);
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
    while (next && (next as HTMLElement).hidden) next = down ? next.nextElementSibling : next.previousElementSibling;
    return next as HTMLElement | null;
  };

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
    const tr = el(
      'tr',
      {
        class: context.onOpenRecord ? 'fd-list-row fd-list-openable' : 'fd-list-row',
        tabindex: '0',
        'data-id': String(record.id),
        'data-level': level ? String(level) : undefined,
        'aria-current': openId !== null && String(openId) === String(record.id) ? 'true' : undefined,
      },
      ...(box ? [el('td', { class: 'fd-list-check' }, box)] : []),
      ...(parentField ? [el('td', { class: 'fd-list-tree' })] : []),
      ...node.columns.map((name) => sized(el('td', { class: atEnd(name) ? 'fd-num' : undefined, 'data-name': parentField && name === nameColumn ? '' : undefined }, ...cellContent(name, record.values)), name))
    );
    tr.addEventListener('click', (event) => {
      const cell = (event.target as Element).closest('td');
      // The box's own cell is a bigger target for the box; a parent's toggle is its own.
      if (cell?.classList.contains('fd-list-check')) {
        if (event.target === cell) box?.click();
        return;
      }
      if ((event.target as Element).closest('.fd-list-twisty')) return;
      void openRow(record.id);
    });
    tr.addEventListener('keydown', (event) => {
      if (event.target !== tr) return;
      const forward = tr.closest('[dir]')?.getAttribute('dir') === 'rtl' ? 'ArrowLeft' : 'ArrowRight';
      if (event.key === 'Enter') {
        event.preventDefault();
        void openRow(record.id);
      } else if (event.key === ' ' && box) {
        event.preventDefault();
        box.click();
      } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        shownBeside(tr, event.key === 'ArrowDown')?.focus();
      } else if ((event.key === 'ArrowRight' || event.key === 'ArrowLeft') && tr.hasAttribute('data-parent-of')) {
        // A parent opens towards the line's end, closes towards its start: flipped right to left.
        event.preventDefault();
        fold(String(record.id), event.key !== forward);
      }
    });
    // Under the pointer or the focus: its pin on the map lights up.
    tr.addEventListener('mouseenter', () => viewParts.highlight(record.id));
    tr.addEventListener('mouseleave', () => viewParts.highlight(null));
    tr.addEventListener('focus', () => viewParts.highlight(record.id));
    recordOf.set(tr, record);
    return tr;
  }

  // ---- rows under their parent -------------------------------------------------------

  /** The parents closed, by id: kept while the list asks again. */
  const closed = new Set<string>();

  /** A page of records with each under its parent, depth first, where the parent is on the page too; the rest at the top. */
  function nest(records: Row[]): HTMLTableRowElement[] {
    if (!parentField) return records.map((record) => row(record));
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
        tr.setAttribute('data-parent-of', String(under.length));
        tr.setAttribute('aria-expanded', String(!closed.has(id)));
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
      if (twisty) tr.setAttribute('aria-expanded', String(!closed.has(id)));
      if (tr.hasAttribute('data-parent-of')) stack.push({ depth, closed: closed.has(id) });
    }
  }

  expandAll.addEventListener('click', () => {
    closed.clear();
    drawFolds();
  });
  collapseAll.addEventListener('click', () => {
    for (const tr of body.querySelectorAll<HTMLElement>(':scope > .fd-list-row[data-parent-of]')) closed.add(tr.dataset['id'] ?? '');
    drawFolds();
  });

  // ---- what is chosen, and the buttons for it --------------------------------------

  const count = el('span', { class: 'fd-list-count', role: 'status' });
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
  const selection = el('div', { class: 'fd-list-selection', hidden: '' }, count, every, ...(bulk ? [edit] : []), ...buttons, clear);
  /** What an Edit could not change, and why, under the bar: kept until it is dismissed or the next Edit. */
  const reportWords = el('p', { class: 'fd-list-report-words' });
  const reportList = el('ul', { class: 'fd-list-report-list' });
  const dismiss = el('button', { type: 'button', class: 'fd-button fd-button-link' }, labels.dismiss);
  const report = el('div', { class: 'fd-list-report', role: 'alert', hidden: '' }, reportWords, reportList, dismiss);
  dismiss.addEventListener('click', () => {
    report.hidden = true;
    edit.focus();
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
    count.textContent = wide && wide.got < wide.total && chosen.size === wide.got ? fill(labels.selectedOf, { n: number(chosen.size), total: number(wide.total) }) : fill(labels.selected, { n: number(chosen.size) });
    every.hidden = !!wide || groupedNow || !chooseAll.checked || total <= shown.length || !context.dataSource?.list;
    if (!every.hidden && !every.hasAttribute('aria-busy')) every.textContent = fill(labels.selectAllMatching, { n: number(total) });
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

  function drawPager() {
    // Under a filter bar, the pager shows only when there is more than one page.
    pager.hidden = total === 0 || (fieldsSearch && offset === 0 && total <= pageSize);
    // As the page writes numbers, as the count of those chosen is: "1–10 / 1,284".
    range.textContent = fill(labels.range, { from: number(offset + 1), to: number(Math.min(offset + rows.length, total)), total: number(total) });
    previous.disabled = offset === 0;
    next.disabled = offset + pageSize >= total;
  }

  function drawSort() {
    for (const th of headers) {
      // Nearest a place is no column's order.
      const order = !sort[0]?.near && sort[0]?.field === th.dataset['field'] ? sort[0] : null;
      if (order) th.setAttribute('aria-sort', order.desc ? 'descending' : 'ascending');
      else th.removeAttribute('aria-sort');
    }
  }

  // ---- asking for the records ------------------------------------------------------

  /** Rows came or went: what is chosen keeps to the records on show, the table's or the map's. */
  function changed() {
    // On a map, a record chosen may be one the table's page does not hold; and every one that matches reaches past the page.
    if (view === 'list' && !wide) {
      const shown = new Set(visible().map((record) => record.id));
      for (const id of [...chosen]) if (!shown.has(id)) chosen.delete(id);
    }
    drawChoice();
    viewParts.chosenChanged();
  }

  const grouped = (source: DataSource): GroupContext => ({
    page,
    el,
    labels,
    fill,
    dataSource: source,
    model,
    fields,
    columns: node.columns.length + leading,
    pageSize,
    sort: () => sort,
    recordRow: row,
    changed,
  });

  async function load(): Promise<void> {
    const mine = ++asking;
    drawSort();
    table.setAttribute('aria-busy', 'true');
    let drawn: HTMLTableRowElement[] = [];
    try {
      const filter = [...(context.fixedFilter ?? []), ...facetsToFilter(facets, node)];
      const grouping = groupByFields(facets);
      const source = context.dataSource;
      if (grouping.length && source?.groups && source.list) {
        // Grouped: a row for each value of the first field, each opening into the rest.
        const groups = await source.groups({ model, field: grouping[0], filter });
        if (mine !== asking || destroyed) return;
        rows = [];
        total = 0;
        groupedNow = true;
        drawn = groups.map((group) => groupRow(grouped(source), group, 0, filter, grouping));
      } else {
        const answer = source?.list ? await source.list({ model, fields, filter, sort, offset, limit: pageSize }) : { records: [], total: 0 };
        if (mine !== asking || destroyed) return;
        // Past the end, as when the last record of the last page went: back to the page that is left.
        if (!answer.records.length && answer.total > 0 && offset > 0) {
          offset = Math.floor((answer.total - 1) / pageSize) * pageSize;
          return load();
        }
        rows = answer.records;
        total = answer.total;
        groupedNow = false;
        drawn = nest(rows);
      }
      failed.hidden = true;
    } catch {
      if (mine !== asking || destroyed) return;
      rows = [];
      total = 0;
      failed.hidden = false;
    }
    body.replaceChildren(...drawn);
    empty.hidden = drawn.length > 0 || !failed.hidden;
    table.removeAttribute('aria-busy');
    drawPager();
    changed();
  }

  const searched = (next: Facet[]) => {
    facets = next;
    offset = 0;
    searches++;
    // Every record that matched the search before is no choice in this one.
    if (wide) {
      wide = null;
      chosen.clear();
    }
    void load();
    void viewParts.reload();
  };
  // The search bar, or a keyword and a list of values for each of a few fields.
  // The filter bar comes in the filters part, which the viewer has waited for; the search bar where it could not come.
  const filters = node.search === 'fields' ? filtersPart.loaded : undefined;
  const search =
    filters
      ? filters.filterBar({ page, node, doc, el, labels, fill, uid: context.uid, icons: context.icons, preferences: context.preferences, locale, dataSource: context.dataSource, model, fixedFilter: () => context.fixedFilter ?? [], facets, onChange: searched })
      : searchBar({ page, node, doc, el, labels, fill, uid: context.uid, icons: context.icons, preferences: context.preferences, locale, facets, onChange: searched });

  // ---- other views: the map beside the table or instead of it, a calendar, an app's own ----------

  /** The views this list offers, by name, in the order the app registered them: by the page option of its name, unless the view says. */
  const offered = Object.entries(context.views ?? {}).filter(([name, factory]) => (factory.offers ? factory.offers(node) : (node as unknown as Record<string, unknown>)[name] !== undefined));
  const factories = new Map(offered);
  /** The table alone, `both` (the table and the map side by side), or a view's name. */
  let view: string = node.map && factories.has('map') && node.map.view ? node.map.view : (offered.find(([name, factory]) => name !== 'map' && factory.opens?.(node))?.[0] ?? 'list');
  /** Each view once made: the first time it is shown. */
  const parts = new Map<string, ListViewPart>();
  const holders = new Map(offered.map(([name]) => [name, el('div', { class: name === 'map' ? 'fd-list-addon fd-list-map' : 'fd-list-addon', 'data-addon': name })]));
  /** What the table tells a view, it tells each one made. */
  const viewParts = {
    reload: () => Promise.all([...parts.values()].map((part) => part.reload())).then(() => undefined),
    highlight: (id: RecordId | null) => parts.forEach((part) => part.highlight(id)),
    chosenChanged: () => parts.forEach((part) => part.chosenChanged()),
  };
  const currentFilter = () => [...(context.fixedFilter ?? []), ...facetsToFilter(facets, node)];
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
        offset = 0;
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

  /** The switcher: the table, then each view offered — the map as Map, and List and map. */
  const choices = ['list', ...offered.flatMap(([name]) => (name === 'map' ? ['map', 'both'] : [name]))];
  const words = (name: string) =>
    name === 'list' ? labels.viewList : name === 'map' ? labels.viewMap : name === 'both' ? labels.viewBoth : (factories.get(name)?.label?.(locale) ?? name);
  const viewButtons = choices.map((name) => {
    const button = el('button', { type: 'button', class: 'fd-button fd-list-view', 'data-view': name, 'aria-pressed': 'false' }, words(name));
    button.addEventListener('click', () => showAs(name));
    return button;
  });
  const views = el('div', { class: 'fd-list-views', role: 'group', 'aria-label': labels.showAs }, ...viewButtons);
  views.hidden = !offered.length;

  function showAs(next: string) {
    view = choices.includes(next) ? next : 'list';
    element.dataset['view'] = view;
    // A view in place of the table: the table and its pager step aside.
    element.toggleAttribute('data-alone', view !== 'list' && view !== 'both');
    for (const button of viewButtons) button.setAttribute('aria-pressed', String(button.dataset['view'] === view));
    const on = view === 'both' ? 'map' : view;
    for (const [name, holder] of holders) holder.toggleAttribute('data-on', name === on);
    if (view === 'list') return;
    makeView(on);
    parts.get(on)?.shown();
  }

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
        context.say?.(labels.selectAllFailed, 'danger');
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
  const exportOn = node.export !== false && !!(context.dataSource?.list || context.dataSource?.exportRecords);
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
      : fill(new Intl.PluralRules(locale).select(total) === 'one' ? labels.exportAllOne : labels.exportAll, { n: number(total) });
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
    columns: node.columns,
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
      const which: ExportWhich = all ? { filter: currentFilter(), sort, count: wide ? wide.total : total } : { ids, filter: context.fixedFilter ?? [], sort, count: ids.length };
      progress.textContent = fill(labels.exporting, { done: number(0), n: number(which.count) });
      try {
        const end = await exportList(exportOf(), which, format, (done, n) => {
          if (!destroyed) progress.textContent = fill(labels.exporting, { done: number(done), n: number(n) });
        });
        if (destroyed) return;
        if ('message' in end) context.say?.(end.message, 'info');
        else if (end.done < end.total) context.say?.(fill(labels.exportCut, { n: number(end.done), total: number(end.total) }), 'warning');
        else context.say?.(fill(new Intl.PluralRules(locale).select(end.done) === 'one' ? labels.exportedOne : labels.exported, { n: number(end.done) }), 'success');
      } catch {
        if (!destroyed) context.say?.(labels.exportFailed, 'danger');
      }
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
      const asked = await askBulkValue(how, bulk.editValues, fill(one ? labels.bulkTitleOne : labels.bulkTitle, { n: number(n) }));
      if (!asked || destroyed) return;
      if (!(await bulk.ask(bulkQuestion(how, n, asked.field, asked.value, number))) || destroyed) return;
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
          reportWords.textContent = fill(labels.bulkSome, { done: number(done), n: number(n) });
          reportList.replaceChildren(...failed.map(({ id, why }) => el('li', {}, fill(labels.bulkWhy, { name: names.get(String(id)) ?? String(id), why }))));
          report.hidden = false;
        } else context.say?.(fill(new Intl.PluralRules(locale).select(done) === 'one' ? labels.bulkDoneOne : labels.bulkDone, { n: number(done) }), 'success');
        await Promise.all([load(), viewParts.reload()]);
      });
    } finally {
      editing = false;
    }
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

  const element = el(
    'div',
    { class: 'fd-list', 'data-node': node.id, 'data-search': fieldsSearch ? 'fields' : undefined, 'data-choose': choose ? undefined : 'none' },
    el('div', { class: 'fd-list-bar' }, search.element, progress, exportBox, views, ...(fieldsSearch ? [] : [pager])),
    // A list with no box to choose a row has nothing to act on.
    ...(choose ? [selection, report] : []),
    el('div', { class: 'fd-list-body' }, el('div', { class: 'fd-list-records' }, el('div', { class: 'fd-list-scroll' }, table), empty, failed, ...(fieldsSearch ? [pager] : [])), ...holders.values())
  );
  showAs(view);
  void load();

  return {
    element,
    reload: async () => {
      await Promise.all([load(), viewParts.reload()]);
    },
    open: (id, options) => openRow(id, options?.lit !== false),
    destroy() {
      destroyed = true;
      doc.removeEventListener('pointerdown', outsideExport, true);
      search.destroy();
      parts.forEach((part) => part.destroy());
    },
  };
}
