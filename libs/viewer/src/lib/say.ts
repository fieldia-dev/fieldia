import type { SayUndo, Tone } from '@fieldia/core';
import type { El } from './dom';

/** How long words stay before they go by themselves: a warning or a danger stays longer, and so do words with Undo. */
const STAY_MS = 6000;
const STAY_LONG_MS = 10000;
const STAY_UNDO_MS = 8000;
/** The most toasts on screen at once: the oldest give way. */
const MOST = 4;

/**
 * Words a step says, as toasts at the foot of the screen: each in its tone,
 * one over another, in a polite live region inside the form — so they wear its
 * skin, scheme and direction. Each goes by itself after a moment, but not
 * while the pointer or the focus is on it, and at once with its ×. They show
 * over a dialog or panel too, and while a modal one is open, a screen reader —
 * which hears only inside it — is told them there as well, unseen. `clear`
 * takes away what was said before: a button pressed again speaks for itself,
 * never under "Customer blocked" once it has made the customer active again.
 *
 * Words a one-tap press said with `undo` carry **Undo** for a few seconds: pressed, the press is taken back, and the
 * toast says so ("Undone.") — or why not, in the words the taking back stopped with.
 */
export function sayer(root: HTMLElement, el: El, dismiss: string, words?: { undoPress: string; pressUndone: string }): ((message: string, tone: Tone, undo?: SayUndo) => void) & { clear(): void } {
  // There before anything is said, so a screen reader hears what comes into it.
  const region = el('div', { class: 'fd-says', role: 'status', 'aria-live': 'polite' });
  root.append(region);
  const say = (message: string, tone: Tone, undo?: SayUndo) => {
    const close = el('button', { type: 'button', class: 'fd-alert-close', 'aria-label': dismiss }, '×');
    const text = el('span', {}, message);
    const back = undo && words ? el('button', { type: 'button', class: 'fd-button fd-button-link fd-say-undo' }, words.undoPress) : null;
    const toast = el('div', { class: 'fd-say', 'data-tone': tone }, text, ...(back ? [back] : []), close);
    const toned = (now: Tone) => toast.style.setProperty('--fd-tone', `var(--fd-${now === 'danger' ? 'error' : now})`);
    // Its edge in its tone's colour, from the scheme's own: a danger is the error colour.
    toned(tone);
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stay = back ? STAY_UNDO_MS : tone === 'warning' || tone === 'danger' ? STAY_LONG_MS : STAY_MS;
    const hold = () => clearTimeout(timer);
    const go = () => {
      hold();
      toast.remove();
    };
    const wait = () => {
      hold();
      // Not while Undo is taking the press back.
      if (!back?.hasAttribute('aria-busy')) timer = setTimeout(go, stay);
    };
    close.addEventListener('click', go);
    toast.addEventListener('mouseenter', hold);
    toast.addEventListener('focusin', hold);
    toast.addEventListener('mouseleave', wait);
    toast.addEventListener('focusout', wait);
    back?.addEventListener('click', async () => {
      if (!undo || back.hasAttribute('aria-busy')) return;
      back.setAttribute('aria-busy', 'true');
      hold();
      const taken = await undo.undo().catch((error: unknown) => ({ done: false, message: error instanceof Error ? error.message : String(error) }));
      // Taken back, or why not: said in its place, Undo gone, the focus kept on the toast's × where it was on Undo.
      const focused = back.ownerDocument.activeElement === back;
      back.remove();
      text.textContent = taken.done ? (words as { pressUndone: string }).pressUndone : (taken.message ?? '');
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
  };
  return Object.assign(say, { clear: () => region.replaceChildren() });
}

/** The words again, unseen, in a live region of the topmost modal dialog the region is not in. */
function echo(region: HTMLElement, el: El, message: string) {
  const modals = [...region.ownerDocument.querySelectorAll<HTMLElement>('[aria-modal="true"]')].filter((m) => !m.contains(region));
  const top = modals[modals.length - 1];
  if (!top) return;
  let heard = top.querySelector<HTMLElement>(':scope > .fd-says-echo');
  if (!heard) {
    heard = el('div', { class: 'fd-says-echo fd-sr-only', role: 'status', 'aria-live': 'polite' });
    top.append(heard);
  }
  heard.textContent = message;
}
