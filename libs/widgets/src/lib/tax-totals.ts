import type { JsonValue, RelatedRecord, Value } from '@fieldia/core';
import { maker, wordsFor } from './kind-parts';
import { formatMoney, formatNumber, normalizeNumber } from './numbers';
import type { WidgetFactory } from './widgets';

/**
 * Tax totals: Flectra's account-tax-totals-field. The app works the value out
 * — Flectra's own `tax_totals` (`subtotals`, `groups_by_subtotal`,
 * `amount_total`), or a plainer `{ untaxed, groups: [{ name, amount }], total }`
 * — and the widget shows it: each subtotal, the untaxed amount first, the tax
 * groups under it, then the total, in the currency of `options.currencyField`
 * (or `options.currency`). With `options.editable`, a draft's tax amounts are
 * typed in, the total following, for the app to work out again — as Flectra
 * lets a draft bill's taxes be corrected.
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
  const make = maker(document);
  const words = wordsFor(labels, locale);
  const options = node.options ?? {};
  const currencyField = typeof options['currencyField'] === 'string' ? (options['currencyField'] as string) : null;
  const fixed = typeof options['currency'] === 'string' ? (options['currency'] as string) : null;
  const body = make('tbody');
  const element = make('table', { id, class: 'fd-tax-totals' }, body);
  let drawn = '';

  /** The value with one group's amount typed in, and the total following. */
  function typed(group: Group, amount: number) {
    const value = JSON.parse(JSON.stringify(form.getState().values[name])) as Record<string, unknown>;
    const was = group.amount;
    if (Array.isArray(group.at)) {
      const [subtotal, i] = group.at;
      ((value['groups_by_subtotal'] as Record<string, Record<string, unknown>[]>)[subtotal][i])['tax_group_amount'] = amount;
      value['amount_total'] = Math.round((num(value['amount_total']) + amount - was) * 100) / 100;
    } else {
      (value['groups'] as Record<string, unknown>[])[group.at]['amount'] = amount;
      value['total'] = Math.round((num(value['total']) + amount - was) * 100) / 100;
    }
    form.setValue(name, value as JsonValue);
  }

  return {
    element,
    focus: () => element.querySelector<HTMLInputElement>('input')?.focus(),
    update(state) {
      const totals = read(state.value, words.untaxed);
      const holder = currencyField ? state.values[currencyField] : null;
      const code = fixed ?? (holder && typeof holder === 'object' && 'label' in holder ? (holder as RelatedRecord).label : typeof holder === 'string' ? holder : '');
      const money = (n: number) => (/^[A-Z]{3}$/.test(code) ? formatMoney(n, code, 2, locale) : formatNumber(n, 2, locale));
      const editable = options['editable'] === true && !state.readonly;
      const key = JSON.stringify([totals, code, editable]);
      // Drawn again only when what it shows changes, so a box being typed in stays.
      if (key === drawn || element.contains(document.activeElement)) return;
      drawn = key;
      const row = (label: string, amount: string | HTMLElement, className: string) => make('tr', { class: className }, make('th', { scope: 'row' }, label), make('td', {}, amount));
      const rows: HTMLElement[] = [];
      for (const subtotal of totals?.subtotals ?? []) {
        rows.push(row(subtotal.name, money(subtotal.amount), 'fd-tax-subtotal'));
        for (const group of subtotal.groups) {
          if (!editable) {
            rows.push(row(group.name, money(group.amount), 'fd-tax-group'));
            continue;
          }
          const box = make('input', { type: 'text', class: 'fd-input fd-number-input', inputmode: 'decimal', autocomplete: 'off', 'aria-label': group.name });
          box.value = formatNumber(group.amount, 2, locale);
          box.addEventListener('change', () => {
            const text = normalizeNumber(box.value.trim(), locale);
            if (/^-?(\d+\.?\d*|\.\d+)$/.test(text)) typed(group, Number(text));
          });
          rows.push(row(group.name, box, 'fd-tax-group'));
        }
      }
      if (totals) rows.push(row(words.total, money(totals.total), 'fd-tax-total'));
      body.replaceChildren(...rows);
    },
  };
};
