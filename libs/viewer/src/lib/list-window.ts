import type { Row } from './list-groups';

/**
 * A list's rows windowed (the performance audit's H1): past a hundred rows shown, only the rows near the view — a
 * view's height above it and below it — are in the page; the rest are kept as data, a gap row as tall as they are in
 * their place, so the page scrolls as far as it did. 0.34 drew every row loaded: an endless list scrolled to 5,000 rows
 * held 130,000 nodes, a phone froze for over a second a frame as it scrolled, and every key, tick and Tab cost as many
 * rows as were loaded.
 *
 * What a person and a screen reader rely on is kept: the table says how many rows it has (`aria-rowcount`) and each row
 * its place (`aria-rowindex`); a row reached by the keys is drawn as it is reached (`beside`), and one the app opens as
 * it is opened (`reveal`); the row the focus is in, and a row the person has work on (`pinned`), stay in the page
 * wherever the view goes, so the focus is never lost to a scroll; every row is drawn for paper and for cards (`whole`).
 * Rows of differing heights (a row opened to its details) are measured as they are drawn, and a gap is as tall as its
 * rows were measured, or as the rows measured so far are on average; the browser keeps what the person reads in place
 * as rows above it come and go (scroll anchoring), and where it does not (WebKit), the window does.
 */

/** Fewer rows shown than this are all drawn: a page of a list is drawn whole, as it always was. */
export const WINDOW_FROM = 100;
/**
 * What a window takes unless its list says: rows drawn whole up to `from`; the page's own geometry. A test changes them
 * for the windows it makes next — jsdom lays nothing out, so a test gives where the view is and how tall rows are.
 */
export const windowDefaults: { from: number; geometry?: WindowGeometry } = { from: WINDOW_FROM };
/** A row's height before any is measured: a table row of one line. */
const ROW = 40;
/** The least drawn round the view, above and below, in pixels. */
const LEAST_MARGIN = 400;

/** One of a list's rows as the window keeps it: its record and where it stands, its row while it is drawn. */
export interface WindowRow {
  record: Row;
  /** A row added and not saved yet: the key the list keeps it by. */
  added?: string;
  /** Hidden under a closed parent: not shown. */
  hidden?: boolean;
  /** Its row, while it is in the page — or handed out to be worked on (an editable list's paste). */
  tr?: HTMLTableRowElement | null;
  /** Its height with what opened under it, as last measured. */
  height?: number;
  /** What the list keeps of it to draw it: its depth under a parent, the work kept on it. */
  depth?: number;
  children?: number;
  kept?: boolean;
}

/** Where the view is, from the top of the rows (the table's body), and how tall a drawn row is: the page's own, or a test's. */
export interface WindowGeometry {
  /** The rows' part in view, in pixels from their top; null while they are not laid out (hidden, not in the page). */
  view(body: HTMLElement): { top: number; bottom: number } | null;
  /** How tall a row is with what opened under it (`nodes`, the row first); 0 where it is not laid out. */
  height(nodes: readonly Element[]): number;
  /** Where a row's top is on the screen, to keep it in place: null where nothing is laid out. */
  top(tr: Element): number | null;
}

export interface WindowContext {
  doc: Document;
  table: HTMLTableElement;
  body: HTMLTableSectionElement;
  /** A row drawn for it, as the list draws its rows. */
  draw(row: WindowRow): HTMLTableRowElement;
  /** The rows the person has work on, by key: kept in the page wherever the view is (an editable list's rows being changed). */
  pins(): Iterable<string>;
  /** A row put in the page: what opened under it put back after it (its details, an editable row's note). */
  placed(tr: HTMLTableRowElement, row: WindowRow): void;
  /** How many columns a gap row spans. */
  span(): number;
  /** Rows drawn whole up to this many (WINDOW_FROM unless a test says). */
  from?: number;
  /** The page's geometry, unless a test gives its own (jsdom lays nothing out). */
  geometry?: WindowGeometry;
}

