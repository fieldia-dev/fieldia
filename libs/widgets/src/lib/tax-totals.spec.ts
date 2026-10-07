import { createForm, type Field, type FieldNode, type Locale, type Page } from '@fieldia/core';
import { WIDGET_LABELS } from './labels';
import { createWidget } from './widgets';

/** Flectra's account-tax-totals-field: the untaxed amount, a line per tax group, the total — from a value the app works out. */
const TOTALS = {
  amount_untaxed: 1000,
  amount_total: 1190,
  subtotals: [{ name: 'Untaxed Amount', amount: 1000 }],
  subtotals_order: ['Untaxed Amount'],
  groups_by_subtotal: {
    'Untaxed Amount': [
      { tax_group_id: 1, tax_group_name: 'VAT 14%', tax_group_amount: 140, tax_group_base_amount: 1000 },
      { tax_group_id: 2, tax_group_name: 'Stamp duty', tax_group_amount: 50, tax_group_base_amount: 1000 },
    ],
  },
};

function mount(options: Record<string, unknown> = {}, readonly = false, locale: Locale = 'en', value: unknown = TOTALS) {
  const page = {
    fieldia: '0.1',
    id: 'bill',
    data: { kind: 'record', model: 'account.move' },
    fields: { tax_totals: { type: 'json', label: 'Totals' }, currency_id: { type: 'many2one', label: 'Currency', relation: 'res.currency' } },
    layout: { type: 'sections', id: 'root', children: [{ type: 'field', id: 'f-totals', field: 'tax_totals', widget: 'tax-totals', options: { currencyField: 'currency_id', ...options } }] },
  } as unknown as Page;
  const form = createForm({ page, values: { tax_totals: value, currency_id: { id: 1, label: 'EGP' } } as never });
  const node = (page.layout as { children: FieldNode[] }).children[0];
  const widget = createWidget({ form, name: 'tax_totals', field: page.fields['tax_totals'] as Field, node, id: 'fd-totals', document, labels: WIDGET_LABELS[locale], locale });
  document.body.replaceChildren(widget.element);
  const refresh = () => widget.update({ value: form.getState().values['tax_totals'], values: form.getState().values, readonly, required: false, invalid: false });
  form.subscribe(refresh);
  refresh();
  return { form, el: widget.element, value: () => form.getState().values['tax_totals'] as typeof TOTALS };
}

const lines = (el: HTMLElement) => [...el.querySelectorAll('tr')].map((tr) => [tr.querySelector('th')?.textContent, (tr.querySelector('input') as HTMLInputElement | null)?.value ?? tr.querySelector('td')?.textContent]);

describe('tax totals', () => {
  it('shows the untaxed amount, a line per tax group and the total, in the record’s currency', () => {
    const { el } = mount();
    expect(lines(el)).toEqual([
      ['Untaxed Amount', 'E£1,000.00'],
      ['VAT 14%', 'E£140.00'],
      ['Stamp duty', 'E£50.00'],
      ['Total', 'E£1,190.00'],
    ]);
    expect(el.querySelector('tr.fd-tax-total')).not.toBeNull();
  });

  it('takes a plainer value too: untaxed, groups and total', () => {
    const { el } = mount({}, false, 'en', { untaxed: 200, groups: [{ name: 'VAT', amount: 28 }], total: 228 });
    expect(lines(el).map(([label]) => label)).toEqual(['Untaxed amount', 'VAT', 'Total']);
    expect(lines(el)[2][1]).toBe('E£228.00');
  });

  it('lets a draft’s tax amounts be typed, the total following', () => {
    const { el, value } = mount({ editable: true });
    const box = el.querySelector('input[aria-label="VAT 14%"]') as HTMLInputElement;
    expect(box.value).toBe('140.00');
    box.value = '139.5';
    box.dispatchEvent(new Event('change', { bubbles: true }));
    expect(value().groups_by_subtotal['Untaxed Amount'][0].tax_group_amount).toBe(139.5);
    expect(value().amount_total).toBe(1189.5);
  });

  it('shows the amounts as words while read-only, even when editable', () => {
    const { el } = mount({ editable: true }, true);
    expect(el.querySelector('input')).toBeNull();
  });

  it('says its own words in the page’s language', () => {
    const { el } = mount({}, false, 'ar', { untaxed: 200, groups: [], total: 200 });
    expect(lines(el).map(([label]) => label)).toEqual(['المبلغ قبل الضريبة', 'الإجمالي']);
  });
});
