import type { DataSource, ListNode, RecordId, ResolvedFilter, SortOrder } from '@fieldia/core';
import { startLoading, type Loading, type Wait } from '@fieldia/widgets';
import type { El } from './dom';
import type { ViewerLabels } from './labels';
import type { Row } from './list-groups';

export interface TreeContext {
  node: ListNode;
  model: string;
  dataSource: DataSource | undefined;
  el: El;
  labels: ViewerLabels;
  fill: (template: string, values: Record<string, string | number>) => string;
  number: (n: number) => string;
  /** The link to the list's own records its rows nest under (`parentField`). */
  parentField: string;
  /** What every ask keeps to: the list's fixed conditions and its search. */
  filter: () => ResolvedFilter[];
  sort: () => SortOrder[];
  /** What the list asks of each record. */
  fields: string[];
  pageSize: number;
  /** A record's row, as the list draws one, and the record a row is of. */
  row: (record: Row) => HTMLTableRowElement;
  recordOf: (tr: Element) => Row | undefined;
  /** How many columns a row spans. */
  span: () => number;
  /** How the list waits (loading.ts in @fieldia/widgets): a parent's rows as they come (`more`). */
  loading?: Loading;
  /** Whether a search is on: the tree is then its matches, each said under its parent. */
  searching: () => boolean;
  /** Rows came or went. */
  changed: () => void;
  /** The keys from a row to the one shown beside it, down or up: a Show more's arrows, as a record's row's. */
  step?: (tr: HTMLElement, down: boolean) => void;
}

/** A tree of records too big for a page (`loadChildren`), wired into a list's rows under their parent. */
export interface LazyTree {
  /** What the list's own rows are asked with: those with no parent, while no search is on. */
  top(): ResolvedFilter[];
  /** The rows drawn: each one's children counted and its toggle where it has some, those open before opened again. */
  drawn(body: HTMLElement): Promise<void>;
  /** Right or Left on a row: opened or closed; false where nothing is under it. */
  key(tr: HTMLElement, open: boolean): boolean;
  /** Every parent closed (Collapse all). */
  closeAll(body: HTMLElement): void;
}


/**
 * A tree of records loaded as it is opened — a chart of accounts, a project's work breakdown, a development's
 * buildings and units — where the list's rows nest under their parent (`parentField`) and their children come as a
 * parent opens (`loadChildren`): the list's pages are its records with no parent, each parent's children asked when it
 * opens, a page at a time with "Show 40 more", their own children counted so each says whether it opens; the count
 * of each one's children asked of the source's `groups` in one ask for a page of rows (without it, each row offers to
 * open, and one with none loses its toggle as it opens). Opened parents stay open as the list asks again. Under a
 * search, its matches, each with its parent named ("in Current assets"). Null where the source cannot list.
 */
