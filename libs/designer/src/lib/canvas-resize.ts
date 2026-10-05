import { MIN_WIDTH, SIZE_WORDS, sizeAt, type ScreenSize } from './canvas-size';
import type { ElementFactory } from './chrome';
import { setAttr, setText } from './writes';

/**
 * The canvas dragged to any width, as Designable's is: a handle on its end
 * edge (the left one, right to left) sets a width from a phone's to the
 * stage's whole, between the Desktop, Tablet and Phone steps. While it is
 * dragged a chip by the handle says the width and the size the form takes it
 * for, by the form's own widths (`sizeAt`), and each group shows the columns
 * it has there. The canvas stays in the stage's middle, as a tablet's does, so
 * its edge follows the pointer: two pixels of width for each it moves.
 *
 * The handle is a vertical separator: ← and → move it ten pixels (mirrored
 * right to left), Shift a hundred, Home and End to a phone's and the stage's
 * width; a double-click goes back to the size's own width.
 *
 * One frame per redraw: pointer moves are gathered into a single animation
 * frame, which only writes. What is measured — the canvas, the stage — is read
 * as a drag starts, as a key is pressed, and in the canvas's own frame before
 * it writes (`read`).
 */

/** The canvas's width now, the stage's (the most it can be), and the room the canvas keeps round the form inside it. */
export interface CanvasMeasure {
  width: number;
  room: number;
  inset: number;
}

export interface CanvasResizeOptions {
  el: ElementFactory;
  canvas: HTMLElement;
  rtl(): boolean;
  /** The size shown now. */
  size(): ScreenSize;
  /** A width dragged or keyed to, and the size the form takes it for: as a drag goes, and once more when it is let go (`done`). */
  change(width: number, size: ScreenSize, done: boolean): void;
  /** Back to the size's own width: a double-click on the handle. */
  reset(): void;
  /** Words for the live region. */
  say(words: string): void;
  /** Read off the page by default. */
  measure?(): CanvasMeasure;
}

export interface CanvasResize {
  element: HTMLElement;
  /** Measure now, before the frame writes; what to write after — the handle's values. Nothing while it is dragged. */
  read(): (() => void) | null;
  destroy(): void;
}

/** A drag's width: two pixels for each the pointer moves outwards, as the canvas stays in the stage's middle. */
export function dragWidth(at: { start: number; from: number; x: number; rtl: boolean }): number {
  return at.start + 2 * (at.rtl ? at.from - at.x : at.x - at.from);
}

/** No narrower than a phone, no wider than the stage, in whole pixels. */
export function clampWidth(width: number, room: number): number {
  return Math.round(Math.max(MIN_WIDTH, Math.min(width, room)));
}

/** A key's width: ← and → ten pixels (mirrored right to left), Shift a hundred, Home and End the least and the most; null for a key not the handle's. */
export function keyWidth(width: number, key: { key: string; shiftKey: boolean; altKey?: boolean; ctrlKey?: boolean; metaKey?: boolean }, rtl: boolean, room: number): number | null {
  if (key.altKey || key.ctrlKey || key.metaKey) return null;
  if (key.key === 'Home') return MIN_WIDTH;
  if (key.key === 'End') return clampWidth(room, room);
  if (key.key !== 'ArrowLeft' && key.key !== 'ArrowRight') return null;
  const wider = (key.key === 'ArrowRight') !== rtl;
  return clampWidth(width + (wider ? 1 : -1) * (key.shiftKey ? 100 : 10), room);
}

/** The chip's words: "640 px · Tablet". */
export const chipWords = (width: number, size: ScreenSize) => `${width} px · ${SIZE_WORDS[size]}`;
/** A screen reader's: "640 pixels, tablet". */
export const valueWords = (width: number, size: ScreenSize) => `${width} pixels, ${size}`;

