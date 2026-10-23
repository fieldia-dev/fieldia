import type { SayUndo, Tone } from '@fieldia/core';
import type { El } from './dom';
import type { ViewerLabels } from './labels';
import { undoPart } from './viewer-parts';

/** How long words stay before they go by themselves: a warning or a danger stays longer. */
const STAY_MS = 6000;
const STAY_LONG_MS = 10000;
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
 * Words a one-tap press said with `undo` carry **Undo** for a few seconds: drawn by the undo part (undo-toast.ts), which
 * the press that offers it has brought; said plainly where it cannot come. Words with `act` carry its button — a
 * failed wait's Retry (loading.ts) — which does it and lets the words go.
 */
export function sayer(root: HTMLElement, el: El, words: ViewerLabels): ((message: string, tone: Tone, undo?: SayUndo, act?: { label: string; run(): void }) => void) & { clear(): void } {
  // There before anything is said, so a screen reader hears what comes into it.
  const region = el('div', { class: 'fd-says', role: 'status', 'aria-live': 'polite' });
  root.append(region);
  const say = (message: string, tone: Tone, undo?: SayUndo, act?: { label: string; run(): void }) => {
    if (undo) return void undoPart.load().then((part) => part.undoToast(region, el, words, message, tone, undo), () => say(message, tone));
    const close = el('button', { type: 'button', class: 'fd-alert-close', 'aria-label': words.dismiss }, '×');
    const button = act ? el('button', { type: 'button', class: 'fd-button fd-button-link' }, act.label) : null;
    const toast = el('div', { class: 'fd-say', 'data-tone': tone }, el('span', {}, message), ...(button ? [button] : []), close);
    // Its edge in its tone's colour, from the scheme's own: a danger is the error colour.
    toast.style.setProperty('--fd-tone', `var(--fd-${tone === 'danger' ? 'error' : tone})`);
    let timer: ReturnType<typeof setTimeout> | undefined;
    const hold = () => clearTimeout(timer);
    const go = () => {
      hold();
      toast.remove();
    };
    const wait = () => {
      hold();
      timer = setTimeout(go, tone === 'warning' || tone === 'danger' ? STAY_LONG_MS : STAY_MS);
    };
    close.addEventListener('click', go);
    button?.addEventListener('click', () => {
      go();
      act?.run();
    });
    toast.addEventListener('mouseenter', hold);
    toast.addEventListener('focusin', hold);
    toast.addEventListener('mouseleave', wait);
    toast.addEventListener('focusout', wait);
    region.append(toast);
    while (region.children.length > MOST) region.firstElementChild?.remove();
    echo(region, el, message);
    wait();
  };
  return Object.assign(say, { clear: () => region.replaceChildren() });
}

/** The words again, unseen, in a live region of the topmost modal dialog the region is not in. */
export function echo(region: HTMLElement, el: El, message: string) {
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
