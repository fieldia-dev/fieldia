import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Page } from '../format/page';
import type { SheetNode } from '../format/layout';
import { createForm, type ActionRequest, type DraftStore } from './form';
import type { Line } from './values';
import { createMemoryDataSource } from './memory-data-source';
import { saveRefused, type DataSource } from './data-source';
import type { Scheduler } from './scheduler';

const EXAMPLES = join(__dirname, '..', '..', '..', '..', '..', 'examples', 'pages');
const page = (name: string): Page => JSON.parse(readFileSync(join(EXAMPLES, `${name}.page.json`), 'utf8'));

/** Timers that only move when the test says so. */
function manualClock(): Scheduler & { advance(ms: number): void; pending(): number } {
  let now = 0;
  let next = 0;
  const timers = new Map<number, { at: number; run: () => void }>();
  return {
    setTimeout(run, ms) {
      timers.set(++next, { at: now + ms, run });
      return next;
    },
    clearTimeout(handle) {
      timers.delete(handle as number);
    },
    advance(ms) {
      now += ms;
      for (const [id, timer] of [...timers].sort((a, b) => a[1].at - b[1].at)) {
        if (timer.at <= now) {
          timers.delete(id);
          timer.run();
        }
      }
    },
    pending: () => timers.size,
  };
}

function memoryStore(): DraftStore & { items: Map<string, string> } {
  const items = new Map<string, string>();
  return {
    items,
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => void items.set(key, value),
    removeItem: (key) => void items.delete(key),
  };
}

const customerRecord = {
  name: 'Nile Traders',
  is_company: true,
  state: 'active',
  email: 'hello@nile.example',
  country_id: { id: 1, label: 'Egypt' },
  tag_ids: [{ id: 10, label: 'VIP' }],
  child_ids: [{ key: 'c1', id: 2, values: { name: 'Mona', function: 'Buyer', email: null, phone: null } }],
  credit_limit: 5000,
  currency_id: { id: 1, label: 'EGP' },
};

function customerSource() {
  return createMemoryDataSource({
    records: {
      partner: { 1: customerRecord },
      'partner.tag': { 10: { name: 'VIP' }, 11: { name: 'Wholesale' } },
      country: { 1: { name: 'Egypt' }, 2: { name: 'Jordan' } },
      'country.region': { 1: { name: 'Cairo', country_id: { id: 1, label: 'Egypt' } }, 2: { name: 'Amman', country_id: { id: 2, label: 'Jordan' } } },
      currency: { 1: { name: 'EGP' }, 2: { name: 'JOD' } },
    },
    onchange: {
      partner: {
        country_id: (values) => {
          const country = values['country_id'] as { id: number } | null;
          return { currency_id: country?.id === 2 ? { id: 2, label: 'JOD' } : { id: 1, label: 'EGP' }, state_id: null };
        },
      },
    },
  });
}

describe('createForm — a new record', () => {
  it('starts from defaults, clean and ready', () => {
    const form = createForm({ page: page('customer') });
    const state = form.getState();
    expect(state.status).toBe('ready');
    expect(state.recordId).toBeNull();
    expect(state.values['state']).toBe('draft');
    expect(state.values['name']).toBeNull();
    expect(state.dirty).toEqual([]);
  });

  it('marks what changed, and reset brings it back', () => {
    const form = createForm({ page: page('customer') });
    form.setValue('name', 'Delta Co');
    expect(form.getState().values['name']).toBe('Delta Co');
    expect(form.getState().dirty).toEqual(['name']);
    form.setValue('name', null);
    expect(form.getState().dirty).toEqual([]);
    form.setValue('email', 'x@y.co');
    form.reset();
    expect(form.getState().values['email']).toBeNull();
    expect(form.getState().dirty).toEqual([]);
  });

  it('refuses a field the page does not have', () => {
    expect(() => createForm({ page: page('customer') }).setValue('fax', '1')).toThrow('The page has no field "fax"');
  });

  it('tells subscribers about every change, until they leave', () => {
    const form = createForm({ page: page('customer') });
    const seen: unknown[] = [];
    const leave = form.subscribe((state) => seen.push(state.values['name']));
    form.setValue('name', 'A');
    form.setValue('name', 'B');
    leave();
    form.setValue('name', 'C');
    expect(seen).toEqual(['A', 'B']);
  });

  it('hands out a new state object per change and the same one otherwise', () => {
    const form = createForm({ page: page('customer') });
    const before = form.getState();
    expect(form.getState()).toBe(before);
    form.setValue('name', 'A');
    expect(form.getState()).not.toBe(before);
  });
});

