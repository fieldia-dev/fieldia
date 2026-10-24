import type { DataSource, ListRequest, LoadRequest, Page } from '@fieldia/core';
import { listPart } from './viewer-parts';
import { mountViewer, type ViewerHandle } from './viewer';

/**
 * One deadline, one wait (0.34: harden-data's request deadline over 0.33's waits). Every request the viewer makes of
 * its source — a list's rows, its early first page asked beside its part, a record's load — goes through the one
 * deadline (`timeout`, deadline.ts): past it, the request is told to stop and its wait ends as failed, said once in its
 * place with its Retry, which asks again; never a loader left running, never two messages. A wait's own
 * `loading.timeout` ends the loader the same way, sooner where it is shorter, and the request it was waiting for is
 * told to stop with it (a list's); the deadline passing after says nothing more. In a `-lazy` file: the list part is
 * not in before the first test, so its first request is the early one.
 */

const customers: Page = {
  fieldia: '0.13',
  id: 'customers',
  title: 'Customers',
  records: { one: 'customer', other: 'customers' },
  data: { kind: 'record', model: 'partner' },
  fields: { name: { type: 'char', label: 'Name' } },
  layout: { type: 'list', id: 'people', columns: ['name'], sort: [{ field: 'name' }], pageSize: 20 },
} as unknown as Page;
const customer: Page = {
  fieldia: '0.13',
  id: 'customer',
  title: 'Customer',
  records: { one: 'customer', other: 'customers' },
  data: { kind: 'record', model: 'partner' },
  fields: { name: { type: 'char', label: 'Name' } },
  layout: { type: 'sections', id: 'root', children: [{ type: 'field', id: 'f-name', field: 'name' }] },
} as unknown as Page;

const handles: ViewerHandle[] = [];
afterEach(() => {
  for (const handle of handles.splice(0)) handle.destroy();
  document.body.replaceChildren();
});
const flush = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms));
const until = async (check: () => unknown) => {
  for (let waited = 0; !check() && waited < 3000; waited += 10) await flush(10);
};
const visible = (el: Element | null) => !!el && !el.closest('[hidden]');
const retries = (host: Element) => [...host.querySelectorAll('button')].filter((b) => visible(b) && b.textContent?.trim() === 'Retry');
/** What says a wait failed, wherever: a list's sentence, a wait's own box, a banner, a toast. */
const alerts = (host: Element) => [...document.querySelectorAll('[role="alert"]')].filter((one) => visible(one) && one.textContent?.trim() && !one.classList.contains('fd-announce') && (host.contains(one) || one.closest('.fd-says')));
/** A loader still drawn, or a region still busy: a wait left running. */
const running = (host: Element) => host.querySelectorAll('.fd-loader:not([data-way="failed"]), [aria-busy="true"]').length;

const never = <T,>(): Promise<T> => new Promise<T>(() => undefined);
const mount = (page: Page, dataSource: DataSource, more: Record<string, unknown> = {}) => {
  const host = document.createElement('div');
  document.body.append(host);
  handles.push(mountViewer(host, { page, dataSource, ...more }));
  return host;
};

