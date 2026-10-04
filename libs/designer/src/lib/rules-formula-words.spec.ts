import type { Field, SectionNode } from '@fieldia/core';
import { blankPage, createDesigner } from './designer';
import { formulaInWords } from './rules-formula';
import { button, field, mount, openTab, press, type } from './test-editor';

/**
 * A formula read in words. The box keeps the formula as the page stores it —
 * the fields by their names — and a line above it says the same formula with
 * the fields by their labels: `price * qty` reads "Price × Quantity". The
 * page's formula is never translated back from words, so two fields with one
 * label, or a label with a sign in it, cannot turn a formula into another.
 * Both ways round: a field picked by its label puts its name in the box, and
 * a field renamed reads by its new label while the formula stays as it was.
 */

const fields: Record<string, Field> = {
  price: { type: 'float', label: 'Unit price' },
  qty: { type: 'integer', label: 'Quantity' },
  net: { type: 'float', label: 'Price - net' },
  total: { type: 'float', label: 'Total' },
  kind: { type: 'char', label: 'Kind' },
  start: { type: 'date', label: 'Start date' },
  end: { type: 'date', label: 'Ends' },
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
  /** The words line of the box named so, and the box. */
  const read = (name: string) => {
    const box = field(panel(), name) as HTMLInputElement;
    const line = box.closest('.fd-formula')?.querySelector('.fd-formula-reads') as HTMLElement;
    return { box, line, words: () => (line.hidden ? null : line.textContent) };
  };
  return { designer, panel, read };
}

describe('a formula in words, above its box', () => {
  it('reads the fields by their labels, the box keeping their names', () => {
    const { panel, read } = screen('total');
    const { box, line, words } = read('Worked out from');
    type(box, 'price * qty');
    expect(box.value).toBe('price * qty');
    expect(words()).toBe('Reads: Unit price × Quantity');
    // Above the box, and what the box is described by.
    expect(line.compareDocumentPosition(box) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(box.getAttribute('aria-describedby')).toBe(line.id);
    // Each field stands out as one name.
    expect([...line.querySelectorAll('.fd-formula-name')].map((n) => n.textContent)).toEqual(['Unit price', 'Quantity']);
    // The line under the box keeps to the result.
    expect(panel().querySelector('.fd-formula-result')?.textContent).toBe('With Unit price 120 and Quantity 3: 360');
  });

  it('quotes a label with a sign of its own, so it reads as one name', () => {
    const { read } = screen('total');
    type(read('Worked out from').box, 'net * qty');
    expect(read('Worked out from').words()).toBe('Reads: “Price - net” × Quantity');
  });

  it('says nothing while the formula does not read, nor for one that reads as it is written', () => {
    const { read } = screen('total');
    const { box, words } = read('Worked out from');
    type(box, 'price *');
    expect(words()).toBeNull();
    type(box, '120');
    expect(words()).toBeNull();
  });

  it('shows in “Set when” and in a rule across fields too', () => {
    const { panel, read } = screen('kind');
    (button(panel(), 'Set when…') as HTMLButtonElement).click();
    type(read('When').box, 'qty > 10');
    expect(read('When').words()).toBe('Reads: Quantity > 10');
    const ends = screen('end');
    ends.designer.addAnswerRule('f-end', { holds: 'end >= start' });
    (ends.panel().querySelector('.fd-answer-rule-say') as HTMLButtonElement).click();
    expect(ends.read('Must hold').box.value).toBe('end >= start');
    expect(ends.read('Must hold').words()).toBe('Reads: Ends ≥ Start date');
  });

  it('both ways round: a field picked by its label puts its name in; a field renamed reads by its new label', () => {
    const { designer, read } = screen('total');
    const { box, words } = read('Worked out from');
    type(box, 'quan');
    box.setSelectionRange(4, 4);
    box.dispatchEvent(new Event('input', { bubbles: true }));
    press('Enter', {}, box);
    expect(box.value).toBe('qty');
    expect(words()).toBe('Reads: Quantity');
    expect(designer.getPage().fields['total'].compute).toBe('qty');
    box.blur();
    designer.updateQuestion('f-qty', { label: 'Number of units' });
    expect(words()).toBe('Reads: Number of units');
    expect(designer.getPage().fields['total'].compute).toBe('qty');
  });
});

describe('formulaInWords', () => {
  const page = { ...blankPage('screen', 'Order'), fields };

  it('says ≥ and ≤, × and ÷, and quotes only labels with a sign in them', () => {
    expect(formulaInWords(page, 'end >= start and price <= net / qty')).toBe('Ends ≥ Start date and Unit price ≤ “Price - net” ÷ Quantity');
  });
});
