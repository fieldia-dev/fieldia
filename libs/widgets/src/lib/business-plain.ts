import { placesOfCurrency, type LineField, type RecordId, type RelatedRecord, type Value } from '@fieldia/core';
import { displayValue } from './display';
import { distributionWords } from './distribution';
import { hoursKept, parseDuration, parsePercentage, percentPlaces, shownNumber } from './duration';
import { leftWords, numberFits, quoted, unreadWords, type NumberBox } from './input-rules';
import { boxPurpose, fillIn, setAttr, setText, wordsFor } from './kind-parts';
import { formatMoney, formatNumber } from './numbers';
import type { WidgetContext, WidgetFactory, WidgetState } from './widgets';

/**
 * The business widgets drawn plainly, until their part comes (business-part.ts): drawn by something that did not wait
 * for it as the viewer does, each shows its value — read-only words for a statusbar (the state's words), priority stars
 * (how many of how many), a distribution (its shares), tax totals (their total) and payments (each one's day and
 * amount); a plain text box for hours and a per cent, read as they are typed — and the part's own widget takes its place
 * with the last value it was given (partWidget). A part that cannot come leaves them, and they work.
 */

/** A payment on a record, as Flectra's invoice_payments_widget gives it. */
export interface Payment {
  date: string;
  amount: number;
  name: string;
  journal: string;
  memo: string;
  id: RecordId | null;
}

const text = (value: unknown) => (typeof value === 'string' ? value : typeof value === 'number' ? String(value) : '');

/** The payments a value holds: Flectra's own (`{ content: [...] }`) or a plain list. */
export function paymentsOf(value: Value | undefined): Payment[] {
  const list = Array.isArray(value) ? value : value && typeof value === 'object' && Array.isArray((value as { content?: unknown }).content) ? (value as { content: unknown[] }).content : [];
  return (list as Record<string, unknown>[])
    .filter((p) => p && typeof p === 'object')
    .map((p) => ({
      date: text(p['date']),
      amount: typeof p['amount'] === 'number' ? p['amount'] : Number(p['amount']) || 0,
      name: text(p['name']),
      journal: text(p['journal_name'] ?? p['journal']),
      memo: text(p['ref'] ?? p['memo']),
      id: (p['account_payment_id'] ?? p['payment_id'] ?? p['id'] ?? null) as RecordId | null,
    }));
}

/** A value as words, read-only, brought up to date with each state it is given. */
function plainWords(say: (state: WidgetState, context: WidgetContext) => string): WidgetFactory {
  return (context) => {
    const element = context.document.createElement('span');
    element.id = context.id;
    element.className = 'fd-read-text';
    element.setAttribute('data-fd-plain', '');
    return {
      element,
      focus: () => undefined,
      update: (state) => setText(element, say(state, context)),
    };
  };
}

/** Money in the record's currency (`options.currencyField`, or `options.currency`) when it has one, else the amount. */
function moneyOf({ node, locale = 'en' }: WidgetContext, values: WidgetState['values']): (amount: number) => string {
  const options = node.options ?? {};
  const holder = typeof options['currency'] === 'string' ? options['currency'] : typeof options['currencyField'] === 'string' ? values[options['currencyField']] : null;
  const code = holder && typeof holder === 'object' && 'label' in holder ? (holder as RelatedRecord).label : typeof holder === 'string' ? holder : '';
  const known = /^[A-Z]{3}$/.test(code);
  return (amount) => (known ? formatMoney(amount, code, placesOfCurrency(code), locale) : formatNumber(amount, 2, locale));
}

/** A statusbar: the state's words, a choice's label or a stage's name. */
export const plainState = plainWords(({ value }, { field, locale }) => displayValue(field as LineField, value, {}, locale));

/**
 * Hours and a per cent in a plain text box: shown as a cell writes them, "06:30" and "25%", and read as the part's own
 * box reads them, with the main script's readers and the same limits — a per cent's places, hours kept to the field's.
 * What reads and fits as it is typed is the field's value at once; as the box is left (or a save reads it first: a
 * change), text that does not read, or that the field cannot hold ("12.345" in a per cent of two places), is kept
 * unread with why (`FormState.unread`), the field holding what it held as the box was entered: Save refuses it, and the
 * part's own box shows it as it stands when it takes this one's place. Entered and left with nothing typed, the value
 * stays as it came, never the rounded picture of it read back.
 */
