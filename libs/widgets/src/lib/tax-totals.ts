import { placesOf, placesOfCurrency, readNumber, type JsonValue, type RelatedRecord, type Value } from '@fieldia/core';
import { fillIn, maker, setAttr, setHidden, wordsFor } from './kind-parts';
import { guard, leftWords, numberRules, refusalHint, type Guard } from './input-rules';
import { formatMoney, formatNumber } from './numbers';
import { installBusinessStyles } from './styles-business-part';
import type { Widget, WidgetFactory, WidgetState } from './widgets';

/**
 * Tax totals: Flectra's account-tax-totals-field. The app works the value out
 * — Flectra's own `tax_totals` (`subtotals`, `groups_by_subtotal`,
 * `amount_total`), or a plainer `{ untaxed, groups: [{ name, amount }], total }`
 * — and the widget shows it: each subtotal, the untaxed amount first, the tax
 * groups under it, then the total, in the currency of `options.currencyField`
 * (or `options.currency`). With `options.editable`, a draft's tax amounts are
 * typed in, the total following, for the app to work out again — as Flectra
 * lets a draft bill's taxes be corrected. In the business part
 * (business-part.ts).
 */

interface Group {
  name: string;
  amount: number;
  /** Where the amount sits in the value, to write it back. */
  at: [string, number] | number;
}
interface Totals {
  subtotals: { name: string; amount: number; groups: Group[] }[];
  total: number;
}

const num = (value: unknown) => (typeof value === 'number' ? value : Number(value) || 0);

/** Flectra's tax_totals, or the plainer value, as subtotals with their groups and the total. */
function read(value: Value | undefined, untaxedWords: string): Totals | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  if (Array.isArray(v['subtotals']) || v['groups_by_subtotal']) {
    const by = (v['groups_by_subtotal'] ?? {}) as Record<string, Record<string, unknown>[]>;
    const listed = (v['subtotals'] as { name: string; amount: number }[] | undefined) ?? [{ name: untaxedWords, amount: num(v['amount_untaxed']) }];
    const order = (v['subtotals_order'] as string[] | undefined) ?? listed.map((s) => s.name);
    return {
      subtotals: order.map((name) => ({
        name,
        amount: num(listed.find((s) => s.name === name)?.amount ?? v['amount_untaxed']),
        groups: (by[name] ?? []).map((g, i) => ({ name: String(g['tax_group_name'] ?? ''), amount: num(g['tax_group_amount']), at: [name, i] as [string, number] })),
      })),
      total: num(v['amount_total']),
    };
  }
  const groups = (Array.isArray(v['groups']) ? (v['groups'] as Record<string, unknown>[]) : []).map((g, i) => ({ name: String(g['name'] ?? ''), amount: num(g['amount']), at: i }));
  return { subtotals: [{ name: untaxedWords, amount: num(v['untaxed']), groups }], total: num(v['total']) };
}

