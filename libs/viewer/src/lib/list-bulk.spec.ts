import { createMemoryDataSource, type MemoryDataSource, type Page, type SaveRequest, type WriteManyRequest } from '@fieldia/core';
import { until } from './test-list';
import { mountViewer, type ViewerHandle, type ViewerOptions } from './viewer';

/**
 * Edit, for the rows ticked (or every record that matches): a field and a
 * value asked in a dialog of the field's own box and rules, the question
 * "Update 2 records?", then each record written — by `writeMany`, or by
 * `save` per record with the version it was listed at — and what was not
 * changed named with why, the rest kept done. A record the list knows the
 * person may not change is never sent. Offered only where the page asks.
 */

const contacts: Page = {
  fieldia: '0.4',
  id: 'contacts',
  title: 'Contacts',
  data: { kind: 'record', model: 'contact' },
  fields: {
    name: { type: 'char', label: 'Name', required: true },
    state: { type: 'selection', label: 'Status', required: true, options: [{ value: 'lead', label: 'Lead' }, { value: 'customer', label: 'Customer' }, { value: 'blocked', label: 'Blocked' }] },
    owner_id: { type: 'many2one', label: 'Owner', relation: 'res.users' },
    orders: { type: 'integer', label: 'Orders', readonly: true },
    credit: { type: 'monetary', label: 'Credit limit', currencyField: 'currency_id', min: 0 },
    currency_id: { type: 'many2one', label: 'Currency', relation: 'currency' },
  },
  layout: { type: 'list', id: 'list', columns: ['name', 'state', 'owner_id', 'orders', 'credit'], sort: [{ field: 'name' }], pageSize: 3, bulkEdit: true },
};
const records = () => ({
  contact: {
    1: { name: 'Nile Traders', state: 'customer', owner_id: { id: 7, label: 'Mona Adel' }, orders: 18, credit: 250000, currency_id: { id: 1, label: 'EGP' } },
    2: { name: 'Amira Clinics', state: 'lead', owner_id: null, orders: 0, credit: 50000, currency_id: { id: 1, label: 'EGP' } },
    3: { name: 'Petra Tours', state: 'lead', owner_id: { id: 8, label: 'Omar Said' }, orders: 4, credit: 80000, currency_id: { id: 2, label: 'JOD' } },
    4: { name: 'Zamalek Studio', state: 'blocked', owner_id: null, orders: 2, credit: null, currency_id: null },
  },
  'res.users': { 7: { name: 'Mona Adel' }, 8: { name: 'Omar Said' } },
});

let handle: ViewerHandle | null = null;
afterEach(() => {
  handle?.destroy();
  handle = null;
  document.body.replaceChildren();
});

async function mount(options: Partial<ViewerOptions> = {}, page: Page = contacts) {
  const host = document.createElement('div');
  document.body.append(host);
  handle = mountViewer(host, { page, dataSource: createMemoryDataSource({ records: records() }), confirm: async () => true, ...options });
  await until(() => host.querySelector('.fd-list-table tbody tr'));
  return host;
}
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
const rows = (host: Element) => [...host.querySelectorAll('.fd-list-table tbody tr.fd-list-row')] as HTMLTableRowElement[];
const tick = (host: Element, ...names: string[]) => {
  for (const row of rows(host)) if (names.includes(row.querySelectorAll('td')[1].textContent ?? '')) (row.querySelector('.fd-list-checkbox') as HTMLInputElement).click();
};
const edit = (host: Element) => host.querySelector('.fd-list-edit') as HTMLButtonElement;
const dialog = () => document.querySelector('.fd-form-dialog') as HTMLElement | null;
const footButton = (name: string) => [...(dialog() as HTMLElement).querySelectorAll<HTMLButtonElement>('.fd-form-dialog-foot button')].find((b) => b.textContent === name) as HTMLButtonElement;
const shown = (id: string) => {
  const part = dialog()?.querySelector(`[data-node="${id}"]`);
  return !!part && !part.closest('[hidden]');
};
/** A choice picked in a box by its words, as a person picks it. */
const choose = (id: string, words: string) => {
  const select = dialog()?.querySelector(`[data-node="${id}"] select`) as HTMLSelectElement;
  select.value = ([...select.options].find((option) => option.textContent === words) as HTMLOptionElement).value;
  select.dispatchEvent(new Event('change', { bubbles: true }));
};
const LABELS: Record<string, string> = { name: 'Name', state: 'Status', owner_id: 'Owner', credit: 'Credit limit' };
const WORDS: Record<string, string> = { lead: 'Lead', customer: 'Customer', blocked: 'Blocked' };
const stateOf = (source: MemoryDataSource, id: number) => source.records['contact'][String(id)]['state'];

