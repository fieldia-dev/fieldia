import { createMemoryDataSource, type ActionRequest, type OpenRequest, type Page, type RecordId } from '@fieldia/core';
import { createWidget, lazyPart, partFactory, type WidgetFactory } from '@fieldia/widgets';
import { installZonePromises } from '../../../../testing/zone-promises';
import type { ListViewContext, ListViewFactory, ListViewPart } from './list';
import type { PageRequest } from './related';
import { mountViewer, type ViewerHandle, type ViewerOptions } from './viewer';

/**
 * Every promise Fieldia is given by the app is handled the moment it is given — never when Fieldia first awaits it — so
 * one the app refused at once, or had refused already, is never said unhandled by a zone that watches its own promises:
 * Angular's, which tells `NgZone.onError` (FU2 on 0.36.1: a linked record's page whose request had failed already when
 * Open was pressed). The zone looks at a promise refused in its drain before any job of the engine's queued after it —
 * a native `await`'s: Fieldia's own code, which Angular did not compile (testing/zone-promises.ts). Each kind the app
 * gives: the page loader, a call step's `onAction`, an open step's `onOpen`, the app's `confirm`, the pager's ids, the
 * parts its widgets come in, a list row's `onOpenRecord`. Each is told where a person asked, and can be asked again.
 */

const customer = {
  fieldia: '0.13',
  id: 'customer',
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
  fields: { name: { type: 'char', label: 'Order' }, client_id: { type: 'many2one', label: 'Client', relation: 'partner' } },
  layout: { type: 'sections', id: 's', children: [{ type: 'field', id: 'f-name', field: 'name' }, { type: 'field', id: 'f-client', field: 'client_id' }] },
} as unknown as Page;

const records = () => ({
  partner: { 1: { name: 'Nile Traders' } },
  'sale.order': { 7: { name: 'S00007', client_id: { id: 1, label: 'Nile Traders' } }, 8: { name: 'S00008', client_id: null } },
});

const wait = (ms = 0) => new Promise((done) => setTimeout(done, ms));
/** Long enough for anything left unhandled to be said. */
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

/** The app's refusals: made at once, as it is asked; or made before it was asked, in an earlier turn, and kept. */
const FAILED = 'The server did not answer';
const atOnce = <T>() => Promise.reject(new Error(FAILED)) as Promise<T>;
async function already<T>(): Promise<() => Promise<T>> {
  const kept = Promise.reject(new Error(FAILED)) as Promise<T>;
  // Its first asker handled it, as the app's cache had it handled (a link drawn asks whether its page comes).
  kept.then(undefined, () => undefined);
  await settle();
  return () => kept;
}
const KINDS: [string, () => Promise<<T>() => Promise<T>>][] = [
  ['refused as it is asked', async () => atOnce],
  ['refused already, before it was asked', async () => (await already()) as <T>() => Promise<T>],
];

describe('the page loader', () => {
  it.each(KINDS)('%s: Open on a link says why, opens nothing, leaves nothing unhandled, and asks again', async (_, made) => {
    const refuse = await made();
    let fails = true;
    const pages = (request: PageRequest) => ('model' in request && request.model === 'partner' ? (fails ? refuse<Page>() : customer) : null);
    const { host } = await mount({ pages });
    const open = button(at(host, 'f-client'), 'Open Nile Traders')!;
    open.click();
    await settle();
    expect(dialog()).toBeNull();
    expect(toasts(host)).toEqual(['Couldn’t open record Nile Traders: part of this page could not load']);
    expect(said()).toEqual([]);
    fails = false;
    open.click();
    await settle();
    expect(!!dialog()?.querySelector('[data-node="p-name"] input')).toBe(true);
    expect(said()).toEqual([]);
  });
});

describe('the app’s steps', () => {
  it.each(KINDS)('%s: a call step’s onAction says why, and leaves nothing unhandled', async (_, made) => {
    const refuse = await made();
    const asked: ActionRequest[] = [];
    const { handle } = await mount({ onAction: (request) => (asked.push(request), refuse()) });
    const result = await handle.run([{ do: 'call', action: 'price' }]);
    await settle();
    expect(asked.map((request) => request.action)).toEqual(['price']);
    expect([result.done, result.message]).toEqual([false, FAILED]);
    expect(said()).toEqual([]);
  });

  it.each(KINDS)('%s: an open step’s onOpen, the app’s own way, says why, and leaves nothing unhandled', async (_, made) => {
    const refuse = await made();
    const asked: OpenRequest[] = [];
    const { handle } = await mount({ onOpen: (request) => (asked.push(request), refuse()) });
    const result = await handle.run([{ do: 'open', page: 'customer' }]);
    await settle();
    expect(asked.map((request) => request.page)).toEqual(['customer']);
    expect([result.done, result.message]).toEqual([false, FAILED]);
    expect(said()).toEqual([]);
  });

  it.each(KINDS)('%s: the app’s confirm, asked by an ask step, stops the steps, and leaves nothing unhandled', async (_, made) => {
    const refuse = await made();
    const { handle } = await mount({ confirm: () => refuse<boolean>() });
    const result = await handle.run([{ do: 'ask', message: 'Price it?' }, { do: 'say', message: 'never' }]);
    await settle();
    expect(result.done).toBe(false);
    expect(said()).toEqual([]);
  });
});