describe('createForm — modifiers', () => {
  it('hides a field until what it depends on is set', () => {
    const form = createForm({ page: page('customer') });
    expect(form.node('f-region').invisible).toBe(true);
    form.setValue('country_id', { id: 1, label: 'Egypt' });
    expect(form.node('f-region').invisible).toBe(false);
  });

  it('hides everything inside a hidden tab', () => {
    const form = createForm({ page: page('customer') });
    expect(form.node('tab-contacts').invisible).toBe(true);
    expect(form.node('f-contacts').invisible).toBe(true);
    form.setValue('is_company', true);
    expect(form.node('f-contacts').invisible).toBe(false);
  });

  it('makes a field read-only by state', () => {
    const form = createForm({ page: page('customer') });
    expect(form.node('f-credit-limit').readonly).toBe(false);
    form.setValue('state', 'blocked');
    expect(form.node('f-credit-limit').readonly).toBe(true);
  });

  it('makes every field of a section read-only while the section says so, nested sections too', () => {
    const p = page('customer');
    const layout = p.layout as { children: { readonly?: string; children: unknown[] }[] };
    layout.children[0].readonly = "state == 'blocked'";
    layout.children[0].children.push({ type: 'section', id: 'inner', children: [{ type: 'field', id: 'f-inner-notes', field: 'notes' }] });
    const form = createForm({ page: p });
    expect(form.node('f-email').readonly).toBe(false);
    expect(form.node('f-inner-notes').readonly).toBe(false);
    form.setValue('state', 'blocked');
    expect(form.node('f-email').readonly).toBe(true);
    expect(form.node('f-inner-notes').readonly).toBe(true);
    // Outside it, a field keeps its own rule.
    expect(form.node('f-notes').readonly).toBe(false);
  });

  it('treats the fields above and below the title like any field: conditions, and checks', () => {
    const p = page('customer');
    const layout = p.layout as SheetNode;
    layout.title = { ...layout.title!, above: [{ type: 'field', id: 't-company', field: 'is_company', invisible: "state == 'blocked'" }] };
    layout.title.below = [{ type: 'field', id: 't-website', field: 'website', required: true }];
    layout.badges = [{ id: 'b-blocked', label: 'Blocked', invisible: "state != 'blocked'" }];
    const form = createForm({ page: p });
    expect(form.node('t-company').invisible).toBe(false);
    expect(form.node('b-blocked').invisible).toBe(true);
    form.setValue('state', 'blocked');
    expect(form.node('t-company').invisible).toBe(true);
    expect(form.node('b-blocked').invisible).toBe(false);
    form.setValue('name', 'Delta');
    expect(form.validate()).toBe(false);
    expect(Object.keys(form.getState().errors)).toContain('website');
  });

  it('shows the ribbon and buttons that match the state', () => {
    const form = createForm({ page: page('customer') });
    expect(form.node('blocked-ribbon').invisible).toBe(true);
    expect(form.node('activate').invisible).toBe(false);
    form.setValue('state', 'blocked');
    expect(form.node('blocked-ribbon').invisible).toBe(false);
    expect(form.node('activate').invisible).toBe(true);
    expect(form.node('block').invisible).toBe(true);
  });

  it('reads a field marked readonly in its definition as readonly everywhere', () => {
    const form = createForm({ page: page('customer') });
    expect(form.fieldReadonly('sale_order_count')).toBe(true);
  });

  it('refuses a node id the page does not have', () => {
    expect(() => createForm({ page: page('customer') }).node('nope')).toThrow('The page has no element "nope"');
  });
});

describe('createForm — validation', () => {
  it('reports a missing required field by name', () => {
    const form = createForm({ page: page('customer') });
    expect(form.validate()).toBe(false);
    expect(form.getState().errors).toEqual({ name: 'Name is required' });
  });

  it('checks values against their fields', () => {
    const form = createForm({ page: page('customer') });
    form.setValue('name', 'Delta');
    form.setValue('email', 'not-an-email');
    expect(form.validate()).toBe(false);
    expect(form.getState().errors).toEqual({ email: 'Email is not in the expected format' });
  });

  it('clears a field error as soon as the field is fixed', () => {
    const form = createForm({ page: page('customer') });
    form.validate();
    form.setValue('name', 'Delta');
    expect(form.getState().errors).toEqual({});
  });

  it('does not ask for a required answer the person was never shown', () => {
    const form = createForm({ page: page('survey') });
    form.setValue('name', 'Sara');
    form.setValue('uses_product', 'yes');
    form.setValue('rating', 4);
    expect(form.validate()).toBe(true); // reason_not is required, but its step is skipped
  });

  it('checks the lines of a one2many', () => {
    const form = createForm({ page: page('customer') });
    form.setValue('name', 'Delta');
    form.setValue('is_company', true);
    const key = form.addLine('child_ids');
    expect(form.validate()).toBe(false);
    expect(form.getState().errors).toEqual({ [`child_ids.${key}.name`]: 'Name is required' });
  });

  it('asks a section or note line only for its text', () => {
    const order = page('order');
    const form = createForm({ page: order });
    form.setValue('name', 'S00119');
    form.setValue('partner_id', { id: 1, label: 'Nile Traders' });
    form.addLine('line_ids', { display_type: 'section', name: 'Workstations' });
    form.addLine('line_ids', { display_type: 'note' });
    const item = form.addLine('line_ids', { name: 'Black mesh back' });
    expect(form.validate()).toBe(false);
    expect(form.getState().errors).toEqual({ [`line_ids.${item}.product_id`]: 'Product is required' });

    // When the text itself is required, a section or note needs it too.
    const strict = page('order') as any;
    strict.fields.line_ids.fields.name.required = true;
    const second = createForm({ page: strict });
    second.setValue('name', 'S00120');
    second.setValue('partner_id', { id: 1, label: 'Nile Traders' });
    const note = second.addLine('line_ids', { display_type: 'note' });
    expect(second.validate()).toBe(false);
    expect(second.getState().errors).toEqual({ [`line_ids.${note}.name`]: 'Description is required' });
  });
});

