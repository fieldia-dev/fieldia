import { alikeRecords, createMemoryDataSource, saveRefused, type DataSource, type DuplicatesRequest, type DuplicatesResult, type MemoryDataSource, type Page } from '@fieldia/core';
import type { PreferenceStore } from '@fieldia/widgets';
import { DUPLICATES_WAIT_MS } from './duplicates';
import { mountViewer, type ViewerHandle, type ViewerOptions } from './viewer';

/**
 * Possible duplicates (`duplicates` on a record's page), as a person meets them: a moment after they stop typing in a
 * field the page names — and as a saved record opens, and as a record is saved — records like this one are said under
 * the field they matched on, with Open it, "It's someone new" and, on a saved record, Merge: the two side by side, a
 * value picked for each field. An answer typing went on past, or for a record no longer shown, is laid nowhere; Save
 * is never in their way.
 */

const page = (more: Partial<Page> = {}): Page =>
  ({
    fieldia: '0.5',
    id: 'customer-card',
    title: 'Customer',
    data: { kind: 'record', model: 'partner' },
    fields: {
      name: { type: 'char', label: 'Name' },
      phone: { type: 'char', label: 'Phone' },
      email: { type: 'char', label: 'Email' },
      vat: { type: 'char', label: 'Tax ID' },
      country_id: { type: 'many2one', label: 'Country', relation: 'country' },
    },
    layout: { type: 'sections', id: 's', children: [{ type: 'section', id: 'g', children: ['name', 'phone', 'email', 'vat', 'country_id'].map((field) => ({ type: 'field', id: `f-${field}`, field })) }] },
    duplicates: { fields: ['name', 'phone', 'email', 'vat'] },
    ...more,
  }) as Page;

const partners = () => ({
  1: { name: 'Nile Traders', phone: '+20223456789', email: 'orders@niletraders.example', vat: '123-456-789', country_id: { id: 1, label: 'Egypt' } },
  2: { name: 'Delta Foods', phone: '+20403334400', email: 'orders@deltafoods.example', vat: null, country_id: { id: 1, label: 'Egypt' } },
  3: { name: 'Nile Traders Co.', phone: null, email: 'orders@niletraders.example', vat: '123456789', country_id: null },
});
const source = (more: Parameters<typeof createMemoryDataSource>[0] = {}) => createMemoryDataSource({ records: { partner: partners(), country: { 1: { name: 'Egypt' } } }, duplicates: alikeRecords(), ...more });

/** A store of preferences in memory, as the browser's would keep them. */
const memoryPreferences = (): PreferenceStore & { kept: Map<string, unknown> } => {
  const kept = new Map<string, unknown>();
  return { kept, get: (key) => (kept.has(key) ? JSON.parse(JSON.stringify(kept.get(key))) : null), set: (key, value) => void kept.set(key, value) };
};

let handle: ViewerHandle | null = null;
let host: HTMLElement;
beforeEach(() => jest.useFakeTimers({ doNotFake: ['queueMicrotask', 'nextTick'] }));
afterEach(() => {
  handle?.destroy();
  handle = null;
  document.body.replaceChildren();
  jest.useRealTimers();
});

/** Time passing, and every answer it lets come. */
const pass = (ms = 0) => jest.advanceTimersByTimeAsync(ms);

