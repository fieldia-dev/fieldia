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

describe('alerts that hold a field’s value, with buttons inside, and alerts in a tab', () => {
  const alerts = [
    { id: 'lock', message: 'The tax lock date is {total}; entries before it cannot be posted.', tone: 'warning' },
    { id: 'credit', message: '', messageField: 'note', invisible: 'not note' },
    { id: 'dup', message: 'This bill may be a duplicate.', buttons: [{ type: 'button', id: 'dup-open', label: 'See the other bill', action: 'open_duplicate' }] },
  ];

  it('takes words with a field’s value inside, words from a field, and buttons', () => {
    expect(both(sheet({ alerts }))).toEqual([]);
  });

  it('refuses a value of a field the page lacks, a message field it lacks, and a button with nothing to do', () => {
    const bad = [{ id: 'a', message: 'Due {nope}', messageField: 'gone', buttons: [{ type: 'button', id: 'b', label: 'Go' }] }];
    const issues = both(sheet({ alerts: bad })).join('\n');
    expect(issues).toMatch(/alerts\[0\]\.message: no field "nope"/);
    expect(issues).toMatch(/alerts\[0\]\.messageField: no field "gone"/);
    expect(issues).toMatch(/alerts\[0\]\.buttons\[0\]: a button needs steps, an action, or both/);
  });

  it('runs an alert’s button as any button, and hides it with its alert', async () => {
    const { createForm } = await import('../../index');
    const calls: string[] = [];
    const page = sheet({ alerts: [{ id: 'dup', message: 'Duplicate?', invisible: "state == 'done'", buttons: [{ type: 'button', id: 'dup-open', label: 'See it', action: 'open_duplicate' }] }] });
    const form = createForm({ page: page as never, values: { state: 'draft' }, onAction: async (request) => void calls.push(request.action) });
    expect(form.node('dup-open').invisible).toBe(false);
    await form.runAction('dup-open');
    expect(calls).toEqual(['open_duplicate']);
    form.setValue('state', 'done');
    expect(form.node('dup-open').invisible).toBe(true);
  });

  it('takes an alert among a page’s parts — in a tab, in a sections page — as words in an alert’s box, with a field’s value inside', () => {
    const text = { type: 'text', id: 't', text: 'Top up {total} to reach the minimum.', style: 'alert', tone: 'warning' };
    expect(both(sheet({}, [{ type: 'tabs', id: 'tabs', children: [{ type: 'tab', id: 'trust', label: 'Trust', children: [text] }] }]))).toEqual([]);
    expect(both({ ...sheet(), layout: { type: 'sections', id: 'root', children: [text] } })).toEqual([]);
    expect(both(sheet({}, [{ ...text, text: 'Top up {nope}' }])).join('\n')).toMatch(/children\[0\]\.text: no field "nope"/);
    expect(both(sheet({}, [{ ...text, tone: 'loud' }])).join('\n')).toMatch(/tone/);
  });
});

describe('stat buttons that say more', () => {
  const stat = (extra: Record<string, unknown>) => sheet({ statButtons: [{ id: 's', label: 'Sold', field: 'orders', action: 'open', ...extra }] });

  it('takes a unit, a unit from a field, words from a field, and a second value with its own words', () => {
    expect(both(stat({ unit: 'Units', labelField: 'note' }))).toEqual([]);
    expect(both(stat({ unitField: 'name', secondField: 'total', secondLabel: 'Out' }))).toEqual([]);
  });

  it('refuses a field the page lacks, and words for a second value with no second value', () => {
    const issues = both(stat({ unitField: 'u', labelField: 'l', secondField: 'x' })).join('\n');
    expect(issues).toMatch(/statButtons\[0\]\.unitField: no field "u"/);
    expect(issues).toMatch(/statButtons\[0\]\.labelField: no field "l"/);
    expect(issues).toMatch(/statButtons\[0\]\.secondField: no field "x"/);
    expect(both(stat({ secondLabel: 'Out' })).join('\n')).toMatch(/statButtons\[0\]\.secondLabel: words for a second value need its field \(secondField\)/);
  });

  it('hands its unit and second words to a translator', async () => {
    const { pageWords } = await import('../../index');
    expect(pageWords(stat({ unit: 'Units', secondField: 'total', secondLabel: 'Out' }) as never)).toEqual(expect.arrayContaining(['Sold', 'Units', 'Out']));
  });
});