export function lazyTree(context: TreeContext): LazyTree | null {
  const { el, labels, fill, number, parentField, model } = context;
  const source = context.dataSource;
  if (!source?.list) return null;
  /** The parents open, by id: opened again, in order, as the list asks again. */
  const opened = new Set<string>();
  /** Each ask of the rows drawn counts on: what an older one answers is let be. */
  let drawing = 0;

  const depthOf = (tr: Element) => Number((tr as HTMLElement).dataset['depth'] ?? 0);
  /** A row's record's id, as it was given: a number as a number. */
  const idOf = (tr: Element): RecordId => context.recordOf(tr)?.id ?? (tr as HTMLElement).dataset['id'] ?? '';
  const rowsOf = (body: HTMLElement) => [...body.children] as HTMLElement[];
  /** Each row hidden under a closed parent, shown under an open one; what opened under a row with it. */
  const fold = (body: HTMLElement) => {
    const stack: { depth: number; open: boolean }[] = [];
    let last = false;
    for (const tr of rowsOf(body)) {
      if (tr.hasAttribute('data-aside')) {
        tr.hidden = last;
        continue;
      }
      const depth = depthOf(tr);
      while (stack.length && stack[stack.length - 1].depth >= depth) stack.pop();
      tr.hidden = last = stack.some((parent) => !parent.open);
      if (tr.hasAttribute('data-children')) stack.push({ depth, open: opened.has(tr.dataset['id'] ?? '') });
    }
  };

  /** How many children each of these records has, by id: asked of `groups` at once; null where the source cannot tell. */
  async function counts(ids: RecordId[]): Promise<Map<string, number> | null> {
    if (!source?.groups || !ids.length) return null;
    const groups = await source.groups({ model, field: parentField, filter: [...context.filter(), { field: parentField, op: 'in', value: ids }] });
    return new Map(groups.filter((group) => group.value !== null).map((group) => [String(group.value), group.count]));
  }

  /** Rows marked at a depth, a toggle before the name of each with children (each, where they cannot be counted). */
  async function mark(rows: HTMLElement[], depth: number, body: HTMLElement) {
    for (const tr of rows) {
      tr.dataset['depth'] = String(depth);
      tr.setAttribute('data-tree', '');
      tr.style.setProperty('--fd-depth', String(depth));
      // Its toggle named as the row is: its name's words.
      tr.dataset['treeName'] = tr.querySelector(':scope > td[data-name]')?.textContent ?? tr.dataset['id'] ?? '';
    }
    const known = await counts(rows.map(idOf));
    for (const tr of rows) {
      const id = tr.dataset['id'] ?? '';
      const n = known ? (known.get(id) ?? 0) : null;
      const cell = tr.querySelector<HTMLElement>(':scope > td[data-name]');
      if (n === 0) {
        cell?.prepend(el('span', { class: 'fd-list-twisty-room', 'aria-hidden': 'true' }));
        continue;
      }
      tr.setAttribute('data-children', n === null ? '' : String(n));
      const twisty = el('button', { type: 'button', class: 'fd-list-twisty', tabindex: '-1', 'aria-expanded': 'false', 'aria-label': tr.dataset['treeName'] ?? id });
      twisty.addEventListener('click', (event) => {
        // Its own press, never its row's.
        event.stopPropagation();
        void toggle(tr, !opened.has(id), body);
      });
      cell?.prepend(twisty);
    }
  }

  /**
   * A parent's next rows' wait (`more`): "Loading more…" in a row of its own where they will come, at their depth — its
   * Show more out of sight meanwhile — and, failed, said there with Retry.
   */
  const waitAt = (region: HTMLElement, parent: HTMLElement, after: Element, retry: () => void) =>
    startLoading(region, 'more', context.loading, {
      part: `${context.node.id}-${parent.dataset['id'] ?? ''}`,
      retry,
      place: (loader) => {
        const row = el('tr', { class: 'fd-list-tree-more', 'data-aside': '' }, el('td', { colspan: String(context.span()) }, loader));
        row.style.setProperty('--fd-depth', String(depthOf(parent) + 1));
        after.after(row);
        return row;
      },
    });

  /** A page of a parent's children, from `offset`, put under it — after those of its already there — and a row for the rest. */
  async function children(parent: HTMLElement, offset: number, body: HTMLElement, after: Element, wait: Wait): Promise<boolean> {
    const id = idOf(parent);
    const answer = await (source as Required<Pick<DataSource, 'list'>>).list({ model, fields: context.fields, filter: [...context.filter(), { field: parentField, op: '=', value: id }], sort: context.sort(), offset, limit: context.pageSize });
    if (!parent.isConnected) {
      wait.stop();
      return false;
    }
    await wait.done();
    const rows = answer.records.map((record) => context.row(record));
    const left = answer.total - offset - answer.records.length;
    const more: HTMLElement[] = [];
    if (left > 0) {
      const button = el('button', { type: 'button', class: 'fd-button fd-button-link' }, fill(labels.loadMore, { n: number(Math.min(left, context.pageSize)) }));
      const moreRow = el('tr', { class: 'fd-list-tree-more', 'data-aside': '' }, el('td', { colspan: String(context.span()) }, button));
      moreRow.style.setProperty('--fd-depth', String(depthOf(parent) + 1));
      const next = async () => {
        // Pressed with the keys on it, they go on to the first of the rows that came — else to the Show more after them —
        // where they were not put elsewhere meanwhile. 0.35 looked for the row before it once it was gone: the page's.
        const doc = moreRow.ownerDocument;
        const held = moreRow.contains(doc.activeElement);
        const wait = waitAt(moreRow, parent, moreRow, () => void next());
        try {
          await children(parent, offset + answer.records.length, body, moreRow, wait);
          const came = moreRow.nextElementSibling as HTMLElement | null;
          const lost = held && (moreRow.contains(doc.activeElement) || doc.activeElement === doc.body);
          moreRow.remove();
          if (lost) (came?.classList.contains('fd-list-row') ? came : came?.querySelector('button'))?.focus();
        } catch (error) {
          wait.fail(error);
        }
      };
      button.addEventListener('click', () => void next());
      button.addEventListener('keydown', (event) => {
        if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
        event.preventDefault();
        context.step?.(moreRow, event.key === 'ArrowDown');
      });
      more.push(moreRow);
    }
    after.after(...rows, ...more);
    await mark(rows, depthOf(parent) + 1, body);
    // Where none came, it opens to nothing: no toggle left to press.
    if (!offset && !answer.records.length) {
      parent.removeAttribute('data-children');
      parent.querySelector(':scope > td[data-name] > .fd-list-twisty')?.replaceWith(el('span', { class: 'fd-list-twisty-room', 'aria-hidden': 'true' }));
      opened.delete(parent.dataset['id'] ?? '');
    }
    fold(body);
    context.changed();
    return rows.length > 0;
  }

  /** A parent opened — its children asked the first time — or closed. */
  async function toggle(tr: HTMLElement, open: boolean, body: HTMLElement) {
    const id = tr.dataset['id'] ?? '';
    const twisty = tr.querySelector(':scope > td[data-name] > .fd-list-twisty');
    if (open) opened.add(id);
    else opened.delete(id);
    twisty?.setAttribute('aria-expanded', String(open));
    if (open && !tr.hasAttribute('data-loaded')) {
      tr.setAttribute('data-loaded', '');
      const wait = waitAt(tr, tr, tr, () => void toggle(tr, true, body));
      try {
        await children(tr, 0, body, tr, wait);
      } catch (error) {
        tr.removeAttribute('data-loaded');
        opened.delete(id);
        twisty?.setAttribute('aria-expanded', 'false');
        wait.fail(error);
      }
      return;
    }
    fold(body);
    context.changed();
  }

  return {
    top: () => (context.searching() ? [] : [{ field: parentField, op: 'notset', value: null }]),
    async drawn(body) {
      const mine = ++drawing;
      const rows = rowsOf(body).filter((tr) => tr.classList.contains('fd-list-row'));
      if (context.searching()) {
        // Its matches, each said under its parent.
        for (const tr of rows) {
          const link = context.recordOf(tr)?.values[parentField];
          const named = link && typeof link === 'object' && 'label' in (link as object) ? String((link as { label: unknown }).label) : '';
          if (named) tr.querySelector(':scope > td[data-name]')?.append(el('span', { class: 'fd-list-tree-in' }, fill(labels.treeIn, { name: named })));
        }
        return;
      }
      try {
        await mark(rows, 0, body);
      } catch {
        return;
      }
      // Those open before, opened again in their order: a parent's before its children's.
      for (const id of [...opened]) {
        if (mine !== drawing) return;
        const tr = rowsOf(body).find((one) => one.dataset['id'] === id && one.classList.contains('fd-list-row'));
        if (!tr || !tr.hasAttribute('data-children')) {
          opened.delete(id);
          continue;
        }
        opened.delete(id);
        await toggle(tr, true, body);
      }
    },
    key(tr, open) {
      if (!tr.hasAttribute('data-children')) return false;
      const body = tr.parentElement as HTMLElement;
      if (open !== opened.has(tr.dataset['id'] ?? '')) void toggle(tr, open, body);
      return true;
    },
    closeAll(body) {
      opened.clear();
      for (const twisty of body.querySelectorAll(':scope > .fd-list-row > td[data-name] > .fd-list-twisty')) twisty.setAttribute('aria-expanded', 'false');
      fold(body);
      context.changed();
    },
  };
}
