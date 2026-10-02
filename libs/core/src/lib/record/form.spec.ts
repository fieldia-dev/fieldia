import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Page } from '../format/page';
import { createForm, type DraftStore } from './form';
import { createMemoryDataSource } from './memory-data-source';
import type { DataSource } from './data-source';
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

  it('deletes a saved line with a delete operation', async () => {
    const form = createForm({ page: page('customer'), dataSource: customerSource(), recordId: 1 });
    await form.load();
    form.removeLine('child_ids', 'c1');
    expect(form.changes().lines).toEqual({ child_ids: [{ op: 'delete', id: 2 }] });
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
