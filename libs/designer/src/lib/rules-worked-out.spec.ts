import type { Field, SectionNode } from '@fieldia/core';
import { blankPage, createDesigner } from './designer';
import { button, choose, field, leave, mount, openTab, press, type, typeAndLeave } from './test-editor';

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
  const { host } = mount(designer, { mode: 'advanced' });
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
    // Kept as the box is left, all of it read.
    expect(def('total').compute).toBeUndefined();
    leave(box());
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

  it('says what is wrong under the box, its place marked, and keeps the last formula that read, saying which', () => {
    const { designer, box, panel, def } = screen('total');
    typeAndLeave(box(), 'price * qty');
    type(box(), 'prise * qty');
    const problem = panel().querySelector('.fd-formula-problem') as HTMLElement;
    expect(problem.hidden).toBe(false);
    expect(problem.querySelector('.fd-formula-problem-words')?.textContent).toBe('Not in force yet: Unknown field “prise” at 1–5. The page keeps price * qty.');
    expect(problem.querySelector('mark')?.textContent).toBe('prise');
    leave(box());
    expect(def('total').compute).toBe('price * qty');
    expect(designer.getState().issues).toEqual([]);
    type(box(), 'total * 2');
    expect(problem.querySelector('.fd-formula-problem-words')?.textContent).toBe('Not in force yet: “Total” cannot be worked out from itself. The page keeps price * qty.');
  });

  it('never keeps the part typed so far that happens to read: only all of it, as the box is left', () => {
    const { box, def, panel } = screen('total');
    for (const typed of ['qty * ٢', 'qty * ۲', 'qty * 1٫5', 'qty * 2 + abc', 'qty * 1,5']) {
      type(box(), typed);
      leave(box());
    }
    // Arabic and Persian digits and ٫ read; a comma never does, and the page keeps the last that read.
    expect(def('total').compute).toBe('qty * 1٫5');
    expect(panel().querySelector('.fd-formula-problem-words')?.textContent).toMatch(/The page keeps qty \* 1٫5\. In a formula the decimal mark is a point or ٫, like 1\.5$/);
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
    typeAndLeave(box(), 'price * qty');
    expect(def('total').compute).toBe('price * qty');
    typeAndLeave(box(), '');
    expect(def('total').compute).toBeUndefined();
  });

  it('is for numbers, amounts and text', () => {
    expect(screen('kind').box()).toBeDefined();
    expect(screen('vip').box()).toBeUndefined();
    expect(screen('state').box()).toBeUndefined();
  });
});

describe('set when a field changes', () => {
  it('sets a value when a chosen field changes, a condition then optional, and says so', () => {
    const { panel, def } = screen('state');
    (button(panel(), 'Set when…') as HTMLButtonElement).click();
    choose(field(panel(), 'Set to'), 'active');
    choose(field(panel(), 'Set'), 'vip');
    expect(def('state').setWhen).toEqual([{ value: "'active'", on: ['vip'] }]);
    expect([...panel().querySelectorAll('.fd-set-when-say')].map((s) => s.textContent)).toEqual(['Set to Active when “VIP” changes']);
    typeAndLeave(field(panel(), 'When'), 'vip');
    expect(def('state').setWhen).toEqual([{ when: 'vip', value: "'active'", on: ['vip'] }]);
    expect([...panel().querySelectorAll('.fd-set-when-say')].map((s) => s.textContent)).toEqual(['Set to Active when “VIP” changes, if VIP']);
    // Back to as the condition starts to hold: the condition is kept, the field it was on goes.
    choose(field(panel(), 'Set'), '');
    expect(def('state').setWhen).toEqual([{ when: 'vip', value: "'active'" }]);
  });

  it('refuses a rule on a change of a field the page does not have, in words', () => {
    const { designer, def } = screen('state');
    expect(designer.setSetWhen('f-state', [{ value: "'active'", on: ['nothing'] }])).toBe(false);
    expect(designer.getState().issues).toEqual(['Unknown field “nothing”']);
    expect(def('state').setWhen).toBeUndefined();
  });
});

describe('set when', () => {
  it('sets a value when something holds, a row each, and takes a row away', () => {
    const { panel, def, typeOn } = screen('kind');
    (button(panel(), 'Set when…') as HTMLButtonElement).click();
    type(field(panel(), 'Set to'), 'bulk');
    expect(def('kind').setWhen).toBeUndefined();
    typeOn(field(panel(), 'When') as HTMLInputElement, 'qty > 10');
    leave(field(panel(), 'When'));
    expect(def('kind').setWhen).toEqual([{ when: 'qty > 10', value: "'bulk'" }]);
    expect([...panel().querySelectorAll('.fd-set-when-say')].map((s) => s.textContent)).toEqual(['Set to “bulk” when Quantity > 10']);
    (button(panel(), 'Remove: Set to “bulk” when Quantity > 10') as HTMLButtonElement).click();
    expect(def('kind').setWhen).toBeUndefined();
  });

  it('takes a number in the designer’s number box: Arabic and Persian digits and a decimal comma read, never 15 for 1,5', () => {
    const { panel, def } = screen('price');
    (button(panel(), 'Set when…') as HTMLButtonElement).click();
    const to = field(panel(), 'Set to') as HTMLInputElement;
    // Never the browser's number box, which reads by the browser's language and empties itself on Arabic digits.
    expect(to.type).toBe('text');
    typeAndLeave(to, '1,5');
    typeAndLeave(field(panel(), 'When'), 'qty > 10');
    expect(def('price').setWhen).toEqual([{ when: 'qty > 10', value: '1.5' }]);
    for (const [typed, expected] of [
      ['٥٠', '50'],
      ['۵۰', '50'],
      ['1.234,5', '1234.5'],
    ] as const) {
      typeAndLeave(field(panel(), 'Set to'), typed);
      expect([typed, def('price').setWhen?.[0]?.value]).toEqual([typed, expected]);
    }
  });

  it('keeps a whole number’s value whole, and says so under the box, never a value it did not read', () => {
    const { panel, def } = screen('qty');
    (button(panel(), 'Set when…') as HTMLButtonElement).click();
    const to = field(panel(), 'Set to') as HTMLInputElement;
    typeAndLeave(to, '1.5');
    typeAndLeave(field(panel(), 'When'), 'price > 10');
    expect(def('qty').setWhen).toBeUndefined();
    expect(to.parentElement?.querySelector('.fd-refusal-hint')?.textContent).toBe('Set to must be a whole number');
    typeAndLeave(field(panel(), 'Set to'), '3');
    expect(def('qty').setWhen).toEqual([{ when: 'price > 10', value: '3' }]);
  });

  it('offers a choice’s options, and yes or no, to set', () => {
    const state = screen('state');
    (button(state.panel(), 'Set when…') as HTMLButtonElement).click();
    choose(field(state.panel(), 'Set to'), 'active');
    typeAndLeave(field(state.panel(), 'When'), 'qty > 1');
    expect(state.def('state').setWhen).toEqual([{ when: 'qty > 1', value: "'active'" }]);
    const vip = screen('vip');
    (button(vip.panel(), 'Set when…') as HTMLButtonElement).click();
    choose(field(vip.panel(), 'Set to'), 'True');
    typeAndLeave(field(vip.panel(), 'When'), 'qty > 100');
    expect(vip.def('vip').setWhen).toEqual([{ when: 'qty > 100', value: 'True' }]);
  });
});
