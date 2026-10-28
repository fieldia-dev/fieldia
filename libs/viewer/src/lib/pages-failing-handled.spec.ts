import { createMemoryDataSource, type OpenRequest, type OpenResult, type Page, type RecordId } from '@fieldia/core';
import { installZonePromises } from '../../../../testing/zone-promises';
import { pageDialogs, type PageRequest } from './related';
import { mountViewer, type ViewerHandle, type ViewerOptions } from './viewer';

/**
 * A page the app cannot give — its fetch failed (a network's failure, or the page left as it came) — leaves no promise
 * rejection unhandled, and where a press asked for it the person is told why, in words the viewer has: a link drawn (it
 * asks whether the app has a page, to show its Open), its Open, a tag's, a related list's rows and New, the app's own
 * way of opening a related record (`open: 'app'`), and the pager's next record. Each press can be tried again.
 *
 * Promises here are kept as Angular's zone keeps them (testing/zone-promises.ts: a refusal with no handler once the
 * zone's microtasks have drained is said — before a native `await` queued after them); one of the engine's own left unhandled fails the test (jest). The app answers with the zone's
 * promise or with the engine's own (an `import()`, an async function Angular did not compile): in a zone, `instanceof
 * Promise` is true of the zone's alone, so a page that comes later is known by its `then`.
 */

const FAILED = 'Failed to fetch dynamically imported module: /chunks/partner.page-7QX2.js';
/** The app's answers for a page that cannot come. */
const FAILS: [string, () => Promise<Page | null>][] = [
  ['refused at once', () => Promise.reject(new Error(FAILED))],
  ['refused later', () => new Promise<Page | null>((_, reject) => setTimeout(() => reject(new Error(FAILED)), 5))],
  ['the engine’s own promise, refused', async () => {
    throw new Error(FAILED);
  }],
];

const partner = {
  fieldia: '0.13',
  id: 'partner',
  title: 'Customer',
  data: { kind: 'record', model: 'partner' },
  fields: { name: { type: 'char', label: 'Name' } },
  layout: { type: 'sections', id: 's', children: [{ type: 'field', id: 'p-name', field: 'name' }] },
} as unknown as Page;

const order = {
  fieldia: '0.13',
  id: 'order',
  title: 'Order',
  data: { kind: 'record', model: 'sale.order' },
  fields: { client_id: { type: 'many2one', label: 'Client', relation: 'partner' }, tag_ids: { type: 'many2many', label: 'Tags', relation: 'partner' } },
  layout: { type: 'sections', id: 's', children: [{ type: 'field', id: 'f-client', field: 'client_id' }, { type: 'field', id: 'f-tags', field: 'tag_ids' }] },
} as unknown as Page;

const records = () => ({
  partner: { 1: { name: 'Nile Traders' }, 2: { name: 'Delta Foods' } },
  'sale.order': {
    7: { client_id: { id: 1, label: 'Nile Traders' }, tag_ids: [{ id: 2, label: 'Delta Foods' }] },
    8: { client_id: { id: 2, label: 'Delta Foods' }, tag_ids: [] },
    9: { client_id: null, tag_ids: [] },
  },
  invoice: { 11: { name: 'INV/1', partner_id: { id: 1, label: 'Nile Traders' } } },
});

const wait = (ms = 0) => new Promise((done) => setTimeout(done, ms));
/** Long enough for a refusal later to have come, and for anything left unhandled to be said. */
const settle = async () => {
  for (let i = 0; i < 8; i++) await wait(5);
};

let zone: ReturnType<typeof installZonePromises>;
const handles: ViewerHandle[] = [];
beforeEach(() => {
  zone = installZonePromises();
});
afterEach(() => {
  zone.restore();
  for (const handle of handles.splice(0)) handle.destroy();
  document.body.replaceChildren();
});
const said = () => zone.said.map((reason) => (reason as Error)?.message ?? String(reason));