describe('a list’s request past its deadline', () => {
  it('ends its wait as failed, said once with Retry — its early first page too, asked before the part came — and Retry asks again', async () => {
    expect(listPart.loaded).toBeUndefined();
    const asked: { request: ListRequest; partIn: boolean }[] = [];
    let answering = false;
    const source: DataSource = {
      list: (request) => {
        asked.push({ request, partIn: !!listPart.loaded });
        return answering ? Promise.resolve({ records: [{ id: 1, values: { name: 'Nile Traders' } }], total: 1 }) : never();
      },
    };
    const host = mount(customers, source, { timeout: 80 });
    await until(() => host.querySelector('.fd-list-failed:not([hidden])'));
    // The first page asked for before the list's part had come: the early one, under the same deadline, told to stop.
    expect(asked).toHaveLength(1);
    expect(asked[0].partIn).toBe(false);
    expect((asked[0].request as { signal?: AbortSignal }).signal?.aborted).toBe(true);
    const failed = host.querySelector('.fd-list-failed') as HTMLElement;
    expect(failed.textContent).toContain('Could not load the customers. The server did not answer in time');
    expect(alerts(host)).toHaveLength(1);
    expect(retries(host)).toHaveLength(1);
    expect(running(host)).toBe(0);
    // Retry asks again, as any list's request: answered, drawn.
    answering = true;
    retries(host)[0].click();
    await until(() => host.querySelector('.fd-list-row'));
    expect(asked).toHaveLength(2);
    expect(host.querySelector('.fd-list-row')?.textContent).toContain('Nile Traders');
    expect(alerts(host)).toHaveLength(0);
    expect(running(host)).toBe(0);
  });

  it('with a shorter loading timeout: the loader ends first, the request told to stop with it; the deadline after says nothing more', async () => {
    const asked: ListRequest[] = [];
    const host = mount(customers, { list: (request) => (asked.push(request), never()) }, { timeout: 200, loading: { timeout: 40 } });
    await until(() => host.querySelector('.fd-list-failed:not([hidden])'));
    expect(host.querySelector('.fd-list-failed')?.textContent).toContain('Could not load the customers. It took too long.');
    expect((asked[0] as { signal?: AbortSignal }).signal?.aborted).toBe(true);
    // Past the deadline as well: still the one message, the one Retry, nothing running.
    await flush(260);
    expect(host.querySelector('.fd-list-failed')?.textContent).toContain('It took too long.');
    expect(alerts(host)).toHaveLength(1);
    expect(retries(host)).toHaveLength(1);
    expect(running(host)).toBe(0);
  });
});

describe('a record’s load past its deadline', () => {
  it('ends its wait as failed, said once in its place in its own words with Retry, which loads it', async () => {
    let answering = false;
    const loads: LoadRequest[] = [];
    const source: DataSource = { load: (request) => (loads.push(request), answering ? Promise.resolve({ name: 'Nile Traders' }) : never()), save: async () => ({ id: 7 }) };
    const host = mount(customer, source, { recordId: 7, timeout: 80 });
    await until(() => host.querySelector('.fd-loader[data-way="failed"]'));
    expect((loads[0] as { signal?: AbortSignal }).signal?.aborted).toBe(true);
    const failed = host.querySelector('.fd-loader[data-way="failed"]') as HTMLElement;
    expect(failed.querySelector('.fd-loader-words')?.textContent).toBe('This customer could not be loaded: The server did not answer in time');
    expect(alerts(host)).toHaveLength(1);
    expect(retries(host)).toHaveLength(1);
    expect(running(host)).toBe(0);
    answering = true;
    retries(host)[0].click();
    await until(() => (host.querySelector('[data-node="f-name"] input') as HTMLInputElement | null)?.value === 'Nile Traders');
    expect(loads).toHaveLength(2);
    expect(host.querySelector('.fd-loader[data-way="failed"]')).toBeNull();
    expect(running(host)).toBe(0);
  });

  it('with a shorter loading timeout: said once as it took too long; the deadline after adds no second message', async () => {
    const host = mount(customer, { load: () => never(), save: async () => ({ id: 7 }) }, { recordId: 7, timeout: 200, loading: { timeout: 40 } });
    await until(() => host.querySelector('.fd-loader[data-way="failed"]'));
    expect(host.querySelector('.fd-loader[data-way="failed"] .fd-loader-words')?.textContent).toBe('Couldn’t load. It took too long.');
    await flush(260);
    // Core knows the request ended (`loadProblem`); the page says it once, where it was said.
    expect(handles[0].form.getState().loadProblem?.message).toBe('This customer could not be loaded: The server did not answer in time');
    expect(alerts(host)).toHaveLength(1);
    expect(retries(host)).toHaveLength(1);
    expect(running(host)).toBe(0);
  });
});
