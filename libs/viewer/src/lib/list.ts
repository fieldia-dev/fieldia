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
  type Value,
} from '@fieldia/core';
import { displayValue, type IconSet, type PreferenceStore } from '@fieldia/widgets';
import type { El } from './dom';
import { startingFacets } from './favourites';
import type { ViewerLabels } from './labels';
import { groupRow, type GroupContext, type Row } from './list-groups';
import { installListStyles } from './list-styles';
import { searchBar } from './search-bar';

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
  onOpenRecord?: (id: RecordId) => void;
  /** Conditions every search keeps: the records this list may show at all. */
  fixedFilter?: ResolvedFilter[];
  /** Other ways of showing the records, by name: `map` for a list with `map`. */
  views?: Record<string, ListViewFactory>;
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
  open?: (id: RecordId) => void;
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

export type ListViewFactory = (context: ListViewContext) => ListViewPart;

export interface ListView {
  element: HTMLElement;
  /** Ask for the records again, keeping the page, the order and what is chosen where it still applies. */
  reload(): Promise<void>;
  destroy(): void;
}

/** Numbers line up on the end of their column. */
const NUMBERS = new Set(['integer', 'float', 'monetary']);
/** Fields no list can put in order. */
const UNSORTABLE = new Set(['one2many', 'many2many', 'binary', 'image', 'html', 'json', 'properties']);

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
  let asking = 0;
  let destroyed = false;

  // The columns, and what an amount needs to be read: its currency, from the record.
  const fields = [...new Set(node.columns.flatMap((name) => {
    const def = page.fields[name];
    return def.type === 'monetary' && def.currencyField ? [name, def.currencyField] : [name];
  }))];
  const show = (name: string, values: Record<string, Value>) => displayValue(page.fields[name] as LineField, values[name], values, locale);

  // ---- the table ---------------------------------------------------------------

  const chooseAll = el('input', { type: 'checkbox', class: 'fd-list-checkbox', 'aria-label': labels.selectAll });
  const headers = node.columns.map((name) => {
    const def = page.fields[name];
    const th = el('th', { scope: 'col', 'data-field': name, class: NUMBERS.has(def.type) ? 'fd-num' : undefined });
    if (UNSORTABLE.has(def.type)) th.append(def.label);
    else {
      const button = el('button', { type: 'button', class: 'fd-list-sort' }, def.label);
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
  const body = el('tbody');
  const table = el(
    'table',
    { class: 'fd-list-table', 'aria-label': page.title },
    el('thead', {}, el('tr', {}, el('th', { class: 'fd-list-check', scope: 'col' }, chooseAll), ...headers)),
    body
  );
  const empty = el('p', { class: 'fd-list-empty', hidden: '' }, labels.noRecords);
  const retry = el('button', { type: 'button', class: 'fd-button fd-button-link' }, labels.retry);
  const failed = el('p', { class: 'fd-list-failed', role: 'alert', hidden: '' }, labels.loadFailed, ' ', retry);
  retry.addEventListener('click', () => void load());

  function row(record: Row, level = 0): HTMLTableRowElement {
    const name = show(node.columns[0], record.values) || String(record.id);
    const box = el('input', { type: 'checkbox', class: 'fd-list-checkbox', 'aria-label': fill(labels.selectRecord, { name }) });
    box.checked = chosen.has(record.id);
    box.addEventListener('change', () => {
      if (box.checked) chosen.add(record.id);
      else chosen.delete(record.id);
      drawChoice();
      mapPart?.chosenChanged();
    });
    const tr = el(
      'tr',
      { class: context.onOpenRecord ? 'fd-list-row fd-list-openable' : 'fd-list-row', tabindex: '0', 'data-id': String(record.id), 'data-level': level ? String(level) : undefined },
      el('td', { class: 'fd-list-check' }, box),
      // Each value in its own direction: a phone number or an amount reads left to right on a right-to-left page.
      ...node.columns.map((name) => el('td', { class: NUMBERS.has(page.fields[name].type) ? 'fd-num' : undefined }, el('bdi', {}, show(name, record.values))))
    );
    tr.addEventListener('click', (event) => {
      const cell = (event.target as Element).closest('td');
      // The box's own cell is a bigger target for the box.
      if (cell?.classList.contains('fd-list-check')) {
        if (event.target === cell) box.click();
        return;
      }
      context.onOpenRecord?.(record.id);
    });
    tr.addEventListener('keydown', (event) => {
      if (event.target !== tr) return;
      if (event.key === 'Enter') {
        event.preventDefault();
        context.onOpenRecord?.(record.id);
      } else if (event.key === ' ') {
        event.preventDefault();
        box.click();
      } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        const next = event.key === 'ArrowDown' ? tr.nextElementSibling : tr.previousElementSibling;
        (next as HTMLElement | null)?.focus();
      }
    });
    // Under the pointer or the focus: its pin on the map lights up.
    tr.addEventListener('mouseenter', () => mapPart?.highlight(record.id));
    tr.addEventListener('mouseleave', () => mapPart?.highlight(null));
    tr.addEventListener('focus', () => mapPart?.highlight(record.id));
    recordOf.set(tr, record);
    return tr;
  }

  // ---- what is chosen, and the buttons for it --------------------------------------

  const count = el('span', { class: 'fd-list-count', role: 'status' });
  const clear = el('button', { type: 'button', class: 'fd-button fd-button-link' }, labels.clearSelection);
  const buttons = (node.actions ?? []).map((action: ButtonNode) => {
    const button = el('button', { type: 'button', class: `fd-button fd-button-${action.style ?? 'secondary'}`, 'data-node': action.id }, ...context.withIcon(action.icon, action.label));
    // Its confirmation, then its steps with the records chosen; then the records again, as they are now.
    button.addEventListener('click', () =>
      void context.press(button, async () => {
        const result = await form.runAction(action.id, { recordIds: [...chosen] });
        await Promise.all([load(), mapPart?.reload()]);
        return result;
      })
    );
    return button;
  });
  const selection = el('div', { class: 'fd-list-selection', hidden: '' }, count, ...buttons, clear);
  clear.addEventListener('click', () => {
    chosen.clear();
    for (const box of body.querySelectorAll<HTMLInputElement>('.fd-list-checkbox')) box.checked = false;
    drawChoice();
  });
  chooseAll.addEventListener('change', () => {
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
    count.textContent = fill(labels.selected, { n: chosen.size });
    for (const tr of body.querySelectorAll<HTMLElement>('.fd-list-row')) {
      tr.setAttribute('aria-selected', String([...chosen].some((id) => String(id) === tr.dataset['id'])));
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
    pager.hidden = total === 0;
    range.textContent = fill(labels.range, { from: offset + 1, to: Math.min(offset + rows.length, total), total });
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
    // On a map, a record chosen may be one the table's page does not hold.
    if (view === 'list') {
      const shown = new Set(visible().map((record) => record.id));
      for (const id of [...chosen]) if (!shown.has(id)) chosen.delete(id);
    }
    drawChoice();
    mapPart?.chosenChanged();
  }

  const grouped = (source: DataSource): GroupContext => ({
    page,
    el,
    labels,
    fill,
    dataSource: source,
    model,
    fields,
    columns: node.columns.length + 1,
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
        drawn = rows.map((record) => row(record));
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

  const search = searchBar({
    page,
    node,
    doc,
    el,
    labels,
    fill,
    uid: context.uid,
    icons: context.icons,
    preferences: context.preferences,
    facets,
    onChange(next) {
      facets = next;
      offset = 0;
      void load();
      void mapPart?.reload();
    },
  });

  // ---- the map, beside the table or instead of it ----------------------------------

  const mapFactory = node.map ? context.views?.['map'] : undefined;
  let view: 'list' | 'map' | 'both' = mapFactory ? (node.map?.view ?? 'list') : 'list';
  let mapPart: ListViewPart | null = null;
  const mapHolder = el('div', { class: 'fd-list-map' });
  const currentFilter = () => [...(context.fixedFilter ?? []), ...facetsToFilter(facets, node)];

  function makeMap() {
    if (mapPart || !mapFactory) return;
    mapPart = mapFactory({
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
        mapPart?.chosenChanged();
      },
      ...(context.onOpenRecord ? { open: context.onOpenRecord } : {}),
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
        void mapPart?.reload();
      },
      actions: (node.actions ?? []).map((action) => ({ id: action.id, label: action.label, ...(action.style ? { style: action.style } : {}) })),
      act: (id, ids, button) =>
        context.press(button, async () => {
          const result = await form.runAction(id, { recordIds: ids });
          await Promise.all([load(), mapPart?.reload()]);
          return result;
        }),
    });
    mapHolder.append(mapPart.element);
    void mapPart.reload();
  }

  const viewButtons = (['list', 'map', 'both'] as const).map((name) => {
    const button = el('button', { type: 'button', class: 'fd-button fd-list-view', 'data-view': name, 'aria-pressed': 'false' }, name === 'list' ? labels.viewList : name === 'map' ? labels.viewMap : labels.viewBoth);
    button.addEventListener('click', () => showAs(name));
    return button;
  });
  const views = el('div', { class: 'fd-list-views', role: 'group', 'aria-label': labels.showAs }, ...viewButtons);
  views.hidden = !mapFactory;

  function showAs(next: typeof view) {
    view = next;
    element.dataset['view'] = view;
    for (const button of viewButtons) button.setAttribute('aria-pressed', String(button.dataset['view'] === view));
    if (view !== 'list') {
      makeMap();
      mapPart?.shown();
    }
  }

  const element = el(
    'div',
    { class: 'fd-list', 'data-node': node.id },
    el('div', { class: 'fd-list-bar' }, search.element, views, pager),
    selection,
    el('div', { class: 'fd-list-body' }, el('div', { class: 'fd-list-records' }, el('div', { class: 'fd-list-scroll' }, table), empty, failed), mapHolder)
  );
  showAs(view);
  void load();

  return {
    element,
    reload: async () => {
      await Promise.all([load(), mapPart?.reload()]);
    },
    destroy() {
      destroyed = true;
      search.destroy();
      mapPart?.destroy();
    },
  };
}