async function mount(options: Partial<ViewerOptions> & { dataSource: DataSource }, shown: Page = page()) {
  host = document.createElement('div');
  document.body.append(host);
  handle = mountViewer(host, { page: shown, preferences: memoryPreferences(), ...options });
  await pass(0);
  await pass(0);
  return handle;
}
const box = (field: string) => host.querySelector(`.fd-field[data-path="${field}"] input`) as HTMLInputElement;
/** Typing, a key at a time, as a person does. */
async function type(field: string, text: string, gap = 80) {
  const input = box(field);
  input.focus();
  for (const key of text) {
    input.value += key;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await pass(gap);
  }
}
const note = (field: string) => host.querySelector(`.fd-field[data-path="${field}"] .fd-duplicates`) as HTMLElement | null;
const notes = () => [...host.querySelectorAll('.fd-duplicates')] as HTMLElement[];
const words = (field: string) => [...(note(field)?.querySelectorAll('.fd-duplicate-words') ?? [])].map((w) => w.textContent);
const ways = (field: string, row = 0) => [...(note(field)?.querySelectorAll('.fd-duplicate')[row]?.querySelectorAll('button') ?? [])].map((b) => b.textContent);
const way = (field: string, name: string, row = 0) => [...(note(field)?.querySelectorAll('.fd-duplicate')[row]?.querySelectorAll('button') ?? [])].find((b) => b.textContent === name) as HTMLButtonElement;
const asked = (ds: MemoryDataSource) => ds.calls.filter((call) => call.method === 'duplicates').map((call) => call.request as DuplicatesRequest);

describe('possible duplicates, as a record is typed', () => {
  it('says a record with the same phone under the phone box, once typing has rested, asking once', async () => {
    const ds = source();
    await mount({ dataSource: ds });
    await type('phone', '+20 2 2345 6789');
    expect(asked(ds)).toEqual([]);
    await pass(DUPLICATES_WAIT_MS - 100);
    expect(notes()).toEqual([]);
    await pass(100);
    expect(asked(ds)).toEqual([{ model: 'partner', recordId: null, values: expect.objectContaining({ phone: '+20 2 2345 6789' }), fields: ['phone'] }]);
    expect(words('phone')).toEqual(['A record with this Phone already exists: Nile Traders']);
    // A new record: Open it and It's someone new, never Merge.
    expect(ways('phone')).toEqual(['Open it', 'It’s someone new']);
    // Said politely, once, to a screen reader.
    expect(host.querySelector('.fd-duplicates-said')?.textContent).toBe('A record with this Phone already exists: Nile Traders');
  });

  it('says a name close enough as one, and every field it matched on, under one it holds the same', async () => {
    const ds = source();
    await mount({ dataSource: ds });
    await type('name', 'Nile Trader', 20);
    await pass(DUPLICATES_WAIT_MS);
    expect(words('name')).toEqual(['A record with a name like this already exists: Nile Traders', 'A record with a name like this already exists: Nile Traders Co.']);
    await type('vat', '123456789', 20);
    await pass(DUPLICATES_WAIT_MS);
    // Under the field it holds the same, a name's likeness being the weaker sign.
    expect(words('vat')).toEqual(['A record with this Tax ID and a name like this already exists: Nile Traders', 'A record with this Tax ID and a name like this already exists: Nile Traders Co.']);
    expect(note('name')).toBeNull();
  });

  it('leaves an answer on its way unheard when typing goes on, and asks again once it rests', async () => {
    const answers: ((result: DuplicatesResult) => void)[] = [];
    const ds = { ...source(), duplicates: (_: DuplicatesRequest) => new Promise<DuplicatesResult>((resolve) => answers.push(resolve)) };
    await mount({ dataSource: ds });
    await type('phone', '+2022345');
    await pass(DUPLICATES_WAIT_MS);
    expect(answers).toHaveLength(1);
    await type('phone', '6789');
    answers[0]({ matches: [{ id: 1, name: 'Nile Traders', why: ['phone'] }] });
    await pass(0);
    expect(notes()).toEqual([]);
    await pass(DUPLICATES_WAIT_MS);
    expect(answers).toHaveLength(2);
    answers[1]({ matches: [{ id: 2, name: 'Delta Foods', why: ['phone'] }] });
    await pass(0);
    expect(words('phone')).toEqual(['A record with this Phone already exists: Delta Foods']);
  });

  it('lays an answer for a record no longer shown on none', async () => {
    const answers: ((result: DuplicatesResult) => void)[] = [];
    const ds = { ...source(), duplicates: (_: DuplicatesRequest) => new Promise<DuplicatesResult>((resolve) => answers.push(resolve)) };
    const viewer = await mount({ dataSource: ds });
    await type('phone', '+20223456789');
    await pass(DUPLICATES_WAIT_MS);
    expect(answers).toHaveLength(1);
    await viewer.form.openRecord(2);
    await pass(0);
    // Record 2 opened is asked of in its turn: no answer yet for it either.
    answers[0]({ matches: [{ id: 1, name: 'Nile Traders', why: ['phone'] }] });
    await pass(0);
    expect(notes()).toEqual([]);
    expect(viewer.form.getState().recordId).toBe(2);
  });

  it('clears what it said once the value no longer matches', async () => {
    const ds = source();
    await mount({ dataSource: ds });
    await type('email', 'orders@deltafoods.example', 5);
    await pass(DUPLICATES_WAIT_MS);
    expect(words('email')).toEqual(['A record with this Email already exists: Delta Foods']);
    box('email').value = 'hello@new.example';
    box('email').dispatchEvent(new Event('input', { bubbles: true }));
    await pass(DUPLICATES_WAIT_MS);
    expect(notes()).toEqual([]);
  });

  it('is never in Save’s way: a duplicate said, Save saves, and it is asked again as saved', async () => {
    const ds = source();
    const viewer = await mount({ dataSource: ds });
    await type('phone', '+20223456789', 5);
    await pass(DUPLICATES_WAIT_MS);
    expect(words('phone')).toHaveLength(1);
    expect(await viewer.save()).toBe(true);
    await pass(0);
    expect(viewer.form.getState().recordId).toBe(4);
    expect(ds.records['partner'][4]['phone']).toBe('+20223456789');
    expect(asked(ds).at(-1)?.recordId).toBe(4);
    // Saved, it may be merged now.
    expect(ways('phone')).toEqual(['Open it', 'It’s someone new', 'Merge…']);
  });

  it('with on: "save", asks only as the record is saved', async () => {
    const ds = source();
    const viewer = await mount({ dataSource: ds }, page({ duplicates: { fields: ['phone', 'email'], on: 'save' } }));
    await type('phone', '+20223456789', 5);
    await pass(DUPLICATES_WAIT_MS * 3);
    expect(asked(ds)).toEqual([]);
    expect(await viewer.save()).toBe(true);
    await pass(0);
    expect(asked(ds)).toHaveLength(1);
    expect(words('phone')).toEqual(['A record with this Phone already exists: Nile Traders']);
  });
});

