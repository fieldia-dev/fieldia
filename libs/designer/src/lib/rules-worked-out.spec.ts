import type { Field, SectionNode } from '@fieldia/core';
import { blankPage, createDesigner } from './designer';
import { button, choose, field, mount, openTab, press, type } from './test-editor';

/**
 * "Worked out from": a formula typed with the page's fields suggested by
 * their labels, a short list of functions, the result on made-up values,
 * and what is wrong said under the box with its place marked. "Set when…":
 * values set when something holds, a row each.
 */

const fields: Record<string, Field> = {
  price: { type: 'float', label: 'Price' },
  qty: { type: 'integer', label: 'Quantity' },
  total: { type: 'float', label: 'Total' },
  kind: { type: 'char', label: 'Kind' },
  state: { type: 'selection', label: 'Status', options: [{ value: 'draft', label: 'Draft' }, { value: 'active', label: 'Active' }] },
  vip: { type: 'boolean', label: 'VIP' },
};

function screen(pick: string) {
  const page = blankPage('screen', 'Order');
  const section = (page.layout as unknown as { children: SectionNode[] }).children[0];
  section.children = Object.keys(fields).map((name) => ({ type: 'field' as const, id: `f-${name}`, field: name }));
  page.fields = JSON.parse(JSON.stringify(fields));
  const designer = createDesigner({ page });
  designer.select(`f-${pick}`);
  const { host } = mount(designer);
  openTab(host, 'Rules');
  const panel = () => host.querySelector('.fd-properties') as HTMLElement;
  const box = () => field(panel(), 'Worked out from') as HTMLInputElement;
  const suggested = () => [...panel().querySelectorAll('.fd-formula-suggest [role="option"]')].filter((o) => !o.closest('[hidden]')).map((o) => o.querySelector('.fd-formula-suggest-label')?.textContent);
  /** Type at the end of the box, as a person does, a key at a time. */
  const typeOn = (input: HTMLInputElement, text: string) => {
    for (const ch of text) {
      input.focus();
      input.value += ch;
      input.setSelectionRange(input.value.length, input.value.length);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
  };
  return { designer, host, panel, box, suggested, typeOn, def: (name: string) => designer.getPage().fields[name] };
}

describe('worked out from', () => {
  it('suggests the page’s fields by their labels as a name is typed, or after @, and puts in their names', () => {
    const { box, suggested, typeOn, def, panel } = screen('total');
    typeOn(box(), 'pr');
    expect(suggested()).toEqual(['Price']);
    press('Enter', {}, box());
    expect(box().value).toBe('price');
    typeOn(box(), ' * @');
    expect(suggested()).toEqual(['Price', 'Quantity', 'Kind', 'Status', 'VIP']);
    typeOn(box(), 'qu');
    expect(suggested()).toEqual(['Quantity']);
    press('Enter', {}, box());
    expect(box().value).toBe('price * qty');
    expect(def('total').compute).toBe('price * qty');
    expect(panel().querySelector('.fd-formula-outcome')?.textContent).toBe('With Price 120 and Quantity 3: 360');
    expect(panel().querySelector('.fd-formula-reads')?.textContent).toBe('Reads: Price × Quantity');
    expect(panel().querySelector('[data-setting="Worked out from"] .fd-properties-hint')?.textContent).toMatch(/cannot type in it/);
  });

  it('moves through the suggestions with the arrows, and Escape closes them', () => {
    const { box, suggested, typeOn } = screen('total');
    typeOn(box(), '@');
    press('ArrowDown', {}, box());
    expect(box().getAttribute('aria-activedescendant')).toMatch(/-1$/);
    press('Escape', {}, box());
    expect(suggested()).toEqual([]);
    expect(box().getAttribute('aria-expanded')).toBe('false');
  });

  it('says what is wrong under the box, its place marked, and keeps the last formula that read', () => {
    const { designer, box, panel, def } = screen('total');
    type(box(), 'price * qty');
    type(box(), 'prise * qty');
    const problem = panel().querySelector('.fd-formula-problem') as HTMLElement;
    expect(problem.hidden).toBe(false);
    expect(problem.querySelector('.fd-formula-problem-words')?.textContent).toBe('Unknown field “prise” at 1–5');
    expect(problem.querySelector('mark')?.textContent).toBe('prise');
    expect(def('total').compute).toBe('price * qty');
    expect(designer.getState().issues).toEqual([]);
    type(box(), 'total * 2');
    expect(problem.querySelector('.fd-formula-problem-words')?.textContent).toBe('“Total” cannot be worked out from itself');
  });

  it('puts in a function where the cursor is', () => {
    const { box } = screen('total');
    type(box(), 'price');
    box().setSelectionRange(0, 0);
    (button(box().closest('[data-setting]') as HTMLElement, 'round') as HTMLButtonElement).click();
    expect(box().value).toBe('round(, 2)price');
    expect(box().selectionStart).toBe('round('.length);
  });

  it('takes the formula away when the box is emptied, and the field can be typed in again', () => {
    const { box, def } = screen('total');
    type(box(), 'price * qty');
    type(box(), '');
    expect(def('total').compute).toBeUndefined();
  });

  it('is for numbers, amounts and text', () => {
    expect(screen('kind').box()).toBeDefined();
    expect(screen('vip').box()).toBeUndefined();
    expect(screen('state').box()).toBeUndefined();
  });
});

describe('set when', () => {
  it('sets a value when something holds, a row each, and takes a row away', () => {
    const { panel, def, typeOn } = screen('kind');
    (button(panel(), 'Set when…') as HTMLButtonElement).click();
    type(field(panel(), 'Set to'), 'bulk');
    expect(def('kind').setWhen).toBeUndefined();
    typeOn(field(panel(), 'When') as HTMLInputElement, 'qty > 10');
    expect(def('kind').setWhen).toEqual([{ when: 'qty > 10', value: "'bulk'" }]);
    expect([...panel().querySelectorAll('.fd-set-when-say')].map((s) => s.textContent)).toEqual(['Set to “bulk” when Quantity > 10']);
    (button(panel(), 'Remove: Set to “bulk” when Quantity > 10') as HTMLButtonElement).click();
    expect(def('kind').setWhen).toBeUndefined();
  });

  it('offers a choice’s options, and yes or no, to set', () => {
    const state = screen('state');
    (button(state.panel(), 'Set when…') as HTMLButtonElement).click();
    choose(field(state.panel(), 'Set to'), 'active');
    type(field(state.panel(), 'When'), 'qty > 1');
    expect(state.def('state').setWhen).toEqual([{ when: 'qty > 1', value: "'active'" }]);
    const vip = screen('vip');
    (button(vip.panel(), 'Set when…') as HTMLButtonElement).click();
    choose(field(vip.panel(), 'Set to'), 'True');
    type(field(vip.panel(), 'When'), 'qty > 100');
    expect(vip.def('vip').setWhen).toEqual([{ when: 'qty > 100', value: 'True' }]);
  });
});