async function mount(options: Partial<ViewerOptions>) {
  const host = document.createElement('div');
  document.body.append(host);
  const handle = mountViewer(host, { page: order, dataSource: createMemoryDataSource({ records: records() }), recordId: 7, ...options });
  handles.push(handle);
  await handle.drawn;
  await handle.form.settled();
  await settle();
  return { host, handle };
}

const at = (host: HTMLElement, node: string) => host.querySelector(`[data-node="${node}"]`) as HTMLElement;
const toasts = (host: HTMLElement) => [...host.querySelectorAll('.fd-say > span')].map((span) => span.textContent);
const dialog = () => document.querySelector('[role="dialog"]') as HTMLElement | null;
const button = (scope: Element, words: string) => [...scope.querySelectorAll('button')].find((b) => b.textContent === words || b.getAttribute('aria-label') === words) as HTMLButtonElement | undefined;

/** The app's pages: the customer's by its model as `answer` gives it (once, or each time), the rest as they are. */
function pagesOf(answer: () => Promise<Page | null> | Page | null) {
  const asked: string[] = [];
  const pages = (request: PageRequest) => {
    asked.push('model' in request ? request.model : request.id);
    return 'model' in request && request.model === 'partner' ? answer() : null;
  };
  return { pages, asked };
}

describe('a link whose record’s page cannot come', () => {
  it.each(FAILS)('%s: the link is drawn with its Open, and nothing is left unhandled', async (_, answer) => {
    const { pages } = pagesOf(answer);
    const { host } = await mount({ pages });
    expect(at(host, 'f-client').querySelector('input')?.value).toBe('Nile Traders');
    // Asked as the link is drawn, to know it opens: a page still coming counts.
    expect(button(at(host, 'f-client'), 'Open Nile Traders')?.hidden).toBe(false);
    expect(said()).toEqual([]);
  });

  it.each(FAILS)('%s: Open says why, opens nothing, and asks again when pressed again', async (_, answer) => {
    let fails = true;
    const { pages, asked } = pagesOf(() => (fails ? answer() : partner));
    const { host } = await mount({ pages });
    const open = button(at(host, 'f-client'), 'Open Nile Traders')!;
    const before = asked.length;
    open.click();
    await settle();
    expect(dialog()).toBeNull();
    expect(toasts(host)).toEqual(['Couldn’t open record Nile Traders: part of this page could not load']);
    expect(said()).toEqual([]);
    // Pressed again, the app is asked again: it has the page now, and the record opens.
    fails = false;
    open.click();
    await settle();
    expect(asked.length).toBeGreaterThan(before + 1);
    expect(!!dialog()?.querySelector('[data-node="p-name"] input')).toBe(true);
    expect(said()).toEqual([]);
  });

  it.each(FAILS)('%s: a tag’s Open says why too, and nothing is left unhandled', async (_, answer) => {
    const { pages } = pagesOf(answer);
    const { host } = await mount({ pages });
    button(at(host, 'f-tags'), 'Open Delta Foods')!.click();
    await settle();
    expect(dialog()).toBeNull();
    expect(toasts(host)).toEqual(['Couldn’t open record Delta Foods: part of this page could not load']);
    expect(said()).toEqual([]);
  });

  it('the dialogs’ own Open, for every widget that asks it: null, said — a record by its name or the name typed, a new one as a form', async () => {
    const told: string[] = [];
    const dialogs = pageDialogs({ page: order, pages: () => Promise.reject(new Error(FAILED)) }, (message) => told.push(message));
    await expect(dialogs.openRecord('partner', { recordId: 1, title: 'Nile Traders' })).resolves.toBeNull();
    await expect(dialogs.openRecord('partner', { name: 'Hilton Cairo', title: 'Client' })).resolves.toBeNull();
    await expect(dialogs.openRecord('partner', { title: 'New customer' })).resolves.toBeNull();
    expect(told).toEqual(['Couldn’t open record Nile Traders: part of this page could not load', 'Couldn’t open record Hilton Cairo: part of this page could not load', 'This form could not be loaded.']);
    await settle();
    expect(said()).toEqual([]);
  });

  it('a page the viewer refuses opens a box with its words, which × and Escape close; nothing left unhandled', async () => {
    // The record's page has a mistake the check before the draw refuses (0.35's): its words where the form would be.
    const broken = { ...partner, layout: { type: 'sections', id: 's', children: [{ type: 'field', id: 'p-x', field: 'nowhere' }] } } as unknown as Page;
    const dialogs = pageDialogs({ page: order, pages: () => broken });
    for (const key of ['×', 'Escape']) {
      const opened = dialogs.openRecord('partner', { recordId: 1, title: 'Nile Traders' });
      await settle();
      const box = dialog() as HTMLElement;
      expect(box.textContent).toContain('This form cannot be shown: its page has mistakes.');
      if (key === '×') (box.querySelector('.fd-dialog-close') as HTMLButtonElement).click();
      else box.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await expect(opened).resolves.toBeNull();
      expect(dialog()).toBeNull();
    }
    await settle();
    expect(said()).toEqual([]);
  });

  it('a page that comes later as the zone’s promise or the engine’s own opens alike', async () => {
    for (const later of [() => Promise.resolve(partner), async () => partner]) {
      const { pages } = pagesOf(later);
      const { host, handle } = await mount({ pages });
      button(at(host, 'f-client'), 'Open Nile Traders')!.click();
      await settle();
      expect(!!dialog()?.querySelector('[data-node="p-name"] input')).toBe(true);
      dialog()!.querySelector<HTMLButtonElement>('.fd-dialog-close')!.click();
      await settle();
      handle.destroy();
    }
    expect(said()).toEqual([]);
  });
});