/** A source that keeps nothing of what is let be (no `notDuplicates`, no `markNotDuplicate`): the browser keeps it. */
const browserKept = (ds: MemoryDataSource): DataSource => {
  const { notDuplicates: _read, markNotDuplicate: _write, ...rest } = ds;
  return rest;
};

describe('its ways: It’s someone new, Open it', () => {
  it('lets a match’s record be for this record, whatever matches it next, remembered for the record once it is saved', async () => {
    const ds = source();
    const preferences = memoryPreferences();
    const viewer = await mount({ dataSource: browserKept(ds), preferences });
    await type('email', 'orders@niletraders.example', 2);
    await pass(DUPLICATES_WAIT_MS);
    expect(words('email')).toHaveLength(2);
    way('email', 'It’s someone new').click();
    expect(words('email')).toEqual(['A record with this Email already exists: Nile Traders Co.']);
    // The focus moves to the next match's first way, never lost.
    expect(document.activeElement?.textContent).toBe('Open it');
    way('email', 'It’s someone new').click();
    expect(notes()).toEqual([]);
    expect(document.activeElement).toBe(box('email'));
    // The same values asked again: still let be. Saved: remembered by the record's id.
    expect(await viewer.save()).toBe(true);
    await pass(0);
    expect(notes()).toEqual([]);
    expect(preferences.kept.get('duplicates.partner')).toEqual([['4', ['1', '3']]]);
    // Another field matching them too (0.25 said them again, by the values they had matched on): still let be.
    await type('vat', '123456789', 2);
    await pass(DUPLICATES_WAIT_MS);
    expect(notes()).toEqual([]);
    // Opened again later, what was let be stays let be.
    handle?.destroy();
    document.body.replaceChildren();
    const again = await mount({ dataSource: browserKept(ds), preferences, recordId: 4 }, page({ duplicates: { fields: ['email'] } }));
    await pass(0);
    expect(again.form.getState().recordId).toBe(4);
    expect(notes()).toEqual([]);
  });

  it('Open it asks before typed work goes, and shows the record found in this one’s place', async () => {
    const ds = source();
    const viewer = await mount({ dataSource: ds });
    await type('phone', '+20223456789', 5);
    await pass(DUPLICATES_WAIT_MS);
    way('phone', 'Open it').click();
    await pass(0);
    const question = document.querySelector('.fd-dialog[role="alertdialog"]') as HTMLElement;
    expect(question.textContent).toContain('Discard your changes?');
    // Cancel: the person stays with what they typed.
    ([...question.querySelectorAll('button')].find((b) => b.textContent === 'Cancel') as HTMLButtonElement).click();
    await pass(0);
    expect(viewer.form.getState().recordId).toBeNull();
    expect(box('phone').value).toBe('+20223456789');
    way('phone', 'Open it').click();
    await pass(0);
    ([...document.querySelectorAll('.fd-dialog[role="alertdialog"] button')].find((b) => b.textContent === 'Discard') as HTMLButtonElement).click();
    await pass(0);
    await pass(0);
    expect(viewer.form.getState().recordId).toBe(1);
    expect(box('name').value).toBe('Nile Traders');
  });
});