describe('a statusbar with a condition, time per step, folded steps, and a click that saves', () => {
  const page = (statusbar: Record<string, unknown>, more: Record<string, unknown> = {}) => ({
    ...sheet({ statusbar }),
    fields: { ...fields, stage_id: { type: 'many2one', label: 'Stage', relation: 'stage' }, durations: { type: 'json', label: 'Time per stage' }, ...more },
  });

  it('takes a condition, roles, the field holding time per step, folded steps and a click that saves', () => {
    expect(both(page({ field: 'stage_id', invisible: "state == 'done'", roles: ['sales.user'], durationsField: 'durations', fold: true, clickable: true, saves: true }))).toEqual([]);
  });

  it('refuses time per step from what is not a json field, folded steps of a choice, and a save on a click no one can make', () => {
    expect(both(page({ field: 'stage_id', durationsField: 'name' })).join('\n')).toMatch(/statusbar\.durationsField: "name" is a char; time per step comes from a json field/);
    expect(both(page({ field: 'state', fold: true })).join('\n')).toMatch(/statusbar\.fold: steps fold by their record/);
    expect(both(page({ field: 'state', saves: true })).join('\n')).toMatch(/statusbar\.saves: a click saves only where a step can be clicked/);
    expect(both(page({ field: 'state', invisible: 'state ==' })).join('\n')).toMatch(/statusbar\.invisible: cannot read/);
  });

  it('hides the statusbar while its condition holds, as a form reads it', async () => {
    const { createForm } = await import('../../index');
    const form = createForm({ page: page({ field: 'state', invisible: "state == 'done'" }) as never, values: { state: 'draft' } });
    expect(form.node('#statusbar').invisible).toBe(false);
    form.setValue('state', 'done');
    expect(form.node('#statusbar').invisible).toBe(true);
  });
});

describe('what a link shows of its record, from the memory data source', () => {
  it('gives each record a search finds, and each link a record loads, its picture, colour, lines and folding', async () => {
    const { createMemoryDataSource } = await import('../../index');
    const source = createMemoryDataSource({
      records: {
        deal: { 1: { user_id: { id: 5, label: 'Mona' }, tag_ids: [{ id: 9, label: 'VIP' }], stage_id: { id: 3, label: 'Won' } } },
        user: { 5: { name: 'Mona', image: 'data:image/png;base64,AAA', city: { id: 1, label: 'Cairo' }, street: '12 Nile St' } },
        tag: { 9: { name: 'VIP', color: 4 } },
        stage: { 2: { name: 'Lost', fold: true }, 3: { name: 'Won', fold: false } },
      },
      shows: { user: { avatar: 'image', details: ['street', 'city'] }, tag: { color: 'color' }, stage: { folded: 'fold' } },
    });
    const fieldsOf = {
      user_id: { type: 'many2one', label: 'User', relation: 'user' },
      tag_ids: { type: 'many2many', label: 'Tags', relation: 'tag' },
      stage_id: { type: 'many2one', label: 'Stage', relation: 'stage' },
    } as const;
    const loaded = await source.load({ model: 'deal', id: 1, fields: fieldsOf as never });
    expect(loaded['user_id']).toEqual({ id: 5, label: 'Mona', avatar: 'data:image/png;base64,AAA', details: '12 Nile St\nCairo' });
    expect(loaded['tag_ids']).toEqual([{ id: 9, label: 'VIP', color: 4 }]);
    expect(await source.search({ model: 'stage', query: '' })).toEqual([{ id: 2, label: 'Lost', folded: true }, { id: 3, label: 'Won', folded: false }]);
  });
});
