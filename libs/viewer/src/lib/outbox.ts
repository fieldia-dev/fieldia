import { setHidden, setText } from './dom';
import type { JoinContext, PageJoin } from './joins';
import { installOutboxStyles } from './outbox-styles';

/**
 * An offline outbox, on screen — the outbox part (`outbox` on a page): over the form, what waits on this device to be
 * sent and **Send now**, while it is sent, and a send the server refused once it went — its words, **Try again** and
 * **Discard** (asked first). It is sent by its own tries, never by the browser's word alone: soon after a send is kept
 * and less often while it waits — after 2 seconds, then 4, 8 and 16, then every half a minute —, as the signal comes
 * back (the browser's `online`), as the page comes back into view (a phone unlocked, its tab gone back to: a phone's
 * timers sleep while its page is out of sight), as the page opens (what waited from before a reload), and right after
 * another send went through. "No signal" is said by the last try, never by the browser's `navigator.onLine`: some
 * browsers say offline throughout and never say `online` — WebKit on a Linux whose NetworkManager runs none of its
 * network says "offline" as its connection comes back —, others online behind a network that answers nothing (a
 * captive portal, Wi-Fi with no way out) — a try costs one failed request. A response kept without signal ends with
 * "Kept on this device" in place of the thanks (`state.outbox.kept`), the bar under it — so what is sent, or refused,
 * is said there too — and back over the form once another response is started.
 */

/** The first try again after a send is kept, in ms: each later one waits twice as long, up to `AGAIN_MS`. */
const FIRST_MS = 2_000;
/** How often what waits is tried again once it has waited a while, in ms. */
const AGAIN_MS = 30_000;

/** The outbox part's side of a page (joins.ts): its bar over the questions, and a kept response's ending. */
export const draw = (ctx: JoinContext): PageJoin => watchOutbox(ctx);

export function watchOutbox(ctx: JoinContext): PageJoin & { bar: HTMLElement } {
  const { form, el, labels, fill, doc } = ctx;
  installOutboxStyles(doc);
  const win = doc.defaultView;
  const said = el('span', { class: 'fd-outbox-said' });
  const now = el('button', { type: 'button', class: 'fd-button fd-button-link fd-outbox-send', hidden: '' }, labels.outboxSendNow);
  const refused = el('ul', { class: 'fd-outbox-refused', hidden: '' });
  const bar = el('div', { class: 'fd-outbox', role: 'status', 'aria-live': 'polite', hidden: '' }, el('div', { class: 'fd-outbox-row' }, said, now), refused);
  const send = () => void form.joined('outbox')?.send();
  now.addEventListener('click', send);
  // Back online, or the page in sight again: what waited goes — besides its own tries, as the browser may say neither.
  const online = () => send();
  const seen = () => doc.visibilityState === 'visible' && send();
  win?.addEventListener('online', online);
  doc.addEventListener('visibilitychange', seen);
  /** The next try while something waits; how many tries came before it since something began to wait; what waited. */
  let timer: number | undefined;
  let tries = 0;
  let before = 0;
  /** The refusals drawn, by key, so a redraw keeps the focus where it is. */
  let drawnRefused = '';
  /** Whether something waited since the page opened: once nothing does, "Everything was sent" is said — aloud once. */
  let waited = false;
  let saidSent = false;
  /** Where the bar stands over the form while it is under a kept response's ending. */
  let home: Comment | null = null;
  /** A kept response's words under its ending's title, and the title it had before. */
  let mine: HTMLElement | null = null;
  let thanks = '';
  // What waited from before a reload goes as the page opens.
  queueMicrotask(send);
  return {
    bar,
    before: [bar],
    update(state) {
      // Another response started: the bar back over the form.
      if (home && !state.sent) {
        home.replaceWith(bar);
        home = null;
      }
      const box = state.outbox;
      const waiting = box?.waiting ?? 0;
      const kept = box?.refused ?? [];
      // A send kept anew: tried again soon, the waits from the first; nothing waiting: no more tries.
      if (waiting === 0 || waiting > before) {
        if (timer !== undefined) win?.clearTimeout(timer);
        timer = undefined;
        tries = 0;
      }
      before = waiting;
      if (waiting > 0 && timer === undefined && win) {
        timer = win.setTimeout(() => {
          timer = undefined;
          tries++;
          send();
        }, Math.min(AGAIN_MS, FIRST_MS * 2 ** tries));
      }
      if (waiting > 0) {
        waited = true;
        saidSent = false;
      }
      const allSent = waited && !waiting && !box?.sending && !kept.length;
      // Held by this page alone (no IndexedDB): said so, never "on this device".
      const [one, many] = box?.lasting === false ? [labels.outboxWaitingPageOne, labels.outboxWaitingPage] : [labels.outboxWaitingOne, labels.outboxWaiting];
      const words = box?.sending && waiting ? labels.outboxSending : waiting ? [box?.offline ? labels.outboxOffline : '', waiting === 1 ? one : fill(many, { count: waiting })].filter(Boolean).join(' ') : allSent ? labels.outboxSent : '';
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
            again.addEventListener('click', () => void form.joined('outbox')?.retry(one.key));
            const discard = el('button', { type: 'button', class: 'fd-button fd-button-link' }, labels.outboxDiscard);
            discard.addEventListener('click', () => {
              void ctx.ask(labels.outboxDiscardAsk).then((yes) => {
                if (!yes) return;
                // Let go, not sent: nothing is said to have gone.
                waited = (form.getState().outbox?.waiting ?? 0) > 0;
                void form.joined('outbox')?.discard(one.key);
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
      // Sent as ever: the ending as it was, the page's own words back.
      if (!form.getState().outbox?.kept) {
        if (mine) {
          mine.remove();
          mine = null;
          setText(title, thanks);
          if (words) words.hidden = false;
        }
        return false;
      }
      // Kept on the device: said so in place of the thanks and any ending, the bar under it.
      if (!mine) {
        thanks = title.textContent ?? '';
        mine = el('div', { class: 'fd-done-text' });
        title.after(mine);
      }
      if (!home) {
        home = doc.createComment('');
        bar.before(home);
      }
      // Held by this page alone where the browser keeps nothing past it: said so, never "Kept on this device".
      const lasting = form.getState().outbox?.lasting !== false;
      setText(title, lasting ? labels.outboxKeptTitle : labels.outboxPageTitle);
      if (words) words.hidden = true;
      mine.replaceChildren(el('p', {}, lasting ? labels.outboxKeptWords : labels.outboxPageWords), bar);
      return true;
    },
    destroy() {
      win?.removeEventListener('online', online);
      doc.removeEventListener('visibilitychange', seen);
      if (timer !== undefined) win?.clearTimeout(timer);
      home?.remove();
      mine?.remove();
      bar.remove();
    },
  };
}
