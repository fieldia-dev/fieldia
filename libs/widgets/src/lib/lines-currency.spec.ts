import { createForm, type Field, type FieldNode, type Page } from '@fieldia/core';
import { createWidget } from './widgets';
import { displayValue } from './display';
import { WIDGET_LABELS } from './labels';

/** A line's money in the currency of the record it is on, as Flectra's related currency_id: `currencyField: "parent.currency_id"`. */
const order = {
  fieldia: '0.1',
  id: 'order',
  data: { kind: 'record', model: 'sale.order' },
  fields: {
    currency_id: { type: 'many2one', label: 'Currency', relation: 'res.currency' },
    line_ids: {
      type: 'one2many',
      label: 'Lines',
      relation: 'sale.order.line',
      fields: {
        name: { type: 'char', label: 'Description' },
        price: { type: 'monetary', label: 'Price', currencyField: 'parent.currency_id' },
      },
    },
  },
  layout: { type: 'sections', id: 'root', children: [{ type: 'field', id: 'f-lines', field: 'line_ids', totals: ['price'] }] },
} as unknown as Page;

function mount(currency: string) {
  const form = createForm({ page: order, values: { currency_id: { id: 1, label: currency }, line_ids: [{ key: 'a', values: { name: 'Desk', price: 1200 } }, { key: 'b', values: { name: 'Chair', price: 300 } }] } as never });
  const node = (order.layout as { children: FieldNode[] }).children[0];
  const widget = createWidget({ form, name: 'line_ids', field: order.fields['line_ids'] as Field, node, id: 'fd-lines', document, labels: WIDGET_LABELS.en });
  document.body.replaceChildren(widget.element);
  const refresh = () => widget.update({ value: form.getState().values['line_ids'], values: form.getState().values, readonly: false, required: false, invalid: false });
  form.subscribe(refresh);
  refresh();
  return { form, el: widget.element };
}

const unit = (el: Element, key: string) => el.querySelector(`tr[data-line="${key}"] td[data-column="price"] .fd-currency`)?.textContent;
const total = (el: Element) => el.querySelector('tfoot td[data-column="price"]')?.textContent;

describe('a line’s money in its record’s currency', () => {
  it('shows each line’s amount and the total in the record’s currency, and follows it when it changes', () => {
    const { form, el } = mount('EUR');
    expect(unit(el, 'a')).toBe('€');
    expect(total(el)).toBe('€1,500.00');
    form.setValue('currency_id', { id: 2, label: 'USD' });
    expect(unit(el, 'b')).toBe('$');
    expect(total(el)).toBe('$1,500.00');
  });

  it('is written in that currency where a value is only shown, given the record', () => {
    const def = (order.fields['line_ids'] as Extract<Field, { type: 'one2many' }>).fields['price'];
    expect(displayValue(def, 12, {}, 'en', { currency_id: { id: 1, label: 'EUR' } })).toBe('€12.00');
    expect(displayValue(def, 12, {}, 'en')).toBe('12.00');
  });
});
