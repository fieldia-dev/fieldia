import type { DesignerWords } from './designer-words';
import { en } from './locales/en';
import { speakLike } from './chrome-language';
/**
 * Dragging on the canvas: a field to another place, in its section or
 * another, or a tile from the toolbox onto the page. What is carried leaves
 * its place, and a gap of its size opens where it would land, the fields
 * around it moving aside — so where it goes is seen, not guessed; a small
 * chip with its name follows the pointer. Let go over a section, it lands in
 * the gap as one edit; let go anywhere else, or press Escape, and nothing
 * changes. Resting on a closed tab opens it, so a field can go into another
 * tab. Held at the window's top or bottom edge, the page scrolls.
 *
 * The gap moves only when the pointer crosses the middle of another field —
 * over the gap itself nothing moves — so the fields moving aside never chase
 * the pointer into a flicker.
 *
 * A list's columns, side by side, take the same drag: their row carries
 * `data-drop-flow="row"`, and a line down the whole table shows the place,
 * as a table's columns cannot make room the way a grid's fields do.
 *
 * A press that does not move is a click, left to the click handlers; the
 * click that ends a real drag is swallowed. Places are read from where things
 * are on screen, not hit-tested, so a field's own widget — inert on the
 * canvas — never gets in the way.
 */

interface Rect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** How many of the fields, in reading order, come before a point: where one let go there would go. */
export function dropIndex(cards: readonly Rect[], x: number, y: number): number {
  return cards.filter((r) => r.bottom <= y || (r.top <= y && (r.left + r.right) / 2 < x)).length;
}

/** What is carried: a field on the canvas, or what a toolbox tile adds. */
export type DragSource = { node: string } | { tool: string };

export interface CanvasDragOptions {
  /** The designer's words, for what a carried thing is called when it shows none. English unless given. */
  words?: DesignerWords;
  /**
   * The canvas: its sections carry `data-drop-section` — and `data-drop-flow="column"`
   * where they are one column, as a survey's page is — its fields `.fd-canvas-field[data-node]`.
   * A section's fields sit in its `[data-drop-grid]`, or in the section itself.
   */
  canvas: HTMLElement;
  /** What can be carried, when not the screen's fields: a survey's questions, say. */
  cards?: string;
  /** What counts as a place in a section, when more than what can be carried: the screen's blocks and groups between its fields. */
  parts?: string;
  drop(source: DragSource, sectionId: string, index: number): void;
  /** Whether it carries anything now: off while the Advanced canvas carries instead. On by default. */
  enabled?(): boolean;
  /** Where an element is on screen; the browser's own by default. */
  rectOf?: (element: Element) => DOMRect;
}

export interface CanvasDrag {
  /** A toolbox tile was pressed: carry it if the pointer moves. */
  press(source: DragSource, event: PointerEvent, element: HTMLElement): void;
  destroy(): void;
}

/** How far the pointer moves before a press becomes a drag. */
const SLOP = 4;
/** How long the pointer rests on a tab before it opens. */
const TAB_DELAY = 450;
/**
 * How far under a table a column still lands in it. A grid's gap needs none:
 * its last place is the room beside or after its last field — and a reach
 * under a section would let the gap grow the section away from the pointer.
 */
const REACH = 24;
/** How near the window's top or bottom something carried scrolls the page, faster the nearer. */
const EDGE = 48;
/** How long it rests there first: a drop made quickly near the edge stays where it was let go. */
const EDGE_DELAY = 250;

/** The words a carried thing goes by, for the chip that follows the pointer. */
function nameOf(element: HTMLElement, words: DesignerWords): string {
  // The words being typed in, for a field open to edit; else the words it shows.
  const box = element.querySelector<HTMLInputElement>('.fd-canvas-label-input, .fd-q-label');
  const said = box?.value || element.querySelector('.fd-label, .fd-q-text, .fd-tool-name, .fd-list-sort')?.textContent || element.textContent || '';
  return said.trim().replace(/\s+/g, ' ').slice(0, 48) || words.canvas.field;
}

