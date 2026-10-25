import { loadedRecordOf, matchesFilter, type DataSource, type Line, type ListNode, type Locale, type Page, type RecordId, type SortOrder, type Values } from '@fieldia/core';
import { moneyReads, startLoading, type Loading } from '@fieldia/widgets';
import type { El } from './dom';
import type { ViewerLabels } from './labels';
import type { Cells } from './list-cells';
import type { Row } from './list-groups';

/** Numbers line up on the end of their column, as the list's own do. */
const NUMBERS = new Set(['integer', 'float', 'monetary']);

export interface DetailContext {
  /** The list's page: its fields, its model, its language and look, which what a row opens to is shown in. */
  page: Page;
  /** The list, with its `detail`. */
  node: ListNode;
  model: string;
  dataSource: DataSource | undefined;
  el: El;
  labels: ViewerLabels;
  locale: Locale;
  fill: (template: string, values: Record<string, string | number>) => string;
  /** A count as the page writes numbers. */
  number: (n: number) => string;
  /** How a list's cells are drawn (list-cells.ts), for the page of what a row opens to: handed over, never imported. */
  cellsOf: (page: Page, node: ListNode) => Cells;
  /** How many columns a row of the list spans now. */
  span: () => number;
  /** How the list waits (loading.ts in @fieldia/widgets): what a row opens to, drawn the first time, then another page of it. */
  loading?: Loading;
}

/** What a list's rows open in place to show (`ListNode.detail`), wired into its rows. */
export interface DetailRows {
  /** A row drawn: its toggle before its name, and in its card for a phone; open where it was before the list asked again. */
  wire(tr: HTMLTableRowElement, record: Row, name: string): void;
  /**
   * The rows drawn again (the list asked again): those open stay open under their rows, asked again — and a row the list
   * still holds though it is not in the page (`holds`: past the view, list-window.ts) stays open, asked again as it is drawn.
   */
  drawn(body: HTMLElement, holds?: (id: string) => boolean): void;
  /** A row put back in the page as the view came to it: what it opened to under it again. */
  placed(tr: HTMLTableRowElement): void;
  /** Right or Left on a row: opened or closed; false where the row opens to nothing. */
  key(tr: HTMLElement, open: boolean): boolean;
  /** The columns changed: each open one spans them. */
  spread(body: HTMLElement): void;
}

/** One row open: what it shows under it, the page of it shown, and its record's lines once loaded. */
interface Opened {
  row: HTMLTableRowElement;
  name: string;
  offset: number;
  lines?: Line[];
  /** Each ask counts on: an older answer is not drawn over a newer one's. */
  asking: number;
  /** The list asked again while its row was out of the page: asked again as the row comes back. */
  stale?: boolean;
  draw(): Promise<void>;
}

/** Two values in a list's order: a link by its label, numbers by size, empty last whichever way. */
function compare(a: unknown, b: unknown, desc = false): number {
  const blank = (v: unknown) => v === null || v === undefined || v === '';
  if (blank(a) || blank(b)) return blank(a) === blank(b) ? 0 : blank(a) ? 1 : -1;
  const label = (v: unknown) => (typeof v === 'object' && v !== null && 'label' in v ? (v as { label: unknown }).label : v);
  const [x, y] = [label(a), label(b)];
  const result = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y));
  return desc ? -result : result;
}

/**
 * A list's rows opened in place: under a row, what its record holds or what points at it — its lines (a table of lines
 * of the page's, as the source loads the record) or another model's records with their link to it (as a related list's,
 * asked of the source's `list`) — a page at a time, to read: a toggle before the row's name (in its card on a phone),
 * Right and Left on the row, several open at once, each kept open while the list asks again. Null where the list opens
 * nothing, or its source cannot answer (no `load` for lines, no `list` for records): hidden, never disabled.
 */