describe('createForm — making a record from a name', () => {
  it('creates a record a link may point to, from what was typed', async () => {
    const dataSource = createMemoryDataSource({ records: { country: { 1: { name: 'Egypt' } } } });
    const form = createForm({ page: page('customer'), dataSource });
    expect(form.canCreate('country_id')).toBe(true);
    const made = await form.quickCreate('country_id', 'Oman');
    expect(made).toEqual({ id: 2, label: 'Oman' });
    expect(dataSource.records['country'][2]).toEqual({ name: 'Oman' });
    expect(await form.search('country_id', 'om')).toEqual([{ id: 2, label: 'Oman' }]);
  });

  it('cannot create when the data source does not make records, or the field is not a link', async () => {
    const form = createForm({ page: page('customer'), dataSource: { search: async () => [] } });
    expect(form.canCreate('country_id')).toBe(false);
    await expect(form.quickCreate('country_id', 'Oman')).rejects.toThrow('cannot make records');
    expect(createForm({ page: page('customer'), dataSource: createMemoryDataSource() }).canCreate('email')).toBe(false);
    const fixed = page('customer') as any;
    fixed.fields.country_id.readonly = true;
    expect(createForm({ page: fixed, dataSource: createMemoryDataSource() }).canCreate('country_id')).toBe(false);
  });

  it('creates for a link inside a line, through its own relation', async () => {
    const dataSource = createMemoryDataSource({ records: { product: { 1: { name: 'Chair' } } } });
    const form = createForm({ page: page('order'), dataSource });
    expect(form.canCreateLine('line_ids', 'product_id')).toBe(true);
    expect(await form.quickCreateLine('line_ids', 'product_id', 'Lamp')).toEqual({ id: 2, label: 'Lamp' });
    expect(dataSource.records['product'][2]).toEqual({ name: 'Lamp' });
  });
});

describe('createForm — the order of lines', () => {
  const orderSource = (sequences: (number | null)[] = [10, 20, 30, 40]) =>
    createMemoryDataSource({
      records: {
        'sale.order': {
          1: {
            name: 'S00118',
            line_ids: sequences.map((sequence, i) => ({ key: 'abcd'[i], id: i + 1, values: { sequence, name: 'ABCD'[i] } })),
          },
        },
      },
    });
  const order = (form: ReturnType<typeof createForm>) => (form.getState().values['line_ids'] as Line[]).map((l) => [l.key, l.values['sequence']]);

  it('moves a line, handing the lines that moved the numbers they already used', async () => {
    const form = createForm({ page: page('order'), dataSource: orderSource(), recordId: 1 });
    await form.load();
    form.moveLine('line_ids', 'c', 0);
    expect(order(form)).toEqual([['c', 10], ['a', 20], ['b', 30], ['d', 40]]);
    expect(form.changes().lines).toEqual({
      line_ids: [
        { op: 'update', id: 3, values: { sequence: 10 } },
        { op: 'update', id: 1, values: { sequence: 20 } },
        { op: 'update', id: 2, values: { sequence: 30 } },
      ],
    });
    expect(form.getState().dirty).toEqual(['line_ids']);
  });

  it('leaves the lines outside the move alone', async () => {
    const form = createForm({ page: page('order'), dataSource: orderSource(), recordId: 1 });
    await form.load();
    form.moveLine('line_ids', 'b', 2);
    expect(order(form)).toEqual([['a', 10], ['c', 20], ['b', 30], ['d', 40]]);
    expect(form.changes().lines['line_ids'].map((op) => (op.op === 'update' ? op.id : null))).toEqual([3, 2]);
  });

  it.each([
    ['had a line with no number', [null, 5, 6, 7]],
    ['shared a number', [5, 5, 6, 7]],
    ['were numbered out of their order', [10, 30, 20, 40]],
  ])('numbers every line afresh when the lines %s, so the saved order is the one shown', async (_, sequences) => {
    const form = createForm({ page: page('order'), dataSource: orderSource(sequences), recordId: 1 });
    await form.load();
    form.moveLine('line_ids', 'a', 3);
    expect(order(form)).toEqual([['b', 1], ['c', 2], ['d', 3], ['a', 4]]);
  });

  it('numbers a new line after the last one', async () => {
    const form = createForm({ page: page('order'), dataSource: orderSource(), recordId: 1 });
    await form.load();
    const key = form.addLine('line_ids', { name: 'E' });
    expect((form.getState().values['line_ids'] as Line[]).find((l) => l.key === key)?.values['sequence']).toBe(41);
  });

  it('refuses to move lines that keep no order of their own', () => {
    const form = createForm({ page: page('customer') });
    const key = form.addLine('child_ids', { name: 'Omar' });
    expect(() => form.moveLine('child_ids', key, 0)).toThrow('The lines of "child_ids" keep no order: give the field a sequenceField');
  });
});

