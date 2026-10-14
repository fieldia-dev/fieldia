import { createForm, createMemoryDataSource, type Field, type FieldNode, type Line, type LineField, type Page } from '@fieldia/core';
// The widgets first: lines.ts and widgets.ts import each other, and the table is found among the widgets once both are in.
import { createWidget } from './widgets';
import { displayValue } from './display';
import { columnTotal } from './lines';
import { WIDGET_LABELS } from './labels';

/**
 * The input rules in a table (FIELDIA INPUT RULES, 8): a cell shows a value
 * that is no number as its own words, never NaN; a column's total adds only
 * numbers and waits, in words, for the line that holds text that does not read;
 * and a cell's message is linked to its box and said once as the cell is left.
 */

const float = { type: 'float', label: 'Quantity', digits: [8, 2] } as LineField;
const integer = { type: 'integer', label: 'Seats' } as LineField;

describe('a number cell at rest', () => {
  it('shows words where a number goes as they are: never NaN, never a number JavaScript reads from them', () => {
    expect(displayValue(float, 'abc' as never)).toBe('abc');
    expect(displayValue(float, '0x1A' as never)).toBe('0x1A');
    expect(displayValue(integer, '1e3' as never)).toBe('1e3');
    expect(displayValue({ type: 'monetary', label: 'Price', currency: 'EGP' } as LineField, 'E£ 1,200.00' as never)).toBe('E£ 1,200.00');
    expect(displayValue(float, Number.NaN)).toBe('');
  });

  it('never shows a rounded picture of a different value, and writes money in its currency’s places', () => {
    expect(displayValue(float, 1.234)).toBe('1.234');
    expect(displayValue(float, 1.5)).toBe('1.50');
    expect(displayValue({ type: 'monetary', label: 'Price', currency: 'KWD' } as LineField, 12).replace(/\D+/g, ' ').trim()).toBe('12 000');
  });
});

describe('a column’s total', () => {
  const lines = (...qty: unknown[]): Line[] => qty.map((q, i) => ({ key: `l${i}`, values: { qty: q as never, kind: i === 9 ? 'section' : null } }));
  const item = () => true;
  const none = () => false;

  it('adds the lines’ numbers, an empty cell as nothing', () => {
    expect(columnTotal(lines(2, null, 3.5, ''), 'qty', item, none)).toEqual({ sum: 5.5 });
  });

  it('waits for the first line that holds no number, or text that does not read, never NaN or a confident sum', () => {
    expect(columnTotal(lines(2, 'abc', 3), 'qty', item, none)).toEqual({ waits: 2 });
    expect(columnTotal(lines(2, '0x1A'), 'qty', item, none)).toEqual({ waits: 2 });
    expect(columnTotal(lines(2, 5, 3), 'qty', item, (line) => line.key === 'l2')).toEqual({ waits: 3 });
  });

  it('leaves sections and notes out, whatever they hold', () => {
    expect(columnTotal(lines(2, 'Lighting', 3), 'qty', (line) => line.key !== 'l1', none)).toEqual({ sum: 5 });
  });
});

describe('a table’s cell', () => {
  const page = {
    fieldia: '0.1',
    id: 'order',
    data: { kind: 'record', model: 'order' },
    fields: {
      line_ids: {
        type: 'one2many',
        label: 'Order lines',
        relation: 'order.line',
        fields: { name: { type: 'char', label: 'Item' }, hours: { type: 'float', label: 'Hours', min: 0 } },
      },
    },
    layout: { type: 'sections', id: 'root', children: [{ type: 'field', id: 'n-lines', field: 'line_ids', totals: ['hours'] }] },
  } as unknown as Page;

  function mount(locale: 'en' | 'ar' = 'en') {
    const form = createForm({ page, dataSource: createMemoryDataSource({}) });
    const node = (page.layout as { children: FieldNode[] }).children[0];
    const widget = createWidget({ form, name: 'line_ids', field: page.fields['line_ids'] as Field, node, id: 'fd-lines', document, labels: WIDGET_LABELS[locale], locale });
    document.body.replaceChildren(widget.element);
    const refresh = () => widget.update({ value: form.getState().values['line_ids'], values: form.getState().values, readonly: false, required: false, invalid: false });
    form.subscribe(refresh);
    refresh();
    form.addLine('line_ids', { name: 'Survey', hours: 2 });
    form.addLine('line_ids', { name: 'Fit-out', hours: 3 });
    return { form, el: widget.element };
  }
  const hoursBox = (el: Element, row: number) => el.querySelectorAll('tbody tr')[row].querySelector('td[data-column="hours"] input') as HTMLInputElement;
  const total = (el: Element) => el.querySelector('tfoot td[data-column="hours"]') as HTMLElement;
  function typeAndLeave(box: HTMLInputElement, text: string) {
    box.focus();
    box.value = text;
    box.dispatchEvent(new Event('input', { bubbles: true }));
    box.blur();
  }

  it('links its message to its box and says it once, politely, as the cell is left', () => {
    const { form, el } = mount();
    const box = hoursBox(el, 0);
    typeAndLeave(box, '12 34');
    const error = box.closest('td')?.querySelector('.fd-cell-error') as HTMLElement;
    expect(error.hidden).toBe(false);
    expect(error.textContent).toBe('Digits are grouped in threes, like 1,234,567');
    expect(error.id).toBeTruthy();
    expect(box.getAttribute('aria-describedby')?.split(' ')).toContain(error.id);
    expect(error.getAttribute('aria-live')).toBe('polite');
    // The line keeps the hours it had; the box keeps what was typed.
    expect((form.getState().values['line_ids'] as Line[])[0].values['hours']).toBe(2);
    expect(box.value).toBe('12 34');
    // Entered again, it is quiet until it is left with something new to say.
    box.focus();
    expect(error.hasAttribute('aria-live')).toBe(false);
  });

  it('makes its column’s total wait for its line, a dash said in words, and adds up again once it reads', () => {
    const { el } = mount();
    expect(total(el).textContent).toBe('5.00');
    typeAndLeave(hoursBox(el, 1), '1 2');
    expect(total(el).querySelector('[aria-hidden="true"]')?.textContent).toBe('—');
    expect(total(el).querySelector('.fd-sr-only')?.textContent).toBe('Fix line 2 to see this total');
    expect(total(el).title).toBe('Fix line 2 to see this total');
    expect(total(el).textContent).not.toMatch(/NaN|0\.00/);
    typeAndLeave(hoursBox(el, 1), '4');
    expect(total(el).textContent).toBe('6.00');
    expect(total(el).hasAttribute('title')).toBe(false);
  });

  it('waits in Arabic too', () => {
    const { el } = mount('ar');
    typeAndLeave(hoursBox(el, 0), '١٢ ٣٤');
    expect(total(el).title).toBe('صحّح السطر 1 ليظهر هذا الإجمالي');
  });
});
