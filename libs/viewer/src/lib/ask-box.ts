import type { AskHow } from '@fieldia/core';
import type { El } from './dom';
import { keepTabIn } from './focus-trap';
import type { ViewerLabels } from './labels';

/** What the viewer's own question box is drawn with: the form it is asked over, and its words. */
export interface AskContext {
  root: HTMLElement;
  el: El;
  labels: ViewerLabels;
  /** The viewer's own prefix for its ids. */
  prefix: string;
}

/**
 * The viewer's own question (the acts part's, viewer.ts asks through it): Cancel and its Yes, or with `how.alone` a
 * notice with OK alone. A question opens with the focus on Cancel — a button's `confirm`, an `ask` step, Archive, Delete
 * and "Discard your changes?" alike — so an Enter meant for the form, or a second press of the key that asked, never
 * answers Yes by itself; a notice, on OK. `how.yes` words Yes as what it does (the button's own words, Archive,
 * Discard), OK without it; `how.ended` is told the moment it is answered, before the promise settles.
 */
export function askBox({ root, el, labels, prefix }: AskContext, message: string, how: AskHow & { alone?: boolean; ended?: () => void } = {}): Promise<boolean> {
  const withCancel = !how.alone;
  return new Promise((resolve) => {
    const text = el('p', { id: `${prefix}-confirm` }, message);
    const cancel = el('button', { type: 'button', class: 'fd-button' }, labels.cancel);
    const ok = el('button', { type: 'button', class: 'fd-button fd-button-primary' }, how.yes || labels.ok);
    const dialog = el('div', { class: 'fd-dialog', role: 'alertdialog', 'aria-modal': 'true', 'aria-labelledby': text.id }, text, el('div', { class: 'fd-actions fd-actions-end' }, ...(withCancel ? [cancel, ok] : [ok])));
    const backdrop = el('div', { class: 'fd-dialog-backdrop' }, dialog);
    const doc = root.ownerDocument;
    const opener = doc.activeElement as HTMLElement | null;
    const close = (answer: boolean) => {
      backdrop.remove();
      // Back to what had focus when it asked; or, when that let go of it — Save hides while it saves — to Save, shown again.
      const shown = (e: HTMLElement | null) => !!e && e !== doc.body && e.isConnected && !e.closest('[hidden]');
      const back = shown(opener) ? opener : root.querySelector<HTMLElement>('button[type="submit"]:not([hidden])');
      back?.focus();
      how.ended?.();
      resolve(answer);
    };
    cancel.addEventListener('click', () => close(false));
    ok.addEventListener('click', () => close(true));
    // Its keys are its own: Escape answers No here, and closes no dialog or panel under it.
    backdrop.addEventListener('keydown', (event) => {
      event.stopPropagation();
      if (event.key === 'Escape') {
        event.preventDefault();
        close(false);
      } else keepTabIn(dialog, event);
    });
    // Asked where it is seen: over a page opened in this one's place (its breadcrumb leaving this record), in that one.
    const over = root.hidden ? [...(root.parentElement?.children ?? [])].reverse().find((child): child is HTMLElement => child !== root && child.matches('form.fd-form') && !(child as HTMLElement).hidden) : undefined;
    (over ?? root).append(backdrop);
    (withCancel ? cancel : ok).focus();
  });
}