export function canvasDrag(options: CanvasDragOptions): CanvasDrag {
  const { canvas } = options;
  const doc = canvas.ownerDocument;
  const rectOf = options.rectOf ?? ((element: Element) => element.getBoundingClientRect());
  const inside = (r: Rect, x: number, y: number) => x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;

  interface Drag {
    source: DragSource;
    element: HTMLElement;
    start: { x: number; y: number };
    started: boolean;
    ghost: HTMLElement | null;
    marker: HTMLElement | null;
    /** The gap where it would land; for a field, first in its own place. */
    slot: HTMLElement | null;
    /** Where the gap is: the section, and how many of its other fields come before it. */
    target: { section: string; index: number } | null;
  }
  let drag: Drag | null = null;
  let tabTimer: ReturnType<typeof setTimeout> | undefined;
  let tabUnder: HTMLElement | null = null;
  let edgeTimer: ReturnType<typeof setTimeout> | undefined;
  let pointer = { x: 0, y: 0 };

  const nearEdge = (y: number) => y < EDGE || y > (doc.defaultView?.innerHeight ?? Infinity) - EDGE;
  /** Held near the window's top or bottom, the page scrolls under what is carried, so it can go to a place out of view. */
  function edgeScroll() {
    clearTimeout(edgeTimer);
    edgeTimer = undefined;
    const view = doc.defaultView;
    if (!drag?.started || !view) return;
    const { x, y } = pointer;
    const speed = y < EDGE ? -(EDGE - y) : y > view.innerHeight - EDGE ? EDGE - (view.innerHeight - y) : 0;
    if (!speed) return;
    view.scrollBy(0, Math.round(speed / 2) || Math.sign(speed));
    follow(drag, x, y);
    edgeTimer = setTimeout(edgeScroll, 16);
  }

  const sections = () => [...canvas.querySelectorAll<HTMLElement>('[data-drop-section]')].filter((s) => !s.closest('[hidden]'));
  const flowOf = (section: HTMLElement | null) => section?.dataset['dropFlow'] ?? 'grid';
  const cardSelector = options.cards ?? '.fd-canvas-field[data-node]';
  const partSelector = options.parts ?? cardSelector;
  /** A section's own parts, in order: not those of a group inside it, which has places of its own. */
  const cardsIn = (section: HTMLElement) => [...section.querySelectorAll<HTMLElement>(partSelector)].filter((part) => part.parentElement?.closest('[data-drop-section]') === section);
  /** A section and the gap under it, where it can still be dropped last. */
  const reach = (r: Rect): Rect => ({ left: r.left, top: r.top, right: r.right, bottom: r.bottom + REACH });
  /** The innermost section under the pointer: a group inside a group takes what is dropped on it. */
  const sectionAt = (x: number, y: number) => sections().filter((s) => inside(flowOf(s) === 'row' ? reach(rectOf(s)) : rectOf(s), x, y)).pop() ?? null;
  const closedTabAt = (x: number, y: number) =>
    [...canvas.querySelectorAll<HTMLElement>('.fd-tab')].find((t) => t.getAttribute('aria-selected') !== 'true' && inside(rectOf(t), x, y)) ?? null;

  function begin(source: DragSource, element: HTMLElement, x: number, y: number) {
    drag = { source, element, start: { x, y }, started: false, ghost: null, marker: null, slot: null, target: null };
  }

  /** A press on a field: anywhere on one not being edited, or on the grip of the one being edited. */
  const on = () => options.enabled?.() ?? true;

  function onDown(event: PointerEvent) {
    if (!on() || event.button !== 0 || drag) return;
    const target = event.target as Element;
    const card = target.closest?.<HTMLElement>(cardSelector);
    if (!card || !canvas.contains(card)) return;
    const grip = target.closest('[data-grip]');
    if (card.classList.contains('fd-editing') ? !grip : target.closest('input, select, textarea, button:not([data-grip]), a, [contenteditable]')) return;
    begin({ node: card.dataset['node'] as string }, card, event.clientX, event.clientY);
  }


  function lift(current: Drag) {
    current.started = true;
    // While something is carried, nothing on the page is selected.
    canvas.classList.add('fd-dragging');
    doc.getSelection()?.removeAllRanges();
    const home = 'node' in current.source ? current.element.closest<HTMLElement>('[data-drop-section]') : null;
    // A small chip with its name, so it never hides where it is going.
    const ghost = doc.createElement('div');
    ghost.className = 'fd-drag-ghost fd-drag-chip';
    ghost.setAttribute('aria-hidden', 'true');
    ghost.textContent = nameOf(current.element, options.words ?? en);
    current.ghost = ghost;
    (canvas.closest('.fd-form') ?? doc.body).append(speakLike(ghost, canvas));
    if (flowOf(home) === 'row' || ('tool' in current.source && canvas.querySelector('[data-drop-flow="row"]'))) {
      // Columns of a table: a line where it lands; the column dims in its place.
      if ('node' in current.source) current.element.classList.add('fd-drag-source-dim');
      current.marker = doc.createElement('div');
      current.marker.className = 'fd-drop-marker';
      (canvas.closest('.fd-form') ?? doc.body).append(current.marker);
      return;
    }
    // The gap: as big as what is carried, in its place to begin with.
    const slot = doc.createElement('div');
    slot.className = 'fd-drop-slot';
    slot.setAttribute('aria-hidden', 'true');
    const r = rectOf(current.element);
    if ('node' in current.source) {
      slot.style.height = `${Math.round(Math.min(160, Math.max(44, r.bottom - r.top)))}px`;
      const span = current.element.style.getPropertyValue('--fd-span');
      if (span) slot.style.setProperty('--fd-span', span);
      current.element.before(slot);
      current.element.classList.add('fd-drag-source');
      const section = current.element.closest<HTMLElement>('[data-drop-section]');
      if (section) current.target = { section: section.dataset['dropSection'] as string, index: cardsIn(section).indexOf(current.element) };
    } else slot.style.height = '56px';
    current.slot = slot;
  }

  /** Put the gap before the `index`-th of the section's other fields, or after the last of them. */
  function placeSlot(slot: HTMLElement, section: HTMLElement, others: HTMLElement[], index: number) {
    if (index < others.length) {
      if (others[index].previousElementSibling !== slot) others[index].before(slot);
    } else if (others.length) {
      if (others[others.length - 1].nextElementSibling !== slot) others[others.length - 1].after(slot);
    } else {
      const grid = [...section.querySelectorAll('[data-drop-grid]')].find((g) => g.closest('[data-drop-section]') === section) ?? section;
      if (slot.parentElement !== grid) grid.append(slot);
    }
  }

  function follow(current: Drag, x: number, y: number) {
    if (current.ghost) {
      current.ghost.style.left = `${x + 14}px`;
      current.ghost.style.top = `${y + 10}px`;
    }
    const section = sectionAt(x, y);
    for (const s of sections()) s.classList.toggle('fd-drop-target', s === section);
    if (current.marker) return followLine(current, section, x, y);
    const slot = current.slot as HTMLElement;
    if (!section || flowOf(section) === 'row') {
      current.target = null;
      // Over no section: back to where it came from, or nowhere for something new.
      if ('node' in current.source) current.element.before(slot);
      else slot.remove();
      return;
    }
    const id = section.dataset['dropSection'] as string;
    const others = cardsIn(section).filter((c) => c !== current.element);
    const column = flowOf(section) === 'column';
    let index: number;
    const over = others.find((c) => inside(rectOf(c), x, y));
    if (over) {
      // Over another field: before it in its first half, after it in its second.
      const r = rectOf(over);
      const second = column ? y > (r.top + r.bottom) / 2 : x > (r.left + r.right) / 2;
      index = others.indexOf(over) + (second ? 1 : 0);
    } else if (current.target?.section === id && slot.isConnected && inside(rectOf(slot), x, y)) {
      // Over the gap itself: it stays.
      index = current.target.index;
    } else {
      // In the room between fields: by reading order, or by height down a column.
      const rects = others.map(rectOf);
      index = column ? rects.filter((r) => (r.top + r.bottom) / 2 < y).length : dropIndex(rects, x, y);
    }
    current.target = { section: id, index };
    placeSlot(slot, section, others, index);
  }

  /** Across a table's columns: a line down the table where it would land. */
  function followLine(current: Drag, section: HTMLElement | null, x: number, y: number) {
    const marker = current.marker as HTMLElement;
    if (!section || flowOf(section) !== 'row') {
      current.target = null;
      marker.hidden = true;
      return;
    }
    const others = cardsIn(section).filter((c) => c !== current.element);
    const rects = others.map(rectOf);
    const index = rects.filter((r) => (r.left + r.right) / 2 < x).length;
    current.target = { section: section.dataset['dropSection'] as string, index };
    marker.hidden = false;
    const at = rects[index];
    const last = rects[rects.length - 1];
    const area = rectOf(section);
    const line = { left: (at ? at.left : last ? last.right : area.left) - 1, top: area.top, width: 3, height: area.bottom - area.top };
    Object.assign(marker.style, { left: `${line.left}px`, top: `${line.top}px`, width: `${line.width}px`, height: `${line.height}px` });
    void y;
  }

  function restOnTab(x: number, y: number) {
    const tab = closedTabAt(x, y);
    if (tab === tabUnder) return;
    clearTimeout(tabTimer);
    tabUnder = tab;
    if (tab) tabTimer = setTimeout(() => tab.click(), TAB_DELAY);
  }

  function onMove(event: PointerEvent) {
    if (!drag) return;
    const { clientX: x, clientY: y } = event;
    if (!drag.started) {
      if (Math.hypot(x - drag.start.x, y - drag.start.y) < SLOP) return;
      lift(drag);
    }
    event.preventDefault();
    follow(drag, x, y);
    restOnTab(x, y);
    pointer = { x, y };
    if (!nearEdge(y)) {
      clearTimeout(edgeTimer);
      edgeTimer = undefined;
    } else if (!edgeTimer) edgeTimer = setTimeout(edgeScroll, EDGE_DELAY);
  }

  /** The click a real drag ends with is not a click on what was under it. */
  function swallowNextClick() {
    const swallow = (event: Event) => {
      event.stopPropagation();
      event.preventDefault();
      stop();
    };
    // Only that click: gone after it, at the next press, or once the drag's own events are over.
    const stop = () => {
      doc.removeEventListener('click', swallow, true);
      doc.removeEventListener('pointerdown', stop, true);
    };
    doc.addEventListener('click', swallow, true);
    doc.addEventListener('pointerdown', stop, true);
    setTimeout(stop, 0);
  }

  function end(commit: boolean) {
    const current = drag;
    drag = null;
    clearTimeout(tabTimer);
    tabUnder = null;
    clearTimeout(edgeTimer);
    edgeTimer = undefined;
    if (!current?.started) return;
    current.ghost?.remove();
    current.marker?.remove();
    current.slot?.remove();
    current.element.classList.remove('fd-drag-source', 'fd-drag-source-dim');
    canvas.classList.remove('fd-dragging');
    for (const s of sections()) s.classList.remove('fd-drop-target');
    swallowNextClick();
    if (commit && current.target) options.drop(current.source, current.target.section, current.target.index);
  }

  const onUp = () => end(true);
  const onCancel = () => end(false);
  const onKey = (event: KeyboardEvent) => {
    if (event.key === 'Escape' && drag?.started) {
      event.preventDefault();
      end(false);
    }
  };
  canvas.addEventListener('pointerdown', onDown);
  doc.addEventListener('pointermove', onMove);
  doc.addEventListener('pointerup', onUp);
  doc.addEventListener('pointercancel', onCancel);
  doc.addEventListener('keydown', onKey, true);

  return {
    press(source, event, element) {
      if (!on() || event.button !== 0 || drag) return;
      begin(source, element, event.clientX, event.clientY);
    },
    destroy() {
      end(false);
      canvas.removeEventListener('pointerdown', onDown);
      doc.removeEventListener('pointermove', onMove);
      doc.removeEventListener('pointerup', onUp);
      doc.removeEventListener('pointercancel', onCancel);
      doc.removeEventListener('keydown', onKey, true);
    },
  };
}
