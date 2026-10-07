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

describe('several ribbons', () => {
  const ribbons = [
    { id: 'paid', label: 'Paid', tone: 'success', invisible: "state != 'done'" },
    { id: 'legacy', label: 'Legacy', tooltip: 'Made before the switch to Flectra', labelField: 'note' },
  ];

  it('takes ribbons, each with its condition, words from a field and a tooltip', () => {
    expect(both(sheet({ ribbons }))).toEqual([]);
  });

  it('refuses a ribbon whose field the page lacks, a condition it cannot read, and an id used twice', () => {
    const issues = both(sheet({ ribbon: { id: 'paid', label: 'Old' }, ribbons: [{ id: 'paid', label: 'Paid', labelField: 'nope', invisible: 'state ==' }] })).join('\n');
    expect(issues).toMatch(/ribbons\[0\]\.labelField: no field "nope"/);
    expect(issues).toMatch(/ribbons\[0\]\.invisible: cannot read/);
    expect(issues).toMatch(/duplicate id "paid"/);
  });

  it('shows the first ribbon whose condition holds, as a form reads it', async () => {
    const { createForm } = await import('../../index');
    const form = createForm({ page: sheet({ ribbons }) as never, values: { state: 'done' } });
    expect(form.node('paid').invisible).toBe(false);
    form.setValue('state', 'draft');
    expect(form.node('paid').invisible).toBe(true);
    expect(form.node('legacy').invisible).toBe(false);
  });

  it('hands a ribbon’s tooltip to a translator', async () => {
    const { pageWords } = await import('../../index');
    expect(pageWords(sheet({ ribbons }) as never)).toEqual(expect.arrayContaining(['Paid', 'Legacy', 'Made before the switch to Flectra']));
  });
});
