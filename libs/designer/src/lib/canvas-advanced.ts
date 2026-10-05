import type { DragSource } from './canvas-drag';
import { findDrop, type DropMark } from './canvas-drop';
import { echo } from './drop-echo';
import type { Designer } from './designer';
import type { Drop, NewPart } from './layout-ops';
import { nameOf, nodeOf } from './layout-tree';
import { speakLike } from './chrome-language';

/**
 * Dragging on the Advanced canvas, as the approved mockup drags: what is
 * carried stays where it is, dimmed, while a line shows where it would go —
 * beside a part, under it, into a group, as a new row or a new column (see
 * canvas-drop.ts) — and a chip by the pointer says so in words, or says why
 * it cannot go there. Let go, it goes there as one edit (`place`), and is
 * picked. Escape, or letting go where nothing would take it, changes nothing.
 * Resting on a closed tab opens it, so a part can go into another tab.
 *
 * What it carries: a part on the canvas — a field, a block, a group by its
 * title or the room round its parts, tabs by their strip — or a toolbox tile.
 */

export interface AdvancedDragOptions {
  /** The canvas: the marks are drawn in it, so they wear its colours. */
  canvas: HTMLElement;
  /** What holds the page's own parts. */
  root: HTMLElement;
  designer: Designer;
  rtl(): boolean;
  rectOf?(element: Element): DOMRect;
  /** The deepest element at a point; the document's own by default. */
  elementAt?(x: number, y: number): Element | null;
  /** A part was dropped and placed: new, from the toolbox, or moved. */
  placed?(id: string, source: DragSource): void;
}

export interface AdvancedDrag {
  /** A toolbox tile was pressed: carry it if the pointer moves. */
  press(source: DragSource, event: PointerEvent, element: HTMLElement): void;
  /** Off in Simple mode: the canvas's own presses are left to it. */
  setEnabled(on: boolean): void;
  destroy(): void;
}

/** How far the pointer moves before a press becomes a drag. */
const SLOP = 5;
/** How long the pointer rests on a closed tab before it opens. */
const TAB_DELAY = 450;
/** How near the window's top or bottom something carried scrolls the page, faster the nearer; and how long it rests there first. */
const EDGE = 48;
const EDGE_DELAY = 250;

/** What a toolbox tile adds, as a new part. */
export function newPartOf(spec: string): NewPart | null {
  const at = spec.indexOf(':');
  const [kind, name] = [spec.slice(0, at), spec.slice(at + 1)];
  if (kind === 'kind') return { kind: name };
  if (kind === 'model') return { field: name };
  if (kind === 'block') return { block: name as never };
  if (spec === 'layout:section') return { block: 'group' };
  if (spec === 'layout:tabs') return { block: 'tabs' };
  return null;
}

/** Where a press starts carrying a part: anywhere on one not being typed in, or on the grip of the one that is. */
export function partPressed(target: Element, root: HTMLElement): HTMLElement | null {
  if (target.closest('.fd-field-bar, .fd-simple-lock, .fd-q-option-box, input, textarea, select, [contenteditable="plaintext-only"], [contenteditable="true"]')) return null;
  const control = target.closest('button, a');
  if (control && !control.matches('[data-grip]')) return null;
  const part = target.closest<HTMLElement>('[data-node]');
  if (!part || !root.contains(part) || part.getAttribute('role') === 'tab') return null;
  // The field being edited moves only by its grip: pressing on it otherwise is for its words.
  if (part.classList.contains('fd-editing') && !target.closest('[data-grip]')) return null;
  return part;
}

