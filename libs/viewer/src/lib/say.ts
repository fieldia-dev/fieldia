import type { Tone } from '@fieldia/core';
import type { El } from './dom';

/** How long words stay before they go by themselves: a warning or a danger stays longer. */
const STAY_MS = 6000;
const STAY_LONG_MS = 10000;
/** The most toasts on screen at once: the oldest give way. */
const MOST = 4;

/**
 * Words a step says, as toasts at the foot of the screen: each in its tone,
 * one over another, in a polite live region inside the form — so they wear its
 * skin, scheme and direction. Each goes by itself after a moment, but not
 * while the pointer or the focus is on it, and at once with its ×.
 */
export function sayer(root: HTMLElement, el: El, dismiss: string): (message: string, tone: Tone) => void {
  // There before anything is said, so a screen reader hears what comes into it.
  const region = el('div', { class: 'fd-says', role: 'status', 'aria-live': 'polite' });
  root.append(region);
  return (message, tone) => {
    const close = el('button', { type: 'button', class: 'fd-alert-close', 'aria-label': dismiss }, '×');
    const toast = el('div', { class: 'fd-say', 'data-tone': tone }, el('span', {}, message), close);
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
    toast.addEventListener('mouseenter', hold);
    toast.addEventListener('focusin', hold);
    toast.addEventListener('mouseleave', wait);
    toast.addEventListener('focusout', wait);
    region.append(toast);
    while (region.children.length > MOST) region.firstElementChild?.remove();
    wait();
  };
}