describe('the pager’s ids', () => {
  it.each(KINDS)('%s: Next says why, the record stays, nothing is left unhandled, and Next asks again', async (_, made) => {
    const refuse = await made();
    let fails = true;
    const asked: number[] = [];
    const id = (place: number) => (asked.push(place), fails ? refuse<RecordId>() : Promise.resolve(8));
    const { host, handle } = await mount({ records: { total: 3, at: 0, id } });
    const next = host.querySelector('.fd-record-pager .fd-record-step:last-of-type') as HTMLButtonElement;
    next.click();
    await settle();
    expect(handle.form.getState().recordId).toBe(7);
    expect(toasts(host)).toEqual([FAILED]);
    expect(said()).toEqual([]);
    fails = false;
    next.click();
    await settle();
    expect(handle.form.getState().recordId).toBe(8);
    expect(said()).toEqual([]);
  });
});

describe('a widget the app gives in a part of its own', () => {
  it.each(KINDS)('%s: its field is drawn plainly, and nothing is left unhandled', async (_, made) => {
    const refuse = await made();
    let loads = 0;
    const part = lazyPart<{ widget: WidgetFactory }>('app-badge', () => (loads++, refuse()));
    const plain: WidgetFactory = (context) => createWidget(context, {});
    const page = { ...order, layout: { type: 'sections', id: 's', children: [{ type: 'field', id: 'f-name', field: 'name', widget: 'badge-of-app' }] } } as unknown as Page;
    const { host } = await mount({ page, widgets: { 'char.badge-of-app': partFactory(part, (module) => module.widget, plain) } });
    expect(loads).toBeGreaterThan(0);
    expect((at(host, 'f-name').querySelector('input') as HTMLInputElement | null)?.value).toBe('S00007');
    expect(said()).toEqual([]);
  });
});

describe('a list row the app opens', () => {
  const orders = {
    fieldia: '0.13',
    id: 'orders',
    title: 'Orders',
    data: { kind: 'record', model: 'sale.order' },
    fields: { name: { type: 'char', label: 'Order' } },
    layout: { type: 'list', id: 'l', columns: ['name'] },
  } as unknown as Page;

  it.each(KINDS)('%s: onOpenRecord’s answer handled, the list as it was, nothing left unhandled', async (_, made) => {
    const refuse = await made();
    const opened: RecordId[] = [];
    const { host } = await mount({ page: orders, recordId: undefined, onOpenRecord: (id) => (opened.push(id), refuse()) });
    (host.querySelector('.fd-list-row[data-id="7"]') as HTMLElement).click();
    await settle();
    expect(opened).toEqual([7]);
    expect(host.querySelectorAll('.fd-list-row')).toHaveLength(2);
    expect(said()).toEqual([]);
  });
});

describe('a new record the app makes from a list’s view', () => {
  it.each(KINDS)('%s: onNewRecord’s answer handled, the records asked for again, nothing left unhandled', async (_, made) => {
    const refuse = await made();
    const contexts: ListViewContext[] = [];
    const calendar = Object.assign((context: ListViewContext): ListViewPart => {
      contexts.push(context);
      return { element: document.createElement('div'), reload: async () => undefined, highlight: () => undefined, chosenChanged: () => undefined, shown: () => undefined, destroy: () => undefined };
    }, { label: () => 'Calendar' }) as ListViewFactory;
    const orders = {
      fieldia: '0.13',
      id: 'orders',
      title: 'Orders',
      data: { kind: 'record', model: 'sale.order' },
      fields: { name: { type: 'char', label: 'Order' }, on: { type: 'date', label: 'Order date' } },
      layout: { type: 'list', id: 'l', columns: ['name'], calendar: { start: 'on', title: 'name' } },
    } as unknown as Page;
    const asked: unknown[] = [];
    const { host } = await mount({ page: orders, recordId: undefined, listViews: { calendar }, onNewRecord: (values) => (asked.push(values), refuse()) });
    ([...host.querySelectorAll('.fd-list-views button')].find((b) => b.textContent === 'Calendar') as HTMLButtonElement).click();
    await settle();
    await contexts[0].create?.({ on: '2026-10-14' });
    await settle();
    expect(asked).toEqual([{ on: '2026-10-14' }]);
    expect(said()).toEqual([]);
  });
});