export interface RowWindow {
  /** The rows to show, in order, in place of those shown before (the list asked again). */
  set(rows: WindowRow[]): void;
  /** Rows after these: the next page of an endless list, a row added, the work kept on a row the list no longer holds. */
  append(rows: WindowRow[]): void;
  /** A row taken away (a row added and dropped). */
  remove(tr: HTMLTableRowElement): void;
  /** A drawn row drawn again in place of another (an editable row at rest), its record as it is now. */
  replaced(old: HTMLTableRowElement, fresh: HTMLTableRowElement, record: Row, added?: string): void;
  /** Which rows are hidden changed (a parent closed or opened): drawn again from the same rows. */
  refold(): void;
  /** Every row, in order, drawn or not. */
  rows(): readonly WindowRow[];
  /** Whether a row of this key is shown (drawn or not). */
  holds(key: string): boolean;
  /** The row shown of this key, drawn where it is not: null where none is shown. */
  reveal(key: string): HTMLTableRowElement | null;
  /** The row shown next to this one, down or up, drawn where it is not: null past the ends. */
  beside(tr: HTMLTableRowElement, down: boolean): HTMLTableRowElement | null;
  /** This row's place among those shown, the rows shown from it on (`n` at most, drawn where they are not), and how many are shown from it to the end. */
  from(tr: HTMLTableRowElement, n: number): { at: number; rows: HTMLTableRowElement[]; left: number };
  /** Every row drawn for a while (`reason`: paper, cards), or back to those round the view. */
  whole(reason: string, on: boolean): void;
  /** Whether rows are left out of the page now: more are shown than are drawn. */
  windowed(): boolean;
  /** The rows drawn by the list itself for a while (under groups): the window lets the table's body be. */
  clear(): void;
  /** Measure and draw again round the view at the next frame: something round the rows changed. */
  later(): void;
  /** The columns changed: each gap spans them. */
  spread(): void;
  destroy(): void;
}

const keyOf = (row: WindowRow) => row.added ?? String(row.record.id);
const isGap = (element: Element | null) => !!element && element.classList.contains('fd-list-gap');
const isRow = (element: Element | null) => !!element && element.classList.contains('fd-list-row');

/** The page's geometry: the rows' place on the screen, the window, and each box round them that scrolls. */
function pageGeometry(doc: Document): WindowGeometry {
  const view = doc.defaultView;
  return {
    view(body) {
      if (!body.isConnected || !body.getClientRects().length) return null;
      const box = body.getBoundingClientRect();
      let top = 0;
      let bottom = view?.innerHeight ?? 0;
      // Clipped by each box round the rows that scrolls or hides what overflows it: a dialog's body, the app's own — not
      // one that holds them whole (the list's own sideways scroll, whose height is the table's).
      for (let up = body.parentElement?.parentElement; up && up !== doc.body && up !== doc.documentElement; up = up.parentElement) {
        const y = view?.getComputedStyle(up).overflowY;
        if (!y || y === 'visible' || up.scrollHeight <= up.clientHeight) continue;
        const clip = up.getBoundingClientRect();
        top = Math.max(top, clip.top);
        bottom = Math.min(bottom, clip.bottom);
      }
      return { top: top - box.top, bottom: Math.max(top, bottom) - box.top };
    },
    height(nodes) {
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (!first?.isConnected) return 0;
      return last.getBoundingClientRect().bottom - first.getBoundingClientRect().top;
    },
    top: (tr) => (tr.isConnected ? tr.getBoundingClientRect().top : null),
  };
}

/** The nearest box round an element that scrolls up and down, else the page's own scrolling. */
function scrollerOf(doc: Document, from: Element): Element | null {
  const view = doc.defaultView;
  for (let up = from.parentElement; up && up !== doc.body && up !== doc.documentElement; up = up.parentElement) {
    const y = view?.getComputedStyle(up).overflowY;
    if ((y === 'auto' || y === 'scroll') && up.scrollHeight > up.clientHeight) return up;
  }
  return doc.scrollingElement;
}