describe('createForm — loading and saving a record', () => {
  it('loads a record through the data source', async () => {
    const form = createForm({ page: page('customer'), dataSource: customerSource(), recordId: 1 });
    expect(form.getState().status).toBe('idle');
    const loading = form.load();
    expect(form.getState().status).toBe('loading');
    await loading;
    expect(form.getState().status).toBe('ready');
    expect(form.getState().values['name']).toBe('Nile Traders');
    expect(form.getState().dirty).toEqual([]);
  });

  it('settled() waits for a load someone else started', async () => {
    const form = createForm({ page: page('customer'), dataSource: customerSource(), recordId: 1 });
    void form.load();
    await form.settled();
    expect(form.getState().values['name']).toBe('Nile Traders');
  });

  it('reports a load that fails, in words', async () => {
    const form = createForm({ page: page('customer'), dataSource: customerSource(), recordId: 99 });
    await form.load();
    expect(form.getState().status).toBe('error');
    expect(form.getState().error).toBe('No partner record with id 99');
  });

  it('sends only what changed, with Odoo-style line and link operations', async () => {
    const ds = customerSource();
    const form = createForm({ page: page('customer'), dataSource: ds, recordId: 1 });
    await form.load();
    form.setValue('website', 'https://nile.example');
    const added = form.addLine('child_ids', { name: 'Omar' });
    form.updateLine('child_ids', 'c1', 'function', 'Head buyer');
    form.setValue('tag_ids', [{ id: 11, label: 'Wholesale' }]);
    expect(form.changes()).toEqual({
      values: { website: 'https://nile.example' },
      lines: {
        child_ids: [
          { op: 'update', id: 2, values: { function: 'Head buyer' } },
          { op: 'create', key: added, values: { name: 'Omar', function: null, email: null, phone: null } },
        ],
      },
      links: { tag_ids: [{ op: 'link', id: 11 }, { op: 'unlink', id: 10 }] },
    });
    expect(await form.save()).toBe(true);
    expect(form.getState().status).toBe('saved');
    expect(form.getState().dirty).toEqual([]);
    expect(ds.records['partner'][1]['website']).toBe('https://nile.example');
    expect(ds.records['partner'][1]['tag_ids']).toEqual([{ id: 11, label: 'Wholesale' }]);
  });

  describe('previewLine', () => {
    const orderSource = (withOnchange: boolean) =>
      createMemoryDataSource({
        records: { 'sale.order': { 1: { name: 'S00118', line_ids: [{ key: 'l1', id: 101, values: { name: 'Office chair', qty: 2, price: 100, subtotal: 200 } }] } } },
        ...(withOnchange
          ? {
              onchange: {
                'sale.order': {
                  line_ids: (values) => ({
                    line_ids: (values['line_ids'] as Line[]).map((l) => ({ ...l, values: { ...l.values, subtotal: Number(l.values['qty']) * Number(l.values['price']) } })),
                    amount_total: 0,
                  }),
                },
              },
            }
          : {}),
      });

    it('shows what a line would become after the onchange, and writes nothing', async () => {
      const ds = orderSource(true);
      const form = createForm({ page: page('order'), dataSource: ds, recordId: 1 });
      await form.load();
      const before = form.getState();
      expect(await form.previewLine('line_ids', 'l1', { qty: 5 })).toEqual({ name: 'Office chair', qty: 5, price: 100, subtotal: 500 });
      expect(form.getState().values).toEqual(before.values);
      expect(form.getState().dirty).toEqual([]);
      expect(ds.calls.filter((c) => c.method === 'onchange')).toHaveLength(1);
    });

    it('hands the values back merged when nothing recalculates', async () => {
      const form = createForm({ page: page('order'), dataSource: orderSource(false), recordId: 1 });
      await form.load();
      expect(await form.previewLine('line_ids', 'l1', { qty: 5 })).toEqual({ name: 'Office chair', qty: 5, price: 100, subtotal: 200 });
    });

    it('says which line it could not find', async () => {
      const form = createForm({ page: page('order'), dataSource: orderSource(true), recordId: 1 });
      await form.load();
      await expect(form.previewLine('line_ids', 'nope', {})).rejects.toThrow('"line_ids" has no line "nope"');
    });
  });

  it('deletes a saved line with a delete operation', async () => {
    const form = createForm({ page: page('customer'), dataSource: customerSource(), recordId: 1 });
    await form.load();
    form.removeLine('child_ids', 'c1');
    expect(form.changes().lines).toEqual({ child_ids: [{ op: 'delete', id: 2 }] });
  });

  it('a new record sends every value it holds, those it started with and defaults too', async () => {
    const ds = customerSource();
    const form = createForm({ page: page('customer'), dataSource: ds, values: { name: 'Hilton Cairo' } });
    expect(await form.save()).toBe(true);
    const id = form.getState().recordId as number;
    expect(ds.records['partner'][id]).toEqual(expect.objectContaining({ name: 'Hilton Cairo', state: 'draft' }));
  });

  it('creates a new record and keeps its new id', async () => {
    const ds = customerSource();
    const form = createForm({ page: page('customer'), dataSource: ds });
    form.setValue('name', 'Delta Co');
    expect(await form.save()).toBe(true);
    expect(form.getState().recordId).toBe(2);
    expect(ds.records['partner'][2]['name']).toBe('Delta Co');
  });

  it('does not save an invalid record, and does not call the source', async () => {
    const ds = customerSource();
    const form = createForm({ page: page('customer'), dataSource: ds });
    expect(await form.save()).toBe(false);
    expect(ds.calls.filter((c) => c.method === 'save')).toEqual([]);
    expect(form.getState().errors['name']).toBe('Name is required');
  });
});

