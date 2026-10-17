import type { JsonValue, ListNode, Page } from '@fieldia/core';
import { drawIcon, type IconSet, type PreferenceStore } from '@fieldia/widgets';
import type { El } from './dom';
import type { ViewerLabels } from './labels';

/**
 * The columns a person shapes in a list with `optionalColumns` (list.ts; the
 * columns part, columns-part.ts): which show, in what order and how wide — chosen in the Columns
 * menu at the header's end (a box to show or hide each column the page lets
 * them hide, Move up and Move down, or Alt with an arrow, for every column,
 * and Reset), or by dragging a header's edge (its grip takes the arrow keys
 * too) — and kept for them in the viewer's `preferences`, by page and list, as
 * a table of lines keeps its own: `[{ colId, width, hide }]`, in their order.
 */

/** A width a person may give a column, in pixels. */
const NARROWEST = 48;
const WIDEST = 1200;
/** How far an arrow key on a column's grip moves its edge. */
const STEP = 16;

export interface ColumnsContext {
  page: Page;
  node: ListNode;
  doc: Document;
  el: El;
  labels: ViewerLabels;
  fill: (template: string, values: Record<string, string | number>) => string;
  preferences: PreferenceStore;
  uid: (id: string) => string;
  icons?: IconSet;
  /** Where the menu opens: the list, round the table's scroll. */
  host: () => HTMLElement;
  /** The columns shown, their order or a width changed: `kept`, once the person is done (a drag let go). */
  changed: (kept: boolean) => void;
}

export interface ColumnChoices {
  /** The columns shown, in the person's order. */
  shown(): string[];
  /** Every column in the person's order, those hidden in their places. */
  order(): string[];
  /** The person's width for a column, in pixels; null for the page's. */
  width(name: string): number | null;
  /** The header's button that opens the Columns menu. */
  button: HTMLButtonElement;
  /** A column's grip, at its header's end, to size it. */
  grip(name: string, header: HTMLElement): HTMLElement;
  /** Close the menu, as the list goes. */
  destroy(): void;
}

/** Where a list's columns are kept for the person: by page and list, as a table of lines keeps its own. */
export const columnsKey = (page: Page, node: ListNode) => `${page.id}.${node.id}.columns`;

