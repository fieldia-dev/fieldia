import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { CDPSession, Page } from '@playwright/test';
import { expect, test } from './fixtures';

/**
 * Mounted and taken away twenty times, Fieldia leaves nothing behind: no element, no listener — on its own elements or
 * on the window and the document — no observer, no timer, no data source subscription, no IndexedDB connection. A
 * record with tabs, a list, an editable list with a cell open, a page kept without signal (its outbox in IndexedDB),
 * a page that opened a dialog, and the screen editor with a menu open. Counted after two forced garbage collections,
 * by the browser (Chromium's DOM counters) and by counters put round the browser's own constructors before any page
 * code runs. 0.32 left an IndexedDB connection per mount open, and a dialog the viewer opened alive after it (the
 * performance audit's M7 and L2).
 */

test.skip(({ browserName }) => browserName !== 'chromium', 'the DOM counters are Chromium’s (DevTools protocol)');
test.describe.configure({ mode: 'serial' });

const CYCLES = 20;
const pageJson = (name: string) => JSON.parse(readFileSync(join(__dirname, '..', 'examples', 'pages', `${name}.page.json`), 'utf8'));

/** In the page before its own code: what is live, counted as it is made and let go. */
function counters() {
  const live = { observers: 0, intervals: 0, timeouts: 0, winListeners: 0, docListeners: 0, idbOpen: 0, idbClosed: 0 };
  (window as unknown as { __live: typeof live }).__live = live;
  for (const name of ['ResizeObserver', 'IntersectionObserver', 'MutationObserver'] as const) {
    const Real = window[name] as unknown as { new (...args: never[]): { observe(...a: unknown[]): void; disconnect(): void } };
    if (!Real) continue;
    const observing = new WeakSet<object>();
    (window as unknown as Record<string, unknown>)[name] = class extends Real {
      observe(...args: unknown[]) {
        if (!observing.has(this)) (observing.add(this), live.observers++);
        return super.observe(...args);
      }
      disconnect() {
        if (observing.has(this)) (observing.delete(this), live.observers--);
        return super.disconnect();
      }
    };
  }
  const intervals = new Set<unknown>();
  const [setI, clearI] = [window.setInterval, window.clearInterval];
  window.setInterval = ((...args: Parameters<typeof setInterval>) => {
    const id = setI(...args);
    intervals.add(id);
    live.intervals = intervals.size;
    return id;
  }) as typeof setInterval;
  window.clearInterval = ((id?: number) => {
    intervals.delete(id);
    live.intervals = intervals.size;
    clearI(id);
  }) as typeof clearInterval;
  const timeouts = new Set<unknown>();
  const [setT, clearT] = [window.setTimeout, window.clearTimeout];
  window.setTimeout = ((fn: TimerHandler, ms?: number, ...rest: unknown[]) => {
    const id: number = setT(
      (...args: unknown[]) => {
        timeouts.delete(id);
        live.timeouts = timeouts.size;
        if (typeof fn === 'function') (fn as (...a: unknown[]) => void)(...args);
      },
      ms,
      ...rest
    );
    timeouts.add(id);
    live.timeouts = timeouts.size;
    return id;
  }) as typeof setTimeout;
  window.clearTimeout = ((id?: number) => {
    timeouts.delete(id);
    live.timeouts = timeouts.size;
    clearT(id);
  }) as typeof clearTimeout;
  // Weakly held: the count must never be what keeps a listener, and what it closes over, alive.
  const count = (target: EventTarget, key: 'winListeners' | 'docListeners') => {
    const [add, remove] = [target.addEventListener, target.removeEventListener];
    const seen = new WeakMap<object, Set<string>>();
    const keyOf = (type: string, options?: boolean | AddEventListenerOptions) => `${type}|${typeof options === 'boolean' ? options : !!options?.capture}`;
    target.addEventListener = function (this: EventTarget, type: string, fn: EventListenerOrEventListenerObject | null, options?: boolean | AddEventListenerOptions) {
      if (fn) {
        let made = seen.get(fn);
        if (!made) seen.set(fn, (made = new Set()));
        const k = keyOf(type, options);
        if (!made.has(k)) (made.add(k), live[key]++);
        if (typeof options === 'object' && options.signal) options.signal.addEventListener('abort', () => seen.get(fn)?.delete(k) && live[key]--);
      }
      return add.call(this, type, fn, options);
    };
    target.removeEventListener = function (this: EventTarget, type: string, fn: EventListenerOrEventListenerObject | null, options?: boolean | EventListenerOptions) {
      if (fn && seen.get(fn)?.delete(keyOf(type, options))) live[key]--;
      return remove.call(this, type, fn, options);
    };
  };
  count(window, 'winListeners');
  count(document, 'docListeners');
  const open = IDBFactory.prototype.open;
  IDBFactory.prototype.open = function (this: IDBFactory, ...args: Parameters<IDBFactory['open']>) {
    const request = open.apply(this, args);
    request.addEventListener('success', () => live.idbOpen++);
    return request;
  };
  const close = IDBDatabase.prototype.close;
  IDBDatabase.prototype.close = function (this: IDBDatabase) {
    live.idbClosed++;
    return close.call(this);
  };
}

