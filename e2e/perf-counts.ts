import type { Browser, Page } from '@playwright/test';

/**
 * What the browser did for an action, counted rather than timed (0.35, the audit's M6): a runner's speed changes none of
 * it. The layouts it ran and how many objects the largest laid out (Chromium's own trace), the style recalculations, the
 * changes made to the DOM (a MutationObserver's records), and the scripts fetched. Chromium alone: the counts are its.
 */
export interface Counts {
  /** Layouts run, and the most objects one laid out. */
  layouts: number;
  layoutObjects: number;
  /** Style recalculations run, and the most elements one restyled. */
  styles: number;
  styledElements: number;
  /** DOM changes: nodes added or taken away, attributes and text written. */
  mutations: number;
  /** Scripts asked for while it ran. */
  scripts: number;
}

/** Count what `act` makes the browser do on `page`, the changes under `root` (the whole document unless said). */
export async function countsOf(page: Page, browser: Browser, act: () => Promise<void>, root = 'body'): Promise<Counts> {
  let scripts = 0;
  const asked = (request: { resourceType(): string }) => void (request.resourceType() === 'script' && scripts++);
  await page.evaluate((selector) => {
    const w = window as unknown as { __mutations: number; __watch?: MutationObserver };
    w.__mutations = 0;
    w.__watch?.disconnect();
    w.__watch = new MutationObserver((records) => {
      for (const record of records) w.__mutations += record.type === 'childList' ? record.addedNodes.length + record.removedNodes.length : 1;
    });
    w.__watch.observe(document.querySelector(selector) ?? document.body, { subtree: true, childList: true, attributes: true, characterData: true });
  }, root);
  page.on('request', asked);
  await browser.startTracing(page, { categories: ['devtools.timeline'] });
  await act();
  // What the action put off for a moment (a frame, a microtask) counts with it.
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const trace = JSON.parse((await browser.stopTracing()).toString()) as { traceEvents: { name: string; ph: string; args?: { beginData?: { totalObjects?: number }; elementCount?: number } }[] };
  page.off('request', asked);
  const mutations = await page.evaluate(() => {
    const w = window as unknown as { __mutations: number; __watch?: MutationObserver };
    for (const record of w.__watch?.takeRecords() ?? []) w.__mutations += record.type === 'childList' ? record.addedNodes.length + record.removedNodes.length : 1;
    w.__watch?.disconnect();
    return w.__mutations;
  });
  const layouts = trace.traceEvents.filter((event) => event.name === 'Layout' && event.ph === 'X');
  const styles = trace.traceEvents.filter((event) => (event.name === 'UpdateLayoutTree' || event.name === 'RecalculateStyles') && event.ph === 'X');
  return {
    layouts: layouts.length,
    layoutObjects: Math.max(0, ...layouts.map((event) => event.args?.beginData?.totalObjects ?? 0)),
    styles: styles.length,
    styledElements: Math.max(0, ...styles.map((event) => event.args?.elementCount ?? 0)),
    mutations,
    scripts,
  };
}

/** The page's DOM nodes and JS event listeners, as Chromium counts them after two collections. */
export async function domCounters(page: Page): Promise<{ nodes: number; listeners: number }> {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('HeapProfiler.collectGarbage');
  await cdp.send('HeapProfiler.collectGarbage');
  const { nodes, jsEventListeners } = await cdp.send('Memory.getDOMCounters');
  await cdp.detach();
  return { nodes, listeners: jsEventListeners };
}

/** A mid-range phone: four times slower than this machine, as Lighthouse and the audit measure one (`perf-phone`). */
export async function asAPhone(page: Page): Promise<void> {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
}

/** The one-tag script's page with `page` mounted in place of its form, from records made here: a scale of our choosing. */
export async function mountGenerated(page: Page, built: { page: Record<string, unknown>; records?: Record<string, Record<number, Record<string, unknown>>>; recordId?: number }): Promise<void> {
  await page.goto('/script/');
  await page.waitForFunction(() => (window as unknown as { fieldiaDemo?: unknown }).fieldiaDemo);
  await page.evaluate(async (built) => {
    const w = window as unknown as { fieldiaDemo: { handle: { destroy(): void } }; fieldiaScale?: { drawn: Promise<void> }; Fieldia: { mountViewer(h: Element, o: unknown): { drawn: Promise<void> }; createMemoryDataSource(o: unknown): unknown } };
    w.fieldiaDemo.handle.destroy();
    const handle = w.Fieldia.mountViewer(document.getElementById('app') as Element, { page: built.page, dataSource: w.Fieldia.createMemoryDataSource({ records: built.records ?? {} }), ...(built.recordId ? { recordId: built.recordId } : {}) });
    w.fieldiaScale = handle;
    await handle.drawn;
  }, built);
}
