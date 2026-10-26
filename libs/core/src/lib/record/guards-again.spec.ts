import type { Page } from '../format/page';

/**
 * A part that guards a send could not come — the owner's walk of 0.35: the payment step's script refused by the
 * network, Retry offered under the refusal never asked for it again (no request at all: a browser keeps a failed
 * `import()` failed for the page's life), and Reload, which the words asked for, emptied the form (0.35.1).
 *
 * Where the browser said which module failed (Chromium, Firefox), Retry asks for it anew at an address of its own
 * (`failedModule`, `asksAgain`), and the words say "Try again."; where it said none (WebKit) they ask for a reload — and
 * in either case what is typed is kept in the tab's own store from the moment the part is missing, so the reload brings
 * it back, laid as the form opens; sent, it goes.
 */

/** How the next asks for each part's module fail: with the browser's own words, as many times as there are. */
const mockFailing: Record<string, string[]> = {};
const mockPart = (name: string, path: string) => {
  const next = mockFailing[name]?.shift();
  if (next) throw new TypeError(next);
  return jest.requireActual(path);
};
jest.mock('./pay-part', () => mockPart('pay', './pay-part'));

const CHROMIUM = 'Failed to fetch dynamically imported module: https://homes.example/assets/pay-part-Q2X7.js';
const FIREFOX = 'error loading dynamically imported module: https://homes.example/assets/pay-part-Q2X7.js';
const WEBKIT = 'Importing a module script failed.';

/** The tab's own store, as a browser's sessionStorage is: its keys listed too. Core runs in no browser here. */
const tab = new Map<string, string>();
const sessionStorage = {
  getItem: (key: string) => tab.get(key) ?? null,
  setItem: (key: string, value: string) => void tab.set(key, String(value)),
  removeItem: (key: string) => void tab.delete(key),
  get length() {
    return tab.size;
  },
  key: (index: number) => [...tab.keys()][index] ?? null,
};
const drafts = () => [...tab.keys()].filter((key) => key.startsWith('fieldia:draft:'));

beforeAll(() => void ((globalThis as { sessionStorage?: unknown }).sessionStorage = sessionStorage));
afterAll(() => void delete (globalThis as { sessionStorage?: unknown }).sessionStorage);
beforeEach(() => {
  jest.resetModules();
  for (const name of Object.keys(mockFailing)) delete mockFailing[name];
  // The tab's own id kept, as a reload keeps it; its drafts let go.
  for (const key of drafts()) tab.delete(key);
});

async function fresh() {
  const { createForm } = await import('./form');
  const { createMemoryDataSource } = await import('./memory-data-source');
  const { failedModule } = await import('../parts');
  return { createForm, createMemoryDataSource, failedModule };
}

const enquiry = (): Page =>
  ({
    fieldia: '0.13',
    id: 'unit-enquiry',
    data: { kind: 'responses' },
    payment: { label: 'Reservation fee', amount: 10000, currency: 'EGP' },
    fields: { name: { type: 'char', label: 'Full name', required: true }, message: { type: 'text', label: 'Anything else?' }, pin: { type: 'char', label: 'PIN', secret: true } },
    layout: { type: 'sections', id: 'root', children: [{ type: 'field', id: 'f-name', field: 'name' }, { type: 'field', id: 'f-message', field: 'message' }, { type: 'field', id: 'f-pin', field: 'pin' }] },
  }) as Page;

const settled = () => new Promise((resolve) => setTimeout(resolve, 600));

describe('the address of a module the browser could not fetch', () => {
  it('is read from Chromium’s words and Firefox’s, and is none where WebKit names none or the failure was another', async () => {
    const { failedModule } = await fresh();
    expect(failedModule(new TypeError(CHROMIUM))).toBe('https://homes.example/assets/pay-part-Q2X7.js');
    expect(failedModule(new TypeError(FIREFOX))).toBe('https://homes.example/assets/pay-part-Q2X7.js');
    expect(failedModule(new TypeError(WEBKIT))).toBeNull();
    expect(failedModule(new Error('Unexpected token <'))).toBeNull();
    expect(failedModule(new TypeError('Failed to fetch dynamically imported module: javascript:alert(1)'))).toBeNull();
  });
});

