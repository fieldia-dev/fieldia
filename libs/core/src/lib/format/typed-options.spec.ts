import { validatePage } from './validate';

/** A mask and a one-time code's settings, as the format takes and refuses them. */

const page = (node: Record<string, unknown>): unknown => ({
  fieldia: '0.9',
  id: 'typed',
  data: { kind: 'responses' },
  fields: { id_number: { type: 'char', label: 'National ID' } },
  layout: { type: 'sections', id: 'root', children: [{ type: 'field', id: 'f', field: 'id_number', ...node }] },
});
const messages = (node: Record<string, unknown>) => {
  const checked = validatePage(page(node));
  return checked.ok ? [] : checked.issues.map((issue) => `${issue.path}: ${issue.message}`);
};

describe('a mask and a one-time code in the format', () => {
  it('takes a mask, its capitals and what it keeps', () => {
    expect(messages({ options: { mask: '9 999 999 999' } })).toEqual([]);
    expect(messages({ options: { mask: 'aa99 **** [** ****]', upper: true, maskKeeps: 'shown' } })).toEqual([]);
    expect(messages({ options: { mask: '\\9-99' } })).toEqual([]);
  });

  it('refuses a mask that names nothing to type, a part left out that is not its end, and a word written wrong', () => {
    expect(messages({ options: { mask: '---' } })[0]).toMatch(/a mask names what goes in it/);
    expect(messages({ options: { mask: '99 [99] 99' } })[0]).toMatch(/what may be left out is the end of a mask/);
    expect(messages({ options: { mask: '99', maskKeeps: 'all' } })[0]).toMatch(/maskKeeps is "typed"/);
  });

  it('takes a code of 4 to 12 characters, letters too, and refuses one longer', () => {
    expect(messages({ widget: 'one-time-code', options: { length: 8, letters: true } })).toEqual([]);
    expect(messages({ widget: 'one-time-code', options: { length: 20 } })[0]).toMatch(/options\.length/);
  });

  it('takes amounts in shorthand, and refuses a word for it', () => {
    expect(messages({ options: { shorthand: true } })).toEqual([]);
    expect(messages({ options: { shorthand: 'yes' } })[0]).toMatch(/shorthand is true/);
  });
});

describe('a checkbox tree in the format', () => {
  const tree = (options: Record<string, unknown>): unknown => ({
    fieldia: '0.9',
    id: 'alert',
    data: { kind: 'responses' },
    fields: { areas: { type: 'many2many', label: 'Areas', relation: 'area' } },
    layout: { type: 'sections', id: 'root', children: [{ type: 'field', id: 'f', field: 'areas', widget: 'tree', options }] },
  });
  it('takes what it keeps and its search, and refuses a word written wrong', () => {
    expect(validatePage(tree({ keeps: 'top', search: false })).ok).toBe(true);
    const wrong = validatePage(tree({ keeps: 'branches' }));
    expect(wrong.ok ? '' : wrong.issues[0].message).toMatch(/keeps is "all", "top"/);
  });
});
