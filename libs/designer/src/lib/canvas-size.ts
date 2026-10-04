import type { ColumnCount, ColumnsByWidth } from '@fieldia/core';
import type { ElementFactory } from './chrome';
import { designerIcon } from './icons';

/**
 * The size of screen the Advanced canvas shows, as the mockup's switch on its
 * stage: a desktop, a tablet or a phone. Each group shows the columns it has
 * on that size whatever the canvas's own width — worked out by the form's own
 * rules — and on a tablet or a phone the canvas narrows to one. Simple shows a
 * desktop. The choice is the person's, kept in this browser.
 */

export type ScreenSize = 'desktop' | 'tablet' | 'phone';

const KEY = 'fieldia.designer.size';
const SIZES: readonly ScreenSize[] = ['desktop', 'tablet', 'phone'];

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
  set(size: ScreenSize): void;
}

/** Three buttons — a picture each, and its name where there is room — the one shown pressed. */
export function sizeSwitch(el: ElementFactory, doc: Document, size: ScreenSize, change: (size: ScreenSize) => void): SizeSwitch {
  const icons: Record<ScreenSize, string> = { desktop: 'desktop', tablet: 'tablet', phone: 'device' };
  const words: Record<ScreenSize, string> = { desktop: 'Desktop', tablet: 'Tablet', phone: 'Phone' };
  const buttons = SIZES.map((s) => {
    const b = el('button', { type: 'button', class: 'fd-canvas-size', 'data-size': s, title: words[s] }, designerIcon(doc, icons[s]), el('span', { class: 'fd-canvas-size-name' }, words[s]));
    b.addEventListener('click', () => change(s));
    return b;
  });
  const element = el('div', { class: 'fd-canvas-sizes', role: 'group', 'aria-label': 'Screen size' }, ...buttons);
  const set = (now: ScreenSize) => buttons.forEach((b, i) => b.setAttribute('aria-pressed', String(SIZES[i] === now)));
  set(size);
  return { element, set };
}