export function canvasResize(options: CanvasResizeOptions): CanvasResize {
  const { el, canvas } = options;
  const doc = canvas.ownerDocument;
  const view = doc.defaultView;
  /** Pixels of a computed style's properties, added up. */
  const px = (style: CSSStyleDeclaration | undefined, ...names: string[]) => names.reduce((sum, name) => sum + (parseFloat(style?.getPropertyValue(name) ?? '') || 0), 0);
  const across = ['padding-left', 'padding-right', 'border-left-width', 'border-right-width'];
  const measure =
    options.measure ??
    ((): CanvasMeasure => {
      const stage = canvas.parentElement;
      const room = stage ? stage.getBoundingClientRect().width - px(view?.getComputedStyle(stage), ...across) : canvas.getBoundingClientRect().width;
      return { width: canvas.getBoundingClientRect().width, room, inset: px(view?.getComputedStyle(canvas), ...across) };
    });

  const chip = el('span', { class: 'fd-canvas-resize-chip', 'aria-hidden': 'true' });
  const grip = el('span', { class: 'fd-canvas-resize-grip' }, chip);
  const element = el(
    'div',
    {
      class: 'fd-canvas-resize',
      role: 'separator',
      'aria-orientation': 'vertical',
      'aria-label': 'Screen width',
      'aria-valuemin': String(MIN_WIDTH),
      tabindex: '0',
      title: 'Drag to change the width · double-click for the size’s own',
    },
    grip
  );
  canvas.append(element);

  /** The handle's values, and the chip's words, for a width and its size. */
  function show(width: number, room: number, size: ScreenSize) {
    setAttr(element, 'aria-valuenow', String(width));
    setAttr(element, 'aria-valuemax', String(Math.max(MIN_WIDTH, Math.round(room))));
    setAttr(element, 'aria-valuetext', valueWords(width, size));
    setText(chip, chipWords(width, size));
  }

  // ---- the pointer ---------------------------------------------------------------
  let drag: { end(commit: boolean): void } | null = null;

  const onDown = (event: PointerEvent) => {
    if (event.button !== 0 || drag) return;
    event.preventDefault();
    event.stopPropagation();
    // Captured, a fast drag never loses the handle; the moves still come up to the document.
    try {
      element.setPointerCapture?.(event.pointerId);
    } catch {
      // A pointer the browser no longer has: the document's moves are enough.
    }
    const m = measure();
    const rtl = options.rtl();
    const from = event.clientX;
    let x = from;
    let moved = false;
    let frame = 0;
    let width = Math.round(m.width);
    let size = options.size();
    const settle = () => {
      width = clampWidth(dragWidth({ start: m.width, from, x, rtl }), m.room);
      size = sizeAt(width - m.inset);
      show(width, m.room, size);
    };
    const draw = () => {
      frame = 0;
      settle();
      options.change(width, size, false);
    };
    const move = (e: PointerEvent) => {
      x = e.clientX;
      if (x !== from) moved = true;
      if (moved && !frame) frame = view?.requestAnimationFrame ? view.requestAnimationFrame(draw) : (draw(), 0);
    };
    const end = (commit: boolean) => {
      doc.removeEventListener('pointermove', move);
      doc.removeEventListener('pointerup', up);
      doc.removeEventListener('pointercancel', up);
      if (frame) view?.cancelAnimationFrame(frame);
      frame = 0;
      drag = null;
      element.removeAttribute('data-active');
      if (!commit || !moved) return;
      settle();
      options.change(width, size, true);
      options.say(valueWords(width, size));
    };
    // Let go, or taken by the browser: the width shown is the one kept.
    const up = () => end(true);
    doc.addEventListener('pointermove', move);
    doc.addEventListener('pointerup', up);
    doc.addEventListener('pointercancel', up);
    drag = { end };
    show(width, m.room, size);
    element.setAttribute('data-active', '');
    // Its keys go on from where the pointer left it.
    element.focus({ preventScroll: true });
  };

  // ---- the keys ------------------------------------------------------------------
  const onKey = (event: KeyboardEvent) => {
    if (drag) return;
    const m = measure();
    const now = Math.round(m.width);
    const next = keyWidth(now, event, options.rtl(), m.room);
    if (next === null) return;
    event.preventDefault();
    event.stopPropagation();
    if (next === now) return;
    const size = sizeAt(next - m.inset);
    show(next, m.room, size);
    options.change(next, size, true);
    options.say(valueWords(next, size));
  };

  const onDouble = (event: MouseEvent) => {
    event.preventDefault();
    options.reset();
  };
  element.addEventListener('pointerdown', onDown);
  element.addEventListener('keydown', onKey);
  element.addEventListener('dblclick', onDouble);

  return {
    element,
    read() {
      if (drag) return null;
      const m = measure();
      return () => show(Math.round(m.width), m.room, options.size());
    },
    destroy() {
      drag?.end(false);
      element.removeEventListener('pointerdown', onDown);
      element.removeEventListener('keydown', onKey);
      element.removeEventListener('dblclick', onDouble);
      element.remove();
    },
  };
}
