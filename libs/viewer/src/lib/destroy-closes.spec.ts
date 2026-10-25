import { createMemoryDataSource, type LayoutNode, type Page } from '@fieldia/core';
import { mountViewer, type ViewerHandle } from './viewer';
import { pageDialogs } from './related';

/**
 * A viewer taken away (`destroy()`) takes with it what it opened: a page's dialog, its side panel, a page opened in its
 * place, a related record's dialog, a Search more… list — each closed as not saved, nothing asked (the app took the
 * page away). 0.32 left them open on the body with their own keys and live subscriptions until the person closed them
 * (the performance audit's L2).
 */

const until = async (check: () => unknown) => {
  for (let waited = 0; !check() && waited < 2000; waited += 10) await new Promise((resolve) => setTimeout(resolve, 10));
};
const field = (id: string, name: string): LayoutNode => ({ type: 'field', id, field: name });

const order: Page = {
  fieldia: '0.13',
  id: 'order',
  title: 'Quick order',
  data: { kind: 'record', model: 'shop.order' },
  fields: { caller: { type: 'char', label: 'Caller' } },
  layout: { type: 'sections', id: 'root', children: [{ type: 'section', id: 's', children: [field('f-caller', 'caller')] }] },
} as Page;
const customer: Page = {
  fieldia: '0.13',
  id: 'new-customer',
  title: 'New customer',
  data: { kind: 'record', model: 'partner' },
  fields: { name: { type: 'char', label: 'Name' } },
  layout: { type: 'sections', id: 'root', children: [{ type: 'section', id: 's', children: [field('c-name', 'name')] }] },
} as Page;

let host: HTMLElement;
let handle: ViewerHandle | null = null;
beforeEach(() => {
  document.body.replaceChildren();
  host = document.createElement('div');
  document.body.append(host);
});
afterEach(() => handle?.destroy());

describe('a viewer taken away', () => {
  it.each(['dialog', 'panel'] as const)('closes the %s its page opened, as not saved', async (as) => {
    handle = mountViewer(host, { page: order, dataSource: createMemoryDataSource(), pages: { 'new-customer': customer } });
    const ran = handle.run([{ do: 'open', page: 'new-customer', as }]);
    await until(() => document.querySelector('.fd-form-dialog'));
    expect(document.querySelectorAll('.fd-form-dialog [data-node="c-name"]')).toHaveLength(1);
    handle.destroy();
    handle = null;
    expect(document.querySelector('.fd-form-dialog, .fd-dialog-backdrop')).toBeNull();
    // The steps waiting on it end: nothing was saved.
    await expect(ran).resolves.toBeDefined();
  });

  it('takes a page opened in its place with it', async () => {
    handle = mountViewer(host, { page: order, dataSource: createMemoryDataSource(), pages: { 'new-customer': customer } });
    void handle.run([{ do: 'open', page: 'new-customer', as: 'page' }]);
    await until(() => host.querySelector('[data-node="c-name"]'));
    expect(host.querySelector('[data-node="c-name"]')).not.toBeNull();
    handle.destroy();
    handle = null;
    expect(host.querySelector('[data-node]')).toBeNull();
  });

  it('closes a related record’s dialog and a Search more… list it opened', async () => {
    const controller = new AbortController();
    const dialogs = pageDialogs({ page: order, dataSource: createMemoryDataSource(), relatedPages: { partner: customer } }, undefined, controller.signal);
    const opened = dialogs.openRecord?.('partner', { title: 'New customer' });
    const searched = dialogs.searchMore?.({ title: 'Customers', search: async () => [] });
    await until(() => document.querySelectorAll('.fd-form-dialog').length === 2);
    expect(document.querySelectorAll('.fd-form-dialog')).toHaveLength(2);
    controller.abort();
    expect(document.querySelector('.fd-form-dialog, .fd-dialog-backdrop')).toBeNull();
    await expect(opened).resolves.toBeNull();
    await expect(searched).resolves.toBeNull();
  });
});