describe('createForm — onchange', () => {
  it('applies what the source recalculates', async () => {
    const form = createForm({ page: page('customer'), dataSource: customerSource(), recordId: 1 });
    await form.load();
    form.setValue('country_id', { id: 2, label: 'Jordan' });
    await form.settled();
    expect(form.getState().values['currency_id']).toEqual({ id: 2, label: 'JOD' });
    expect(form.getState().dirty).toEqual(expect.arrayContaining(['country_id', 'currency_id']));
  });

  it('keeps a warning with the field that changed, until an answer without one', async () => {
    const dataSource: DataSource = {
      onchange: async ({ changed, values }) =>
        changed === 'credit_limit' && Number(values['credit_limit']) > 100000 ? { warning: 'Above the approval limit' } : {},
    };
    const form = createForm({ page: page('customer'), dataSource });
    form.setValue('credit_limit', 250000);
    await form.settled();
    expect(form.getState()).toMatchObject({ warning: 'Above the approval limit', warningField: 'credit_limit' });
    form.setValue('credit_limit', 5000);
    await form.settled();
    expect(form.getState()).toMatchObject({ warning: null, warningField: null });
  });

  it('ignores an answer that arrives after a newer change', async () => {
    // The first request is answered last, the way a slow network reorders them.
    const answers: Array<(website: string) => void> = [];
    const dataSource: DataSource = {
      onchange: () => new Promise((resolve) => answers.push((website) => resolve({ values: { website } }))),
    };
    const form = createForm({ page: page('customer'), dataSource });
    form.setValue('name', 'First');
    form.setValue('name', 'Second');
    answers[1]('https://second.example');
    answers[0]('https://first.example');
    await form.settled();
    expect(form.getState().values['website']).toBe('https://second.example');
  });
});

describe('createForm — relations', () => {
  it('searches a relation through the source, with its filter filled in', async () => {
    const ds = customerSource();
    const form = createForm({ page: page('customer'), dataSource: ds });
    form.setValue('country_id', { id: 2, label: 'Jordan' });
    expect(await form.search('state_id', '')).toEqual([{ id: 2, label: 'Amman' }]);
    expect(ds.calls.find((c) => c.method === 'search')?.request).toEqual({
      model: 'country.region',
      query: '',
      filter: [{ field: 'country_id', op: '=', value: 2 }],
      limit: 8,
    });
  });
});

describe('createForm — a survey', () => {
  it('walks only the steps that apply, as answers change', () => {
    const form = createForm({ page: page('survey') });
    expect(form.steps()).toEqual(['step-about', 'step-usage', 'step-last']);
    form.setValue('uses_product', 'yes');
    expect(form.steps()).toEqual(['step-about', 'step-usage', 'step-experience', 'step-last']);
    form.setValue('uses_product', 'no');
    expect(form.steps()).toEqual(['step-about', 'step-usage', 'step-reason', 'step-last']);
  });

  it('checks a step before moving on, and only that step', () => {
    const form = createForm({ page: page('survey') });
    expect(form.getState().step).toBe('step-about');
    expect(form.next()).toBe(false);
    expect(form.getState().errors).toEqual({ name: 'Your name is required' });
    form.setValue('name', 'Sara');
    expect(form.next()).toBe(true);
    expect(form.getState().step).toBe('step-usage');
    expect(form.back()).toBe(true);
    expect(form.getState().step).toBe('step-about');
  });

  it('submits only the answers to the questions that were shown', async () => {
    const ds = createMemoryDataSource();
    const form = createForm({ page: page('survey'), dataSource: ds });
    form.setValue('name', 'Sara');
    form.setValue('uses_product', 'yes');
    form.setValue('rating', 5);
    form.setValue('uses_product', 'no'); // changed their mind: the rating step is gone
    form.setValue('reason_not', 'Too expensive');
    expect(await form.save()).toBe(true);
    expect(ds.responses).toEqual([
      {
        pageId: 'product-feedback',
        values: { name: 'Sara', email: null, uses_product: 'no', reason_not: 'Too expensive', contact_ok: false },
      },
    ]);
    expect(form.getState().status).toBe('saved');
  });
});

