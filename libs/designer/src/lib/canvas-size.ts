import type { ColumnCount, ColumnsByWidth } from '@fieldia/core';
import { FORM_WIDTHS } from '@fieldia/widgets';
import type { ElementFactory } from './chrome';
import { designerIcon } from './icons';
import { setHidden, setText } from './writes';

/**
 * The size of screen the Advanced canvas shows, as the mockup's switch on its
 * stage: a desktop, a tablet or a phone. Each group shows the columns it has
 * on that size whatever the canvas's own width — worked out by the form's own
 * rules — and on a tablet or a phone the canvas narrows to one. Simple shows a
 * desktop. The choice is the person's, kept in this browser.
 *
 * The canvas can also be dragged to any width (canvas-resize.ts): the size is
 * then the one the form takes that width for, by its own widths.
 */

export type ScreenSize = 'desktop' | 'tablet' | 'phone';

const KEY = 'fieldia.designer.size';
const WIDTH_KEY = 'fieldia.designer.width';
const SIZES: readonly ScreenSize[] = ['desktop', 'tablet', 'phone'];
export const SIZE_WORDS: Record<ScreenSize, string> = { desktop: 'Desktop', tablet: 'Tablet', phone: 'Phone' };

/** The narrowest the canvas is dragged to: a small phone's screen. */
export const MIN_WIDTH = 320;

/**
 * The size a form this wide is, by the form's own widths (FORM_WIDTHS, the
 * ones its stylesheet lays its groups out by): a phone up to the narrow one,
 * a tablet up to the medium one, a desktop beyond.
 */
export function sizeAt(formWidth: number): ScreenSize {
  if (formWidth <= FORM_WIDTHS.narrow) return 'phone';
  if (formWidth <= FORM_WIDTHS.medium) return 'tablet';
  return 'desktop';
}

export function readSize(view: Window | null): ScreenSize {
  try {
    const kept = view?.localStorage.getItem(KEY);
    return SIZES.includes(kept as ScreenSize) ? (kept as ScreenSize) : 'desktop';
  } catch {
    return 'desktop';
  }
}

export function writeSize(view: Window | null, size: ScreenSize): void {
  try {
    view?.localStorage.setItem(KEY, size);
  } catch {
    // A browser that keeps nothing: the size lasts as long as the page.
  }
}

/** The canvas's own width, dragged to: whole pixels, no narrower than a phone; or none, the size's own. */
export function readWidth(view: Window | null): number | null {
  try {
    const kept = view?.localStorage.getItem(WIDTH_KEY) ?? '';
    const width = /^\d+$/.test(kept) ? Number(kept) : NaN;
    return width >= MIN_WIDTH ? width : null;
  } catch {
    return null;
  }
}

export function writeWidth(view: Window | null, width: number | null): void {
  try {
    if (width === null) view?.localStorage.removeItem(WIDTH_KEY);
    else view?.localStorage.setItem(WIDTH_KEY, String(width));
  } catch {
    // A browser that keeps nothing: the width lasts as long as the page.
  }
}

/**
 * A group's columns on a size of screen, as the form lays them out there: a
 * tablet's own count, or what the skin does by itself — the outlined skin
 * keeps its columns, the underline skin stacks them; a phone's own, or one.
 */
export function columnsAt(columns: ColumnCount | ColumnsByWidth | undefined, size: ScreenSize, skin: string): number {
  const wide = typeof columns === 'object' ? columns.wide : (columns ?? 1);
  const own = typeof columns === 'object' ? columns : null;
  if (size === 'desktop') return wide;
  if (size === 'tablet') return own?.medium ?? (skin === 'underline' ? 1 : wide);
  return own?.narrow ?? 1;
}

export interface SizeSwitch {
  element: HTMLElement;
  /** The canvas's own width beside the switch, once it has one: "640 px". */
  note: HTMLElement;
  /** The size shown pressed, and the canvas's own width, or none. */
  set(size: ScreenSize, width?: number | null): void;
}

/** Three buttons — a picture each, and its name where there is room — the one shown pressed; a note of the width dragged to. */
export function sizeSwitch(el: ElementFactory, doc: Document, size: ScreenSize, change: (size: ScreenSize) => void, width: number | null = null): SizeSwitch {
  const icons: Record<ScreenSize, string> = { desktop: 'desktop', tablet: 'tablet', phone: 'device' };
  const buttons = SIZES.map((s) => {
    const b = el('button', { type: 'button', class: 'fd-canvas-size', 'data-size': s, title: SIZE_WORDS[s] }, designerIcon(doc, icons[s]), el('span', { class: 'fd-canvas-size-name' }, SIZE_WORDS[s]));
    b.addEventListener('click', () => change(s));
    return b;
  });
  const element = el('div', { class: 'fd-canvas-sizes', role: 'group', 'aria-label': 'Screen size' }, ...buttons);
  const note = el('span', { class: 'fd-canvas-size-px', hidden: '' });
  const set = (now: ScreenSize, own: number | null = null) => {
    buttons.forEach((b, i) => {
      const pressed = String(SIZES[i] === now);
      if (b.getAttribute('aria-pressed') !== pressed) b.setAttribute('aria-pressed', pressed);
    });
    setHidden(note, own === null);
    setText(note, own === null ? '' : `${own} px`);
  };
  set(size, width);
  return { element, note, set };
}