export function advancedDrag(options: AdvancedDragOptions): AdvancedDrag {
  const { canvas, root, designer } = options;
  const doc = canvas.ownerDocument;
  const rectOf = options.rectOf ?? ((element: Element) => element.getBoundingClientRect());
  const elementAt = options.elementAt ?? ((x: number, y: number) => doc.elementFromPoint(x, y));
  let enabled = true;

  interface Drag {
    source: DragSource;
    element: HTMLElement;
    start: { x: number; y: number };
    started: boolean;
    chip: HTMLElement | null;
    where: HTMLElement | null;
    bar: HTMLElement | null;
    zone: HTMLElement | null;
    drop: Drop | null;
  }
  let drag: Drag | null = null;
  let tabTimer: ReturnType<typeof setTimeout> | undefined;
  let tabUnder: Element | null = null;
  let edgeTimer: ReturnType<typeof setTimeout> | undefined;
  let pointer = { x: 0, y: 0 };

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

  const moving = (d: Drag) => ('node' in d.source ? d.source.node : undefined);

  function begin(source: DragSource, element: HTMLElement, x: number, y: number) {
    drag = { source, element, start: { x, y }, started: false, chip: null, where: null, bar: null, zone: null, drop: null };
  }

  function onDown(event: PointerEvent) {
    if (!enabled || event.button !== 0 || drag) return;
    const part = partPressed(event.target as Element, root);
    if (part) begin({ node: part.dataset['node'] as string }, part, event.clientX, event.clientY);
  }

  /** Where a box in the window is, in the canvas: the marks are drawn in it. */
  function inCanvas(box: { left: number; top: number; width: number; height: number }, element: HTMLElement) {
    const c = rectOf(canvas);
    Object.assign(element.style, { left: `${box.left - c.left}px`, top: `${box.top - c.top}px`, width: `${box.width}px`, height: `${box.height}px` });
  }

  function lift(current: Drag) {
    current.started = true;
    canvas.classList.add('fd-dragging');
    doc.getSelection()?.removeAllRanges();
    const name = 'node' in current.source ? nameOf(designer.getPage(), nodeOf(designer.getPage(), current.source.node), designer.words) : (current.element.querySelector('.fd-tool-name')?.textContent ?? current.element.textContent ?? '').trim();
    const chip = doc.createElement('div');
    chip.className = 'fd-drop-chip';
    chip.setAttribute('aria-hidden', 'true');
    const label = doc.createElement('span');
    label.className = 'fd-drop-name';
    label.textContent = name || designer.words.canvas.part;
    const where = doc.createElement('span');
    where.className = 'fd-drop-where';
    chip.append(label, where);
    const bar = doc.createElement('div');
    bar.className = 'fd-drop-bar';
    bar.hidden = true;
    const zone = doc.createElement('div');
    zone.className = 'fd-drop-zone';
    zone.hidden = true;
    canvas.append(zone, bar, speakLike(chip, canvas));
    Object.assign(current, { chip, where, bar, zone });
    if ('node' in current.source) current.element.classList.add('fd-drag-carried');
  }

  function follow(current: Drag, x: number, y: number) {
    const chip = current.chip as HTMLElement;
    const c = rectOf(canvas);
    // Beside the pointer, out of the way of the line; on its other side where it would run past the canvas's end.
    const width = rectOf(chip).width;
    const after = x - c.left + 16;
    chip.style.left = `${after + width > c.width ? Math.max(0, x - c.left - 16 - width) : after}px`;
    chip.style.top = `${y - c.top + 18}px`;
    const page = designer.getPage();
    const mark: DropMark | null = findDrop({ root, page, rtl: options.rtl(), rectOf }, elementAt(x, y), x, y, moving(current));
    const bar = current.bar as HTMLElement;
    const zone = current.zone as HTMLElement;
    const refused = mark ? designer.dropRefusal(mark.drop, moving(current)) : null;
    current.drop = mark && !refused ? mark.drop : null;
    chip.classList.toggle('fd-drop-refused', !current.drop);
    (current.where as HTMLElement).textContent = !mark ? designer.words.canvas.notHere : (refused ?? designer.describeDrop(mark.drop, moving(current)));
    bar.hidden = !current.drop;
    zone.hidden = !current.drop || !mark?.zone;
    // gap lane: the outline draws where it lands too.
    echo(canvas, { source: 'canvas', drop: current.drop, moving: moving(current) });
    if (mark && current.drop) {
      inCanvas(mark.line, bar);
      if (mark.zone) inCanvas(mark.zone, zone);
    }
  }

  /** Resting on a closed tab opens it, so a part can go into another tab. */
  function restOnTab(x: number, y: number) {
    const tab = elementAt(x, y)?.closest('[role="tab"]:not([aria-selected="true"])') ?? null;
    if (tab === tabUnder) return;
    clearTimeout(tabTimer);
    tabUnder = tab;
    if (tab) tabTimer = setTimeout(() => (tab as HTMLElement).click(), TAB_DELAY);
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
    const view = doc.defaultView;
    const nearEdge = !!view && (y < EDGE || y > view.innerHeight - EDGE);
    if (!nearEdge) {
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
    for (const mark of [current.chip, current.bar, current.zone]) mark?.remove();
    echo(canvas, { source: 'canvas', drop: null });
    current.element.classList.remove('fd-drag-carried');
    canvas.classList.remove('fd-dragging');
    swallowNextClick();
    if (!commit || !current.drop) return;
    const part = 'node' in current.source ? current.source.node : newPartOf(current.source.tool);
    if (!part) return;
    const id = designer.place(part, current.drop);
    if (id) options.placed?.(id, current.source);
  }

  const onUp = () => end(true);
  const onCancel = () => end(false);
  const onKey = (event: KeyboardEvent) => {
    if (event.key === 'Escape' && drag?.started) {
      event.preventDefault();
      event.stopPropagation();
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
      if (!enabled || event.button !== 0 || drag) return;
      begin(source, element, event.clientX, event.clientY);
    },
    setEnabled(on) {
      enabled = on;
      if (!on) end(false);
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