export function detailRows(context: DetailContext): DetailRows | null {
  const { node, page, el, labels, fill, number } = context;
  const detail = node.detail;
  const source = context.dataSource;
  if (!detail) return null;
  const linesDef = detail.lines ? page.fields[detail.lines] : undefined;
  const lines = linesDef?.type === 'one2many' ? linesDef : undefined;
  if (detail.lines ? !lines || !source?.load : !source?.list || !detail.model || !detail.field) return null;
  const fields = (lines ? lines.fields : detail.fields) ?? {};
  const title = detail.title ?? lines?.label ?? labels.detailTitle;
  const limit = detail.limit ?? 5;
  const sort: SortOrder[] = detail.sort ?? [];
  const inner: ListNode = { type: 'list', id: `${node.id}-detail`, columns: detail.columns, choose: false, pageSize: limit, ...(detail.cells ? { cells: detail.cells } : {}) };
  const innerPage: Page = { ...page, id: `${page.id}.${node.id}-detail`, data: { kind: 'record', model: lines ? lines.relation : (detail.model as string) }, fields: fields as Page['fields'], layout: inner };
  const cells = context.cellsOf(innerPage, inner);
  /** What is asked of each record: the columns, and what an amount needs to be read (its currency). */
  const reads = [...new Set(detail.columns.flatMap((name) => [name, ...moneyReads(fields[name])]))];
  const atEnd = (name: string) => (detail.cells?.[name]?.align ? detail.cells[name]?.align === 'end' : NUMBERS.has(fields[name]?.type ?? ''));
  /** A line that is a section's heading or a note (the table's `lineKinds`): its words across the row. */
  const kinds = lines?.lineKinds;
  const kindOf = (values: Values) => (!kinds ? null : values[kinds.field] === (kinds.section ?? 'section') ? 'section' : values[kinds.field] === (kinds.note ?? 'note') ? 'note' : null);
  /** The rows open, by their record's id: kept while the list asks again. */
  const open = new Map<string, Opened>();
  /** A row's toggles: before its name, and in its card — found in it, so a row the window lets go is never held here. */
  const togglesOf = (tr: HTMLElement) => tr.querySelectorAll<HTMLButtonElement>('.fd-list-detail-toggle');

  /** A page of what a row opens to: its lines, sorted and cut here; its records, asked. */
  async function pageOf(id: RecordId, opened: Opened): Promise<{ rows: Values[]; total: number }> {
    if (lines && source?.load) {
      if (!opened.lines) {
        const answer = loadedRecordOf(await source.load({ model: context.model, id, fields: { [detail?.lines as string]: lines } }));
        const held = answer.values[detail?.lines as string];
        opened.lines = Array.isArray(held) ? (held as Line[]) : [];
      }
      const all = opened.lines.map((line) => line.values).filter((values) => matchesFilter(values, []));
      const sorted = sort.length ? [...all].sort((a, b) => sort.reduce((by, key) => by || compare(a[key.field], b[key.field], key.desc), 0)) : all;
      return { rows: sorted.slice(opened.offset, opened.offset + limit), total: all.length };
    }
    const answer = await (source as Required<Pick<DataSource, 'list'>>).list({ model: detail?.model as string, fields: reads, filter: [{ field: detail?.field as string, op: '=', value: id }], sort, offset: opened.offset, limit });
    return { rows: answer.records.map((record) => record.values), total: answer.total };
  }

  /** The row under a record's row, drawn as it opens: a table of what it opens to (read only), its pager past a page. */
  function opening(id: RecordId, name: string, level: string | undefined): Opened {
    const named = fill(labels.detailOf, { title, name });
    const grid = el('div', { class: 'fd-list-detail-table', role: 'table', 'aria-label': named });
    grid.style.setProperty('--fd-detail-columns', String(detail?.columns.length ?? 1));
    const head = el(
      'div',
      { class: 'fd-list-detail-row fd-list-detail-head', role: 'row' },
      ...(detail?.columns ?? []).map((name) => el('div', { role: 'columnheader', class: atEnd(name) ? 'fd-num' : undefined }, fields[name]?.label ?? name))
    );
    const rows = el('div', { role: 'rowgroup' });
    grid.append(el('div', { role: 'rowgroup' }, head), rows);
    const none = el('p', { class: 'fd-list-detail-none', hidden: '' }, labels.relatedNone);
    const retry = el('button', { type: 'button', class: 'fd-button fd-button-link' }, labels.retry);
    const why = el('span', {});
    const failed = el('p', { class: 'fd-list-detail-failed', role: 'alert', hidden: '' }, labels.loadFailed, why, ' ', retry);
    const range = el('span', { class: 'fd-pager-text' });
    const previous = el('button', { type: 'button', class: 'fd-button fd-pager-button', 'aria-label': labels.previousPage }, '‹');
    const next = el('button', { type: 'button', class: 'fd-button fd-pager-button', 'aria-label': labels.nextPage }, '›');
    const pager = el('div', { class: 'fd-pager fd-list-detail-pager', role: 'group', 'aria-label': named, hidden: '' }, range, previous, next);
    const box = el('div', { class: 'fd-list-detail-box' }, el('div', { class: 'fd-list-detail-scroll' }, grid), none, failed, pager);
    const cell = el('td', { colspan: String(context.span()) }, box);
    /** Whether it was drawn once: a wait after that (another page, the list asking again) is a refresh. */
    let drew = false;
    // Not a record's row: the list's keys and presses pass over it; its level its record's, so a group closing takes it away.
    const row = el('tr', { class: 'fd-list-detail', 'data-aside': '', 'data-detail-of': String(id), 'data-level': level }, cell);
    const opened: Opened = {
      row,
      name,
      offset: 0,
      asking: 0,
      async draw() {
        const mine = ++opened.asking;
        // Its wait, as every wait is (loading.ts): drawn the first time, then another page of it (what is shown kept, a bar
        // over it, unless the page says otherwise); a failure in its own words, the source's after them, and Retry.
        const wait = startLoading(box, drew ? 'refresh' : 'first', context.loading, {
          part: `${node.id}-detail`,
          failed: (_message, _retry, said) => {
            // Its lines asked again on Retry: a record that could not be read is read again.
            opened.lines = undefined;
            why.textContent = said ? ` ${said}` : '';
            failed.hidden = false;
            none.hidden = true;
            return true;
          },
        });
        try {
          const { rows: found, total } = await pageOf(id, opened);
          if (mine !== opened.asking) return wait.stop();
          // Past the end, as when the last line of the last page went: back to the page that is left.
          if (!found.length && total > 0 && opened.offset > 0) {
            opened.offset = Math.floor((total - 1) / limit) * limit;
            wait.stop();
            return opened.draw();
          }
          await wait.done(() => drawFound(found, total));
        } catch (error) {
          if (mine !== opened.asking) return wait.stop();
          wait.fail(error);
        }
        /** A page of what it opens to drawn, its pager under it past a page. */
        function drawFound(found: Values[], total: number) {
          drew = true;
          const columns = detail?.columns ?? [];
          rows.replaceChildren(
            ...found.map((values) => {
              const kind = kindOf(values);
              // A section's heading or a note: its words across every column.
              if (kind && kinds) return el('div', { class: 'fd-list-detail-row', role: 'row', 'data-kind': kind }, el('div', { role: 'cell', class: 'fd-list-detail-across', 'aria-colspan': String(columns.length) }, String(values[kinds.text] ?? '')));
              return el('div', { class: 'fd-list-detail-row', role: 'row' }, ...columns.map((column) => el('div', { role: 'cell', class: atEnd(column) ? 'fd-num' : undefined }, ...cells.draw(column, values))));
            })
          );
          failed.hidden = true;
          none.hidden = total > 0;
          grid.hidden = total === 0;
          pager.hidden = total <= limit;
          range.textContent = fill(labels.range, { from: number(opened.offset + 1), to: number(Math.min(opened.offset + found.length, total)), total: number(total) });
          previous.disabled = opened.offset === 0;
          next.disabled = opened.offset + limit >= total;
        }
      },
    };
    retry.addEventListener('click', () => void opened.draw());
    previous.addEventListener('click', () => {
      opened.offset = Math.max(0, opened.offset - limit);
      void opened.draw();
    });
    next.addEventListener('click', () => {
      opened.offset += limit;
      void opened.draw();
    });
    return opened;
  }

  /** Open a record's row, or close it: what it opens to under it, asked as it opens; its toggles say which. */
  function toggle(tr: HTMLElement, show: boolean) {
    const id = tr.dataset['id'] ?? '';
    const was = open.get(id);
    if (show && !was) {
      const record = { id: (tr as HTMLTableRowElement & { fdId?: RecordId }).fdId ?? id, name: tr.dataset['detailName'] ?? id };
      const opened = opening(record.id, record.name, tr.dataset['level']);
      open.set(id, opened);
      tr.after(opened.row);
      void opened.draw();
    } else if (!show && was) {
      open.delete(id);
      was.row.remove();
    }
    for (const button of togglesOf(tr)) button.setAttribute('aria-expanded', String(open.has(id)));
  }

  return {
    wire(tr, record, name) {
      const id = String(record.id);
      // Its own id kept, a number as a number: what it opens to is asked by it.
      (tr as HTMLTableRowElement & { fdId?: RecordId }).fdId = record.id;
      tr.dataset['detailName'] = name;
      tr.toggleAttribute('data-opens', true);
      const named = fill(labels.detailOf, { title, name });
      const make = (words: boolean) => {
        const button = el(
          'button',
          { type: 'button', class: words ? 'fd-list-detail-toggle fd-list-detail-words' : 'fd-list-detail-toggle', 'aria-expanded': String(open.has(id)), 'aria-label': named, ...(words ? {} : { tabindex: '-1' }) },
          ...(words ? [el('span', { 'aria-hidden': 'true' }, title)] : [])
        );
        button.addEventListener('click', (event) => {
          // Its own press, never its row's.
          event.stopPropagation();
          toggle(tr, !open.has(id));
        });
        return button;
      };
      // Before the name, as a parent's toggle; in the card, with its words, where the row is a card.
      const first = make(false);
      tr.querySelector<HTMLElement>(':scope > td[data-col]')?.prepend(first);
      const card = tr.querySelector<HTMLElement>(':scope > td.fd-list-card .fd-list-card-body') ?? tr.querySelector<HTMLElement>(':scope > td.fd-list-card');
      const second = card ? make(true) : null;
      if (second) card?.append(second);
    },
    drawn(body, holds) {
      for (const [id, opened] of [...open]) {
        const tr = [...body.querySelectorAll<HTMLElement>(':scope > .fd-list-row')].find((one) => one.dataset['id'] === id && !one.closest('[hidden]'));
        if (!tr) {
          // Out of the page, its record still held: asked again once its row is drawn.
          if (holds?.(id)) opened.stale = true;
          else open.delete(id);
          continue;
        }
        tr.after(opened.row);
        (opened.row.firstElementChild as HTMLTableCellElement).colSpan = context.span();
        opened.stale = false;
        void opened.draw();
      }
    },
    placed(tr) {
      const opened = open.get(tr.dataset['id'] ?? '');
      if (!opened) return;
      tr.after(opened.row);
      (opened.row.firstElementChild as HTMLTableCellElement).colSpan = context.span();
      if (!opened.stale) return;
      opened.stale = false;
      void opened.draw();
    },
    key(tr, show) {
      if (!tr.hasAttribute('data-opens')) return false;
      toggle(tr, show);
      return true;
    },
    spread(body) {
      for (const cell of body.querySelectorAll<HTMLTableCellElement>(':scope > .fd-list-detail > td')) cell.colSpan = context.span();
    },
  };
}
