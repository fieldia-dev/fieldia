import type { Page as Browser } from '@playwright/test';
import { expect, test } from './fixtures';

/**
 * The checks a viewer runs on a page (0.36, the coordinator's decision of 26 Oct; docs/maintainers/release-train.md):
 * before the draw, what 0.35's viewer refused — a page it refuses is not drawn, its words where the form would be; after
 * the draw, once the browser is idle, the whole check, `validatePage`'s verdict in a script of its own
 * (fieldia.check.js), which never delays the draw — what only it finds said once in the console and to `onError` as a
 * warning, the page left drawn, refused from 0.37 (`page.invalid`). In each engine: WebKit has no requestIdleCallback,
 * and each engine fetches the part's script its own way.
 */

const page = (change: (page: Record<string, unknown> & { fields: Record<string, Record<string, unknown>>; layout: { children: Record<string, unknown>[] } }) => void = () => undefined) => {
  const made = {
    fieldia: '0.13',
    id: 'contact',
    title: 'Contact',
    data: { kind: 'responses' },
    fields: { name: { type: 'char', label: 'Your name' }, topic: { type: 'selection', label: 'Topic', options: [{ value: 'sales', label: 'Sales' }, { value: 'support', label: 'Support' }] } },
    layout: { type: 'sections', id: 'root', children: [{ type: 'field', id: 'f-name', field: 'name' }, { type: 'field', id: 'f-topic', field: 'topic' }] },
  };
  change(made as never);
  return made;
};

/**
 * A page of the app's own with the one-tag script and nothing drawn yet (beside the script demo, its fieldia.js and its
 * parts), `given` mounted in it: what onError heard, what the mount threw, and when the page was drawn by the page's
 * own clock — beside which the whole check's script is asked for.
 */
async function mount(browser: Browser, given: unknown) {
  await browser.route('**/script/own-page.html', (route) => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>An app</title><script src="fieldia.js"></script></head><body><main id="app"></main></body></html>' }));
  await browser.goto('/script/own-page.html');
  await browser.waitForFunction(() => (window as unknown as { Fieldia?: unknown }).Fieldia);
  await browser.evaluate((shown) => {
    const w = window as unknown as {
      Fieldia: { mountViewer(h: Element, o: unknown): { drawn: Promise<void> }; createMemoryDataSource(o?: unknown): unknown };
      checked: { told: { stage: string; part: string; warning?: boolean; paths: string[] }[]; thrown: string | null; drawnAt: number | null };
    };
    w.checked = { told: [], thrown: null, drawnAt: null };
    try {
      const handle = w.Fieldia.mountViewer(document.getElementById('app') as Element, {
        page: shown,
        dataSource: w.Fieldia.createMemoryDataSource(),
        onError: (error: { issues?: { path: string }[] }, where: { stage: string; part: string; warning?: boolean }) => w.checked.told.push({ ...where, paths: (error.issues ?? []).map((issue) => issue.path) }),
      });
      void handle.drawn.then(() => (w.checked.drawnAt = performance.now()));
    } catch (error) {
      w.checked.thrown = (error as Error).message;
    }
  }, given);
}
const checked = (browser: Browser) => browser.evaluate(() => (window as unknown as { checked: { told: { stage: string; part: string; warning?: boolean; paths: string[] }[]; thrown: string | null; drawnAt: number | null } }).checked);
/** When the whole check's script was asked for, by the page's clock; null where it was not. */
const checkAskedAt = (browser: Browser) => browser.evaluate(() => (performance.getEntriesByType('resource') as PerformanceResourceTiming[]).find((entry) => /\/fieldia\.check\.js(\?|$)/.test(entry.name))?.startTime ?? null);

test('a page 0.35 drew that validatePage refuses: drawn, then its mistakes said once in the console and to onError, as a warning', async ({ page: browser }) => {
  const warnings: string[] = [];
  browser.on('console', (message) => message.type() === 'warning' && warnings.push(message.text()));
  await mount(browser, page((p) => (p.fields['name']['required'] = 'yes')));
  // Drawn, as 0.35 drew it.
  await expect(browser.getByRole('textbox', { name: 'Your name' })).toBeVisible();
  await expect(browser.locator('#app .fd-unshown')).toHaveCount(0);
  // Then, the browser idle, its whole check: said to onError as a warning, the page left drawn.
  await expect.poll(async () => (await checked(browser)).told).toEqual([{ stage: 'check', part: 'page', warning: true, paths: ['fields.name.required'] }]);
  await expect(browser.getByRole('textbox', { name: 'Your name' })).toBeVisible();
  // Its script asked for once the page was drawn, never before.
  const { drawnAt } = await checked(browser);
  const askedAt = await checkAskedAt(browser);
  expect(drawnAt).not.toBeNull();
  expect(askedAt).not.toBeNull();
  expect(askedAt as number).toBeGreaterThanOrEqual(drawnAt as number);
  // Said once in the console, naming what is wrong and when it is refused.
  const said = warnings.filter((words) => words.includes('(page.invalid;'));
  expect(said).toHaveLength(1);
  expect(said[0]).toContain('fields.name.required');
  expect(said[0]).toContain('it changes in 0.37 (page.invalid; https://fieldia.dev/promises/#deprecations)');
});

test('a page 0.35 refused: refused, its words where the form would be, nothing of it drawn', async ({ page: browser }) => {
  await mount(browser, page((p) => (p.layout.children[1]['field'] = 'phone')));
  const words = browser.locator('#app .fd-unshown [role="alert"]');
  await expect(words).toHaveText('This form cannot be shown: its page has mistakes. Whoever made it can check it with validatePage.');
  await browser.locator('#app .fd-unshown summary').click();
  await expect(browser.locator('#app .fd-unshown li')).toHaveText(['layout.children[1].field no field "phone"']);
  await expect(browser.locator('#app .fd-field')).toHaveCount(0);
  const { told, thrown } = await checked(browser);
  expect(thrown).toMatch(/^This page cannot be shown:/);
  expect(told).toEqual([{ stage: 'draw', part: 'page', paths: ['layout.children[1].field'] }]);
});

test('a page that passes: drawn, its whole check asked for after the draw, nothing said', async ({ page: browser }) => {
  const warnings: string[] = [];
  browser.on('console', (message) => message.type() === 'warning' && warnings.push(message.text()));
  await mount(browser, page());
  await expect(browser.getByRole('textbox', { name: 'Your name' })).toBeVisible();
  await expect.poll(() => checkAskedAt(browser)).not.toBeNull();
  await expect.poll(() => browser.evaluate(() => !!(window as unknown as { Fieldia: { pageCheckPart: { loaded?: unknown } } }).Fieldia.pageCheckPart.loaded)).toBe(true);
  // Let it run: nothing found, nothing said.
  await browser.evaluate(() => new Promise((resolve) => setTimeout(resolve, 200)));
  expect((await checked(browser)).told).toEqual([]);
  expect(warnings.filter((words) => words.includes('page.invalid'))).toEqual([]);
});
