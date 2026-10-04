import type { ElementFactory } from './chrome';
import type { Designer, DesignerState } from './designer';

/**
 * What a whole-page edit did, said where it was done: "Started from the
 * template …", or what the assistant changed, with Undo beside it. It speaks
 * to a screen reader as it appears, and goes away at the next edit, so its
 * Undo only ever takes back the edit it names.
 */

export interface DoneNotice {
  element: HTMLElement;
  /** Say what was done to the page as it is now, with the changes in words; the cursor goes to it. */
  show(words: string, changes?: string[]): void;
  /** Away once the page is not the one it speaks of. */
  update(state: DesignerState): void;
}

/** How many changes are listed before "and N more". */
const LISTED = 8;

export function doneNotice(el: ElementFactory, designer: Designer, afterUndo: () => void): DoneNotice {
  const words = el('p', { class: 'fd-start-done-words' });
  const list = el('ul', { class: 'fd-start-done-changes' });
  const undo = el('button', { type: 'button', class: 'fd-button' }, 'Undo');
  const close = el('button', { type: 'button', class: 'fd-icon-button fd-start-done-close', 'aria-label': 'Close', title: 'Close' }, '×');
  const element = el('div', { class: 'fd-start-done', role: 'status', tabindex: '-1', hidden: '' }, el('div', { class: 'fd-start-done-body' }, words, list), el('div', { class: 'fd-start-done-actions' }, undo, close));
  /** The page it speaks of. */
  let about: object | null = null;
  const hide = () => {
    about = null;
    element.hidden = true;
  };
  undo.addEventListener('click', () => {
    hide();
    designer.undo();
    afterUndo();
  });
  close.addEventListener('click', hide);
  return {
    element,
    show(text, changes = []) {
      // Each in its own direction: English words keep their order on a page right to left.
      words.replaceChildren(el('bdi', {}, text));
      const listed = changes.slice(0, LISTED);
      list.replaceChildren(...listed.map((c) => el('li', {}, el('bdi', {}, c))), ...(changes.length > LISTED ? [el('li', { class: 'fd-start-done-more' }, el('bdi', {}, `and ${changes.length - LISTED} more`))] : []));
      list.hidden = !changes.length;
      about = designer.getPage();
      element.hidden = false;
      // In the middle of the view: at its top, the editor's bar would cover it.
      element.focus({ preventScroll: true });
      element.scrollIntoView?.({ block: 'center' });
    },
    update(state) {
      if (about && state.page !== about) hide();
    },
  };
}
