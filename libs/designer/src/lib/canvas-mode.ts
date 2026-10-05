import type { Page, SectionNode } from '@fieldia/core';
import type { ElementFactory } from './chrome';
import { colsOf } from './layout-tree';
import { en } from './locales/en';
import type { DesignerWords } from './designer-words';

/**
 * Simple and Advanced. Simple draws the page exactly as Advanced laid it out
 * and leaves its marks off: no drop lines between parts, no width handles, one
 * part picked at a time. Advanced adds them. Which one is a preference of the
 * person designing, kept in this browser — never part of the page.
 */

export type DesignerMode = 'simple' | 'advanced';

const KEY = 'fieldia.designer.mode';

/** The mode last used in this browser; Simple when there is none, or the browser keeps nothing. */
export function readMode(view: Window | null): DesignerMode {
  try {
    return view?.localStorage.getItem(KEY) === 'advanced' ? 'advanced' : 'simple';
  } catch {
    return 'simple';
  }
}

export function writeMode(view: Window | null, mode: DesignerMode): void {
  try {
    view?.localStorage.setItem(KEY, mode);
  } catch {
    // A browser that keeps nothing: the mode lasts as long as the page.
  }
}

export interface ModeSwitch {
  element: HTMLElement;
  set(mode: DesignerMode): void;
}

/** Two buttons side by side in the editor's bar; the one on is pressed. */
export function modeSwitch(el: ElementFactory, mode: DesignerMode, change: (mode: DesignerMode) => void, words: DesignerWords): ModeSwitch {
  const w = words.bar;
  const button = (name: DesignerMode, words: string, title: string) => {
    const b = el('button', { type: 'button', class: 'fd-mode-button', 'data-mode': name, title }, words);
    b.addEventListener('click', () => change(name));
    return b;
  };
  const simple = button('simple', w.simple, w.simpleTitle);
  const advanced = button('advanced', w.advanced, w.advancedTitle);
  // Drawn as the bar's other switch, Design or Try it, is.
  const element = el('div', { class: 'fd-mode fd-mode-switch', role: 'group', 'aria-label': w.editingMode }, simple, advanced);
  const set = (now: DesignerMode) => {
    simple.setAttribute('aria-pressed', String(now === 'simple'));
    advanced.setAttribute('aria-pressed', String(now === 'advanced'));
  };
  set(mode);
  return { element, set };
}


/** What Simple mode says of an arrangement: how Advanced laid it out, and that it stays so. */
export function lockWords(page: Page, section: SectionNode, words: DesignerWords = en): string {
  const desktop = colsOf(page, section);
  // A width left out stacks as the skin does by itself: one column on a phone.
  const phone = Math.min(desktop, typeof section.columns === 'object' ? (section.columns.narrow ?? 1) : 1);
  return words.canvas.lock(section.children.length, desktop > 1, desktop, phone);
}
