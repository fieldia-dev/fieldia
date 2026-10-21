import type { Page } from '@fieldia/core';
import type { ElementFactory } from './chrome';
import type { Designer } from './designer';
import { settingNumber } from './number-box';
import { setting } from './panel-controls';

/**
 * A payment the answers wait for (`payment`), on the screen's panel (panel-page.ts) beside its other rules: asked or
 * not, what it is for, how much — a number, or a number or money field of the page — its currency, and words under it.
 * Paid through the app's own data source (`pay`): the hint says so. A condition of its own (`when`) is the page's JSON's.
 */
export function paymentSettings(el: ElementFactory, designer: Designer): { rows: HTMLElement[]; update(page: Page): void; destroy(): void } {
  const w = designer.words.panel;
  const focused = (node: Element) => node.ownerDocument.activeElement === node;
  const payment = () => designer.getPage().payment;
  const on = el('input', { type: 'checkbox', class: 'fd-check', 'aria-label': w.paymentOn }) as HTMLInputElement;
  on.addEventListener('change', () => designer.setPayment(on.checked ? {} : null));
  const label = el('input', { class: 'fd-input', 'aria-label': w.paymentLabel, placeholder: w.paymentLabelExample }) as HTMLInputElement;
  label.addEventListener('change', () => designer.setPayment({ label: label.value }));
  const amount = settingNumber(el, designer, {
    label: w.paymentAmount,
    attrs: { class: 'fd-input', 'aria-label': w.paymentAmount },
    min: 0.01,
    optional: true,
    saved: () => (typeof payment()?.amount === 'number' ? (payment()?.amount as number) : null),
    commit: (n) => designer.setPayment({ amount: n }),
  });
  const from = el('select', { class: 'fd-input fd-select', 'aria-label': w.paymentFrom }) as HTMLSelectElement;
  from.addEventListener('change', () => designer.setPayment({ amount: from.value || null }));
  const currency = el('input', { class: 'fd-input', 'aria-label': w.paymentCurrency, placeholder: 'EGP', maxlength: '3', autocomplete: 'off', spellcheck: 'false' }) as HTMLInputElement;
  currency.addEventListener('change', () => designer.setPayment({ currency: currency.value.trim().toUpperCase() || null }));
  const words = el('textarea', { class: 'fd-input fd-insp-area', 'aria-label': w.paymentWords, rows: '2', placeholder: w.optional });
  words.addEventListener('change', () => designer.setPayment({ description: words.value }));
  const onRow = setting(el, 'rules', 'Payment before sending', on, { hint: w.paymentHint, words: w.payment });
  const labelRow = setting(el, 'rules', 'What the payment is for', label, { words: w.paymentLabel });
  const amountRow = setting(el, 'rules', 'Amount', [amount.input, from], { hint: w.paymentAmountHint, words: w.paymentAmount });
  const currencyRow = setting(el, 'rules', 'Currency', currency, { hint: w.paymentCurrencyHint, words: w.paymentCurrency });
  const wordsRow = setting(el, 'rules', 'Words under the amount', words, { words: w.paymentWords });
  return {
    rows: [onRow, labelRow, amountRow, currencyRow, wordsRow],
    destroy: () => amount.destroy(),
    update(page) {
      const own = page.payment;
      onRow.hidden = page.layout.type === 'list';
      on.checked = !!own;
      labelRow.hidden = amountRow.hidden = currencyRow.hidden = wordsRow.hidden = onRow.hidden || !own;
      if (!own) return;
      if (!focused(label)) label.value = own.label;
      amount.refresh();
      // The page's number and money fields it may take its amount from: its own number first.
      const fields = Object.entries(page.fields).filter(([, def]) => def.type === 'integer' || def.type === 'float' || def.type === 'monetary');
      const choices = [['', w.paymentFixed], ...fields.map(([name, def]) => [name, def.label || name])];
      const key = JSON.stringify(choices);
      if (from.dataset['choices'] !== key) {
        from.dataset['choices'] = key;
        from.replaceChildren(...choices.map(([value, text]) => el('option', { value }, text)));
      }
      from.value = typeof own.amount === 'string' ? own.amount : '';
      amount.input.hidden = typeof own.amount === 'string';
      if (!focused(currency)) currency.value = own.currency ?? '';
      if (!focused(words)) words.value = own.description ?? '';
    },
  };
}