describe('createForm — a link’s filter with groups', () => {
  it('sends groups to the search with every valueFrom in them resolved, and the memory source keeps the OR', async () => {
    const p = page('customer');
    p.fields['state_id'] = {
      type: 'many2one',
      label: 'Region',
      relation: 'country.region',
      filter: [{ any: [{ field: 'country_id', op: '=', valueFrom: 'country_id' }, { field: 'name', op: 'startswith', value: 'Ri' }] }],
    };
    const ds = createMemoryDataSource({
      records: {
        'country.region': {
          1: { name: 'Cairo', country_id: { id: 1, label: 'Egypt' } },
          2: { name: 'Amman', country_id: { id: 2, label: 'Jordan' } },
          3: { name: 'Riyadh', country_id: { id: 3, label: 'Saudi Arabia' } },
        },
      },
    });
    const form = createForm({ page: p, dataSource: ds });
    form.setValue('country_id', { id: 1, label: 'Egypt' });
    expect((await form.search('state_id', '')).map((r) => r.label)).toEqual(['Cairo', 'Riyadh']);
    const sent = ds.calls.filter((c) => c.method === 'search').at(-1)?.request as { filter: unknown };
    expect(sent.filter).toEqual([{ any: [{ field: 'country_id', op: '=', value: 1 }, { field: 'name', op: 'startswith', value: 'Ri' }] }]);
  });
});

describe('createForm — a save the server refuses', () => {
  /** The customer record, saved through a source whose save fails the way it is told. */
  function refusing(failure: () => unknown) {
    const ds = customerSource();
    let fail = true;
    const source: DataSource = {
      ...ds,
      load: (r) => ds.load!(r),
      save: async (r) => {
        if (fail) throw failure();
        return ds.save!(r);
      },
    };
    const form = createForm({ page: page('customer'), dataSource: source, recordId: 1 });
    return { form, succeed: () => (fail = false) };
  }

  it('shows a save’s field errors on those fields, each until that field changes', async () => {
    const { form } = refusing(() =>
      saveRefused({ kind: 'fields', message: 'Two fields need a look', fields: { email: 'This email is taken', phone: 'Use an international number' } })
    );
    await form.load();
    form.setValue('website', 'https://nile.example');
    expect(await form.save()).toBe(false);
    expect(form.getState().status).toBe('error');
    expect(form.getState().saveProblem).toEqual({ kind: 'fields', message: 'Two fields need a look', fields: { email: 'This email is taken', phone: 'Use an international number' } });
    expect(form.getState().errors).toEqual({ email: 'This email is taken', phone: 'Use an international number' });
    form.setValue('website', 'https://nile.example/en');
    expect(form.getState().errors).toEqual({ email: 'This email is taken', phone: 'Use an international number' });
    form.setValue('email', 'sales@nile.example');
    expect(form.getState().errors).toEqual({ phone: 'Use an international number' });
  });

  it('keeps a business rule for a dialog, and nothing under the fields', async () => {
    const { form } = refusing(() => saveRefused({ kind: 'rule', message: 'A blocked customer cannot be given credit.' }));
    await form.load();
    form.setValue('credit_limit', 5000);
    expect(await form.save()).toBe(false);
    expect(form.getState().saveProblem).toEqual({ kind: 'rule', message: 'A blocked customer cannot be given credit.' });
    expect(form.getState().errors).toEqual({});
  });

  it('tells a network failure from the rest, a failed fetch included', async () => {
    const { form } = refusing(() => new TypeError('Failed to fetch'));
    await form.load();
    form.setValue('website', 'https://nile.example');
    expect(await form.save()).toBe(false);
    expect(form.getState().saveProblem?.kind).toBe('network');
    const other = refusing(() => new Error('The server said no'));
    await other.form.load();
    other.form.setValue('website', 'https://nile.example');
    await other.form.save();
    expect(other.form.getState().saveProblem).toEqual({ kind: 'other', message: 'The server said no' });
  });

  it('forgets the problem once a save goes through, and a server’s field error with it', async () => {
    const { form, succeed } = refusing(() => saveRefused({ kind: 'fields', message: 'Check the email', fields: { email: 'This email is taken' } }));
    await form.load();
    form.setValue('website', 'https://nile.example');
    await form.save();
    succeed();
    expect(await form.save()).toBe(true);
    expect(form.getState().saveProblem).toBeNull();
    expect(form.getState().errors).toEqual({});
  });
});

describe('createForm — a field’s problem, asked quietly', () => {
  it('says what a field would be told if checked now, and shows nothing', () => {
    const form = createForm({ page: page('signup') });
    expect(form.problem('full_name')).toBe('Full name is required');
    form.setValue('email', 'sara@');
    expect(form.problem('email')).not.toBeNull();
    form.setValue('email', 'sara@example.com');
    form.setValue('full_name', 'Sara Hassan');
    expect(form.problem('full_name')).toBeNull();
    expect(form.problem('email')).toBeNull();
    expect(form.problem('hourly_rate')).toBeNull(); // empty and optional
    form.setValue('hourly_rate', -5);
    expect(form.problem('hourly_rate')).not.toBeNull();
    expect(form.getState().errors).toEqual({});
  });

  it('asks nothing of a field no one can see', () => {
    const form = createForm({ page: page('signup') });
    // "Which role?" is hidden until the role is Other, the team size until it is Manager.
    expect(form.problem('other_role')).toBeNull();
    form.setValue('team_size', 900);
    expect(form.problem('team_size')).toBeNull();
    form.setValue('role', 'manager');
    expect(form.problem('team_size')).not.toBeNull();
  });
});