interface Snapshot {
  nodes: number;
  listeners: number;
  observers: number;
  intervals: number;
  timeouts: number;
  winListeners: number;
  docListeners: number;
  idbOpen: number;
  subscriptions: number;
}

async function snapshot(page: Page, cdp: CDPSession): Promise<Snapshot> {
  // Whatever waits a moment (a toast's, a press's) has had it.
  await page.waitForTimeout(700);
  await cdp.send('HeapProfiler.collectGarbage');
  await cdp.send('HeapProfiler.collectGarbage');
  const dom = await cdp.send('Memory.getDOMCounters');
  const live = await page.evaluate(() => {
    const own = (window as unknown as { __live: Record<string, number>; __subscriptions?: number }).__live;
    return { ...own, idbOpen: own['idbOpen'] - own['idbClosed'], subscriptions: (window as unknown as { __subscriptions?: number }).__subscriptions ?? 0 };
  });
  return { nodes: dom.nodes, listeners: dom.jsEventListeners, observers: live['observers'], intervals: live['intervals'], timeouts: live['timeouts'], winListeners: live['winListeners'], docListeners: live['docListeners'], idbOpen: live['idbOpen'], subscriptions: live['subscriptions'] };
}

/** What is left, per kind, after `cycles` more mounts than the warm-up's: nothing. */
async function leftAfter(page: Page, cdp: CDPSession, cycle: (n: number) => Promise<void>) {
  // Two warm-up cycles: the parts in, their sheets installed, the document's one watch on presses made.
  await cycle(-2);
  await cycle(-1);
  const before = await snapshot(page, cdp);
  for (let n = 0; n < CYCLES; n++) await cycle(n);
  const after = await snapshot(page, cdp);
  return Object.fromEntries(Object.keys(before).map((key) => [key, after[key as keyof Snapshot] - before[key as keyof Snapshot]]));
}

const NOTHING = { nodes: 0, listeners: 0, observers: 0, intervals: 0, timeouts: 0, winListeners: 0, docListeners: 0, idbOpen: 0, subscriptions: 0 };

/** The one-tag script's page, a source counting its subscriptions, and a viewer mounted and taken away on demand. */
async function scriptPage(page: Page) {
  await page.addInitScript(counters);
  await page.goto('/script/');
  await page.waitForFunction(() => (window as unknown as { fieldiaDemo?: unknown }).fieldiaDemo);
  await page.evaluate(() => {
    const demo = (window as unknown as { fieldiaDemo: { handle: { destroy(): void } } }).fieldiaDemo;
    demo.handle.destroy();
    const w = window as unknown as { __subscriptions: number; Fieldia: { createMemoryDataSource(o: unknown): Record<string, unknown> }; source(records: unknown): unknown };
    w.__subscriptions = 0;
    w.source = (records: unknown) => {
      const source = w.Fieldia.createMemoryDataSource({ records, live: true });
      const real = source['subscribe'] as ((...a: unknown[]) => unknown) | undefined;
      if (real)
        source['subscribe'] = (...args: unknown[]) => {
          w.__subscriptions++;
          const stop = real.apply(source, args) as (() => void) | undefined;
          let stopped = false;
          return () => {
            if (!stopped) (stopped = true), w.__subscriptions--;
            stop?.();
          };
        };
      return source;
    };
  });
  return page.context().newCDPSession(page);
}

const PEOPLE = Object.fromEntries(Array.from({ length: 200 }, (_, i) => [i + 1, { name: `Customer ${i + 1}`, email: `c${i + 1}@example.com`, phone: `+2010000${String(i).padStart(5, '0')}`, state: 'active', credit_limit: i * 100 }]));