export const plainNumber: WidgetFactory = ({ form, name, field, node, id, document, labels, locale = 'en' }) => {
  const percent = node.widget === 'percentage';
  const input = document.createElement('input');
  Object.assign(input, { type: 'text', id, className: 'fd-input fd-number-input' });
  for (const [key, value] of Object.entries(boxPurpose(node, { autocomplete: 'off' }))) input.setAttribute(key, value);
  if (node.placeholder) input.placeholder = node.placeholder;
  input.setAttribute('data-fd-plain', '');
  const min = 'min' in field && typeof field.min === 'number' ? field.min : undefined;
  // The part's box's limits: a per cent's places and least are the per cent's.
  const box: NumberBox & { percent?: boolean } = {
    label: node.label ?? field.label,
    locale,
    labels,
    duration: !percent,
    percent,
    limits: () => (percent ? { percent: true, places: percentPlaces(field), ...(min !== undefined ? { min: min * 100 } : {}) } : {}),
  };
  const parse = (text: string) => (percent ? parsePercentage(text, locale) : hoursKept(parseDuration(text, locale), field));
  const unread = () => form.getState().unread?.[name];
  const shown = (value: Value | undefined) => (typeof value === 'number' ? shownNumber(node.widget, field, value, locale) ?? '' : value === null || value === undefined ? '' : String(value));
  let entered: Value | undefined;
  let enteredText: string | null = null;
  input.addEventListener('focus', () => {
    entered = form.getState().values[name];
    enteredText = input.value;
  });
  input.addEventListener('input', () => {
    if (document.activeElement !== input) [entered, enteredText] = [form.getState().values[name], null];
    // Typed back to what it showed as it was entered: the value as it came.
    const back = input.value === enteredText;
    const value = back ? entered : parse(input.value);
    // Not yet, or not as it stands ("25.555" in a per cent of two places, on its way to "25.555,5"): left, it is said.
    if (value === undefined || (!back && percent && !numberFits(input.value, box))) return;
    if (unread()) form.setUnread(name, null);
    if ((form.getState().values[name] ?? null) !== (value ?? null)) form.setValue(name, (value ?? null) as Value);
  });
  /** What is typed, read: taken when it reads and fits, else kept unread with why. True when taken. */
  const read = (): boolean => {
    const text = input.value;
    if (text === enteredText && !unread()) return true;
    const value = parse(text);
    const words = value === undefined ? (unreadWords(text, box) ?? fillIn(wordsFor(labels, locale).notANumber, { label: box.label, text: quoted(text) })) : value === (entered ?? null) ? null : leftWords(text, box);
    if (words === null) {
      if (unread()) form.setUnread(name, null);
      if (value !== undefined && (form.getState().values[name] ?? null) !== value) form.setValue(name, value);
      return true;
    }
    if (form.getState().values[name] !== entered) form.setValue(name, (entered ?? null) as Value);
    form.setUnread(name, { text, message: words });
    return false;
  };
  input.addEventListener('change', () => !input.readOnly && read());
  input.addEventListener('blur', () => {
    if (!input.readOnly && read()) input.value = shown(form.getState().values[name]);
    enteredText = null;
  });
  return {
    element: input,
    focus: () => input.focus(),
    update(state) {
      const typing = document.activeElement === input;
      if (!typing) input.value = unread()?.text ?? shown(state.value);
      if (input.readOnly !== state.readonly) input.readOnly = state.readonly;
      setAttr(input, 'aria-invalid', String(state.invalid || (!!unread() && !typing)));
      setAttr(input, 'aria-describedby', state.describedBy || null);
    },
  };
};

/** Priority stars: how many of how many, "★ 2 of 3"; a star over a yes or no is one of one. */
export const plainStars = plainWords(({ value }, { field, labels, locale }) => {
  const levels = field.type === 'selection' ? field.options.map((option) => option.value) : [false, true];
  return `★ ${fillIn(wordsFor(labels, locale).ofMax, { n: Math.max(0, levels.indexOf(value as never)), max: levels.length - 1 })}`;
});

/** An analytic distribution's shares, "60% · 40%", as a cell writes them. */
export const plainShares = plainWords(({ value }, { locale }) => distributionWords(value, locale));

/** Tax totals: their total, from Flectra's tax_totals (`amount_total`) or the plainer value (`total`). */
export const plainTotal = plainWords(({ value, values }, context) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return '';
  const total = (value as Record<string, unknown>)['amount_total'] ?? (value as Record<string, unknown>)['total'];
  return typeof total === 'number' ? `${wordsFor(context.labels, context.locale).total} ${moneyOf(context, values)(total)}` : '';
});

/** Payments: each one's day and amount, "Paid on 15 Oct 2026 1,000.00". */
export const plainPayments = plainWords(({ value, values }, context) => {
  const words = wordsFor(context.labels, context.locale);
  const money = moneyOf(context, values);
  const day = { type: 'date', label: '' } as LineField;
  return paymentsOf(value)
    .map((payment) => `${fillIn(words.paidOn, { date: displayValue(day, payment.date, {}, context.locale) })} ${money(payment.amount)}`)
    .join(' · ');
});
