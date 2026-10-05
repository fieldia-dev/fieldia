import type { Page } from '@fieldia/core';
import type { ElementFactory } from './chrome';
import type { Designer } from './designer';
import type { Drop } from './layout-ops';
import { across, isWrapper, locate, nameOf, spanOf } from './layout-tree';
import { laidInTwelfths, rowShare } from './layout-twelfths';
import type { DesignerWords } from './designer-words';
import { en } from './locales/en';

/**
 * Moving parts on the Advanced canvas from the keyboard, as a drag would:
 *
 *  Alt+↑ / Alt+↓       before or after the part next to it, as it is — out of
 *                      an arrangement at its edge, no further than its group;
 *  Alt+← / Alt+→       beside the part before or after it (mirrored right to left);
 *  Alt+Shift+← / →     a column narrower or wider — in twelfths, a twelfth —
 *                      (mirrored right to left);
 *
 * and with what is picked: ⌘G puts it in a group, ⌘⇧G ungroups, ⌘D copies,
 * Delete takes it off the page, Escape puts it down. Each move is said in a
 * polite live region, in the words a drop's chip says.
 */

export type KeyMove = { drop: Drop } | { span: number } | { said: string } | null;

/** What a key does to a part: a drop, a width, or words saying why nothing. */
export function keyMove(page: Page, id: string, key: { key: string; altKey: boolean; shiftKey: boolean }, rtl: boolean, words: DesignerWords = en): KeyMove {
  if (!key.altKey) return null;
  const at = locate(page, id);
  if (!at || at.node.type === 'tab') return null;
  const { list, index, parent } = at;
  if (key.key === 'ArrowUp' || key.key === 'ArrowDown') {
    if (key.shiftKey) return null;
    const down = key.key === 'ArrowDown';
    if (down ? index < list.length - 1 : index > 0) return { drop: { how: 'at', container: parent.id, index: index + (down ? 1 : -1) } };
    // At the edge of an arrangement — there only to lay parts out — it steps out of it.
    const outer = isWrapper(parent) ? locate(page, parent.id) : null;
    if (outer) return { drop: { how: 'at', container: outer.parent.id, index: outer.index + (down ? 1 : 0) } };
    return { said: words.refusals.cannotMoveFurther };
  }
  if (key.key !== 'ArrowLeft' && key.key !== 'ArrowRight') return null;
  const forward = (key.key === 'ArrowRight') !== rtl;
  if (key.shiftKey) {
    const span = spanOf(at.node) + (forward ? 1 : -1);
    return span < 1 ? { said: laidInTwelfths(page, parent) ? words.canvas.twelfthAlready : words.canvas.oneColumnAlready } : { span };
  }
  const beside = list[index + (forward ? 1 : -1)];
  if (!beside) return { said: words.canvas.nothingThatWay };
  return { drop: { how: 'beside', target: beside.id, after: forward } };
}

/** A width said aloud: a fraction of the row in twelfths, else so many columns. */
function widthWords(page: Page, id: string, span: number, words: DesignerWords): string {
  const parent = locate(page, id)?.parent;
  return parent && laidInTwelfths(page, parent) ? rowShare(span, across(page, parent), words) : words.canvas.columnsWide(span);
}

export interface CanvasKeys {
  /** The live region, and the help that lists the keys: for the canvas to hold. */
  said: HTMLElement;
  help: HTMLElement;
  /** Do what a key says, when it says something on the Advanced canvas; whether it did. */
  handle(event: KeyboardEvent): boolean;
  say(words: string): void;
}

export const KEYS: [string, string][] = [
  ['Alt+↑ / Alt+↓', 'Move it before or after the part next to it'],
  ['Alt+← / Alt+→', 'Put it beside the part before or after it'],
  ['Alt+Shift+← / →', 'Make it a column narrower or wider'],
  ['Shift-click', 'Pick several (⌘- or Ctrl-click too)'],
  ['⌘G / ⌘⇧G', 'Put what is picked in a group, or ungroup it (Ctrl on Windows)'],
  ['⌘D', 'Copy what is picked'],
  ['Delete', 'Take what is picked off the page'],
  ['Escape', 'Put it down'],
];

export function canvasKeys(options: { el: ElementFactory; designer: Designer; rtl(): boolean }): CanvasKeys {
  const { el, designer } = options;
  const w = designer.words.canvas;
  const said = el('div', { class: 'fd-canvas-said', role: 'status', 'aria-live': 'polite' });
  const list = el('dl', { class: 'fd-canvas-keys', id: 'fd-canvas-keys', hidden: '' }, ...w.keys.flatMap(([key, what]) => [el('dt', {}, key), el('dd', {}, what)]));
  const toggle = el('button', { type: 'button', class: 'fd-canvas-help-button', 'aria-label': w.keysTitle, title: w.keysTitle, 'aria-expanded': 'false', 'aria-controls': 'fd-canvas-keys' }, '?');
  const open = (on: boolean) => {
    list.hidden = !on;
    toggle.setAttribute('aria-expanded', String(on));
  };
  toggle.addEventListener('click', () => open(list.hidden));
  const help = el('div', { class: 'fd-canvas-help' }, toggle, list);
  const say = (words: string) => {
    said.textContent = words;
  };

  function handle(event: KeyboardEvent): boolean {
    const state = designer.getState();
    const mod = event.metaKey || event.ctrlKey;
    const key = event.key.toLowerCase();
    if (event.key === '?' && !mod) {
      open(list.hidden);
      return true;
    }
    if (!state.picked.length) return false;
    // Only the layout's parts are the canvas's to move: a header's buttons, a list's columns have keys of their own.
    if (!state.picked.every((id) => locate(state.page, id))) return false;
    if (mod && key === 'g') {
      if (event.shiftKey) designer.ungroup(state.selected as string);
      else designer.wrap(state.picked, 'group');
      say(designer.getState().issues[0] ?? (event.shiftKey ? w.ungrouped : w.grouped(state.picked.length)));
      return true;
    }
    if (mod && key === 'd') {
      designer.duplicate(state.picked);
      say(w.copied(state.picked.length));
      return true;
    }
    if (event.key === 'Delete' || event.key === 'Backspace') {
      designer.remove(state.picked);
      say(designer.getState().issues[0] ?? w.tookOff(state.picked.length));
      return true;
    }
    if (state.picked.length !== 1 || !state.selected) return false;
    const id = state.selected;
    const page = state.page;
    const move = keyMove(page, id, event, options.rtl(), designer.words);
    if (!move) return false;
    const name = nameOf(page, locate(page, id)?.node ?? null, designer.words);
    if ('said' in move) say(move.said);
    else if ('span' in move) say(designer.setColspan(id, move.span) ? w.named(name, widthWords(page, id, move.span, designer.words)) : designer.getState().issues[0]);
    else {
      const words = designer.describeDrop(move.drop, id);
      say(designer.place(id, move.drop) ? w.named(name, words) : designer.getState().issues[0]);
    }
    return true;
  }

  return { said, help, handle, say };
}