describe('It’s someone new kept on the app’s server (notDuplicates, markNotDuplicate)', () => {
  /** Another device: its own viewer, its own browser's preferences (none kept), the same server. */
  async function elsewhere(ds: DataSource, recordId: number, shown = page()) {
    handle?.destroy();
    document.body.replaceChildren();
    const preferences = memoryPreferences();
    const viewer = await mount({ dataSource: ds, preferences, recordId }, shown);
    await pass(0);
    return { viewer, preferences };
  }

  it('keeps what a new record let be on the server once it is saved, and another device lets it be too', async () => {
    const ds = source();
    const preferences = memoryPreferences();
    const viewer = await mount({ dataSource: ds, preferences });
    await type('email', 'orders@niletraders.example', 2);
    await pass(DUPLICATES_WAIT_MS);
    way('email', 'It’s someone new').click();
    way('email', 'It’s someone new').click();
    expect(notes()).toEqual([]);
    // New, nothing is kept yet: it has no id to keep it by.
    expect(ds.calls.filter((call) => call.method === 'markNotDuplicate')).toEqual([]);
    expect(await viewer.save()).toBe(true);
    await pass(0);
    expect(notes()).toEqual([]);
    expect(ds.notDuplicatePairs).toEqual({ partner: [[4, 1], [4, 3]] });
    // The server keeps them: the browser, nothing.
    expect(preferences.kept.has('duplicates.partner')).toBe(false);
    const { preferences: theirs } = await elsewhere(ds, 4, page({ duplicates: { fields: ['email'] } }));
    expect(notes()).toEqual([]);
    expect(theirs.kept.size).toBe(0);
    // A pair: on Nile Traders Co., the customer saved since is someone else too.
    await elsewhere(ds, 3, page({ duplicates: { fields: ['email'] } }));
    expect(words('email')).toEqual(['A record with this Email already exists: Nile Traders']);
  });

  it('keeps a saved record’s at once, and says the matches only once the server has said what it keeps', async () => {
    const ds = source();
    await mount({ dataSource: ds, recordId: 3 }, page({ duplicates: { fields: ['email'] } }));
    await pass(0);
    expect(words('email')).toEqual(['A record with this Email already exists: Nile Traders']);
    way('email', 'It’s someone new').click();
    expect(notes()).toEqual([]);
    expect(ds.calls.find((call) => call.method === 'markNotDuplicate')?.request).toEqual({ model: 'partner', recordId: 3, matchId: 1 });
    // Another device, the server slow to say what it keeps: nothing is said meanwhile, and the one let be never.
    let answer: (ids: string[]) => void = () => undefined;
    const slow: DataSource = { ...ds, notDuplicates: () => new Promise((done) => (answer = done)) };
    await elsewhere(slow, 3, page({ duplicates: { fields: ['email'] } }));
    await pass(1000);
    expect(notes()).toEqual([]);
    answer(['1']);
    await pass(0);
    expect(notes()).toEqual([]);
  });

  it('keeps one the server refuses in the browser, and says the matches as found where it cannot say what it keeps', async () => {
    const ds = source();
    const refusing: DataSource = { ...ds, markNotDuplicate: async () => Promise.reject(new Error('The server is away')) };
    const preferences = memoryPreferences();
    await mount({ dataSource: refusing, preferences, recordId: 3 }, page({ duplicates: { fields: ['email'] } }));
    await pass(0);
    way('email', 'It’s someone new').click();
    await pass(0);
    expect(notes()).toEqual([]);
    expect(preferences.kept.get('duplicates.partner')).toEqual([['3', ['1']]]);
    // A server that cannot say what it keeps: the matches as found, what this browser kept still let be.
    handle?.destroy();
    document.body.replaceChildren();
    const failing: DataSource = { ...ds, notDuplicates: async () => Promise.reject(new Error('The server is away')) };
    await mount({ dataSource: failing, preferences, recordId: 3 }, page({ duplicates: { fields: ['email'] } }));
    await pass(0);
    expect(notes()).toEqual([]);
    await elsewhere(failing, 3, page({ duplicates: { fields: ['email'] } }));
    expect(words('email')).toEqual(['A record with this Email already exists: Nile Traders']);
  });

  it('lays what the server keeps for a record no longer shown on none', async () => {
    // Mona Adel (4) found like every customer, by a source of the app's own.
    const ds = source({ duplicates: () => ({ matches: [{ id: 4, name: 'Mona Adel', why: ['email'] }] }) });
    let answer: (ids: string[]) => void = () => undefined;
    // What the server keeps for Nile Traders Co. (3) comes late: Mona Adel let be for it.
    const slow: DataSource = { ...ds, notDuplicates: (request) => (String(request.recordId) === '3' ? new Promise((done) => (answer = done)) : ds.notDuplicates(request)) };
    const viewer = await mount({ dataSource: slow, recordId: 3 }, page({ duplicates: { fields: ['email'] } }));
    await pass(0);
    // Nile Traders (1) shown before the server's answer for Nile Traders Co. (3) comes: its own matches, nothing let be.
    await viewer.form.openRecord(1);
    await pass(0);
    answer(['4']);
    await pass(0);
    expect(viewer.form.getState().recordId).toBe(1);
    expect(words('email')).toEqual(['A record with this Email already exists: Mona Adel']);
    // Asked again as Nile Traders is typed in: still said for it.
    await type('email', '.eg', 2);
    await pass(DUPLICATES_WAIT_MS);
    expect(words('email')).toEqual(['A record with this Email already exists: Mona Adel']);
  });
});

