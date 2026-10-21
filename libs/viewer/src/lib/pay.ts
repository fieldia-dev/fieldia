import { saveProblemOf, type DataSource, type PaidPayment, type PaymentDue, type PayRequest } from '@fieldia/core';
import { setHidden, setText, type El } from './dom';
import type { ViewerLabels } from './labels';
import { installPayStyles } from './pay-styles';

/**
 * A payment the answers wait for — the pay part (`payment` on a page, the data source's `pay`): as a send's checks pass,
 * the questions give way to the payment step — what it is for, the amount in its currency, the page's words about it —
 * and **Pay** hands it to the app's `pay`, inside the press, so the app may open its provider's checkout in a window of
 * its own, or draw it in the step's slot. Waiting, the step says so, with **Cancel**; paid, the answers go with the
 * payment's reference; failed or cancelled, it says which and that nothing was sent, with **Pay again** and **Back to
 * the answers**. Fieldia holds no keys and no provider's code.
 */

/** What the pay part needs of the viewer that draws the page. */
export interface PayContext {
  doc: Document;
  el: El;
  labels: ViewerLabels;
  fill(template: string, values: Record<string, string | number>): string;
  dataSource: DataSource;
  /** The page's language, by tag: how the amount is written. */
  tag: string;
  /** The page's questions and their buttons, once drawn: given way to while the payment step shows. */
  content(): HTMLElement | null;
  /** Words said at once to a screen reader. */
  announce(text: string): void;
}

/** What the viewer places of it, and what its host's `pay` does. */
export interface PayKit {
  /** The payment step, after the questions: hidden until a send waits on it. */
  step: HTMLElement;
  /** The host's payment step (`ActionHost.pay`): shown, settled once paid — or null once the person goes back to the answers. */
  pay(due: PaymentDue, request: PayRequest): Promise<PaidPayment | null>;
  destroy(): void;
}

/** An amount in its currency, as the page's language writes money: its digits Latin, as everywhere in Fieldia. */
export function amountWords(amount: number, currency: string, tag: string): string {
  try {
    return new Intl.NumberFormat(tag, { style: 'currency', currency, numberingSystem: 'latn' }).format(amount);
  } catch {
    return `${currency} ${amount}`;
  }
}

export function drawPay(ctx: PayContext): PayKit {
  const { el, labels, fill, doc } = ctx;
  installPayStyles(doc);
  const title = el('h2', { class: 'fd-pay-title', id: `fd-pay-${Math.random().toString(36).slice(2, 8)}`, tabindex: '-1' });
  const amount = el('p', { class: 'fd-pay-amount' });
  const words = el('p', { class: 'fd-pay-words', hidden: '' });
  const slot = el('div', { class: 'fd-pay-slot' });
  const said = el('p', { class: 'fd-pay-said', role: 'status', 'aria-live': 'polite' });
  const payButton = el('button', { type: 'button', class: 'fd-button fd-button-primary fd-pay-go' });
  const back = el('button', { type: 'button', class: 'fd-button fd-button-link fd-pay-back' }, labels.payBack);
  const cancel = el('button', { type: 'button', class: 'fd-button fd-pay-cancel', hidden: '' }, labels.payCancel);
  const note = el('p', { class: 'fd-pay-note' }, labels.payNothingSent);
  const step = el('section', { class: 'fd-pay', 'aria-labelledby': title.id, hidden: '' }, title, amount, words, slot, said, el('div', { class: 'fd-pay-row' }, payButton, cancel, back), note);

  /** The payment asked for now, and how its promise settles. */
  let asked: { due: PaymentDue; request: PayRequest; settle(paid: PaidPayment | null): void } | null = null;
  let going: AbortController | null = null;
  let gone = false;
  const say = (text: string, error = false) => {
    setText(said, text);
    said.classList.toggle('fd-pay-error', error);
  };
  /** Back to the answers, or on to the send: the step gives way to them again. */
  const leave = (paid: PaidPayment | null) => {
    const now = asked;
    asked = null;
    setHidden(step, true);
    const content = ctx.content();
    if (content) content.hidden = false;
    now?.settle(paid);
  };
  const waiting = (on: boolean) => {
    setHidden(payButton, on);
    setHidden(back, on);
    setHidden(cancel, !on);
    step.toggleAttribute('aria-busy', on);
  };

  payButton.addEventListener('click', () => {
    const now = asked;
    if (!now || going) return;
    going = new AbortController();
    const signal = going.signal;
    slot.replaceChildren();
    waiting(true);
    say(labels.payWaiting);
    let answer: ReturnType<NonNullable<DataSource['pay']>>;
    try {
      // Called inside the press: the app may open its provider's checkout in a window of its own.
      answer = (ctx.dataSource.pay as NonNullable<DataSource['pay']>)({ ...now.request, slot, signal });
    } catch (error) {
      answer = Promise.reject(error);
    }
    answer.then(
      (result) => {
        going = null;
        if (gone || asked !== now) return;
        waiting(false);
        if (result.status === 'paid') {
          const words = result.reference ? fill(labels.payPaidReference, { reference: result.reference }) : labels.payPaid;
          say(words);
          ctx.announce(words);
          leave({ amount: now.due.amount, currency: now.due.currency, key: now.due.key, ...(result.reference ? { reference: result.reference } : {}) });
          return;
        }
        payButton.textContent = labels.payAgain;
        const why = result.status === 'cancelled' ? labels.payCancelled : result.message ? fill(labels.payFailedWhy, { why: result.message }) : labels.payFailed;
        say(why, true);
        ctx.announce(why);
      },
      (error: unknown) => {
        going = null;
        if (gone || asked !== now) return;
        waiting(false);
        payButton.textContent = labels.payAgain;
        const stopped = signal.aborted || (error as { name?: string } | null)?.name === 'AbortError';
        const problem = saveProblemOf(error);
        const why = stopped ? labels.payCancelled : problem.kind === 'rule' ? problem.message : labels.payNotStarted;
        say(why, true);
        ctx.announce(why);
      }
    );
  });
  cancel.addEventListener('click', () => {
    // The app's checkout is told to stop; what it answers then is what the step says.
    going?.abort();
    say(labels.payCancelling);
  });
  back.addEventListener('click', () => leave(null));

  return {
    step,
    pay(due, request) {
      // Asked again while one waits (a second press of Submit): the one shown is the one paid.
      if (asked) asked.settle(null);
      return new Promise((settle) => {
        asked = { due, request, settle };
        const written = amountWords(due.amount, due.currency, ctx.tag);
        setText(title, due.label);
        setText(amount, written);
        setText(words, due.description ?? '');
        setHidden(words, !due.description);
        setText(payButton, fill(labels.payAmount, { amount: written }));
        say('');
        waiting(false);
        slot.replaceChildren();
        const content = ctx.content();
        if (content) content.hidden = true;
        setHidden(step, false);
        title.focus();
      });
    },
    destroy() {
      gone = true;
      going?.abort();
      leave(null);
      step.remove();
    },
  };
}
