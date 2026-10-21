import type { Form, FormState } from '@fieldia/core';
import { setHidden, setText, type El } from './dom';
import type { ViewerLabels } from './labels';
import { installOutboxStyles } from './outbox-styles';

/**
 * An offline outbox, on screen — the outbox part (`outbox` on a page): over the form, what waits on this device to be
 * sent and **Send now**, while it is sent, and a send the server refused once it went — its words, **Try again** and
 * **Discard** (asked first). It is sent as the signal comes back (the browser's `online`), every half a minute while
 * something waits, as the page opens (what waited from before a reload), and right after another send went through.
 * "No signal" is said by the last try, never by the browser's `navigator.onLine`: some browsers say offline throughout
 * (WebKit on Linux), others online behind a network that answers nothing — a try costs one failed request. A response kept without signal ends with
 * "Kept on this device" in place of the thanks, the bar under it — so what is sent, or refused, is said there too — and
 * back over the form once another response is started.
 */

/** What the outbox part needs of the viewer that draws the page. */
export interface OutboxContext {
  form: Form;
  doc: Document;
  el: El;
  labels: ViewerLabels;
  fill(template: string, values: Record<string, string | number>): string;
  /** Words said at once to a screen reader. */
  announce(text: string): void;
  /** A question answered Yes or No: Discard's. */
  ask(message: string): Promise<boolean>;
}

/** What the viewer places of it. */
export interface OutboxKit {
  /** The bar over the form: what waits, Send now, what was refused. */
  bar: HTMLElement;
  update(state: FormState): void;
  /** A response kept on the device: its ending's title and words in place of the thanks, the bar under them. */
  ending(title: HTMLElement, words: HTMLElement): void;
  destroy(): void;
}

/** How often what waits is tried again while it waits, in ms. */
const AGAIN_MS = 30_000;

export function watchOutbox(ctx: OutboxContext): OutboxKit {
  const { form, el, labels, fill, doc } = ctx;
  installOutboxStyles(doc);
  const win = doc.defaultView;
  const said = el('span', { class: 'fd-outbox-said' });
  const now = el('button', { type: 'button', class: 'fd-button fd-button-link fd-outbox-send', hidden: '' }, labels.outboxSendNow);
  const refused = el('ul', { class: 'fd-outbox-refused', hidden: '' });
  const bar = el('div', { class: 'fd-outbox', role: 'status', 'aria-live': 'polite', hidden: '' }, el('div', { class: 'fd-outbox-row' }, said, now), refused);
  const send = () => void form.outbox()?.send();
  now.addEventListener('click', send);
  // Back online: what waited goes; and every half a minute while something waits, in case the browser did not say so.
  const online = () => send();
  win?.addEventListener('online', online);
  // Another send went through: there is signal, and what waited goes after it.
  const went = (event: { queued?: unknown }) => !event.queued && send();
  const offs = [form.on('send', went), form.on('save', went)];
  let timer: number | undefined;
  /** The refusals drawn, by key, so a redraw keeps the focus where it is. */
  let drawnRefused = '';
  /** Whether something waited since the page opened: once nothing does, "Everything was sent" is said — aloud once. */
  let waited = false;
  let saidSent = false;
  /** Where the bar stands over the form while it is under a kept response's ending. */
  let home: Comment | null = null;
  // What waited from before a reload goes as the page opens.
  queueMicrotask(send);
  return {
    bar,
    update(state) {
      // Another response started: the bar back over the form.
      if (home && !state.sent) {
        home.replaceWith(bar);
        home = null;
      }
      const box = state.outbox;
      const waiting = box?.waiting ?? 0;
      const kept = box?.refused ?? [];
      if (waiting > 0 && timer === undefined && win) timer = win.setInterval(send, AGAIN_MS);
      if (waiting === 0 && timer !== undefined) {
        win?.clearInterval(timer);
        timer = undefined;
      }
      if (waiting > 0) {
        waited = true;
        saidSent = false;
      }
      const allSent = waited && !waiting && !box?.sending && !kept.length;
      const words = box?.sending && waiting ? labels.outboxSending : waiting ? [box?.offline ? labels.outboxOffline : '', waiting === 1 ? labels.outboxWaitingOne : fill(labels.outboxWaiting, { count: waiting })].filter(Boolean).join(' ') : allSent ? labels.outboxSent : '';
      if (allSent && !saidSent) {
        saidSent = true;
        ctx.announce(labels.outboxSent);
      }
      setText(said, words);
      setHidden(now, !waiting || !!box?.sending);
      const key = JSON.stringify(kept);
      if (key !== drawnRefused) {
        drawnRefused = key;
        refused.replaceChildren(
          ...kept.map((one) => {
            const again = el('button', { type: 'button', class: 'fd-button fd-button-link' }, labels.outboxRetry);
            again.addEventListener('click', () => void form.outbox()?.retry(one.key));
            const discard = el('button', { type: 'button', class: 'fd-button fd-button-link' }, labels.outboxDiscard);
            discard.addEventListener('click', () => {
              void ctx.ask(labels.outboxDiscardAsk).then((yes) => {
                if (!yes) return;
                // Let go, not sent: nothing is said to have gone.
                waited = (form.getState().outbox?.waiting ?? 0) > 0;
                void form.outbox()?.discard(one.key);
              });
            });
            return el('li', {}, el('span', {}, fill(labels.outboxRefused, { why: one.message })), again, discard);
          })
        );
      }
      setHidden(refused, !kept.length);
      setHidden(bar, !words && !kept.length);
      bar.classList.toggle('fd-outbox-problem', kept.length > 0);
    },
    ending(title, words) {
      setText(title, labels.outboxKeptTitle);
      if (!home) {
        home = doc.createComment('');
        bar.before(home);
      }
      words.replaceChildren(el('p', {}, labels.outboxKeptWords), bar);
      words.hidden = false;
    },
    destroy() {
      win?.removeEventListener('online', online);
      for (const off of offs) off();
      if (timer !== undefined) win?.clearInterval(timer);
      home?.remove();
      bar.remove();
    },
  };
}