describe('createForm — skipping and jumping between steps', () => {
  /** The survey, with "Using the product" (which has a required question) made optional. */
  const optionalUsage = () => {
    const p = page('survey');
    (p.layout as { children: { optional?: boolean }[] }).children[1].optional = true;
    return p;
  };

  it('skips an optional step without asking for its required answers, and leaves its answers out', async () => {
    const ds = createMemoryDataSource();
    const form = createForm({ page: optionalUsage(), dataSource: ds });
    form.setValue('name', 'Sara');
    expect(form.next()).toBe(true);
    form.setValue('uses_product', 'yes'); // answered, then skipped after all
    form.setValue('uses_product', null);
    expect(form.skip()).toBe(true);
    expect(form.getState().step).toBe('step-last');
    expect(form.getState().skipped).toEqual(['step-usage']);
    expect(await form.save()).toBe(true);
    expect(ds.responses[0].values).toEqual({ name: 'Sara', email: null, contact_ok: false });
  });

  it('skips nothing that is not optional, nor the last step', () => {
    const form = createForm({ page: optionalUsage() });
    expect(form.skip()).toBe(false);
    expect(form.getState().step).toBe('step-about');
    const p = page('survey');
    (p.layout as { children: { optional?: boolean }[] }).children[4].optional = true;
    const last = createForm({ page: p });
    last.setValue('name', 'Sara');
    last.setValue('uses_product', 'no');
    last.setValue('reason_not', 'Too expensive');
    expect(last.goTo('step-last')).toBe(true);
    expect(last.skip()).toBe(false);
  });

  it('asks for a skipped step’s answers again once someone goes back to it and on', () => {
    const form = createForm({ page: optionalUsage() });
    form.setValue('name', 'Sara');
    form.next();
    form.skip();
    expect(form.back()).toBe(true);
    expect(form.getState().step).toBe('step-usage');
    expect(form.next()).toBe(false);
    expect(Object.keys(form.getState().errors)).toEqual(['uses_product']);
    expect(form.getState().skipped).toEqual([]);
  });

  it('goes back to any step at once, and forward only past steps that are complete', () => {
    const form = createForm({ page: page('survey') });
    expect(form.goTo('step-last')).toBe(false);
    expect(form.getState().step).toBe('step-about');
    expect(form.getState().errors).toEqual({ name: 'Your name is required' });
    form.setValue('name', 'Sara');
    expect(form.goTo('step-last')).toBe(false);
    expect(form.getState().step).toBe('step-usage');
    expect(Object.keys(form.getState().errors)).toEqual(['uses_product']);
    form.setValue('uses_product', 'no');
    form.setValue('reason_not', 'Too expensive');
    expect(form.goTo('step-last')).toBe(true);
    expect(form.getState().step).toBe('step-last');
    expect(form.goTo('step-about')).toBe(true);
    expect(form.getState().step).toBe('step-about');
    expect(form.getState().errors).toEqual({});
    // A step that does not apply now cannot be gone to.
    expect(form.goTo('step-experience')).toBe(false);
    expect(form.getState().step).toBe('step-about');
  });

  it('jumps past an optional step it cannot complete by skipping it', () => {
    const form = createForm({ page: optionalUsage() });
    form.setValue('name', 'Sara');
    expect(form.goTo('step-last')).toBe(true);
    expect(form.getState().skipped).toEqual(['step-usage']);
  });
});

describe('createForm — actions', () => {
  it('passes a button press to the app, with the record', async () => {
    const pressed: unknown[] = [];
    const form = createForm({ page: page('customer'), onAction: (request) => void pressed.push(request) });
    form.setValue('name', 'Delta');
    await form.runAction('activate');
    expect(pressed).toEqual([
      expect.objectContaining({ id: 'activate', action: 'activate', recordId: null, values: expect.objectContaining({ name: 'Delta' }) }),
    ]);
  });

  it('runs stat buttons too, and ignores a hidden button', async () => {
    const pressed: string[] = [];
    const form = createForm({ page: page('customer'), onAction: (request) => void pressed.push(request.action) });
    await form.runAction('sales');
    form.setValue('state', 'blocked');
    await form.runAction('activate');
    expect(pressed).toEqual(['open_sales']);
  });

  it('hands a list’s button the records chosen in it, and only then', async () => {
    const pressed: ActionRequest[] = [];
    const form = createForm({ page: page('customer'), onAction: (request) => void pressed.push(request) });
    await form.runAction('activate', { recordIds: [4, 'b7'] });
    await form.runAction('activate');
    expect(pressed[0].recordIds).toEqual([4, 'b7']);
    expect('recordIds' in pressed[1]).toBe(false);
  });
});

