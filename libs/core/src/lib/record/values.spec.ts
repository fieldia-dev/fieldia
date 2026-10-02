import type { Field } from '../format/field';
import { emptyValue, initialValues, isEmpty, expressionContext, type Values } from './values';

const F = (field: Record<string, unknown>) => ({ label: 'X', ...field }) as Field;

describe('emptyValue', () => {
  it.each([
    ['char', null],
    ['text', null],
    ['html', null],
    ['integer', null],
    ['float', null],
    ['boolean', false],
    ['date', null],
    ['datetime', null],
    ['binary', null],
    ['json', null],
  ])('%s starts as %p', (type, expected) => {
    expect(emptyValue(F({ type }))).toEqual(expected);
  });

  it('a list-shaped field starts as an empty list', () => {
    expect(emptyValue(F({ type: 'many2many', relation: 'tag' }))).toEqual([]);
    expect(emptyValue(F({ type: 'one2many', relation: 'line', fields: {} }))).toEqual([]);
    expect(emptyValue(F({ type: 'selection', options: [{ value: 'a', label: 'A' }], multiple: true }))).toEqual([]);
  });

  it('a single selection, many2one and reference start empty', () => {
    expect(emptyValue(F({ type: 'selection', options: [{ value: 'a', label: 'A' }] }))).toBeNull();
    expect(emptyValue(F({ type: 'many2one', relation: 'x' }))).toBeNull();
    expect(emptyValue(F({ type: 'reference', models: [{ value: 'x', label: 'X' }] }))).toBeNull();
  });
});

describe('initialValues', () => {
  it('uses each field default, and the empty value otherwise', () => {
    const values = initialValues({
      state: F({ type: 'selection', options: [{ value: 'draft', label: 'Draft' }], default: 'draft' }),
      name: F({ type: 'char' }),
      active: F({ type: 'boolean', default: true }),
    });
    expect(values).toEqual({ state: 'draft', name: null, active: true });
  });

  it('copies defaults, so editing one form never edits the page', () => {
    const fields = { meta: F({ type: 'json', default: { a: 1 } }) };
    const values = initialValues(fields);
    (values['meta'] as { a: number }).a = 2;
    expect(initialValues(fields)['meta']).toEqual({ a: 1 });
  });
});

describe('isEmpty', () => {
  it('counts null, blank text and empty lists as empty', () => {
    expect(isEmpty(F({ type: 'char' }), null)).toBe(true);
    expect(isEmpty(F({ type: 'char' }), '   ')).toBe(true);
    expect(isEmpty(F({ type: 'many2many', relation: 't' }), [])).toBe(true);
    expect(isEmpty(F({ type: 'char' }), 'x')).toBe(false);
  });

  it('never counts a number or a boolean as empty', () => {
    expect(isEmpty(F({ type: 'integer' }), 0)).toBe(false);
    expect(isEmpty(F({ type: 'boolean' }), false)).toBe(false);
  });
});

describe('expressionContext — what modifiers see', () => {
  const fields = {
    country_id: F({ type: 'many2one', relation: 'country' }),
    tag_ids: F({ type: 'many2many', relation: 'tag' }),
    child_ids: F({ type: 'one2many', relation: 'partner', fields: {} }),
    doc: F({ type: 'reference', models: [{ value: 'sale.order', label: 'Order' }] }),
    file: F({ type: 'binary' }),
    state: F({ type: 'selection', options: [{ value: 'draft', label: 'Draft' }] }),
  };

  it('reads a many2one as its id, a many2many as its ids, and lines as a list', () => {
    const values: Values = {
      country_id: { id: 5, label: 'Egypt' },
      tag_ids: [{ id: 1, label: 'VIP' }, { id: 2, label: 'Wholesale' }],
      child_ids: [{ key: 'k1', id: 9, values: {} }, { key: 'k2', values: {} }],
      doc: { model: 'sale.order', id: 4, label: 'SO004' },
      file: { name: 'a.pdf', type: 'application/pdf', size: 10 },
      state: 'draft',
    };
    expect(expressionContext(values, fields)).toEqual({
      country_id: 5,
      tag_ids: [1, 2],
      child_ids: ['k1', 'k2'],
      doc: 'sale.order,4',
      file: 'a.pdf',
      state: 'draft',
    });
  });

  it('keeps empty values empty, so "not country_id" is true', () => {
    expect(expressionContext({ country_id: null, tag_ids: [], child_ids: [], doc: null, file: null, state: null }, fields)).toEqual({
      country_id: null,
      tag_ids: [],
      child_ids: [],
      doc: null,
      file: null,
      state: null,
    });
  });
});
