import type { ButtonNode, Page } from '@fieldia/core';
import { blankPage, createDesigner } from './designer';
import { mount, type } from './test-editor';

/**
 * What the page's parts do, where the rules are read: the Rules view lists
 * each list of steps, a step a line, and goes to it; the canvas marks a
 * button that does something and a field whose change does; Find anything
 * finds them by their words.
 */

function order(): Page {
  return {
    ...blankPage('screen', 'Order'),
    id: 'order',
    fields: { customer: { type: 'char', label: 'Customer' }, product: { type: 'char', label: 'Product' }, vip: { type: 'boolean', label: 'VIP' } },
    layout: {
      type: 'sections',
      id: 'sections',
      children: [
        {
          type: 'section',
          id: 'section-1',
          columns: 2,
          children: [
            { type: 'field', id: 'f-customer', field: 'customer', invisible: 'vip != True' },
            { type: 'field', id: 'f-product', field: 'product' },
            { type: 'field', id: 'f-vip', field: 'vip' },
            { type: 'button', id: 'new', label: 'New customer', steps: [{ do: 'open', page: 'customer', as: 'panel', into: { customer: 'name' }, then: [{ do: 'say', message: 'Customer added' }] }] } as ButtonNode,
            { type: 'button', id: 'plain', label: 'Print', action: 'print' },
          ],
        },
      ],
    },
    on: { change: { product: [{ do: 'call', action: 'check_stock' }] }, beforeSave: [{ do: 'check' }, { do: 'ask', message: 'Send the order?' }] },
  };
}

function screen() {
  const designer = createDesigner({ page: order() });
  const { host } = mount(designer, { mode: 'advanced' });
  const view = () => host.querySelector('.fd-rules-view') as HTMLElement;
  const toggle = () => host.querySelector('.fd-designer-bar [data-mode="rules"]') as HTMLButtonElement;
  const groups = () =>
    [...view().querySelectorAll<HTMLElement>('.fd-rules-group')].map((g) => [g.querySelector('.fd-rules-group-title')?.textContent, ...[...g.querySelectorAll<HTMLElement>('.fd-rules-item')].map((i) => `${i.querySelector('.fd-rules-item-name')?.textContent}: ${i.querySelector('.fd-rules-item-say')?.textContent}`)]);
  return { designer, host, view, toggle, groups };
}

describe('the Rules view, with what parts do', () => {
  it('lists each list of steps after the rules, a step a line, and counts them', () => {
    const { view, toggle, groups } = screen();
    toggle().click();
    expect(groups()).toEqual([
      ['Shows when', 'Customer: Shows when VIP is Yes'],
      ['When clicked', 'New customer: Open customer in a panel, then put its answer in Customer\n↳ Say: Customer added'],
      ['When it changes', 'Product: Run the app’s action check_stock'],
      ['At the form’s moments', 'Before it’s saved or sent: Check the form\nAsk: Send the order?'],
    ]);
    expect(view().querySelector('.fd-rules-note')?.textContent).toBe('1 rule, and steps in 3 places, on this page.');
    // The app's names kept apart as code: its action, and a page the app's list has not got, by its id.
    expect([...view().querySelectorAll('.fd-rules-steps code')].map((c) => c.textContent)).toEqual(['customer', 'check_stock']);
  });

  it('says the count without rules when there are none', () => {
    const { designer, view, toggle } = screen();
    designer.setCondition('f-customer', null);
    toggle().click();
    expect(view().querySelector('.fd-rules-note')?.textContent).toBe('Steps in 3 places on this page, and no rules.');
  });

  it('filters steps by their words too', () => {
    const { view, toggle, groups } = screen();
    toggle().click();
    type(view().querySelector('input[aria-label="Filter the rules"]') as HTMLInputElement, 'stock');
    expect(groups()).toEqual([['When it changes', 'Product: Run the app’s action check_stock']]);
  });

  it('goes to a list clicked: its part picked, its list open on the panel, the cursor on its first step', () => {
    const { designer, host, view, toggle } = screen();
    toggle().click();
    const item = (name: string) => [...view().querySelectorAll<HTMLButtonElement>('.fd-rules-item')].find((i) => i.querySelector('.fd-rules-item-name')?.textContent === name) as HTMLButtonElement;
    item('Product').click();
    expect(view().hidden).toBe(true);
    expect(designer.getState().selected).toBe('f-product');
    expect(host.querySelector('.fd-properties [role="tab"][aria-selected="true"]')?.textContent).toBe('Rules');
    expect(document.activeElement?.textContent).toBe('Run the app’s action check_stock');
    toggle().click();
    item('Before it’s saved or sent').click();
    expect(designer.getState().selected).toBeNull();
    expect(document.activeElement?.textContent).toBe('Check the form');
    expect(document.activeElement?.closest('.fd-do')?.getAttribute('aria-label')).toBe('Before it’s saved or sent');
    toggle().click();
    item('New customer').click();
    expect(designer.getState().selected).toBe('new');
    expect(document.activeElement?.closest('[data-setting]')?.getAttribute('data-setting')).toBe('When clicked');
  });
});

describe('the canvas’s marks for what parts do', () => {
  it('marks a button with steps, its steps said when pointed at, and leaves a button that only names an app action', () => {
    const { host } = screen();
    const block = (id: string) => host.querySelector(`.fd-canvas-block[data-node="${id}"]`) as HTMLElement;
    expect(block('new').dataset['steps']).toBe('1');
    expect(block('new').title).toBe('When clicked:\nOpen customer in a panel, then put its answer in Customer\n↳ Say: Customer added');
    expect(block('plain').hasAttribute('data-steps')).toBe(false);
  });

  it('marks a field whose change does something among its rules’ marks, and opens its list from it', () => {
    const { designer, host } = screen();
    const mark = host.querySelector('.fd-canvas-field[data-node="f-product"] .fd-rule-mark[data-mark="steps"]') as HTMLElement;
    expect(mark.textContent).toContain('1 step');
    expect(mark.querySelector('.fd-rule-tip')?.textContent).toBe('When it changes:\nRun the app’s action check_stock');
    mark.click();
    expect(designer.getState().selected).toBe('f-product');
    expect(document.activeElement?.textContent).toBe('Run the app’s action check_stock');
  });
});

describe('Find anything, with what parts do', () => {
  it('finds a list of steps by its words, and goes to it', () => {
    const { designer, host } = screen();
    (host.querySelector('.fd-find-button') as HTMLButtonElement).click();
    const box = document.querySelector('.fd-find-input') as HTMLInputElement;
    type(box, 'check_stock');
    const option = [...document.querySelectorAll<HTMLElement>('.fd-find-option')].find((o) => o.textContent?.includes('Steps: Product')) as HTMLElement;
    expect(option).toBeDefined();
    option.click();
    expect(designer.getState().selected).toBe('f-product');
  });
});
