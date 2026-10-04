import type { Page, SectionNode } from '@fieldia/core';
import type { ElementFactory } from './chrome';
import { colsOf } from './layout-tree';

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
export function modeSwitch(el: ElementFactory, mode: DesignerMode, change: (mode: DesignerMode) => void): ModeSwitch {
  const button = (name: DesignerMode, words: string, title: string) => {
    const b = el('button', { type: 'button', class: 'fd-mode-button', 'data-mode': name, title }, words);
    b.addEventListener('click', () => change(name));
    return b;
  };
  const simple = button('simple', 'Simple', 'Simple: pick a part and edit it where it stands');
  const advanced = button('advanced', 'Advanced', 'Advanced: drop parts beside, under or between others, set widths, pick several');
  // Drawn as the bar's other switch, Design or Try it, is.
  const element = el('div', { class: 'fd-mode fd-mode-switch', role: 'group', 'aria-label': 'Editing mode' }, simple, advanced);
  const set = (now: DesignerMode) => {
    simple.setAttribute('aria-pressed', String(now === 'simple'));
    advanced.setAttribute('aria-pressed', String(now === 'advanced'));
  };
  set(mode);
  return { element, set };
}

const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? '' : 's'}`;

/** What Simple mode says of an arrangement: how Advanced laid it out, and that it stays so. */
export function lockWords(page: Page, section: SectionNode): string {
  const desktop = colsOf(page, section);
  // A width left out stacks as the skin does by itself: one column on a phone.
  const phone = Math.min(desktop, typeof section.columns === 'object' ? (section.columns.narrow ?? 1) : 1);
  const how = desktop > 1 ? 'side by side' : 'together';
  return `Laid out in Advanced: ${plural(section.children.length, 'part')} ${how}, ${plural(desktop, 'column')} on a desktop and ${phone} on a phone.`;
}