/** A customer with its invoices in a related list, which open in the app's page for an invoice. */
const invoices = { type: 'related', id: 'invoices', title: 'Invoices', model: 'invoice', field: 'partner_id', fields: { name: { type: 'char', label: 'Number' }, partner_id: { type: 'many2one', label: 'Customer', relation: 'partner' } }, columns: ['name'] };
const customer = (related: Record<string, unknown> = {}) =>
  ({ ...partner, id: 'customer', layout: { type: 'sheet', id: 'sheet', title: { field: 'name' }, children: [{ ...invoices, ...related }] } }) as unknown as Page;
const invoicePage = { fieldia: '0.13', id: 'invoice', title: 'Invoice', data: { kind: 'record', model: 'invoice' }, records: { one: 'invoice', other: 'invoices' }, fields: invoices.fields, layout: { type: 'sections', id: 's', children: [{ type: 'field', id: 'i-name', field: 'name' }] } } as unknown as Page;

async function customerWith(answer: () => Promise<Page | null> | Page | null, options: Partial<ViewerOptions> = {}, related: Record<string, unknown> = {}) {
  const asked: string[] = [];
  const pages = (request: PageRequest) => (asked.push('model' in request ? request.model : request.id), 'model' in request && request.model === 'invoice' ? answer() : null);
  const view = await mount({ page: customer(related), recordId: 1, pages, ...options });
  for (let i = 0; i < 20 && !view.host.querySelector('[data-node="invoices"] .fd-list-row'); i++) await wait(5);
  return { ...view, asked };
}
const listed = (host: HTMLElement) => at(host, 'invoices');

