import type { SayUndo, Tone } from '@fieldia/core';
import type { El } from './dom';
import type { ViewerLabels } from './labels';
import { echo } from './say';

/** How long words with Undo stay — long enough to read them and reach it — and the words said after, as say.ts keeps them. */
const STAY_UNDO_MS = 8000;
const STAY_MS = 6000;
const STAY_LONG_MS = 10000;
/** The most toasts on screen at once, as say.ts keeps them: the oldest give way. */
const MOST = 4;

/** Undo between the words and the ×: a link-like button, kept from shrinking. */
const UNDO_CSS = '.fd-say > .fd-say-undo { flex: none; font-weight: 600; padding-inline: 8px; }';

/**
 * Words a one-tap press said with `undo` (sayer's, say.ts), with **Undo** for a few seconds: pressed, the press is
 * taken back, and the toast says so ("Undone.") — or why not, in the words the taking back stopped with. A toast as
 * say.ts draws one — in its tone, gone by itself after a moment but not while the pointer or the focus is on it, nor
 * while Undo is at work — in the undo part, which the press that offers it has brought.
 */
export function undoToast(
  region: HTMLElement,
  el: El,
  words: ViewerLabels,
  message: string,
  tone: Tone,
  undo: SayUndo
): void {
  const doc = region.ownerDocument;
  if (!doc.getElementById('fd-undo-styles')) (doc.head ?? doc.documentElement).append(el('style', { id: 'fd-undo-styles' }, UNDO_CSS));
  const close = el('button', { type: 'button', class: 'fd-alert-close', 'aria-label': words.dismiss }, '×');
  const text = el('span', {}, message);
  const back = el('button', { type: 'button', class: 'fd-button fd-button-link fd-say-undo' }, words.undoPress);
  const toast = el('div', { class: 'fd-say', 'data-tone': tone }, text, back, close);
  // Its edge in its tone's colour, from the scheme's own: a danger is the error colour.
  const toned = (now: Tone) => toast.style.setProperty('--fd-tone', `var(--fd-${now === 'danger' ? 'error' : now})`);
  toned(tone);
  let timer: ReturnType<typeof setTimeout> | undefined;
  let stay = STAY_UNDO_MS;
  const hold = () => clearTimeout(timer);
  const go = () => {
    hold();
    toast.remove();
  };
  const wait = () => {
    hold();
    // Not while Undo is taking the press back.
    if (!back.hasAttribute('aria-busy')) timer = setTimeout(go, stay);
  };
  close.addEventListener('click', go);
  toast.addEventListener('mouseenter', hold);
  toast.addEventListener('focusin', hold);
  toast.addEventListener('mouseleave', wait);
  toast.addEventListener('focusout', wait);
  back.addEventListener('click', async () => {
    if (back.hasAttribute('aria-busy')) return;
    back.setAttribute('aria-busy', 'true');
    hold();
    const taken = await undo.undo().catch((error: unknown) => ({ done: false, message: error instanceof Error ? error.message : String(error) }));
    // Taken back, or why not: said in its place, Undo gone, the focus kept on the toast's × where it was on Undo.
    const focused = doc.activeElement === back;
    back.remove();
    text.textContent = taken.done ? words.pressUndone : (taken.message ?? '');
    if (!taken.done && !taken.message) return go();
    toned(taken.done ? 'info' : 'warning');
    stay = taken.done ? STAY_MS : STAY_LONG_MS;
    if (focused) close.focus();
    echo(region, el, text.textContent);
    wait();
  });
  region.append(toast);
  while (region.children.length > MOST) region.firstElementChild?.remove();
  echo(region, el, message);
  wait();
}
