import { labelAt, type JsonValue, type ListNode, type Locale, type Page } from '@fieldia/core';
import { drawIcon, type IconSet, type PreferenceStore, type WidgetLabels } from '@fieldia/widgets';
import type { El } from './dom';
import type { ViewerLabels } from './labels';

/**
 * The columns a person shapes in a list with `optionalColumns` (list.ts; the
 * columns part, columns-part.ts): which show, in what order and how wide — chosen in the Columns
 * menu at the header's end (a box to show or hide each column the page lets
 * them hide, Move up and Move down, or Alt with an arrow, for every column,
 * and Reset), by dragging a header sideways to its place (a finger's long
 * press lifts it), or by dragging a header's edge (its grip takes the arrow
 * keys too) — and kept for them in the viewer's `preferences`, by page and
 * list, as a table of lines keeps its own: `[{ colId, width, hide }]`, in
 * their order. A column moved is said to a screen reader: "Phone moved to
 * place 2 of 8".
 */

/** A width a person may give a column, in pixels. */
const NARROWEST = 48;
const WIDEST = 1200;
/** How far an arrow key on a column's grip moves its edge. */
const STEP = 16;
/** How far a header pressed moves sideways before it is dragged: less, and the press sorts as before. */
const SLOP = 5;
/** How long a finger rests on a header before it lifts its column, in milliseconds: a tap sorts; a swipe scrolls. */
const LONG_PRESS = 500;
/** How far a resting finger may wander before it is a swipe the browser scrolls with, in pixels. */
const WANDER = 10;
/** Within this many pixels of a scrolled table's side, a column dragged scrolls it, up to SCROLL pixels a millisecond. */
const EDGE = 40;
const SCROLL = 0.9;

export interface ColumnsContext {
  page: Page;
  node: ListNode;
  doc: Document;
  el: El;
  labels: ViewerLabels;
  fill: (template: string, values: Record<string, string | number>) => string;
  /** The page's language: a column's label small inside a sentence where the page asks (`labelAt`) is written its way. */
  locale?: Locale;
  preferences: PreferenceStore;
  uid: (id: string) => string;
  icons?: IconSet;
  /** Where the menu opens: the list, round the table's scroll. */
  host: () => HTMLElement;
  /** The columns shown, their order or a width changed: `kept`, once the person is done (a drag let go). */
  changed: (kept: boolean) => void;
  /** The widgets' words: a column moved is said in a table's line's words (`movedTo`). Without them, it is not said. */
  widgetLabels?: WidgetLabels;
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
  /** A column's header pressed and dragged sideways moves the column to where it is let go (a finger's long press lifts it). */
  movable(name: string, header: HTMLElement): void;
  /**
   * The table's card, which scrolls sideways: the first column is held at its start and the Columns menu's cell at its
   * end (the columns' sheet), each parted by a rule from the columns going under it while there are some there —
   * `data-scrolled` once it has left its start, `data-more` while columns lie past its end.
   */
  scrolls(scroller: HTMLElement): void;
  /** Close the menu, as the list goes. */
  destroy(): void;
}

/** Where an element is on the screen. */
const rect = (target: Element) => target.getBoundingClientRect();

/** Where a list's columns are kept for the person: by page and list, as a table of lines keeps its own. */
export const columnsKey = (page: Page, node: ListNode) => `${page.id}.${node.id}.columns`;