export const taxTotalsWidget: WidgetFactory = ({ form, name, node, id, document, labels, locale = 'en' }) => {
  installBusinessStyles(document);
  const make = maker(document);
  const words = wordsFor(labels, locale);
  const options = node.options ?? {};
  const currencyField = typeof options['currencyField'] === 'string' ? (options['currencyField'] as string) : null;
  const fixed = typeof options['currency'] === 'string' ? (options['currency'] as string) : null;
  const body = make('tbody');
  const element = make('table', { id, class: 'fd-tax-totals' }, body);
  let drawn = '';
  /** What a tax box left says: an amount kept, or text that does not read. In a row of its own after the totals, said politely. */
  const note = make('div', { class: 'fd-refusal-hint fd-tax-note', id: `${id}-note`, role: 'status', hidden: '' });
  const noteRow = make('tr', { class: 'fd-tax-note-row' }, make('td', { colspan: '2' }, note));
  const say = (words: string) => {
    note.textContent = words;
    setHidden(note, !words);
  };
  /** Text left in a tax box that does not read, by the group's place: kept in its box, marked, until it is put right. */
  const unread = new Map<string, { text: string; message: string }>();
  const placeOf = (group: Group) => JSON.stringify(group.at);
  let guards: Guard[] = [];
  /** The state last drawn from: drawn again from it once the boxes are left, even when the totals are the same. */
  let last: WidgetState | null = null;

  /** The value with one group's amount typed in, and the total following, to the currency's places. */
  function typed(group: Group, amount: number, places: number) {
    const value = JSON.parse(JSON.stringify(form.getState().values[name])) as Record<string, unknown>;
    const was = group.amount;
    const round = (n: number) => Math.round(n * 10 ** places) / 10 ** places;
    if (Array.isArray(group.at)) {
      const [subtotal, i] = group.at;
      ((value['groups_by_subtotal'] as Record<string, Record<string, unknown>[]>)[subtotal][i])['tax_group_amount'] = amount;
      value['amount_total'] = round(num(value['amount_total']) + amount - was);
    } else {
      (value['groups'] as Record<string, unknown>[])[group.at]['amount'] = amount;
      value['total'] = round(num(value['total']) + amount - was);
    }
    form.setValue(name, value as JsonValue);
  }

  const widget: Widget = {
    element,
    focus: () => element.querySelector<HTMLInputElement>('input')?.focus(),
    destroy: () => guards.forEach((g) => g.destroy()),
    update(state) {
      last = state;
      // The form lets text go once the value is written another way (the app's): its boxes do too.
      if (!form.getState().unread?.[name]) unread.clear();
      const totals = read(state.value, words.untaxed);
      const holder = currencyField ? state.values[currencyField] : null;
      const code = fixed ?? (holder && typeof holder === 'object' && 'label' in holder ? (holder as RelatedRecord).label : typeof holder === 'string' ? holder : '');
      // The currency's places: 3 for the Kuwaiti, Bahraini, Omani and Jordanian dinars and rials, 2 for most; never
      // fewer than an amount has, so a box never shows a rounded picture of another amount.
      const places = placesOfCurrency(/^[A-Z]{3}$/.test(code) ? code : null);
      const shownPlaces = (n: number) => Math.max(places, Math.min(placesOf(n), 20));
      const amount = (n: number) => formatNumber(n, shownPlaces(n), locale);
      const money = (n: number) => (/^[A-Z]{3}$/.test(code) ? formatMoney(n, code, shownPlaces(n), locale) : amount(n));
      const editable = options['editable'] === true && !state.readonly;
      const key = JSON.stringify([totals, code, editable]);
      // Drawn again only when what it shows changes, so a box being typed in stays.
      if (key === drawn || element.contains(document.activeElement)) return;
      drawn = key;
      guards.forEach((g) => g.destroy());
      guards = [];
      const row = (label: string, shown: string | HTMLElement, className: string) => make('tr', { class: className }, make('th', { scope: 'row' }, label), make('td', {}, shown));
      const rows: HTMLElement[] = [];
      for (const subtotal of totals?.subtotals ?? []) {
        rows.push(row(subtotal.name, money(subtotal.amount), 'fd-tax-subtotal'));
        for (const group of subtotal.groups) {
          if (!editable) {
            rows.push(row(group.name, money(group.amount), 'fd-tax-group'));
            continue;
          }
          const box = make('input', { type: 'text', class: 'fd-input fd-number-input', inputmode: 'text', autocomplete: 'off', 'aria-label': group.name });
          const left = unread.get(placeOf(group));
          box.value = left ? left.text : amount(group.amount);
          setAttr(box, 'aria-invalid', left ? 'true' : null);
          if (left) box.setAttribute('aria-describedby', note.id);
          // The tax box's input rules: an amount, the currency's places, in the record's currency (pasted with it too).
          const rules = { label: group.name, locale, labels, limits: () => ({ places }), currency: () => (/^[A-Z]{3}$/.test(code) ? code : null) };
          const hint = refusalHint(box);
          const checks = guard(box, numberRules(rules), hint);
          guards.push(checks);
          // Left, or Enter pressed, with an edit: what it says is read — with the keys held after a refused one, whose
          // words the note under the totals takes over.
          const take = () => {
            const held = checks.held();
            if (held) hint.hide();
            const text = held?.text ?? box.value;
            if (held) box.value = text;
            const problem = held ? (leftWords(text, rules) ?? held.words) : leftWords(text, rules);
            const read = readNumber(text, locale);
            if (problem || !read.ok) {
              // Kept as typed, marked, with why: the amount stays what it was.
              const left = { text, message: problem ?? '' };
              unread.set(placeOf(group), left);
              form.setUnread(name, left);
              setAttr(box, 'aria-invalid', 'true');
              box.setAttribute('aria-describedby', note.id);
              say(left.message);
              return;
            }
            unread.delete(placeOf(group));
            form.setUnread(name, [...unread.values()][0] ?? null);
            setAttr(box, 'aria-invalid', null);
            box.removeAttribute('aria-describedby');
            if (read.value === null) {
              // Emptied and left: it goes back to the amount kept, and says so.
              box.value = amount(group.amount);
              say(fillIn(words.stillHolds, { label: group.name, value: money(group.amount) }));
              return;
            }
            say('');
            box.value = amount(read.value);
            if (read.value !== group.amount) typed(group, read.value, places);
          };
          box.addEventListener('change', take);
          // Keys held after a refused one change nothing the box shows, so no change is said for them: leaving reads them.
          box.addEventListener('blur', () => checks.held() && take());
          rows.push(row(group.name, box, 'fd-tax-group'));
        }
      }
      if (totals) rows.push(row(words.total, money(totals.total), 'fd-tax-total'));
      if (editable) rows.push(noteRow);
      body.replaceChildren(...rows);
    },
  };
  // Drawn again once its boxes are left, even when the totals are the same.
  element.addEventListener('focusout', (event) => {
    if (element.contains(event.relatedTarget as Node | null)) return;
    queueMicrotask(() => {
      if (!last || element.contains(element.ownerDocument.activeElement)) return;
      drawn = '';
      widget.update(last);
    });
  });
  return widget;
};