/** The columns a person may show, hide, order and size, where the list lets them (`optionalColumns`); null where it does not. */
export function columnChoices(context: ColumnsContext): ColumnChoices | null {
  const { page, node, el, labels, fill, preferences, doc } = context;
  if (!node.optionalColumns) return null;
  const optional = node.optionalColumns;
  const key = columnsKey(page, node);
  const label = (name: string) => page.fields[name]?.label ?? name;
  let order: string[] = [];
  let hidden = new Set<string>();
  let widths = new Map<string, number>();

  /** The page's columns, as it lays them out: those it starts hidden hidden. */
  function pagesOwn() {
    order = [...node.columns];
    hidden = new Set(node.columns.filter((name) => optional[name] === 'hide'));
    widths = new Map();
  }
  /** The person's columns, as they were kept: a column the page has since added in its place, one it took away gone. */
  function read() {
    pagesOwn();
    const kept = preferences.get(key);
    if (!Array.isArray(kept)) return;
    const known = (kept as { colId?: unknown; width?: unknown; hide?: unknown }[]).filter(
      (one, i, all) => typeof one?.colId === 'string' && node.columns.includes(one.colId) && all.findIndex((other) => other?.colId === one.colId) === i
    );
    const ids = known.map((one) => one.colId as string);
    // A column the person never saw goes where the page puts it: after the column it follows there.
    order = [...ids];
    for (const name of node.columns) {
      if (order.includes(name)) continue;
      const before = node.columns.slice(0, node.columns.indexOf(name)).reverse().find((other) => order.includes(other));
      order.splice(before ? order.indexOf(before) + 1 : 0, 0, name);
    }
    for (const one of known) {
      const name = one.colId as string;
      // Only a column the page lets them hide stays hidden.
      if (name in optional) {
        if (one.hide === true) hidden.add(name);
        else hidden.delete(name);
      }
      if (typeof one.width === 'number' && Number.isFinite(one.width)) widths.set(name, clamp(one.width));
    }
    // Never a list of no column.
    if (order.every((name) => hidden.has(name))) hidden.delete(order[0]);
  }
  const clamp = (width: number) => Math.round(Math.max(NARROWEST, Math.min(WIDEST, width)));
  const keep = () => preferences.set(key, order.map((colId) => ({ colId, width: widths.get(colId) ?? null, hide: hidden.has(colId) })) as unknown as JsonValue);
  const shown = () => order.filter((name) => !hidden.has(name));
  read();

  // ---- the Columns menu: a box for each column the person may hide, Move up and Move down for every one, Reset ----

  const menuId = context.uid(`${node.id}-columns`);
  // Three columns side by side, unless the app's icons have their own "columns".
  const icon = drawIcon(doc, 'columns', { columns: '<rect x="3.5" y="4.5" width="17" height="15" rx="1.5"/><path d="M9.5 4.5v15M14.5 4.5v15"/>', ...context.icons });
  icon?.setAttribute('aria-hidden', 'true');
  const button = el(
    'button',
    { type: 'button', class: 'fd-list-columns-button', id: `${menuId}-button`, 'aria-haspopup': 'dialog', 'aria-expanded': 'false', 'aria-controls': menuId, 'aria-label': labels.columns, title: labels.columns },
    ...(icon ? [icon] : [])
  );
  const items = el('ul', { class: 'fd-list-columns-items' });
  const reset = el('button', { type: 'button', class: 'fd-button fd-button-link fd-list-columns-reset' }, labels.resetColumns);
  const menu = el('div', { class: 'fd-list-columns-menu', id: menuId, role: 'dialog', 'aria-label': labels.columns, hidden: '' }, el('div', { class: 'fd-list-columns-heading', 'aria-hidden': 'true' }, labels.columns), items, reset);
  let placed = false;

  /** The menu's rows, as the columns are now; the focus back where it was, on the row of `focus` when given. */
  function drawMenu(focus?: { name: string; part: 'box' | 'up' | 'down' }) {
    items.replaceChildren(
      ...order.map((name, i) => {
        const may = name in optional;
        const box = may ? el('input', { type: 'checkbox', class: 'fd-list-checkbox', id: `${menuId}-${name}` }) : null;
        if (box) {
          box.checked = !hidden.has(name);
          box.addEventListener('change', () => {
            // The last column shown stays: its box goes back.
            if (!box.checked && shown().length === 1 && shown()[0] === name) {
              box.checked = true;
              return;
            }
            if (box.checked) hidden.delete(name);
            else hidden.add(name);
            done({ name, part: 'box' });
          });
        }
        const words = box ? el('label', { class: 'fd-list-columns-name', for: `${menuId}-${name}` }, el('bdi', {}, label(name))) : el('span', { class: 'fd-list-columns-name', 'data-fixed': '' }, el('bdi', {}, label(name)));
        // Hide, never disable: the first has no Move up, the last no Move down.
        const up = el('button', { type: 'button', class: 'fd-list-columns-move', 'data-move': 'up', 'aria-label': fill(labels.moveColumnUp, { label: label(name) }), title: fill(labels.moveColumnUp, { label: label(name) }), hidden: i === 0 ? '' : undefined }, '↑');
        const down = el('button', { type: 'button', class: 'fd-list-columns-move', 'data-move': 'down', 'aria-label': fill(labels.moveColumnDown, { label: label(name) }), title: fill(labels.moveColumnDown, { label: label(name) }), hidden: i === order.length - 1 ? '' : undefined }, '↓');
        up.addEventListener('click', () => move(name, -1, 'up'));
        down.addEventListener('click', () => move(name, 1, 'down'));
        const row = el('li', { class: 'fd-list-columns-item', 'data-col': name }, ...(box ? [box] : [el('span', { class: 'fd-list-columns-room', 'aria-hidden': 'true' })]), words, el('span', { class: 'fd-list-columns-moves' }, up, down));
        // Alt with an arrow moves the column whose row has the focus, as the buttons do.
        row.addEventListener('keydown', (event) => {
          if (!event.altKey || (event.key !== 'ArrowUp' && event.key !== 'ArrowDown')) return;
          event.preventDefault();
          const on = (event.target as HTMLElement).dataset['move'];
          move(name, event.key === 'ArrowUp' ? -1 : 1, on === 'up' || on === 'down' ? on : 'box');
        });
        return row;
      })
    );
    reset.hidden = !preferences.get(key);
    if (!focus) return;
    const row = items.querySelector<HTMLElement>(`[data-col="${focus.name}"]`);
    const wanted = focus.part === 'box' ? row?.querySelector<HTMLElement>('input') : row?.querySelector<HTMLElement>(`[data-move="${focus.part}"]:not([hidden])`);
    (wanted ?? row?.querySelector<HTMLElement>('input, [data-move]:not([hidden])'))?.focus();
  }

  function move(name: string, by: -1 | 1, part: 'box' | 'up' | 'down') {
    const at = order.indexOf(name);
    const to = at + by;
    if (to < 0 || to >= order.length) return;
    order.splice(at, 1);
    order.splice(to, 0, name);
    done({ name, part });
  }

  /** A choice made: kept, the table drawn again, the menu as it now is, the focus where it was. */
  function done(focus: { name: string; part: 'box' | 'up' | 'down' }) {
    keep();
    context.changed(true);
    drawMenu(focus);
  }

  reset.addEventListener('click', () => {
    preferences.set(key, null);
    pagesOwn();
    context.changed(true);
    drawMenu();
    button.focus();
    close(false);
  });

  const outside = (event: Event) => {
    if (!menu.contains(event.target as Node) && !button.contains(event.target as Node)) close(false);
  };
  function open() {
    if (!placed) {
      context.host().append(menu);
      placed = true;
    }
    drawMenu();
    menu.hidden = false;
    // Under the button, from its end: inside the list, wherever the table has scrolled to.
    const host = context.host().getBoundingClientRect();
    const at = button.getBoundingClientRect();
    menu.style.insetBlockStart = `${at.bottom - host.top + 4}px`;
    const rtl = context.host().closest('[dir]')?.getAttribute('dir') === 'rtl';
    menu.style.insetInlineEnd = `${Math.max(0, rtl ? at.left - host.left : host.right - at.right)}px`;
    button.setAttribute('aria-expanded', 'true');
    doc.addEventListener('pointerdown', outside, true);
    // On the first box to tick, or the first column's arrows where none may be hidden.
    (items.querySelector<HTMLElement>('input') ?? items.querySelector<HTMLElement>('[data-move]:not([hidden])'))?.focus();
  }
  function close(refocus: boolean) {
    if (menu.hidden) return;
    menu.hidden = true;
    button.setAttribute('aria-expanded', 'false');
    doc.removeEventListener('pointerdown', outside, true);
    if (refocus) button.focus();
  }
  button.addEventListener('click', (event) => {
    // The header's own press is no sort, nor the row's.
    event.stopPropagation();
    if (menu.hidden) open();
    else close(false);
  });
  menu.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      // Escape closes the menu, not the dialog round the list.
      event.preventDefault();
      event.stopPropagation();
      close(true);
    }
  });
  menu.addEventListener('focusout', (event) => {
    const to = event.relatedTarget as Node | null;
    if (to && !menu.contains(to) && to !== button) close(false);
  });

  // ---- a column's grip: dragged, or moved with the arrow keys, it sizes the column ----

  function grip(name: string, header: HTMLElement): HTMLElement {
    const handle = el('span', {
      class: 'fd-list-grip',
      role: 'separator',
      tabindex: '0',
      'aria-orientation': 'vertical',
      'aria-label': fill(labels.resizeColumn, { label: label(name) }),
      'aria-valuemin': String(NARROWEST),
      'aria-valuemax': String(WIDEST),
    });
    const rtl = () => header.closest('[dir]')?.getAttribute('dir') === 'rtl';
    const now = () => widths.get(name) ?? Math.round(header.getBoundingClientRect().width);
    const say = () => handle.setAttribute('aria-valuenow', String(now()));
    const size = (width: number, kept: boolean) => {
      widths.set(name, clamp(width));
      if (kept) keep();
      context.changed(kept);
      say();
    };
    handle.addEventListener('pointerdown', (event) => {
      if (event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();
      const from = event.clientX;
      const start = now();
      const way = rtl() ? -1 : 1;
      handle.setPointerCapture?.(event.pointerId);
      handle.setAttribute('data-dragging', '');
      const moved = (next: PointerEvent) => size(start + way * (next.clientX - from), false);
      const letGo = (last: PointerEvent) => {
        handle.removeEventListener('pointermove', moved);
        handle.removeEventListener('pointerup', letGo);
        handle.removeEventListener('pointercancel', letGo);
        handle.removeAttribute('data-dragging');
        size(start + way * (last.clientX - from), true);
      };
      handle.addEventListener('pointermove', moved);
      handle.addEventListener('pointerup', letGo);
      handle.addEventListener('pointercancel', letGo);
    });
    // A press on the grip is no press of its header.
    handle.addEventListener('click', (event) => event.stopPropagation());
    // Twice: back to the page's width.
    handle.addEventListener('dblclick', (event) => {
      event.stopPropagation();
      widths.delete(name);
      keep();
      context.changed(true);
      say();
    });
    handle.addEventListener('keydown', (event) => {
      // The edge moves the way the arrow points: towards the column's end widens it, on either side of the page.
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      event.preventDefault();
      const wider = (event.key === 'ArrowRight') !== rtl();
      size(now() + (wider ? STEP : -STEP), true);
    });
    handle.addEventListener('focus', say);
    return handle;
  }

  return {
    shown,
    order: () => [...order],
    width: (name) => widths.get(name) ?? null,
    button,
    grip,
    destroy() {
      doc.removeEventListener('pointerdown', outside, true);
      menu.remove();
    },
  };
}