describe('a payment step that could not come', () => {
  it.each([['Chromium', CHROMIUM], ['Firefox', FIREFOX]])('in %s: its words say try again, and a send asks for its module anew, never the failed one', async (_, words) => {
    mockFailing['pay'] = [words, words];
    const { createForm, createMemoryDataSource } = await fresh();
    const dataSource = createMemoryDataSource();
    const form = createForm({ page: enquiry(), dataSource });
    form.setValue('name', 'Hana Mostafa');
    expect(await form.save()).toBe(false);
    expect(form.getState().saveProblem).toEqual({ kind: 'other', message: 'The payment step could not load, so nothing was sent. Try again.' });
    // Asked for again at its own address: the failed module's loader, which the browser would answer from its memory, is
    // never asked again (one failure left of the two, not taken).
    expect(await form.save()).toBe(false);
    expect(mockFailing['pay']).toEqual([words]);
    expect(dataSource.responses).toHaveLength(0);
  });

  it('in WebKit: its words ask for a reload, and what was typed comes back with it, in the same tab, never a secret', async () => {
    mockFailing['pay'] = [WEBKIT, WEBKIT];
    const { createForm, createMemoryDataSource } = await fresh();
    const form = createForm({ page: enquiry(), dataSource: createMemoryDataSource() });
    form.setValue('name', 'Hana Mostafa');
    form.setValue('message', 'Is the price final?');
    form.setValue('pin', '4321');
    expect(await form.save()).toBe(false);
    expect(form.getState().saveProblem?.message).toBe('The payment step could not load, so nothing was sent. Reload the page and try again.');
    // The page reloaded: a new form of the same page, in the same tab.
    const again = (await fresh()).createForm({ page: enquiry(), dataSource: (await fresh()).createMemoryDataSource() });
    await settled();
    expect(again.getState().values).toMatchObject({ name: 'Hana Mostafa', message: 'Is the price final?' });
    expect(again.getState().values['pin'] ?? null).toBeNull();
  });

  it('keeps what is typed from the moment the part is missing, before any send: a reload then brings it back too', async () => {
    mockFailing['pay'] = [WEBKIT];
    const { createForm, createMemoryDataSource } = await fresh();
    const form = createForm({ page: enquiry(), dataSource: createMemoryDataSource() });
    await settled();
    form.setValue('name', 'Hana Mostafa');
    await settled();
    const again = (await fresh()).createForm({ page: enquiry(), dataSource: (await fresh()).createMemoryDataSource() });
    await settled();
    expect(again.getState().values['name']).toBe('Hana Mostafa');
  });

  it('once the part comes and the answers go, what was kept for a reload goes with them; a page whose parts came keeps nothing', async () => {
    mockFailing['pay'] = [WEBKIT];
    const { createForm, createMemoryDataSource } = await fresh();
    const dataSource = createMemoryDataSource();
    const form = createForm({ page: enquiry(), dataSource });
    await settled();
    form.setValue('name', 'Hana Mostafa');
    await settled();
    expect(drafts()).toHaveLength(1);
    // The module comes as the send asks once more (a bundler's chunk asked anew): the payment taken, the answers sent.
    expect(await form.save()).toBe(true);
    expect(dataSource.responses).toHaveLength(1);
    expect(drafts()).toHaveLength(0);
    // Every part in: nothing typed is kept in the tab.
    const whole = (await fresh()).createForm({ page: enquiry(), dataSource: (await fresh()).createMemoryDataSource() });
    await settled();
    whole.setValue('name', 'Mona');
    await settled();
    expect(drafts()).toHaveLength(0);
  });
});
