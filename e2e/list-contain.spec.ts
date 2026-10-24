import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

/**
 * A long list keeps the browser's work to what changed (the performance audit's H1, its first step), held by what the
 * browser itself reports rather than by a timing: a key typed in a cell of an editable list of 1,000 rows lays out the
 * box typed in alone — a few objects, never the table's 27,000 (0.32 laid them all out on every key: 27 ms a key on a
 * desktop, 290 ms on a phone) — and a list drawn as cards skips the cards far out of sight until they come near, the
 * one the keys move to drawn as it takes the focus. A table's rows cannot be skipped so: no browser applies
 * content-visibility to a table row (CSS Containment: internal table boxes), so a long table repaints the rows round
 * the view each time the view moves far enough (every 800 px or so in Chromium) — kept small only by drawing fewer
 * rows (windowing, a later step).
 */

test.skip(({ browserName }) => browserName !== 'chromium', 'the layouts are counted by Chromium’s trace');

const PEOPLE = Object.fromEntries(Array.from({ length: 1000 }, (_, i) => [i + 1, { name: `Customer ${String(i + 1).padStart(4, '0')}`, email: `c${i + 1}@example.com`, city: ['Cairo', 'Giza', 'Luxor'][i % 3], credit: (i * 37) % 100000, visits: i % 50 }]));
const FIELDS = { name: { type: 'char', label: 'Name' }, email: { type: 'char', label: 'Email' }, city: { type: 'char', label: 'City' }, credit: { type: 'monetary', label: 'Credit', currency: 'EGP' }, visits: { type: 'integer', label: 'Visits' } };

/** The one-tag script's page with a list of the 1,000 people mounted in place of its form. */
async function mountList(page: Page, layout: Record<string, unknown>) {
  await page.goto('/script/');
  await page.waitForFunction(() => (window as unknown as { fieldiaDemo?: unknown }).fieldiaDemo);
  await page.evaluate(
    async ([fields, people, layout]) => {
      const w = window as unknown as { fieldiaDemo: { handle: { destroy(): void } }; Fieldia: { mountViewer(h: Element, o: unknown): unknown; createMemoryDataSource(o: unknown): unknown } };
      w.fieldiaDemo.handle.destroy();
      const page = { fieldia: '0.11', id: 'people', title: 'Customers', data: { kind: 'record', model: 'person' }, fields, layout: { type: 'list', id: 'people-list', columns: ['name', 'email', 'city', 'credit', 'visits'], pageSize: 1000, ...layout } };
      w.Fieldia.mountViewer(document.getElementById('app') as Element, { page, dataSource: w.Fieldia.createMemoryDataSource({ records: { person: people } }) });
    },
    [FIELDS, PEOPLE, layout] as const
  );
  await expect(page.locator('#app .fd-list-row')).toHaveCount(1000, { timeout: 30000 });
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

test('cards far out of sight skip their drawing, and the one the keys reach is drawn as it takes the focus', async ({ page }) => {
  await page.setViewportSize({ width: 412, height: 915 });
  await mountList(page, { card: {} });
  await expect(page.locator('#app .fd-list')).toHaveAttribute('data-as', 'cards');
  const drawn = () => page.evaluate(() => [...document.querySelectorAll('#app .fd-list-row')].map((row) => (row as Element & { checkVisibility(o: object): boolean }).checkVisibility({ contentVisibilityAuto: true })));
  await expect.poll(async () => (await drawn()).filter(Boolean).length).toBeLessThan(100);
  expect((await drawn())[0]).toBe(true);
  // The last card, taken by the keys: drawn, focused, in sight.
  const last = page.locator('#app .fd-list-row').last();
  await last.focus();
  await expect(last).toBeFocused();
  await expect(last).toBeInViewport();
  expect((await drawn()).at(-1)).toBe(true);
  await expect(last).toContainText('Customer 1000');
});