describe('Merge: two records side by side, one kept', () => {
  const screen = () => document.querySelector('.fd-merge') as HTMLElement | null;
  const pick = (field: string, side: 'here' | 'there') => screen()?.querySelector(`tr[data-field="${field}"] input[value="${side}"]`) as HTMLInputElement;
  const picked = () => Object.fromEntries([...(screen()?.querySelectorAll('tbody tr') ?? [])].map((row) => [row.getAttribute('data-field'), (row.querySelector('input:checked') as HTMLInputElement | null)?.value]));
  const button = (name: string) => [...(screen()?.querySelectorAll('button') ?? [])].find((b) => b.textContent === name) as HTMLButtonElement;

  it('is asked of as a saved record opens, and merges it into the one found, the values picked kept', async () => {
    const ds = source();
    const viewer = await mount({ dataSource: ds, recordId: 3 });
    await pass(0);
    expect(words('email')).toEqual(['A record with this Email and Tax ID and a name like this already exists: Nile Traders']);
    way('email', 'Merge…').click();
    await pass(0);
    expect(screen()?.getAttribute('role')).toBe('dialog');
    expect(screen()?.querySelector('.fd-form-dialog-title')?.textContent).toBe('Merge two records');
    // Its columns: this record, and the one found, kept unless the person picks this one.
    expect([...(screen() as HTMLElement).querySelectorAll('thead th')].map((th) => th.textContent)).toEqual(['Keep Nile Traders Co.This record', 'Keep Nile Traders']);
    expect((screen()?.querySelector('thead input:checked') as HTMLInputElement).value).toBe('there');
    expect(document.activeElement).toBe(screen()?.querySelector('thead input:checked'));
    // A row for each field held apart, the kept record's value picked; the same in both said apart.
    expect(picked()).toEqual({ name: 'there', phone: 'there', vat: 'there', country_id: 'there' });
    expect(screen()?.querySelector('tr[data-field="phone"] td .fd-merge-empty')?.textContent).toBe('Empty');
    expect(screen()?.querySelector('.fd-merge-same')?.textContent).toBe('The same in both: Email.');
    expect(screen()?.querySelector('.fd-merge-what')?.textContent).toBe(
      'Nile Traders keeps the values picked and the rest of its own. The messages, activities and links of Nile Traders Co. move to Nile Traders, and Nile Traders Co. is taken away. This cannot be undone.'
    );
    pick('vat', 'here').click();
    button('Merge').click();
    await pass(0);
    await pass(0);
    expect(ds.calls.find((call) => call.method === 'merge')?.request).toEqual({
      model: 'partner',
      keepId: 1,
      mergeIds: [3],
      values: { name: 'Nile Traders', phone: '+20223456789', vat: '123456789', country_id: { id: 1, label: 'Egypt' } },
      fields: page().fields,
    });
    expect(screen()).toBeNull();
    expect(ds.records['partner'][3]).toBeUndefined();
    // The record kept is shown, and the merge said.
    expect(viewer.form.getState().recordId).toBe(1);
    expect(box('vat').value).toBe('123456789');
    expect(document.querySelector('.fd-say')?.textContent).toContain('Merged into Nile Traders.');
  });

  it('keeps this record when the person picks it, each row following but those picked, and the empty one filled', async () => {
    const ds = source();
    const viewer = await mount({ dataSource: ds, recordId: 3 });
    way('email', 'Merge…').click();
    await pass(0);
    pick('name', 'there').click();
    (screen()?.querySelector('thead input[value="here"]') as HTMLInputElement).click();
    // Name stays as picked; Phone and Country, empty here, take the other's; Tax ID this record's.
    expect(picked()).toEqual({ name: 'there', phone: 'there', vat: 'here', country_id: 'there' });
    // The records named as they are now: this one kept, though it takes the other's name.
    expect(screen()?.querySelector('.fd-merge-what')?.textContent).toMatch(/^Nile Traders Co\. keeps the values picked .* of Nile Traders move to Nile Traders Co\., and Nile Traders is taken away/);
    button('Merge').click();
    await pass(0);
    await pass(0);
    const request = ds.calls.find((call) => call.method === 'merge')?.request as { keepId: number; mergeIds: number[] };
    expect([request.keepId, request.mergeIds]).toEqual([3, [1]]);
    expect(viewer.form.getState().recordId).toBe(3);
    expect(box('name').value).toBe('Nile Traders');
    expect(box('phone').value).toBe('+20223456789');
  });

  it('says a merge the source refuses in the screen, which stays; Cancel and Escape change nothing', async () => {
    const ds = source({ can: { partner: (values) => (values['name'] === 'Nile Traders Co.' ? { delete: false, reason: 'Only the credit team removes a customer.' } : undefined) } });
    const viewer = await mount({ dataSource: ds, recordId: 3 });
    way('email', 'Merge…').click();
    await pass(0);
    button('Merge').click();
    await pass(0);
    expect(screen()?.querySelector('.fd-merge-error')?.textContent).toBe('Only the credit team removes a customer.');
    expect(screen()?.querySelector('.fd-merge-error')?.getAttribute('role')).toBe('alert');
    screen()?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await pass(0);
    expect(screen()).toBeNull();
    expect(viewer.form.getState().recordId).toBe(3);
    expect(Object.keys(ds.records['partner'])).toEqual(['1', '2', '3']);
    // The focus back on the way that opened it.
    expect(document.activeElement?.textContent).toBe('Merge…');
  });

  it('saves what is typed first, as Duplicate does, and refused stops there', async () => {
    const ds = source();
    const viewer = await mount({ dataSource: ds, recordId: 3 });
    box('phone').value = '+201001112222';
    box('phone').dispatchEvent(new Event('input', { bubbles: true }));
    way('email', 'Merge…').click();
    await pass(0);
    await pass(0);
    expect(ds.records['partner'][3]['phone']).toBe('+201001112222');
    expect(screen()?.querySelector('tr[data-field="phone"] input[value="here"]')?.closest('label')?.textContent).toBe('+201001112222');
    button('Cancel').click();
    expect(viewer.form.getState().recordId).toBe(3);
  });

  it('is offered only where the source merges and the person may change the record', async () => {
    const { merge: _no, ...noMerge } = source();
    await mount({ dataSource: noMerge as DataSource, recordId: 3 });
    expect(ways('email')).toEqual(['Open it', 'It’s someone new']);
    handle?.destroy();
    await mount({ dataSource: source(), recordId: 3, readonly: true });
    expect(ways('email')).toEqual(['Open it', 'It’s someone new']);
    handle?.destroy();
    await mount({ dataSource: source({ can: { partner: () => ({ edit: false }) } }), recordId: 3 });
    expect(ways('email')).toEqual(['Open it', 'It’s someone new']);
  });

  it('a record the source cannot read is said, and no screen opens', async () => {
    const ds = source();
    const failing: DataSource = { ...ds, load: async (request) => (request.id === 1 ? Promise.reject(saveRefused({ kind: 'other', message: 'The server is away' })) : ds.load(request)) };
    await mount({ dataSource: failing, recordId: 3 });
    way('email', 'Merge…').click();
    await pass(0);
    expect(screen()).toBeNull();
    expect(document.querySelector('.fd-say')?.textContent).toContain('Could not read Nile Traders: The server is away');
  });
});

