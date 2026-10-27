import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { everyRowLoaded, longList } from './support';

/**
 * A long list keeps the browser's work to what changed (the performance audit's H1, its first step), held by what the
 * browser itself reports rather than by a timing: a key typed in a cell of an editable list of 1,000 rows lays out the
 * box typed in alone — a few objects, never the table's 27,000 (0.32 laid them all out on every key: 27 ms a key on a
 * desktop, 290 ms on a phone). A table's rows cannot be skipped by content-visibility: no browser applies it to a table
 * row (CSS Containment: internal table boxes), so a long table repaints the rows round the view each time the view
 * moves far enough (every 800 px or so in Chromium) — kept small by drawing fewer rows: past a hundred, only those near
 * the view are in the page (list-window.ts, e2e/list-window.spec.ts). Cards could be, but measured on a phone, wheeling
 * through 3,000 of them drew each frame 3 to 6 times slower so: left as 0.32 has them.
 */

test.skip(({ browserName }) => browserName !== 'chromium', 'the layouts are counted by Chromium’s trace');

const PEOPLE = Object.fromEntries(Array.from({ length: 1000 }, (_, i) => [i + 1, { name: `Customer ${String(i + 1).padStart(4, '0')}`, email: `c${i + 1}@example.com`, city: ['Cairo', 'Giza', 'Luxor'][i % 3], credit: (i * 37) % 100000, visits: i % 50 }]));
const FIELDS = { name: { type: 'char', label: 'Name' }, email: { type: 'char', label: 'Email' }, city: { type: 'char', label: 'City' }, credit: { type: 'monetary', label: 'Credit', currency: 'EGP' }, visits: { type: 'integer', label: 'Visits' } };

/** The one-tag script's page with a list of the 1,000 people mounted in place of its form. */
async function mountList(page: Page, layout: Record<string, unknown>) {
  await page.goto('/script/');
  await page.waitForFunction(() => (window as unknown as { fieldiaDemo?: unknown }).fieldiaDemo);
  await page.evaluate(
    async ([fields, people, layout, long]) => {
      const w = window as unknown as { fieldiaDemo: { handle: { destroy(): void } }; Fieldia: { mountViewer(h: Element, o: unknown): unknown; createMemoryDataSource(o: unknown): unknown } };
      w.fieldiaDemo.handle.destroy();
      const page = { fieldia: '0.13', id: 'people', title: 'Customers', data: { kind: 'record', model: 'person' }, fields, layout: { type: 'list', id: 'people-list', columns: ['name', 'email', 'city', 'credit', 'visits'], ...long, ...layout } };
      w.Fieldia.mountViewer(document.getElementById('app') as Element, { page, dataSource: w.Fieldia.createMemoryDataSource({ records: { person: people } }) });
    },
    [FIELDS, PEOPLE, layout, longList(1000)] as const
  );
  // Its 1,000 rows counted — an endless list's, past a page's 500, every row loaded first; those near the view in the page.
  await everyRowLoaded(page, 1000);
}

test('a key typed in a cell of 1,000 rows lays out the box alone, never the table', async ({ page, browser }) => {
  await mountList(page, { editable: true });
  const name = page.locator('#app .fd-list-row').nth(3).locator('td[data-col="name"]');
  await name.click();
  const box = name.locator('input');
  await expect(box).toBeFocused();
  await page.keyboard.press('End');
  await page.keyboard.type('a');
  await page.waitForTimeout(300);
  await browser.startTracing(page, { categories: ['devtools.timeline'] });
  for (const key of 'bcde') {
    await page.keyboard.type(key);
    await page.waitForTimeout(80);
  }
  await page.waitForTimeout(300);
  const events = JSON.parse((await browser.stopTracing()).toString()).traceEvents as { name: string; ph: string; args?: { beginData?: { totalObjects?: number } } }[];
  const layouts = events.filter((event) => event.name === 'Layout' && event.ph === 'X').map((event) => event.args?.beginData?.totalObjects ?? 0);
  expect(layouts.length).toBeGreaterThan(0);
  // Each layout a key asked for: the box and what is in it.
  expect(Math.max(...layouts)).toBeLessThan(100);
  await expect(box).toHaveValue('Customer 0004abcde');
  // As it was drawn without the containment: a row's height, its box as wide as the cell was.
  const [cellBox, boxBox, otherRow] = await Promise.all([name.boundingBox(), box.boundingBox(), page.locator('#app .fd-list-row').nth(2).boundingBox()]);
  expect(Math.abs((cellBox?.height ?? 0) - (otherRow?.height ?? 0))).toBeLessThanOrEqual(1);
  expect(boxBox?.width).toBeGreaterThan((cellBox?.width ?? 0) - 20);
});

