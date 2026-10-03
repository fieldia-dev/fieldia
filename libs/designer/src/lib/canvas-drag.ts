/**
 * Dragging on the screen canvas: a field to another place, in its section or
 * another, or a tile from the toolbox onto the page. The pointer is followed
 * by a copy of what is carried, with a line where it would land; let go over
 * a section, it lands there as one edit; let go anywhere else, or press
 * Escape, and nothing changes. Resting on a closed tab opens it, so a field
 * can go into another tab.
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
  /** The canvas: its sections carry `data-drop-section`, its fields `.fd-canvas-field[data-node]`. */
  canvas: HTMLElement;
  drop(source: DragSource, sectionId: string, index: number): void;
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

export function canvasDrag(options: CanvasDragOptions): CanvasDrag {
  const { canvas } = options;
  const doc = canvas.ownerDocument;
  const rectOf = options.rectOf ?? ((element: Element) => element.getBoundingClientRect());
  const inside = (r: Rect, x: number, y: number) => x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;

  interface Drag {
    source: DragSource;
    element: HTMLElement;
    start: { x: number; y: number };
    offset: { x: number; y: number };
    started: boolean;
    ghost: HTMLElement | null;
    marker: HTMLElement | null;
    target: { section: string; index: number } | null;
  }
  let drag: Drag | null = null;
  let tabTimer: ReturnType<typeof setTimeout> | undefined;
  let tabUnder: HTMLElement | null = null;

  const sections = () => [...canvas.querySelectorAll<HTMLElement>('[data-drop-section]')].filter((s) => !s.closest('[hidden]'));
  const cardsIn = (section: HTMLElement) => [...section.querySelectorAll<HTMLElement>('.fd-canvas-field[data-node]')];
  const sectionAt = (x: number, y: number) => sections().find((s) => inside(rectOf(s), x, y)) ?? null;
  const closedTabAt = (x: number, y: number) =>
    [...canvas.querySelectorAll<HTMLElement>('.fd-tab')].find((t) => t.getAttribute('aria-selected') !== 'true' && inside(rectOf(t), x, y)) ?? null;

  function begin(source: DragSource, element: HTMLElement, x: number, y: number) {
    const r = rectOf(element);
    drag = { source, element, start: { x, y }, offset: { x: x - r.left, y: y - r.top }, started: false, ghost: null, marker: null, target: null };
  }

  /** A press on a field: anywhere on one not being edited, or on the grip of the one being edited. */
  function onDown(event: PointerEvent) {
    if (event.button !== 0 || drag) return;
    const target = event.target as Element;
    const card = target.closest?.<HTMLElement>('.fd-canvas-field[data-node]');
    if (!card || !canvas.contains(card)) return;
    const grip = target.closest('[data-grip]');
    if (card.classList.contains('fd-editing') ? !grip : target.closest('input, select, textarea, button, a, [contenteditable]')) return;
    begin({ node: card.dataset['node'] as string }, card, event.clientX, event.clientY);
  }

  function lift(current: Drag) {
    current.started = true;
    if ('node' in current.source) current.element.classList.add('fd-drag-source');
    const r = rectOf(current.element);
    const ghost = current.element.cloneNode(true) as HTMLElement;
    ghost.removeAttribute('id');
    ghost.classList.add('fd-drag-ghost');
    ghost.setAttribute('aria-hidden', 'true');
    ghost.style.width = `${r.right - r.left}px`;
    current.ghost = ghost;
    current.marker = doc.createElement('div');
    current.marker.className = 'fd-drop-marker';
    // Inside the editor, so the copy keeps the form's look.
    (canvas.closest('.fd-form') ?? doc.body).append(ghost, current.marker);
  }

  function follow(current: Drag, x: number, y: number) {
    if (current.ghost) {
      current.ghost.style.left = `${x - current.offset.x}px`;
      current.ghost.style.top = `${y - current.offset.y}px`;
    }
    const section = sectionAt(x, y);
    for (const s of sections()) s.classList.toggle('fd-drop-target', s === section);
    if (!section) {
      current.target = null;
      if (current.marker) current.marker.hidden = true;
      return;
    }
    // Its own place is not counted: in its own section the others close up around it.
    const others = cardsIn(section).filter((c) => c !== current.element);
    const rects = others.map(rectOf);
    const index = dropIndex(rects, x, y);
    current.target = { section: section.dataset['dropSection'] as string, index };
    if (!current.marker) return;
    current.marker.hidden = false;
    const at = rects[index];
    const last = rects[rects.length - 1];
    const area = rectOf(section);
    // Before a field: a line down its leading edge; after them all, a line across under the last.
    const line = at
      ? { left: at.left - 5, top: at.top, width: 3, height: at.bottom - at.top }
      : { left: area.left + 6, top: (last ? last.bottom : area.top + 30) + 4, width: area.right - area.left - 12, height: 3 };
    Object.assign(current.marker.style, { left: `${line.left}px`, top: `${line.top}px`, width: `${line.width}px`, height: `${line.height}px` });
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
    if (!current?.started) return;
    current.ghost?.remove();
    current.marker?.remove();
    current.element.classList.remove('fd-drag-source');
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
      if (event.button !== 0 || drag) return;
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