/** Edit pressed, the field and value chosen, Update pressed: the dialog gone. */
async function setOnChosen(host: Element, field: string, value: string) {
  edit(host).click();
  await until(() => dialog());
  choose('bulk-pick', LABELS[field]);
  choose(`bulk-${field}`, WORDS[value]);
  footButton('Update').click();
  await until(() => !dialog());
}

describe('Edit, for many records at once', () => {
  it('asks the field and its value in its own box, then the question, then writes it in each record chosen', async () => {
    const source = createMemoryDataSource({ records: records() });
    const asked: string[] = [];
    const said: string[] = [];
    const host = await mount({ dataSource: source, confirm: async (message) => (asked.push(message), true), host: { say: (message) => void said.push(message) } });
    expect(edit(host).hidden).toBe(true);
    tick(host, 'Amira Clinics', 'Petra Tours');
    expect(edit(host).hidden).toBe(false);
    edit(host).click();
    await until(() => dialog());
    expect(dialog()?.querySelector('.fd-form-dialog-title')?.textContent).toBe('Edit 2 records');
    // The fields one value can set: not the read-only count of orders, nor the currency no column shows.
    const picker = dialog()?.querySelector('[data-node="bulk-pick"] select') as HTMLSelectElement;
    expect([...picker.options].filter((option) => option.value).map((option) => option.textContent)).toEqual(['Name', 'Status', 'Owner', 'Credit limit']);
    expect(['bulk-name', 'bulk-state', 'bulk-owner_id', 'bulk-credit'].map(shown)).toEqual([false, false, false, false]);
    choose('bulk-pick', 'Status');
    expect(['bulk-name', 'bulk-state', 'bulk-owner_id', 'bulk-credit'].map(shown)).toEqual([false, true, false, false]);
    choose('bulk-state', 'Customer');
    expect([...(dialog() as HTMLElement).querySelectorAll('.fd-form-dialog-foot button')].map((b) => b.textContent)).toEqual(['Cancel', 'Update']);
    footButton('Update').click();
    await until(() => said.length > 0);
    expect(asked).toEqual(['Update 2 records? Status becomes “Customer”.']);
    expect(said).toEqual(['2 records updated.']);
    expect([1, 2, 3, 4].map((id) => stateOf(source, id))).toEqual(['customer', 'customer', 'customer', 'blocked']);
    // One call for them all, the field alone.
    const written = source.calls.filter((call) => call.method === 'writeMany').map((call) => call.request as WriteManyRequest);
    expect(written).toEqual([{ model: 'contact', ids: [2, 3], values: { state: 'customer' }, fields: { state: contacts.fields['state'] } }]);
    // Done: nothing chosen, the rows as they are now.
    await until(() => host.querySelector('.fd-list-selection')?.hasAttribute('hidden'));
    await until(() => rows(host).every((row) => row.querySelectorAll('td')[2].textContent === 'Customer'));
  });

  it('keeps to the field’s rules: a required field is never emptied, a least is kept', async () => {
    const host = await mount();
    tick(host, 'Amira Clinics');
    edit(host).click();
    await until(() => dialog());
    expect(dialog()?.querySelector('.fd-form-dialog-title')?.textContent).toBe('Edit 1 record');
    choose('bulk-pick', 'Status');
    footButton('Update').click();
    await settle();
    expect(dialog()).not.toBeNull();
    expect(dialog()?.querySelector('[data-node="bulk-state"]')?.textContent).toContain('required');
    choose('bulk-pick', 'Credit limit');
    const amount = dialog()?.querySelector('[data-node="bulk-credit"] input') as HTMLInputElement;
    amount.value = '-5';
    amount.dispatchEvent(new Event('input', { bubbles: true }));
    amount.dispatchEvent(new Event('change', { bubbles: true }));
    amount.dispatchEvent(new FocusEvent('blur'));
    footButton('Update').click();
    await settle();
    expect(dialog()).not.toBeNull();
    footButton('Cancel').click();
    await until(() => !dialog());
  });

  it('says how far it has got while it writes, and is busy meanwhile', async () => {
    const source = createMemoryDataSource({ records: records(), delayMs: 40 });
    const host = await mount({ dataSource: source });
    tick(host, 'Amira Clinics', 'Petra Tours');
    edit(host).click();
    await until(() => dialog());
    choose('bulk-pick', 'Status');
    choose('bulk-state', 'Customer');
    // Not busy while the person is asked.
    expect(edit(host).hasAttribute('aria-busy')).toBe(false);
    footButton('Update').click();
    await until(() => host.querySelector('.fd-list-progress')?.textContent === 'Updating 0 of 2…');
    expect(edit(host).getAttribute('aria-busy')).toBe('true');
    await until(() => host.querySelector('.fd-list-progress')?.textContent === '' && !edit(host).hasAttribute('aria-busy'));
    expect(stateOf(source, 3)).toBe('customer');
  });

  it('asks before it writes, and writes nothing on No', async () => {
    const source = createMemoryDataSource({ records: records() });
    const host = await mount({ dataSource: source, confirm: async () => false });
    tick(host, 'Amira Clinics');
    await setOnChosen(host, 'state', 'blocked');
    await settle();
    expect(stateOf(source, 2)).toBe('lead');
    expect(source.calls.some((call) => call.method === 'writeMany')).toBe(false);
  });

  it('says, record by record, what was not changed and why, keeps the rest done, and keeps those chosen', async () => {
    const source = createMemoryDataSource({
      records: records(),
      // Mona's contacts are hers to change; a blocked one's status is the credit team's.
      can: { contact: (values) => ({ ...((values['owner_id'] as { id: number } | null)?.id === 7 ? { edit: false, reason: 'Only Mona Adel can change her contacts.' } : {}), ...(values['state'] === 'blocked' ? { readonlyFields: ['state'] } : {}) }) },
    });
    const host = await mount({ dataSource: source });
    tick(host, 'Amira Clinics', 'Nile Traders', 'Petra Tours');
    await setOnChosen(host, 'state', 'customer');
    const report = host.querySelector('.fd-list-report') as HTMLElement;
    await until(() => !report.hidden);
    expect(report.getAttribute('role')).toBe('alert');
    expect(report.querySelector('.fd-list-report-words')?.textContent).toBe('2 of 3 updated. Not changed:');
    expect([...report.querySelectorAll('li')].map((li) => li.textContent)).toEqual(['Nile Traders: Only Mona Adel can change her contacts.']);
    // What the list knew she may not change was never sent.
    expect((source.calls.find((call) => call.method === 'writeMany')?.request as WriteManyRequest).ids).toEqual([2, 3]);
    expect([1, 2, 3].map((id) => stateOf(source, id))).toEqual(['customer', 'customer', 'customer']);
    await until(() => host.querySelector('.fd-list-count')?.textContent === '1 selected');
    // What the source refuses is said in its words: a blocked contact's status.
    [...report.querySelectorAll('button')].find((button) => button.textContent === 'Dismiss')?.click();
    expect(report.hidden).toBe(true);
    host.querySelector<HTMLButtonElement>('.fd-list-selection .fd-button-link:last-child')?.click();
    host.querySelector<HTMLButtonElement>('[aria-label="Next page"]')?.click();
    await until(() => rows(host)[0]?.textContent?.includes('Zamalek'));
    tick(host, 'Zamalek Studio');
    await setOnChosen(host, 'state', 'lead');
    await until(() => !report.hidden);
    expect([...report.querySelectorAll('li')].map((li) => li.textContent)).toEqual(['Zamalek Studio: You can see this field, but not change it.']);
  });

  it('hides Edit when the list knows none of those chosen may be changed', async () => {
    const source = createMemoryDataSource({ records: records(), can: { contact: () => ({ edit: false }) } });
    const host = await mount({ dataSource: source });
    tick(host, 'Amira Clinics');
    expect(host.querySelector('.fd-list-selection')?.hasAttribute('hidden')).toBe(false);
    expect(edit(host).hidden).toBe(true);
  });

  it('saves each record in turn where the source has no writeMany, each with the version it was listed at', async () => {
    const source = createMemoryDataSource({ records: records(), versions: { by: 'Sara' } });
    delete (source as Partial<MemoryDataSource>).writeMany;
    const host = await mount({ dataSource: source });
    tick(host, 'Amira Clinics', 'Nile Traders', 'Petra Tours');
    // Someone else changes one after it was listed.
    source.changeElsewhere('contact', 3, { orders: 5 }, { by: 'Mona', at: '2026-10-16T09:00:00Z' });
    await setOnChosen(host, 'state', 'blocked');
    const report = host.querySelector('.fd-list-report') as HTMLElement;
    await until(() => !report.hidden);
    expect([...report.querySelectorAll('li')].map((li) => li.textContent)).toEqual(['Petra Tours: Mona changed it after it was listed.']);
    const saves = source.calls.filter((call) => call.method === 'save').map((call) => call.request as SaveRequest);
    expect(saves.map((save) => [save.id, save.partial, save.changes.values, !!save.version])).toEqual([
      [2, true, { state: 'blocked' }, true],
      [1, true, { state: 'blocked' }, true],
      [3, true, { state: 'blocked' }, true],
    ]);
    expect([1, 2, 3].map((id) => stateOf(source, id))).toEqual(['blocked', 'blocked', 'lead']);
  });

  it('sets a link, and clears a field that may be empty, saying so in its question', async () => {
    const source = createMemoryDataSource({ records: records() });
    const asked: string[] = [];
    const host = await mount({ dataSource: source, confirm: async (message) => (asked.push(message), true) });
    tick(host, 'Nile Traders', 'Petra Tours');
    edit(host).click();
    await until(() => dialog());
    choose('bulk-pick', 'Owner');
    footButton('Update').click();
    await until(() => asked.length === 1);
    expect(asked).toEqual(['Update 2 records? Owner is cleared.']);
    await until(() => source.records['contact']['1']['owner_id'] === null);
    expect(source.records['contact']['3']['owner_id']).toBeNull();
  });

  it('writes every record that matches, chosen past the page', async () => {
    const source = createMemoryDataSource({ records: records() });
    const host = await mount({ dataSource: source });
    const header = host.querySelector('thead .fd-list-checkbox') as HTMLInputElement;
    header.checked = true;
    header.dispatchEvent(new Event('change'));
    (host.querySelector('.fd-list-every') as HTMLButtonElement).click();
    await until(() => host.querySelector('.fd-list-count')?.textContent === '4 selected');
    await setOnChosen(host, 'state', 'lead');
    await until(() => [1, 2, 3, 4].every((id) => stateOf(source, id) === 'lead'));
  });

  it('is not offered unless the page asks, nor where the source cannot write', async () => {
    const plain = await mount({}, { ...contacts, layout: { ...contacts.layout, bulkEdit: undefined } as Page['layout'] });
    tick(plain, 'Amira Clinics');
    expect(plain.querySelector('.fd-list-edit')).toBeNull();
    handle?.destroy();
    const source = createMemoryDataSource({ records: records() });
    delete (source as Partial<MemoryDataSource>).writeMany;
    delete (source as Partial<MemoryDataSource>).save;
    const host = await mount({ dataSource: source });
    tick(host, 'Amira Clinics');
    expect(host.querySelector('.fd-list-edit')).toBeNull();
  });

  it('offers the fields the page names, in its order, and no picker when it names one', async () => {
    const host = await mount({}, { ...contacts, layout: { ...contacts.layout, bulkEdit: ['owner_id'] } as Page['layout'] });
    tick(host, 'Amira Clinics');
    edit(host).click();
    await until(() => dialog());
    expect(dialog()?.querySelector('[data-node="bulk-pick"]')).toBeNull();
    expect(shown('bulk-owner_id')).toBe(true);
    footButton('Cancel').click();
    await until(() => !dialog());
  });
});

describe('Edit, on a page that names its records', () => {
  it('says them in its dialog, its question and what it did', async () => {
    const asked: string[] = [];
    const said: string[] = [];
    const host = await mount({ confirm: async (message) => (asked.push(message), true), host: { say: (message) => void said.push(message) } }, { ...contacts, records: { one: 'contact', other: 'contacts', a: 'a contact' } });
    tick(host, 'Amira Clinics', 'Petra Tours');
    edit(host).click();
    await until(() => dialog());
    expect(dialog()?.querySelector('.fd-form-dialog-title')?.textContent).toBe('Edit 2 contacts');
    choose('bulk-pick', 'Status');
    choose('bulk-state', 'Customer');
    footButton('Update').click();
    await until(() => said.length > 0);
    expect(asked).toEqual(['Update 2 contacts? Status becomes “Customer”.']);
    expect(said).toEqual(['2 contacts updated.']);
    tick(host, 'Nile Traders');
    edit(host).click();
    await until(() => dialog());
    expect(dialog()?.querySelector('.fd-form-dialog-title')?.textContent).toBe('Edit 1 contact');
  });
});
