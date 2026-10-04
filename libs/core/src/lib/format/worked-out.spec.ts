import { checkPage, validatePage } from '../../index';

/**
 * What a page's worked-out values and values set by a condition are checked
 * for as the page is read: each expression reads, reads only fields of the
 * page (or of its line, in a line), adds up line fields that exist, and no
 * two values are worked out from each other.
 */

const page = (fields: Record<string, unknown>) => ({
  fieldia: '0.1',
  id: 'p',
  data: { kind: 'record', model: 'sale.order' },
  fields,
  layout: { type: 'sections', id: 'root', children: [] },
});

/** The issues both checks find: the full one where pages are made, and the one a viewer runs. */
function issues(fields: Record<string, unknown>): string[] {
  const full = validatePage(page(fields));
  const quick = checkPage(page(fields));
  const said = (r: typeof full) => (r.ok ? [] : r.issues.map((i) => `${i.path}: ${i.message}`));
  expect(said(quick)).toEqual(said(full));
  return said(full);
}

const lines = (fields: Record<string, unknown>) => ({ type: 'one2many', label: 'Lines', relation: 'line', fields });
const num = (label: string, extra: Record<string, unknown> = {}) => ({ type: 'float', label, ...extra });

describe('worked-out values, checked as the page is read', () => {
  it('takes expressions that read fields of the page, and lines that read fields of their line', () => {
    expect(
      issues({
        lines: lines({ qty: num('Qty'), price: num('Price'), subtotal: num('Subtotal', { compute: 'qty * price' }) }),
        total: num('Total', { compute: "round(sum(lines, 'subtotal'), 2)" }),
        discount: num('Discount', { setWhen: [{ when: 'total > 1000', value: 'max(total * 0.05, 10)' }] }),
        due: num('Due', { compute: 'total - discount' }),
      })
    ).toEqual([]);
  });

  it('refuses an expression it cannot read, saying where', () => {
    expect(issues({ a: num('A'), total: num('Total', { compute: 'a *' }) })).toEqual([expect.stringMatching(/^fields\.total\.compute: cannot read "a \*"/)]);
    expect(issues({ a: num('A'), b: num('B', { setWhen: [{ when: 'a > 1', value: 'round()' }] }) })).toEqual([
      expect.stringMatching(/^fields\.b\.setWhen\[0\]\.value: cannot read "round\(\)": round takes 1 or 2 values/),
    ]);
  });

  it('refuses a field the page does not have', () => {
    expect(issues({ price: num('Price'), total: num('Total', { compute: 'price * qtty' }) })).toEqual([
      'fields.total.compute: "price * qtty" reads "qtty", which is not a field of this page',
    ]);
    expect(issues({ b: num('B', { setWhen: [{ when: 'a > 1', value: 'nope' }] }) })).toEqual([
      'fields.b.setWhen[0].when: "a > 1" reads "a", which is not a field of this page',
      'fields.b.setWhen[0].value: "nope" reads "nope", which is not a field of this page',
    ]);
  });

  it('keeps a line to the fields of its own line', () => {
    expect(
      issues({
        rate: num('Rate'),
        lines: lines({ qty: num('Qty'), subtotal: num('Subtotal', { compute: 'qty * rate', setWhen: [{ when: 'rate > 1', value: 'qty' }] }) }),
      })
    ).toEqual([
      'fields.lines.fields.subtotal.compute: "qty * rate" reads "rate", which is not a field of the lines of "lines"',
      'fields.lines.fields.subtotal.setWhen[0].when: "rate > 1" reads "rate", which is not a field of the lines of "lines"',
    ]);
  });

  it('adds up only line fields that exist, of a one2many', () => {
    expect(issues({ lines: lines({ subtotal: num('Subtotal') }), total: num('Total', { compute: "sum(lines, 'subtotl')" }) })).toEqual([
      'fields.total.compute: "subtotl" is not a field of the lines of "lines"',
    ]);
    expect(issues({ name: { type: 'char', label: 'Name' }, total: num('Total', { compute: "sum(name, 'x')" }) })).toEqual([
      'fields.total.compute: sum adds up the lines of a one2many; "name" is a char',
    ]);
  });

  it('names the fields that are worked out from each other', () => {
    expect(issues({ a: num('A', { compute: 'b + 1' }), b: num('B', { compute: 'a * 2' }), c: num('C', { compute: 'a' }) })).toEqual([
      'fields.a.compute: "a" and "b" are worked out from each other: a → b → a',
    ]);
    expect(issues({ a: num('A', { compute: 'a + 1' }) })).toEqual(['fields.a.compute: "a" is worked out from itself']);
    expect(issues({ lines: lines({ x: num('X', { compute: 'y' }), y: num('Y', { compute: 'z' }), z: num('Z', { compute: 'x' }) }) })).toEqual([
      'fields.lines.fields.x.compute: "x", "y" and "z" are worked out from each other: x → y → z → x',
    ]);
  });

  it('works out and sets only what a field can hold from an expression', () => {
    expect(
      issues({
        partner_id: { type: 'many2one', label: 'Customer', relation: 'partner', compute: 'other_id' },
        other_id: { type: 'many2one', label: 'Other', relation: 'partner' },
        file: { type: 'binary', label: 'File', setWhen: [{ when: 'other_id', value: "'x'" }] },
      })
    ).toEqual([
      'fields.partner_id.compute: a many2one cannot be worked out; text, numbers, yes or no, dates, choices and json can',
      'fields.file.setWhen: a binary cannot be set by a condition; text, numbers, yes or no, dates, choices and json can',
    ]);
  });
});