describe('without the source’s duplicates', () => {
  it('asks nothing and says nothing', async () => {
    const { duplicates: _none, ...without } = source();
    await mount({ dataSource: without as DataSource });
    await type('phone', '+20223456789', 5);
    await pass(DUPLICATES_WAIT_MS * 2);
    expect(notes()).toEqual([]);
    expect(host.querySelector('.fd-duplicates-said')).toBeNull();
  });
});

describe('possible duplicates on a page that names its records', () => {
  const customers = (records: Page['records'], more: Partial<Page> = {}) => page({ records, ...more });

  it('says a customer with this phone, its label written small inside the sentence where the page says so', async () => {
    const ds = source();
    await mount({ dataSource: ds }, customers({ one: 'customer', other: 'customers', a: 'a customer' }, { lowerLabels: true }));
    await type('phone', '+20 2 2345 6789');
    await pass(DUPLICATES_WAIT_MS);
    expect(words('phone')).toEqual(['A customer with this phone already exists: Nile Traders']);
    expect(ways('phone')).toEqual(['Open it', 'It’s a new customer']);
  });

  it('keeps a label whose first word holds another capital as written: "Tax ID" small, "IBAN" never', async () => {
    const ds = source();
    const shown = customers({ one: 'customer', other: 'customers', a: 'a customer' }, { lowerLabels: true });
    await mount({ dataSource: ds }, { ...shown, fields: { ...shown.fields, email: { type: 'char', label: 'IBAN' } } });
    await type('vat', '123-456-789', 20);
    await pass(DUPLICATES_WAIT_MS);
    expect(words('vat')).toEqual(['A customer with this tax ID already exists: Nile Traders', 'A customer with this tax ID already exists: Nile Traders Co.']);
    await type('email', 'orders@deltafoods.example', 5);
    await pass(DUPLICATES_WAIT_MS);
    expect(words('email')).toEqual(['A customer with this IBAN already exists: Delta Foods']);
  });

  it('keeps each label as the page wrote it unless it says so, and says "A record" where the page gives no article', async () => {
    const ds = source();
    await mount({ dataSource: ds }, customers({ one: 'customer', other: 'customers' }));
    await type('phone', '+20 2 2345 6789');
    await pass(DUPLICATES_WAIT_MS);
    expect(words('phone')).toEqual(['A record with this Phone already exists: Nile Traders']);
    // A sentence with no article in it names the record still.
    expect(ways('phone')).toEqual(['Open it', 'It’s a new customer']);
  });

  it('keeps a German label’s capital: a language that writes its nouns so', async () => {
    const ds = source();
    await mount({ dataSource: ds, locale: 'de' }, customers({ one: 'Kunde', other: 'Kunden', a: 'ein Kunde' }, { lowerLabels: true, fields: { ...page().fields, phone: { type: 'char', label: 'Telefon' } } }));
    await type('phone', '+20 2 2345 6789');
    await pass(DUPLICATES_WAIT_MS);
    expect(words('phone')).toEqual(['Ein Kunde mit gleichem Wert in Telefon ist bereits vorhanden: Nile Traders']);
  });

  it('names them on the merge’s screen', async () => {
    const ds = source();
    await mount({ dataSource: ds, recordId: 3 }, customers({ one: 'customer', other: 'customers', a: 'a customer' }));
    await pass(0);
    way('email', 'Merge…').click();
    await pass(0);
    const screen = document.querySelector('.fd-merge') as HTMLElement;
    expect(screen.querySelector('.fd-form-dialog-title')?.textContent).toBe('Merge two customers');
    expect(screen.querySelector('.fd-merge-intro')?.textContent).toBe('Pick the customer to keep, then the value it keeps for each field.');
    expect(screen.querySelector('.fd-merge-shown')?.textContent).toBe('This customer');
  });

  it('says what both hold the same by labels small where the page asks; without it, as before', async () => {
    for (const [lower, same] of [
      [true, 'The same in both: email.'],
      [false, 'The same in both: Email.'],
    ] as const) {
      const ds = source();
      await mount({ dataSource: ds, recordId: 3 }, customers({ one: 'customer', other: 'customers' }, { lowerLabels: lower }));
      await pass(0);
      way('email', 'Merge…').click();
      await pass(0);
      expect(document.querySelector('.fd-merge .fd-merge-same')?.textContent).toBe(same);
      handle?.destroy();
      handle = null;
      document.body.replaceChildren();
    }
  });
});

describe('what 0.25 remembered as let be', () => {
  it('is read as its record let be, whatever it matched on', async () => {
    const ds = source();
    const preferences = memoryPreferences();
    // Nile Traders Co. (3) shares Nile Traders' (1) email and tax ID; 0.25 let Nile Traders be by the email alone.
    preferences.set('duplicates.partner', [['3', ['1|email="orders@niletraders.example"']]]);
    await mount({ dataSource: ds, preferences, recordId: 3 }, page({ duplicates: { fields: ['email', 'vat'] } }));
    await pass(0);
    expect(notes()).toEqual([]);
    // Without it, Nile Traders is said.
    handle?.destroy();
    document.body.replaceChildren();
    await mount({ dataSource: ds, preferences: memoryPreferences(), recordId: 3 }, page({ duplicates: { fields: ['email', 'vat'] } }));
    await pass(0);
    expect(notes()).not.toEqual([]);
  });
});