/** The columns a person may show, hide, order and size, where the list lets them (`optionalColumns`); null where it does not. */
export function columnChoices(context: ColumnsContext): ColumnChoices | null {
  const { page, node, el, labels, fill, preferences, doc } = context;
  if (!node.optionalColumns) return null;
  const optional = node.optionalColumns;
  const key = columnsKey(page, node);
  const label = (name: string) => page.fields[name]?.label ?? name;
  /** A sentence naming a column, its label small inside it where the page asks (`lowerLabels`). */
  const naming = (template: string, name: string) => fill(template, { label: labelAt(template, 'label', page.lowerLabels, context.locale)(label(name)) });
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

  /** Where a column moved is said to a screen reader: in the list, there before anything is said in it. */
  const voice = el('span', { class: 'fd-sr-only', role: 'status', 'aria-live': 'polite' });
  const ready = () => {
    if (!voice.isConnected) context.host().append(voice);
  };
  /** "Phone moved to place 2 of 8": its place among `among`, as the person sees them. */
  const said = (name: string, among: string[]) => {
    const words = context.widgetLabels?.movedTo;
    if (words) voice.textContent = fill(words, { label: label(name), n: among.indexOf(name) + 1, total: among.length });
  };

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
        const up = el('button', { type: 'button', class: 'fd-list-columns-move', 'data-move': 'up', 'aria-label': naming(labels.moveColumnUp, name), title: naming(labels.moveColumnUp, name), hidden: i === 0 ? '' : undefined }, '↑');
        const down = el('button', { type: 'button', class: 'fd-list-columns-move', 'data-move': 'down', 'aria-label': naming(labels.moveColumnDown, name), title: naming(labels.moveColumnDown, name), hidden: i === order.length - 1 ? '' : undefined }, '↓');
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
    // Its place in the menu, the hidden columns among them, as the person reads it there.
    said(name, order);
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
    focusButton();
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
    ready();
    drawMenu();
    menu.hidden = false;
    // Under the button, from its end: inside the list, wherever the table has scrolled to.
    const host = rect(context.host());
    const at = rect(button);
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
    if (refocus) focusButton();
  }
  /**
   * The focus back on the menu's button, the table left where the person had scrolled it: the button stands at the
   * header's end, past the columns just shown, and the browser would scroll the table to its end to bring it in.
   */
  function focusButton() {
    button.focus({ preventScroll: true });
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
      'aria-label': naming(labels.resizeColumn, name),
      'aria-valuemin': String(NARROWEST),
      'aria-valuemax': String(WIDEST),
    });
    const rtl = () => header.closest('[dir]')?.getAttribute('dir') === 'rtl';
    const now = () => widths.get(name) ?? Math.round(rect(header).width);
    const say = () => handle.setAttribute('aria-valuenow', String(clamp(now())));
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
    // A separator that takes the focus says its width from the first: as kept, then as laid out once drawn.
    handle.setAttribute('aria-valuenow', String(widths.get(name) ?? NARROWEST));
    header.ownerDocument.defaultView?.requestAnimationFrame(() => {
      if (handle.isConnected) say();
    });
    return handle;
  }

  // ---- a column's header dragged sideways: its ghost under the pointer, the others making its place, a line where it goes ----

  /** A drag just let go or put back: the click its press ends with sorts nothing. */
  let dragged = false;
  /** The drag under way, put back if the list goes. */
  let under: Drag | null = null;
  const view = doc.defaultView;

  /**
   * The column lifted from its header, the pointer `from` across the screen: the ghost of its header follows the
   * pointer, the columns it passes slide aside — its own cells into the place it would take — and a line stands where
   * it goes; let go, it is there and kept; Escape, or the window left, puts it back. Laid out as the table is as it
   * lifts: by each column's width from the table's start, mirrored right to left. The first column shown is held in
   * view as the table scrolls sideways (the columns' sheet): a column moved before it is the one held there then.
   */
  function lift(name: string, header: HTMLElement, from: number): Drag | null {
    const table = header.closest('table');
    const row = header.parentElement;
    const list = context.host();
    const names = shown();
    if (!table || !row || names.length < 2 || !names.includes(name) || list.hasAttribute('data-as')) return null;
    const rtl = header.closest('[dir]')?.getAttribute('dir') === 'rtl';
    const scroller = header.closest<HTMLElement>('.fd-list-scroll');
    // Each column's width, and the room before the first: the box to choose a row, the parents' toggles.
    const heads = [...row.children].filter((cell) => !(cell as HTMLElement).hidden);
    const wide = new Map<string, number>();
    let lead = 0;
    for (const cell of heads) {
      const col = cell.getAttribute('data-col');
      if (col) wide.set(col, rect(cell).width);
      else if (!wide.size) lead += rect(cell).width;
    }
    const widthOf = (one: string) => wide.get(one) ?? 0;
    /** Where a column starts along the line, from the table's start, with the columns shown in `line`'s order. */
    const startIn = (line: string[], one: string) => lead + line.slice(0, line.indexOf(one)).reduce((sum, other) => sum + widthOf(other), 0);
    // Each column's cells: a row's by their column, the totals' by their places under the header's.
    const first = heads.findIndex((cell) => cell.hasAttribute('data-col'));
    const cells = new Map<string, HTMLElement[]>(names.map((one) => [one, []]));
    for (const tr of table.querySelectorAll<HTMLTableRowElement>(':scope > thead > tr, :scope > tbody > tr, :scope > tfoot > tr')) {
      const each = [...tr.children].filter((cell) => !(cell as HTMLElement).hidden) as HTMLElement[];
      if (tr.parentElement?.tagName === 'TFOOT') {
        if (each.length === heads.length) names.forEach((one, i) => cells.get(one)?.push(each[first + i]));
        continue;
      }
      for (const cell of each) cells.get(cell.getAttribute('data-col') ?? '')?.push(cell);
    }
    const others = names.filter((one) => one !== name);
    const pinned = names[0];
    const along = (x: number) => (rtl ? rect(table).right - x : x - rect(table).left);
    const across = (at: number) => (rtl ? rect(table).right - at : rect(table).left + at);
    /** How far the table is scrolled sideways from its start: the first column held at the start of what is seen. */
    const scrolled = () => {
      if (!scroller) return 0;
      const seen = rect(scroller);
      const whole = rect(table);
      return Math.max(0, rtl ? whole.right - seen.right : seen.left - whole.left);
    };
    /** The columns shown, this one at `place` among them. */
    const lineWith = (place: number) => [...others.slice(0, place), name, ...others.slice(place)];
    /** Its place for a pointer at x: past each column whose middle the pointer is past; over the first held in view, before or after it. */
    const placeAt = (x: number) => {
      const at = along(x);
      const held = lead + scrolled();
      if (name !== pinned && held > lead && at >= held && at < held + widthOf(pinned)) return at < held + widthOf(pinned) / 2 ? 0 : 1;
      return others.filter((one) => (one === pinned ? held : startIn(names, one)) + widthOf(one) / 2 < at).length;
    };
    let place = names.indexOf(name);
    let x = from;
    let over = false;
    let rolling = 0;
    const box = rect(header);
    const grab = from - box.left;
    const ghost = el('div', { class: 'fd-list-ghost', 'aria-hidden': 'true' }, el('bdi', {}, label(name)));
    ghost.style.width = `${box.width}px`;
    ghost.style.height = `${box.height}px`;
    const line = el('div', { class: 'fd-list-drop', 'aria-hidden': 'true' });

    /** The columns slid to show the line as it would be: each by how far its start moves. */
    function slide() {
      const next = lineWith(place);
      for (const one of names) {
        const by = startIn(next, one) - startIn(names, one);
        for (const cell of cells.get(one) ?? []) cell.style.transform = by ? `translateX(${rtl ? -by : by}px)` : '';
      }
    }
    /** The ghost under the pointer, the columns slid for where it is, the line at the start of the place it takes. */
    const draw = () => {
      if (over) return;
      const frame = rect(list);
      const left = frame.left + list.clientLeft;
      const top = frame.top + list.clientTop;
      const head = rect(header);
      ghost.style.left = `${x - grab - left}px`;
      ghost.style.top = `${head.top - top}px`;
      const next = placeAt(x);
      if (next !== place) {
        place = next;
        slide();
      }
      // Past the first column, which is held in view: a place under it is said at its end.
      const now = lineWith(place);
      const held = lead + scrolled();
      const at = across(place === 0 ? held : Math.max(startIn(now, name), held + widthOf(now[0])));
      const seen = scroller ? rect(scroller) : null;
      const bottom = Math.min(rect(table).bottom, seen?.bottom ?? Infinity);
      line.hidden = !!seen && (at < seen.left - 1 || at > seen.right + 1);
      line.style.left = `${at - left}px`;
      line.style.top = `${head.top - top}px`;
      line.style.height = `${Math.max(0, bottom - head.top)}px`;
    };
    /**
     * Near the table's end, or over the first column held at its start, the table scrolls that way, faster the nearer —
     * by the time each frame took, so an engine drawing fewer frames (WebKit) scrolls as fast; until it is at that end.
     */
    let last = 0;
    function roll(now: number) {
      rolling = 0;
      const took = last ? Math.min(64, now - last) : 16;
      last = 0;
      if (over || !scroller) return;
      const seen = rect(scroller);
      const fromStart = rtl ? seen.right - x : x - seen.left;
      const fromEnd = rtl ? x - seen.left : seen.right - x;
      const start = Math.max(EDGE, lead + (name === pinned ? 0 : widthOf(pinned)));
      const way = fromEnd < EDGE ? 1 : fromStart < start ? -1 : 0;
      if (!way) return;
      // How far it has gone from its start, right to left too (where scrollLeft runs below 0).
      const gone = Math.abs(scroller.scrollLeft);
      if (way > 0 ? gone >= scroller.scrollWidth - scroller.clientWidth - 0.5 : gone <= 0.5) return;
      const deep = way > 0 ? (EDGE - fromEnd) / EDGE : (start - fromStart) / start;
      // Safari may take a step in its own time: the next frame goes on whether this one has moved it yet or not.
      scroller.scrollLeft += (rtl ? -way : way) * Math.ceil(took * SCROLL * Math.min(1, Math.max(0.5, deep)));
      draw();
      last = now;
      rolling = view?.requestAnimationFrame(roll) ?? 0;
    }
    const keys = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      // Escape puts the column back, and nothing round the list hears it: not a dialog it is in.
      event.preventDefault();
      event.stopPropagation();
      drag.cancel();
    };
    const away = () => drag.cancel();
    /** The drag over: its ghost and line gone, the cells as they were, the click its press ends with no sort. */
    function end() {
      over = true;
      under = null;
      dragged = true;
      if (rolling) view?.cancelAnimationFrame(rolling);
      doc.removeEventListener('keydown', keys, true);
      view?.removeEventListener('blur', away);
      scroller?.removeEventListener('scroll', draw);
      ghost.remove();
      line.remove();
      list.removeAttribute('data-moving');
      for (const cell of cells.get(name) ?? []) cell.removeAttribute('data-lifted');
    }
    const still = () => {
      for (const each of cells.values()) for (const cell of each) cell.style.transform = '';
    };
    const drag: Drag = {
      to(at) {
        if (over) return;
        x = at;
        draw();
        if (!rolling) rolling = view?.requestAnimationFrame(roll) ?? 0;
      },
      drop(at) {
        if (over) return;
        x = at;
        draw();
        end();
        // At once in its place: the cells moved where they slid to, no slide back first.
        table.removeAttribute('data-sliding');
        still();
        if (place === names.indexOf(name)) return;
        const focused = header.contains(doc.activeElement);
        // Among every column, those hidden in their places: before the first shown, or right after the one shown before it.
        const rest = order.filter((one) => one !== name);
        const showing = rest.filter((one) => !hidden.has(one));
        rest.splice(place === 0 ? rest.indexOf(showing[0]) : rest.indexOf(showing[place - 1]) + 1, 0, name);
        order = rest;
        keep();
        context.changed(true);
        said(name, shown());
        // Its press's focus where it was: a cell moved in the table lets go of it.
        if (focused && !header.contains(doc.activeElement)) header.querySelector<HTMLElement>('button')?.focus({ preventScroll: true });
      },
      cancel() {
        if (over) return;
        end();
        // Back to their places, sliding.
        still();
        view?.setTimeout(() => {
          if (!under) table.removeAttribute('data-sliding');
        }, 200);
      },
    };
    ready();
    doc.getSelection()?.removeAllRanges();
    list.setAttribute('data-moving', '');
    table.setAttribute('data-sliding', '');
    for (const cell of cells.get(name) ?? []) cell.setAttribute('data-lifted', '');
    list.append(ghost, line);
    doc.addEventListener('keydown', keys, true);
    view?.addEventListener('blur', away);
    scroller?.addEventListener('scroll', draw, { passive: true });
    draw();
    under = drag;
    return drag;
  }

  /** A press of a mouse or a pen: past a few pixels sideways it lifts the column; less, the press sorts as before. */
  function pressed(name: string, header: HTMLElement, down: PointerEvent) {
    const { pointerId: id, clientX: from } = down;
    let drag: Drag | null = null;
    const follow = (event: PointerEvent) => {
      if (event.pointerId !== id) return;
      if (event.type !== 'pointermove') {
        stop();
        if (event.type === 'pointerup') drag?.drop(event.clientX);
        else drag?.cancel();
        return;
      }
      if (!drag) {
        if (Math.abs(event.clientX - from) < SLOP) return;
        drag = lift(name, header, from);
        if (!drag) return stop();
      }
      event.preventDefault();
      drag.to(event.clientX);
    };
    const kinds = ['pointermove', 'pointerup', 'pointercancel'] as const;
    const stop = () => kinds.forEach((kind) => doc.removeEventListener(kind, follow, true));
    kinds.forEach((kind) => doc.addEventListener(kind, follow, true));
  }

  /** A finger: resting a moment on the header lifts the column, which then follows it; a tap sorts, a swipe scrolls. */
  function rested(name: string, header: HTMLElement, touch: Touch) {
    const { identifier: id, clientX: from, clientY: fromY } = touch;
    let x = from;
    let drag: Drag | null = null;
    const timer = view?.setTimeout(() => {
      drag = lift(name, header, from);
      if (!drag) stop();
      else drag.to(x);
    }, LONG_PRESS);
    const follow = (event: TouchEvent) => {
      const one = [...event.changedTouches].find((each) => each.identifier === id);
      if (!one) return;
      x = one.clientX;
      if (event.type === 'touchmove') {
        // A finger that wanders before it has rested is a swipe, the browser's; once it has, it moves the column, not the page.
        if (!drag) {
          if (Math.hypot(one.clientX - from, one.clientY - fromY) > WANDER) stop();
          return;
        }
        if (event.cancelable) event.preventDefault();
        drag.to(x);
        return;
      }
      stop();
      // A touch that was the drag's ends in no click.
      if (drag && event.cancelable) event.preventDefault();
      if (event.type === 'touchend') drag?.drop(x);
      else drag?.cancel();
    };
    // A finger's long press on a header is the drag's, never the browser's menu.
    const menu = (event: Event) => event.preventDefault();
    const kinds = ['touchmove', 'touchend', 'touchcancel'] as const;
    function stop() {
      view?.clearTimeout(timer);
      kinds.forEach((kind) => header.removeEventListener(kind, follow));
      header.removeEventListener('contextmenu', menu);
    }
    kinds.forEach((kind) => header.addEventListener(kind, follow, { passive: false }));
    header.addEventListener('contextmenu', menu);
  }

  function movable(name: string, header: HTMLElement) {
    // The click a drag ends with sorts nothing; a key's click (no pointer's) always does.
    header.addEventListener(
      'click',
      (event) => {
        if (!dragged || event.detail === 0) return;
        dragged = false;
        event.preventDefault();
        event.stopPropagation();
      },
      true
    );
    header.addEventListener('keydown', () => (dragged = false), true);
    header.addEventListener('pointerdown', (event) => {
      dragged = false;
      // A finger is the touch events' (a long press); the grip's press is its own (it stops it).
      if (event.pointerType === 'touch' || event.button !== 0 || !event.isPrimary || under) return;
      pressed(name, header, event);
    });
    header.addEventListener(
      'touchstart',
      (event) => {
        dragged = false;
        if (event.touches.length !== 1 || under || (event.target as Element).closest?.('.fd-list-grip')) return;
        rested(name, header, event.touches[0]);
      },
      { passive: true }
    );
  }

  // ---- the card the table scrolls in: what lies past each end it holds a column at ----

  let sized: ResizeObserver | null = null;
  function scrolls(scroller: HTMLElement) {
    const mark = () => {
      const gone = Math.abs(scroller.scrollLeft);
      scroller.toggleAttribute('data-scrolled', gone > 0);
      scroller.toggleAttribute('data-more', gone < scroller.scrollWidth - scroller.clientWidth - 1);
    };
    scroller.addEventListener('scroll', mark, { passive: true });
    // The table grows and shrinks as columns are shown, hidden and sized, and the card with the window.
    if (view && 'ResizeObserver' in view) {
      sized = new view.ResizeObserver(mark);
      sized.observe(scroller);
      const table = scroller.querySelector('table');
      if (table) sized.observe(table);
    }
    mark();
  }

  return {
    shown,
    order: () => [...order],
    width: (name) => widths.get(name) ?? null,
    button,
    grip,
    movable,
    scrolls,
    destroy() {
      doc.removeEventListener('pointerdown', outside, true);
      under?.cancel();
      sized?.disconnect();
      menu.remove();
      voice.remove();
    },
  };
}

/** A column being dragged: moved with the pointer, let go there, or put back. */
interface Drag {
  to(x: number): void;
  drop(x: number): void;
  cancel(): void;
}
