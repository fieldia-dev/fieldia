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
}

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
        await load();
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
      const order = sort[0]?.field === th.dataset['field'] ? sort[0] : null;
      if (order) th.setAttribute('aria-sort', order.desc ? 'descending' : 'ascending');
      else th.removeAttribute('aria-sort');
    }
  }

  // ---- asking for the records ------------------------------------------------------

  /** Rows came or went: what is chosen keeps to the records on show. */
  function changed() {
    const shown = new Set(visible().map((record) => record.id));
    for (const id of [...chosen]) if (!shown.has(id)) chosen.delete(id);
    drawChoice();
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
    },
  });
  const element = el(
    'div',
    { class: 'fd-list', 'data-node': node.id },
    el('div', { class: 'fd-list-bar' }, search.element, pager),
    selection,
    el('div', { class: 'fd-list-scroll' }, table),
    empty,
    failed
  );
  void load();

  return {
    element,
    reload: load,
    destroy() {
      destroyed = true;
      search.destroy();
    },
  };
}