test.describe('mounted and taken away twenty times, nothing is left behind', () => {
  test('a record with tabs, read from its source', async ({ page }) => {
    const cdp = await scriptPage(page);
    const customer = pageJson('customer');
    const left = await leftAfter(page, cdp, (n) =>
      page.evaluate(
        async ([customer, people, n]) => {
          const w = window as unknown as { Fieldia: { mountViewer(h: Element, o: unknown): { destroy(): void; form: { settled(): Promise<unknown> } } }; source(r: unknown): unknown };
          const handle = w.Fieldia.mountViewer(document.getElementById('app') as Element, { page: customer, dataSource: w.source({ partner: people }), recordId: 1 + ((n as number) + 2) });
          await handle.form.settled();
          await new Promise((resolve) => setTimeout(resolve, 60));
          handle.destroy();
        },
        [customer, PEOPLE, n] as const
      )
    );
    expect(left).toEqual(NOTHING);
  });

  test('a list of 200 records, and an editable one with a cell open', async ({ page }) => {
    const cdp = await scriptPage(page);
    const list = (editable: boolean) => ({
      fieldia: '0.13',
      id: editable ? 'people-edit' : 'people',
      title: 'Customers',
      data: { kind: 'record', model: 'partner' },
      fields: { name: { type: 'char', label: 'Name' }, email: { type: 'char', label: 'Email' }, credit_limit: { type: 'monetary', label: 'Credit', currency: 'EGP' } },
      layout: { type: 'list', id: 'people-list', columns: ['name', 'email', 'credit_limit'], pageSize: 200, ...(editable ? { editable: true } : {}) },
    });
    for (const editable of [false, true]) {
      const left = await leftAfter(page, cdp, () =>
        page.evaluate(
          async ([page, people, editable]) => {
            const w = window as unknown as { Fieldia: { mountViewer(h: Element, o: unknown): { destroy(): void } }; source(r: unknown): unknown };
            const handle = w.Fieldia.mountViewer(document.getElementById('app') as Element, { page, dataSource: w.source({ partner: people }) });
            for (let waited = 0; document.querySelectorAll('#app tbody tr').length < 200 && waited < 5000; waited += 20) await new Promise((resolve) => setTimeout(resolve, 20));
            if (editable) {
              (document.querySelector('#app tbody tr td[data-edit]') as HTMLElement | null)?.click();
              await new Promise((resolve) => setTimeout(resolve, 80));
            }
            handle.destroy();
          },
          [list(editable), PEOPLE, editable] as const
        )
      );
      expect(left, editable ? 'an editable list, a cell open' : 'a list').toEqual(NOTHING);
    }
  });

  test('a page kept without signal, its outbox in IndexedDB: one connection, never one a mount', async ({ page }) => {
    const cdp = await scriptPage(page);
    const report = pageJson('viewing-report');
    const left = await leftAfter(page, cdp, () =>
      page.evaluate(async (report) => {
        const w = window as unknown as { Fieldia: { mountViewer(h: Element, o: unknown): { destroy(): void } }; source(r: unknown): unknown };
        const handle = w.Fieldia.mountViewer(document.getElementById('app') as Element, { page: report, dataSource: w.source({}) });
        await new Promise((resolve) => setTimeout(resolve, 200));
        handle.destroy();
      }, report)
    );
    expect(left).toEqual(NOTHING);
    expect(await page.evaluate(() => (window as unknown as { __live: { idbOpen: number } }).__live.idbOpen)).toBe(1);
  });

  test('a page taken away with the dialog it opened', async ({ page }) => {
    const cdp = await scriptPage(page);
    const order = {
      fieldia: '0.13',
      id: 'order',
      title: 'Order',
      data: { kind: 'record', model: 'shop.order' },
      fields: { caller: { type: 'char', label: 'Caller' } },
      layout: { type: 'sections', id: 'root', children: [{ type: 'section', id: 's', children: [{ type: 'field', id: 'f-caller', field: 'caller' }, { type: 'button', id: 'b-new', label: 'New customer', steps: [{ do: 'open', page: 'new-customer', as: 'dialog' }] }] }] },
    };
    const customer = pageJson('new-customer');
    const left = await leftAfter(page, cdp, () =>
      page.evaluate(
        async ([order, customer]) => {
          const w = window as unknown as { Fieldia: { mountViewer(h: Element, o: unknown): { destroy(): void } }; source(r: unknown): unknown };
          const handle = w.Fieldia.mountViewer(document.getElementById('app') as Element, { page: order, dataSource: w.source({}), pages: { 'new-customer': customer } });
          [...document.querySelectorAll<HTMLButtonElement>('#app button')].find((b) => b.textContent?.trim() === 'New customer')?.click();
          for (let waited = 0; !document.querySelector('.fd-form-dialog') && waited < 5000; waited += 20) await new Promise((resolve) => setTimeout(resolve, 20));
          if (!document.querySelector('.fd-form-dialog')) throw new Error('no dialog opened');
          handle.destroy();
          if (document.querySelector('.fd-form-dialog')) throw new Error('the dialog outlived its viewer');
        },
        [order, customer] as const
      )
    );
    expect(left).toEqual(NOTHING);
  });

  test('the screen editor, reopened with a menu open', async ({ page }) => {
    await page.addInitScript(counters);
    await page.goto('/screen/');
    await page.waitForFunction(() => (window as unknown as { fieldiaDesigner?: unknown }).fieldiaDesigner);
    // Its page kept in the demo's store, as an app's is: opened again from there each time.
    await page.evaluate(() => {
      const demo = (window as unknown as { fieldiaDesigner: { designer: { getPage(): unknown }; store: { saveDraft(p: unknown): Promise<void> } } }).fieldiaDesigner;
      return demo.store.saveDraft(demo.designer.getPage());
    });
    const cdp = await page.context().newCDPSession(page);
    const left = await leftAfter(page, cdp, async () => {
      // A field's menu open (its ⋯), then the editor taken away and opened again, as an app does.
      await page.locator('.fd-canvas-field').first().click();
      const more = page.locator('[aria-haspopup="menu"]:visible').first();
      if (await more.count()) await more.click();
      await page.evaluate(() => (window as unknown as { fieldiaDesigner: { reopen(): Promise<void> } }).fieldiaDesigner.reopen());
      await page.locator('.fd-canvas-field').first().waitFor();
    });
    // The designer's own subscriptions are its own: the data source's are counted where a viewer is.
    expect({ ...left, subscriptions: 0 }).toEqual(NOTHING);
  });
});
