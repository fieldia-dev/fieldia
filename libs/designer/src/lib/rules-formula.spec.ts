import type { Page } from '@fieldia/core';
import { formulaInWords, formulaProblem, literalOf, problemWords, sampleResult, wouldCircle } from './rules-formula';

/** A formula as a person types it: what is wrong with it and where, what it reads, and what it gives. */

const page = (fields: Page['fields']): Page => ({
  fieldia: '0.1',
  id: 'p',
  data: { kind: 'record', model: 'order' },
  fields,
  layout: { type: 'sections', id: 'root', children: [] },
});

const order = page({
  price: { type: 'float', label: 'Price' },
  qty: { type: 'integer', label: 'Quantity' },
  total: { type: 'float', label: 'Total' },
  tax: { type: 'float', label: 'Tax' },
  name: { type: 'char', label: 'Name' },
  state: { type: 'selection', label: 'Status', options: [{ value: 'draft', label: 'Draft' }, { value: 'done', label: 'Done' }] },
});

describe('what is wrong with a formula, and where', () => {
  it('reads a good one, and says which fields it reads', () => {
    expect(formulaProblem(order, 'price * qty')).toBeNull();
    expect(formulaProblem(order, 'round(price * qty, 2)')).toBeNull();
  });

  it('names a field the page does not have, and where it is typed', () => {
    expect(problemWords(formulaProblem(order, 'prise * qty'))).toBe('Unknown field “prise” at 1–5');
    expect(formulaProblem(order, 'qty * prise')).toMatchObject({ from: 7, to: 11 });
  });

  it('reads the record’s id and the person, but only what the person has', () => {
    expect(formulaProblem(order, "not id or 'sales.manager' in user.roles")).toBeNull();
    expect(formulaProblem(order, 'user.id')).toBeNull();
    expect(problemWords(formulaProblem(order, 'user.role'))).toBe('The person has an id, name or roles, not “role” at 1–9');
  });

  it('reads the values the app passes in, as context', () => {
    expect(formulaProblem(order, "context.restricted_picking_type_code == 'incoming'")).toBeNull();
    expect(formulaProblem(order, 'contxt.code')).toMatchObject({ from: 1 });
  });

  it('names a function there is not', () => {
    const problem = formulaProblem(order, 'rond(price)');
    expect(problemWords(problem)).toMatch(/^Unknown function “rond” at 1–4/);
  });

  it('says a function was given too many values, at its name', () => {
    expect(problemWords(formulaProblem(order, 'price + round(1, 2, 3)'))).toBe('“round” takes 1 or 2 values, at 9–13');
  });

  it('points at what is out of place', () => {
    expect(problemWords(formulaProblem(order, 'price * * qty'))).toBe('“*” is out of place at 9');
    expect(problemWords(formulaProblem(order, 'price qty'))).toBe('“qty” is out of place at 7–9');
  });

  it('says what is missing at the end, and a bracket never closed', () => {
    expect(problemWords(formulaProblem(order, 'price *'))).toBe('Something is missing after “*” at 7');
    expect(problemWords(formulaProblem(order, 'round((price * qty)'))).toBe('A “(” is never closed at 6');
  });

  it('names a sign a formula cannot hold', () => {
    expect(problemWords(formulaProblem(order, 'price & qty'))).toBe('“&” cannot be in a formula, at 7');
  });

  it('asks for something to work out', () => {
    expect(problemWords(formulaProblem(order, '   '))).toBe('Type a formula');
  });
});

describe('a field worked out from itself', () => {
  it('is found directly, and through others', () => {
    expect(wouldCircle(order, 'total', 'total + 1')).toBe('“Total” cannot be worked out from itself');
    const chained = page({ ...order.fields, tax: { type: 'float', label: 'Tax', compute: 'total * 0.1' } });
    expect(wouldCircle(chained, 'total', 'price + tax')).toBe('“Total” would be worked out from itself: Total → Tax → Total');
    expect(wouldCircle(chained, 'total', 'price * qty')).toBeNull();
  });

  it('ends when other fields are worked out from each other, and it is not among them', () => {
    const tangled = page({ ...order.fields, tax: { type: 'float', label: 'Tax', compute: 'extra * 2' }, extra: { type: 'float', label: 'Extra', compute: 'tax + 1' } });
    expect(wouldCircle(tangled, 'total', 'tax + price')).toBeNull();
  });
});

describe('a formula in words', () => {
  it('reads with labels and the signs people write', () => {
    expect(formulaInWords(order, 'price * qty')).toBe('Price × Quantity');
    expect(formulaInWords(order, 'round(price / qty, 2) - tax')).toBe('round(Price ÷ Quantity, 2) − Tax');
    expect(formulaInWords(order, "state == 'done' and qty > 10")).toBe('Status is Done and Quantity > 10');
    expect(formulaInWords(order, "state != 'draft'")).toBe('Status is not Draft');
  });
});

describe('a literal value', () => {
  it('is read as a value, and anything else is not', () => {
    expect(literalOf("'bulk'")).toEqual({ value: 'bulk' });
    expect(literalOf('-5')).toEqual({ value: -5 });
    expect(literalOf('True')).toEqual({ value: true });
    expect(literalOf('qty * 2')).toBeNull();
  });
});

describe('the result on sample values', () => {
  it('works it out the way the form does, and says with what', () => {
    expect(sampleResult(order, 'total', 'price * qty')).toBe('With Price 120 and Quantity 3: 360');
    expect(sampleResult(order, 'qty', 'price / 7')).toBe('With Price 120: 17');
    expect(sampleResult(order, 'total', '2 + 2')).toBe('Always 4');
  });

  it('says when it gives nothing', () => {
    expect(sampleResult(order, 'total', 'price * name')).toBe('With Price 120 and Name “Name”: nothing — it cannot be worked out');
  });
});
