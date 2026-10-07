import { checkPage, validatePage } from '../../index';

/**
 * How a dense record sheet reads, as Flectra draws one: read-only values as
 * words, stat buttons that format what they show, links with pictures and
 * colours, parts on one line, alerts that hold a field's value, a statusbar
 * with a condition, keys on buttons, parts for editing or reading only, and
 * several ribbons. Each addition is checked by shape and by the page check.
 */

const fields = {
  name: { type: 'char', label: 'Name' },
  state: { type: 'selection', label: 'Status', options: [{ value: 'draft', label: 'Draft' }, { value: 'done', label: 'Done' }] },
  total: { type: 'monetary', label: 'Total', currency: 'EGP' },
  orders: { type: 'integer', label: 'Orders' },
  note: { type: 'char', label: 'Note' },
};
const sheet = (extra: Record<string, unknown> = {}, children: unknown[] = []) => ({
  fieldia: '0.1',
  id: 'p',
  data: { kind: 'record', model: 'x' },
  fields,
  layout: { type: 'sheet', id: 'root', children, ...extra },
});
const both = (input: unknown) => {
  const shape = validatePage(input);
  const run = checkPage(input);
  return [...(shape.ok ? [] : shape.issues), ...(run.ok ? [] : run.issues)].map((i) => `${i.path}: ${i.message}`);
};

describe('read-only fields as words', () => {
  it('takes the page-wide way read-only fields show: as words, or in their boxes', () => {
    for (const readonlyShown of ['text', 'box']) expect(both({ ...sheet(), look: { readonlyShown } })).toEqual([]);
    expect(both({ ...sheet(), look: { readonlyShown: 'words' } }).join('\n')).toMatch(/readonlyShown/);
  });
});