describe('a related list whose records’ page cannot come', () => {
  it.each(FAILS)('%s: a row pressed says why, and nothing is left unhandled', async (_, answer) => {
    const { host } = await customerWith(answer);
    listed(host).querySelector<HTMLElement>('.fd-list-row')!.click();
    await settle();
    expect(dialog()).toBeNull();
    expect(toasts(host)).toEqual(['Couldn’t open record INV/1: part of this page could not load']);
    expect(said()).toEqual([]);
  });

  it.each(FAILS)('%s: New says why, and nothing is left unhandled', async (_, answer) => {
    const { host } = await customerWith(answer);
    button(listed(host), 'New')!.click();
    await settle();
    expect(dialog()).toBeNull();
    expect(toasts(host)).toEqual(['This form could not be loaded.']);
    expect(button(listed(host), 'New')!.hasAttribute('aria-busy')).toBe(false);
    expect(said()).toEqual([]);
  });

  it.each(FAILS)('%s: the app’s own way (`open: "app"`) is asked all the same, with the model’s name for the page', async (_, answer) => {
    const opened: OpenRequest[] = [];
    const onOpen = (request: OpenRequest): Promise<OpenResult> => (opened.push(request), Promise.resolve({ saved: false, recordId: null, values: {} }));
    const { host } = await customerWith(answer, { onOpen }, { open: 'app' });
    listed(host).querySelector<HTMLElement>('.fd-list-row')!.click();
    await settle();
    button(listed(host), 'New')!.click();
    await settle();
    expect(opened.map((request) => [request.page, request.recordId ?? null])).toEqual([['invoice', 11], ['invoice', null]]);
    expect(said()).toEqual([]);
  });

  it('its records are named by their page’s words where the page comes later as the engine’s own promise', async () => {
    const { host } = await customerWith(async () => invoicePage);
    await settle();
    expect(button(listed(host), 'New invoice')).toBeDefined();
    expect(said()).toEqual([]);
  });
});

describe('a saved form placed in another', () => {
  const address = { fieldia: '0.13', id: 'address', title: 'Address', data: { kind: 'responses' }, fields: { street: { type: 'char', label: 'Street' } }, layout: { type: 'sections', id: 'a', children: [{ type: 'field', id: 'a-street', field: 'street' }] } } as unknown as Page;
  const outer = { fieldia: '0.13', id: 'delivery', title: 'Delivery', data: { kind: 'responses' }, fields: { name: { type: 'char', label: 'Name' } }, layout: { type: 'sections', id: 'root', children: [{ type: 'field', id: 'd-name', field: 'name' }, { type: 'form', id: 'home', page: 'address', name: 'home' }] } } as unknown as Page;

  it.each([
    ['the zone’s promise', () => Promise.resolve(address)],
    ['the engine’s own promise', async () => address],
  ] as [string, () => Promise<Page>][])('its page answered later as %s is drawn', async (_, answer) => {
    const host = document.createElement('div');
    document.body.append(host);
    handles.push(mountViewer(host, { page: outer, pages: (request) => ('id' in request && request.id === 'address' ? answer() : null) }));
    await settle();
    expect(!!at(host, 'home').querySelector('[data-node="a-street"] input')).toBe(true);
    expect(said()).toEqual([]);
  });
});

describe('the pager’s next record, which the app cannot give', () => {
  it.each([
    ['refused at once', () => Promise.reject(new Error('The server did not answer'))],
    ['refused later', () => new Promise<RecordId>((_, reject) => setTimeout(() => reject(new Error('The server did not answer')), 5))],
    ['the engine’s own promise, refused', async () => {
      throw new Error('The server did not answer');
    }],
  ] as [string, () => Promise<RecordId>][])('%s: Next says why in the app’s words, the record stays, and Next asks again', async (_, refuse) => {
    let fails = true;
    const asked: number[] = [];
    const id = (place: number) => (asked.push(place), fails ? refuse() : Promise.resolve(8));
    const { host, handle } = await mount({ records: { total: 3, at: 0, id } });
    const next = host.querySelector('.fd-record-pager .fd-record-step:last-of-type') as HTMLButtonElement;
    next.click();
    await settle();
    expect(handle.form.getState().recordId).toBe(7);
    expect(toasts(host)).toEqual(['The server did not answer']);
    expect(said()).toEqual([]);
    fails = false;
    next.click();
    await settle();
    expect(asked).toEqual([1, 1]);
    expect(handle.form.getState().recordId).toBe(8);
    expect(said()).toEqual([]);
  });
});