export function rowWindow(context: WindowContext): RowWindow {
  const { doc, table, body } = context;
  const view = doc.defaultView;
  const least = context.from ?? windowDefaults.from;
  const geometry = context.geometry ?? windowDefaults.geometry ?? pageGeometry(doc);
  /** Where the browser keeps what is read in place as rows above it come and go itself; else the window does. */
  const anchors = !!view?.CSS?.supports?.('overflow-anchor', 'auto');
  let all: WindowRow[] = [];
  /** The rows shown (not under a closed parent), and each one's place among them. */
  let shown: WindowRow[] = [];
  let placeOf = new Map<WindowRow, number>();
  let byKey = new Map<string, WindowRow>();
  /** Each drawn row's own, by its element. */
  const ofTr = new WeakMap<Element, WindowRow>();
  /** The rows in the page now, in their order. */
  let drawn: WindowRow[] = [];
  /** The rows drawn round the view, by their place among those shown: [from, to). */
  let range = { from: 0, to: 0 };
  /** Rows reached by the keys or the app (`beside`, `reveal`, `from`), kept in the page until the view moves. */
  const reached = new Set<WindowRow>();
  /** Why every row is drawn now: paper, cards. */
  const wholly = new Set<string>();
  /** The list draws its rows itself for now (under groups). */
  let active = true;
  /** Rows' heights as measured, by key, kept as the list asks again; and a row's height on average, for those not measured. */
  let heights = new Map<string, number>();
  let plain = { sum: 0, n: 0 };
  let estimate = ROW;
  /** The view as last measured, from the rows' top: where the rows the list asks for again are drawn first. */
  let lastView: { top: number; bottom: number } | null = null;
  let frame = 0;
  const gaps: HTMLTableRowElement[] = [];
  /** Each shown row's top, from the rows' top: worked out as rows or their heights change. */
  let tops: Float64Array | null = null;

  const heightOf = (row: WindowRow) => row.height ?? estimate;
  function offsets(): Float64Array {
    if (tops && tops.length === shown.length + 1) return tops;
    tops = new Float64Array(shown.length + 1);
    for (let i = 0; i < shown.length; i++) tops[i + 1] = tops[i] + heightOf(shown[i]);
    return tops;
  }
  /** The place of the first row shown whose bottom is past `y`. */
  function placeAt(y: number): number {
    const at = offsets();
    let low = 0;
    let high = shown.length;
    while (low < high) {
      const middle = (low + high) >> 1;
      if (at[middle + 1] <= y) low = middle + 1;
      else high = middle;
    }
    return low;
  }

  function reshow() {
    shown = all.filter((row) => !row.hidden);
    placeOf = new Map(shown.map((row, i) => [row, i]));
    tops = null;
  }

  const pinned = () => {
    const out = new Set<WindowRow>();
    for (const key of context.pins()) {
      const row = byKey.get(key);
      if (row) out.add(row);
    }
    // The row the focus is in stays where the person left it.
    const active = doc.activeElement;
    if (active && body.contains(active)) {
      let tr: Element | null = active.closest('tr');
      while (tr && tr.parentElement !== body) tr = tr.parentElement?.closest('tr') ?? null;
      // A row's own, or what opened under it.
      while (tr && !isRow(tr) && !isGap(tr)) tr = tr.previousElementSibling;
      const row = tr ? ofTr.get(tr) : undefined;
      if (row) out.add(row);
    }
    return out;
  };

  /** A row out of the page, what opened under it with it; its element let go unless it is being worked on. */
  function unplace(row: WindowRow, keep: boolean) {
    const tr = row.tr;
    if (!tr) return;
    let next = tr.nextElementSibling;
    while (next && !isRow(next) && !isGap(next)) {
      const after = next.nextElementSibling;
      next.remove();
      next = after;
    }
    tr.remove();
    if (!keep) row.tr = null;
  }

  /** The nodes of a drawn row: its own, and what opened under it. */
  function nodesOf(tr: HTMLTableRowElement): Element[] {
    const nodes: Element[] = [tr];
    for (let next = tr.nextElementSibling; next && !isRow(next) && !isGap(next); next = next.nextElementSibling) nodes.push(next);
    return nodes;
  }

  /** Each drawn row's height, as laid out now: a gap of rows not drawn is as tall as they were. */
  function measure() {
    let changed = false;
    for (const row of drawn) {
      if (!row.tr?.isConnected) continue;
      const nodes = nodesOf(row.tr);
      const height = geometry.height(nodes);
      if (height <= 0 || row.height === height) continue;
      if (row.height === undefined && nodes.length === 1) {
        plain = { sum: plain.sum + height, n: plain.n + 1 };
        estimate = plain.sum / plain.n;
      }
      row.height = height;
      heights.set(keyOf(row), height);
      changed = true;
    }
    if (changed) tops = null;
  }

  /** A gap row as tall as the rows shown from `a` to before `b`, which are not drawn. */
  function gapFor(a: number, b: number, at: number): HTMLTableRowElement {
    let gap = gaps[at];
    if (!gap) {
      gap = doc.createElement('tr');
      gap.className = 'fd-list-gap';
      gap.setAttribute('aria-hidden', 'true');
      gap.setAttribute('data-aside', '');
      gap.append(doc.createElement('td'));
      gaps[at] = gap;
    }
    const cell = gap.firstElementChild as HTMLTableCellElement;
    cell.colSpan = context.span();
    const at0 = offsets();
    cell.style.height = `${Math.max(0, at0[b] - at0[a])}px`;
    return gap;
  }

  /** Every row drawn: few enough of them (a page of a list), or for paper or cards — those under a closed parent hidden. */
  const full = () => wholly.size > 0 || all.length <= least;

  /** The rows round the view drawn, those being worked on with them wherever they are; the rest as gaps. */
  function render(from: number, to: number) {
    if (full()) return renderAll();
    range = { from, to };
    const want = new Set<WindowRow>();
    for (let i = from; i < to; i++) want.add(shown[i]);
    for (const row of pinned()) want.add(row);
    for (const row of reached) want.add(row);
    place([...want].filter((row) => placeOf.has(row)).sort((a, b) => (placeOf.get(a) as number) - (placeOf.get(b) as number)), true);
    say();
  }

  /** Every row drawn, in order, as a list draws its rows whole: those under a closed parent hidden, as 0.34 drew them. */
  function renderAll() {
    range = { from: 0, to: shown.length };
    place(all, false);
    for (const row of all) if (row.tr && row.tr.hidden !== !!row.hidden) row.tr.hidden = !!row.hidden;
    unsay();
  }

  /**
   * These rows in the page, in their order: those already there left where they are (the focus in one is never lost),
   * the others drawn and put in among them — and, where rows are left out (`gaps`), a gap as tall as they are in their
   * place.
   */
  function place(order: WindowRow[], withGaps: boolean) {
    const keep = new Set(order);
    for (const row of drawn) if (!keep.has(row)) unplace(row, false);
    for (const gap of gaps) gap.remove();
    const staying = drawn.filter((row) => keep.has(row) && row.tr?.parentElement === body);
    let next = 0;
    let before = -1;
    let used = 0;
    for (const row of order) {
      const at = placeOf.get(row) ?? before;
      const there = staying[next]?.tr ?? null;
      if (withGaps && at > before + 1) body.insertBefore(gapFor(before + 1, at, used++), there);
      if (row === staying[next]) next++;
      else {
        const tr = (row.tr ??= context.draw(row));
        ofTr.set(tr, row);
        // Drawn while shown: a row hidden under a parent is never in the page round the view.
        if (withGaps && tr.hidden) tr.hidden = false;
        body.insertBefore(tr, there);
        context.placed(tr, row);
      }
      before = at;
    }
    if (withGaps && before < shown.length - 1) body.append(gapFor(before + 1, shown.length, used++));
    gaps.length = Math.min(gaps.length, used + 2);
    drawn = order;
  }

  /** Every row in the page: nothing to say of rows left out. */
  function unsay() {
    if (!table.hasAttribute('aria-rowcount')) return;
    table.removeAttribute('aria-rowcount');
    for (const tr of table.querySelectorAll(':scope > :is(thead, tbody, tfoot) > tr[aria-rowindex]')) tr.removeAttribute('aria-rowindex');
  }

  /** The table's rows counted, and each drawn row's place among them: the header first, the totals last. */
  function say() {
    const foot = table.tFoot?.rows.length ?? 0;
    const count = String(1 + shown.length + foot);
    if (table.getAttribute('aria-rowcount') !== count) table.setAttribute('aria-rowcount', count);
    for (const tr of table.tHead?.rows ?? []) tr.setAttribute('aria-rowindex', '1');
    for (const [i, tr] of [...(table.tFoot?.rows ?? [])].entries()) tr.setAttribute('aria-rowindex', String(2 + shown.length + i));
    for (const row of drawn) {
      const place = String(2 + (placeOf.get(row) as number));
      if (row.tr && row.tr.getAttribute('aria-rowindex') !== place) row.tr.setAttribute('aria-rowindex', place);
    }
  }

  /** The rows to draw round a view: a margin of a view's height above and below it, never fewer than fill a view. */
  function around(at: { top: number; bottom: number }): [number, number] {
    const margin = Math.max(at.bottom - at.top, LEAST_MARGIN);
    let from = Math.min(placeAt(at.top - margin), Math.max(0, shown.length - 1));
    let to = Math.min(shown.length, placeAt(at.bottom + margin) + 1);
    const fewest = Math.ceil((at.bottom - at.top + 2 * margin) / Math.max(estimate, 1));
    if (to - from < fewest) {
      to = Math.min(shown.length, from + fewest);
      from = Math.max(0, to - fewest);
    }
    return [from, to];
  }

  /** The first rows, before anything is laid out: as many as fill a tall window twice. */
  const opening = () => Math.min(shown.length, Math.ceil((2 * Math.max(view?.innerHeight ?? 0, 800)) / estimate));

  /** Drawn again round the view as it is now: the rows' heights measured, what is read kept in place. */
  function update() {
    frame = 0;
    if (!active) return;
    if (full()) {
      if (drawn.length !== all.length) renderAll();
      return;
    }
    measure();
    const at = geometry.view(body);
    if (!at) return;
    lastView = at;
    const margin = Math.max(at.bottom - at.top, LEAST_MARGIN);
    const edges = offsets();
    const [top, bottom] = [edges[range.from], edges[range.to]];
    const pins = pinned();
    // Still drawn half a margin round the view, nothing more than it needs, and nothing drawn that need not be: as it is.
    const enough = range.to > range.from && (range.from === 0 || top <= at.top - margin / 2) && (range.to === shown.length || bottom >= at.bottom + margin / 2) && bottom - top <= at.bottom - at.top + 4 * margin;
    const stray = drawn.some((row) => {
      const place = placeOf.get(row) as number;
      return (place < range.from || place >= range.to) && !pins.has(row) && !reached.has(row);
    });
    reached.clear();
    if (enough && !stray) return;
    // What the person reads stays where it is as rows above it come and go: the first row drawn reaching into the view.
    const anchor = anchors ? null : drawn.find((row) => {
      const place = placeOf.get(row) as number;
      return edges[place + 1] > at.top;
    });
    const was = anchor?.tr ? geometry.top(anchor.tr) : null;
    const [from, to] = around(at);
    render(from, to);
    if (anchor?.tr && was !== null) {
      const now = geometry.top(anchor.tr);
      const by = now === null ? 0 : now - was;
      if (Math.abs(by) >= 1) {
        const scroller = scrollerOf(doc, table);
        if (scroller) scroller.scrollTop += by;
      }
    }
  }

  const later = () => {
    if (!frame && view) frame = view.requestAnimationFrame(update);
  };
  /** Drawn at once round the view as it was last seen (the rows asked again stand where the rows before stood), then measured. */
  function now() {
    if (!active) return;
    if (full()) renderAll();
    else if (lastView) render(...around(lastView));
    else {
      const at = geometry.view(body);
      if (at) render(...around(at));
      else render(0, opening());
    }
    later();
  }

  const scrolled = () => later();
  doc.addEventListener('scroll', scrolled, { capture: true, passive: true });
  view?.addEventListener('resize', scrolled);
  // Paper prints every row of the view shown: drawn as printing begins, the window back after it — unless the page
  // prints something else alone (a record's print, the list's own Print).
  const printing = () => {
    const one = doc.documentElement.classList.contains('fd-print-one');
    if (!one || table.closest('.fd-print-this')) whole('paper', true);
  };
  const printed = () => whole('paper', false);
  view?.addEventListener('beforeprint', printing);
  view?.addEventListener('afterprint', printed);
  // Rows' heights change (a row opened, the columns changed), the list shown again after it was hidden: measured again.
  const sizes = view?.ResizeObserver ? new view.ResizeObserver(() => later()) : null;
  sizes?.observe(table);

  function whole(reason: string, on: boolean) {
    const was = wholly.size > 0;
    if (on) wholly.add(reason);
    else wholly.delete(reason);
    if (!active || was === wholly.size > 0) return;
    if (on) renderAll();
    else now();
  }

  return {
    set(rows) {
      // Back from rows the list drew itself (its groups): those let go.
      if (!active) body.replaceChildren();
      active = true;
      for (const row of drawn) unplace(row, false);
      for (const gap of gaps) gap.remove();
      drawn = [];
      reached.clear();
      all = rows;
      byKey = new Map(rows.map((row) => [keyOf(row), row]));
      const kept = new Map<string, number>();
      for (const row of rows) {
        const height = heights.get(keyOf(row));
        if (height !== undefined) {
          row.height = height;
          kept.set(keyOf(row), height);
        }
      }
      heights = kept;
      reshow();
      now();
    },
    append(rows) {
      if (!rows.length) return;
      all = [...all, ...rows];
      for (const row of rows) {
        byKey.set(keyOf(row), row);
        // A row handed in drawn (a row added, the work kept on one) is to be worked on at once: drawn wherever it is.
        if (row.tr) {
          ofTr.set(row.tr, row);
          reached.add(row);
        }
      }
      reshow();
      if (!active) return;
      if (full()) renderAll();
      else render(range.from, range.to);
      later();
    },
    remove(tr) {
      const row = ofTr.get(tr);
      if (!row) return void tr.remove();
      unplace(row, false);
      drawn = drawn.filter((one) => one !== row);
      all = all.filter((one) => one !== row);
      byKey.delete(keyOf(row));
      reshow();
      if (active) render(Math.min(range.from, shown.length), Math.min(range.to, shown.length));
    },
    replaced(old, fresh, record, added) {
      const row = ofTr.get(old);
      if (!row) return;
      byKey.delete(keyOf(row));
      row.record = record;
      row.added = added;
      byKey.set(keyOf(row), row);
      row.tr = fresh;
      ofTr.set(fresh, row);
      // Its place said as the row it stands in for said it.
      const place = placeOf.get(row);
      if (table.hasAttribute('aria-rowcount') && place !== undefined) fresh.setAttribute('aria-rowindex', String(place + 2));
    },
    refold() {
      reshow();
      if (!active) return;
      if (full()) renderAll();
      else render(Math.min(range.from, Math.max(0, shown.length - 1)), Math.min(range.to, shown.length));
      later();
    },
    rows: () => all,
    holds(key) {
      const row = byKey.get(key);
      return !!row && placeOf.has(row);
    },
    reveal(key) {
      const row = byKey.get(key);
      if (!row || !placeOf.has(row)) return null;
      if (!row.tr?.isConnected && active) {
        reached.add(row);
        render(range.from, range.to);
      }
      return row.tr ?? null;
    },
    beside(tr, down) {
      const row = ofTr.get(tr);
      const place = row ? placeOf.get(row) : undefined;
      if (place === undefined) return null;
      const next = shown[place + (down ? 1 : -1)];
      if (!next) return null;
      if (!next.tr?.isConnected && active) {
        reached.add(next);
        render(range.from, range.to);
      }
      return next.tr ?? null;
    },
    from(tr, n) {
      const row = ofTr.get(tr);
      const place = row ? placeOf.get(row) : undefined;
      if (place === undefined) return { at: -1, rows: [], left: 0 };
      const rows = shown.slice(place, place + n);
      if (active && rows.some((one) => !one.tr?.isConnected)) {
        for (const one of rows) reached.add(one);
        render(range.from, range.to);
      }
      return { at: place, rows: rows.map((one) => one.tr).filter((one): one is HTMLTableRowElement => !!one), left: shown.length - place };
    },
    whole,
    windowed: () => active && !full(),
    clear() {
      active = false;
      drawn = [];
      reached.clear();
      all = [];
      shown = [];
      placeOf = new Map();
      byKey = new Map();
      for (const gap of gaps) gap.remove();
      table.removeAttribute('aria-rowcount');
      for (const tr of [...(table.tHead?.rows ?? []), ...(table.tFoot?.rows ?? [])]) tr.removeAttribute('aria-rowindex');
    },
    later,
    spread() {
      for (const gap of gaps) (gap.firstElementChild as HTMLTableCellElement).colSpan = context.span();
    },
    destroy() {
      if (frame) view?.cancelAnimationFrame(frame);
      frame = 0;
      doc.removeEventListener('scroll', scrolled, { capture: true });
      view?.removeEventListener('resize', scrolled);
      view?.removeEventListener('beforeprint', printing);
      view?.removeEventListener('afterprint', printed);
      sizes?.disconnect();
    },
  };
}