describe('createForm — drafts', () => {
  it('keeps a draft while someone types, and offers it back next time', () => {
    const clock = manualClock();
    const store = memoryStore();
    const first = createForm({ page: page('survey'), drafts: { store, delayMs: 300 }, scheduler: clock });
    first.setValue('name', 'Sara');
    expect(store.items.size).toBe(0);
    clock.advance(300);
    expect(store.items.size).toBe(1);

    const second = createForm({ page: page('survey'), drafts: { store }, scheduler: clock });
    expect(second.getState().draft).toEqual({ savedAt: expect.any(String) });
    expect(second.getState().values['name']).toBeNull();
    second.restoreDraft();
    expect(second.getState().values['name']).toBe('Sara');
    expect(second.getState().draft).toBeNull();
  });

  it('can restore a draft without asking, and forgets it once submitted', async () => {
    const clock = manualClock();
    const store = memoryStore();
    const first = createForm({ page: page('survey'), drafts: { store, delayMs: 0 }, scheduler: clock });
    first.setValue('name', 'Sara');
    clock.advance(0);

    const ds = createMemoryDataSource();
    const second = createForm({ page: page('survey'), dataSource: ds, drafts: { store, restore: 'auto' }, scheduler: clock });
    expect(second.getState().values['name']).toBe('Sara');
    second.setValue('uses_product', 'no');
    second.setValue('reason_not', 'Price');
    await second.save();
    expect(store.items.size).toBe(0);
  });
});

describe('createForm — autosave', () => {
  it('saves once after the typing stops', async () => {
    const clock = manualClock();
    const ds = customerSource();
    const form = createForm({ page: page('customer'), dataSource: ds, recordId: 1, autosave: { delayMs: 800 }, scheduler: clock });
    await form.load();
    form.setValue('website', 'https://a.example');
    clock.advance(500);
    form.setValue('website', 'https://ab.example');
    clock.advance(500);
    expect(ds.calls.filter((c) => c.method === 'save')).toHaveLength(0);
    clock.advance(300);
    await form.settled();
    expect(ds.calls.filter((c) => c.method === 'save')).toHaveLength(1);
    expect(ds.records['partner'][1]['website']).toBe('https://ab.example');
  });

  it('waits rather than autosaving an invalid record', async () => {
    const clock = manualClock();
    const ds = customerSource();
    const form = createForm({ page: page('customer'), dataSource: ds, recordId: 1, autosave: { delayMs: 100 }, scheduler: clock });
    await form.load();
    form.setValue('name', '');
    clock.advance(100);
    await form.settled();
    expect(ds.calls.filter((c) => c.method === 'save')).toHaveLength(0);
    expect(form.getState().errors).toEqual({});
  });
});

describe('createForm — messages in the page language', () => {
  it('reports errors with the messages it is given', async () => {
    const { MESSAGES } = await import('./messages');
    const form = createForm({ page: page('survey'), messages: MESSAGES.fr });
    form.next();
    expect(form.getState().errors).toEqual({ name: 'Your name est obligatoire' });
  });
});

describe('createForm — searching references and lines', () => {
  const orderPage = {
    fieldia: '0.1',
    id: 'order',
    data: { kind: 'record', model: 'order' },
    fields: {
      origin: { type: 'reference', label: 'Origin', models: [{ value: 'lead', label: 'Lead' }, { value: 'ticket', label: 'Ticket' }] },
      line_ids: {
        type: 'one2many',
        label: 'Lines',
        relation: 'order.line',
        fields: {
          category: { type: 'selection', label: 'Category', options: [{ value: 'tea', label: 'Tea' }, { value: 'coffee', label: 'Coffee' }] },
          product_id: { type: 'many2one', label: 'Product', relation: 'product', filter: [{ field: 'category', op: '=', valueFrom: 'category' }] },
        },
      },
    },
    layout: { type: 'sections', id: 'root', children: [{ type: 'field', id: 'f-origin', field: 'origin' }, { type: 'field', id: 'f-lines', field: 'line_ids' }] },
  } as unknown as Page;

  const source = () =>
    createMemoryDataSource({
      records: {
        lead: { 1: { name: 'Hotel fit-out' } },
        ticket: { 7: { name: 'Broken kettle' } },
        product: { 1: { name: 'Green tea', category: 'tea' }, 2: { name: 'Espresso', category: 'coffee' } },
      },
    });

  it('searches a reference in the model the person picked', async () => {
    const form = createForm({ page: orderPage, dataSource: source() });
    expect(await form.search('origin', '', 8, { model: 'ticket' })).toEqual([{ id: 7, label: 'Broken kettle' }]);
    await expect(form.search('origin', '')).rejects.toThrow('Searching "origin" needs a model');
  });

  it('searches a relation inside a line, filtered by that line', async () => {
    const form = createForm({ page: orderPage, dataSource: source() });
    const key = form.addLine('line_ids', { category: 'coffee' });
    expect(await form.searchLine('line_ids', key, 'product_id', '')).toEqual([{ id: 2, label: 'Espresso' }]);
  });
});
