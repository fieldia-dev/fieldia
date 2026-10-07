import { createForm, createMemoryDataSource, type Field, type FieldNode, type Page } from '@fieldia/core';
import { WIDGET_LABELS } from './labels';
import { createWidget } from './widgets';

/** Flectra's analytic_distribution: shares of accounts, {accountId: percent}, edited as lines adding up to 100 %. */
const page = {
  fieldia: '0.1',
  id: 'line',
  data: { kind: 'record', model: 'account.move.line' },
  fields: { analytic_distribution: { type: 'json', label: 'Analytic' } },
  layout: { type: 'sections', id: 'root', children: [{ type: 'field', id: 'f-analytic', field: 'analytic_distribution', widget: 'distribution', options: { model: 'account.analytic.account' } }] },
} as unknown as Page;

const dataSource = createMemoryDataSource({
  records: { 'account.analytic.account': { 1: { name: 'Cairo office' }, 2: { name: 'Alexandria branch' }, 3: { name: 'Marketing' } } },
});
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

async function mount(value: Record<string, number> | null, readonly = false) {
  const form = createForm({ page, dataSource, values: { analytic_distribution: value } });
  const node = (page.layout as { children: FieldNode[] }).children[0];
  const widget = createWidget({ form, name: 'analytic_distribution', field: page.fields['analytic_distribution'] as Field, node, id: 'fd-analytic', document, labels: WIDGET_LABELS.en });
  document.body.replaceChildren(widget.element);
  const refresh = () => widget.update({ value: form.getState().values['analytic_distribution'], values: form.getState().values, readonly, required: false, invalid: false });
  form.subscribe(refresh);
  refresh();
  await settle();
  await settle();
  return { form, el: widget.element, value: () => form.getState().values['analytic_distribution'] };
}

const rows = (el: HTMLElement) => [...el.querySelectorAll<HTMLElement>('tbody tr')];
const accountBox = (row: HTMLElement) => row.querySelector('input[role="combobox"], input') as HTMLInputElement;
const shareBox = (row: HTMLElement) => row.querySelector('input.fd-share') as HTMLInputElement;
function type(input: HTMLInputElement, text: string) {
  input.focus();
  input.value = text;
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

describe('an analytic distribution', () => {
  it('shows a line for each account, by its name, with its share, and the total', async () => {
    const { el } = await mount({ '1': 60, '3': 40 });
    expect(el.getAttribute('role')).toBe('group');
    expect(rows(el).map((row) => accountBox(row).value)).toEqual(['Cairo office', 'Marketing']);
    expect(rows(el).map((row) => shareBox(row).value)).toEqual(['60', '40']);
    expect(el.querySelector('tfoot')?.textContent).toContain('100%');
    expect((el.querySelector('.fd-distribution-off') as HTMLElement).hidden).toBe(true);
  });

  it('changes a share as it is typed, and says when the shares do not add up to 100 %', async () => {
    const { el, value } = await mount({ '1': 60, '3': 40 });
    type(shareBox(rows(el)[1]), '30');
    expect(value()).toEqual({ '1': 60, '3': 30 });
    const off = el.querySelector('.fd-distribution-off') as HTMLElement;
    expect(off.hidden).toBe(false);
    expect(off.textContent).toBe('The shares add up to 90%, not 100%');
  });

  it('adds an account found by its name, taking what is left of 100 %', async () => {
    const { el, value } = await mount({ '1': 60 });
    (el.querySelector('.fd-distribution-add') as HTMLButtonElement).click();
    const row = rows(el)[1];
    expect(document.activeElement).toBe(accountBox(row));
    type(accountBox(row), 'alex');
    // The link box waits for typing to pause before it searches.
    await new Promise((resolve) => setTimeout(resolve, 320));
    const option = [...document.querySelectorAll<HTMLElement>('[role="option"]')].find((o) => o.textContent?.includes('Alexandria'));
    option?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    option?.click();
    await settle();
    expect(value()).toEqual({ '1': 60, '2': 40 });
  });

  it('takes a line away', async () => {
    const { el, value } = await mount({ '1': 60, '3': 40 });
    (rows(el)[0].querySelector('.fd-line-delete') as HTMLButtonElement).click();
    expect(value()).toEqual({ '3': 40 });
  });

  it('is read-only as its field is: no adding, no taking away', async () => {
    const { el } = await mount({ '1': 100 }, true);
    expect((el.querySelector('.fd-distribution-add') as HTMLElement).hidden).toBe(true);
    expect(rows(el)[0].querySelector('.fd-line-delete')).toBeNull();
    expect(shareBox(rows(el)[0]).readOnly).toBe(true);
  });
});

describe('an analytic distribution as a column of a plain table', () => {
  it('is the widget itself in each line’s cell, its accounts found by the line, its shares written into the line', async () => {
    const order = {
      fieldia: '0.1',
      id: 'order',
      data: { kind: 'record', model: 'sale.order' },
      fields: { order_line: { type: 'one2many', label: 'Lines', relation: 'sale.order.line', fields: { name: { type: 'char', label: 'Description' }, analytic_distribution: { type: 'json', label: 'Analytic' } } } },
      layout: { type: 'sections', id: 'root', children: [{ type: 'field', id: 'f-lines', field: 'order_line', cells: { analytic_distribution: { widget: 'distribution' } } }] },
    } as unknown as Page;
    const form = createForm({ page: order, dataSource, values: { order_line: [{ key: 'a', values: { name: 'Desks', analytic_distribution: { '1': 60, '3': 40 } } }] } as never });
    const node = (order.layout as { children: FieldNode[] }).children[0];
    const widget = createWidget({ form, name: 'order_line', field: order.fields['order_line'] as Field, node, id: 'fd-lines', document, labels: WIDGET_LABELS.en });
    document.body.replaceChildren(widget.element);
    const refresh = () => widget.update({ value: form.getState().values['order_line'], values: form.getState().values, readonly: false, required: false, invalid: false });
    form.subscribe(refresh);
    refresh();
    await settle();
    await settle();
    const cell = widget.element.querySelector('td[data-column="analytic_distribution"] .fd-distribution') as HTMLElement;
    // Its own lines, not the table's round it.
    const own = () => [...cell.querySelectorAll<HTMLElement>('.fd-distribution-table > tbody > tr')];
    expect(own().map((row) => accountBox(row).value)).toEqual(['Cairo office', 'Marketing']);
    type(shareBox(own()[1]), '30');
    expect((form.getState().values['order_line'] as { values: Record<string, unknown> }[])[0].values['analytic_distribution']).toEqual({ '1': 60, '3': 30 });
  });
});
