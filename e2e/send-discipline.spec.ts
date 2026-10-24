import { type Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { node, open, screen } from './support';

/**
 * One send discipline as a person meets it (audit R-H6, R-M2, R-M3, S-M6): a report sent without signal in a browser
 * that keeps nothing past the page says so — never "Kept on this device" — and goes once back; a record saved without
 * signal and saved again once back is saved in order, its later change last; every try of a send carries one key.
 */

const sent = (page: Page) => page.evaluate(() => (window as any).fieldiaDemo.dataSource.responses as { key?: string; values: Record<string, unknown>; queued?: { key: string } }[]);

let problems: string[] = [];
test.afterEach(() => expect(problems).toEqual([]));

test('without IndexedDB, a report kept without signal says it lives in this page alone, and goes once back', async ({ page }) => {
  // A browser that keeps nothing past the page: a private window in some, a webview in others.
  await page.addInitScript(() => {
    Object.defineProperty(window, 'indexedDB', { value: undefined, configurable: true });
  });
  ({ problems } = await open(page, 'plain', 'page=viewing-report&skin=outlined'));
  await page.getByRole('button', { name: 'Work offline' }).click();
  await node(page, 'f-unit').locator('input').fill('B-12');
  await node(page, 'f-condition').getByRole('radio', { name: 'Needs finishing' }).check();
  await page.getByRole('button', { name: 'Submit', exact: true }).click();
  await expect(page.locator('.fd-done-title')).toHaveText('Not sent yet');
  await expect(page.locator('.fd-done-text p').first()).toHaveText(
    'There is no signal, and this browser cannot keep your answers once this page is closed: keep it open, and they are sent as soon as the signal comes back.'
  );
  await expect(page.locator('.fd-done .fd-outbox-said')).toHaveText('No signal: 1 send waits in this page: keep it open, as this browser cannot keep it once it is closed.');
  await screen(page, 'outbox-page-only');
  await page.getByRole('button', { name: 'Back online' }).click();
  await expect(page.locator('.fd-done .fd-outbox-said')).toHaveText('Everything that waited was sent.');
  const [response] = await sent(page);
  expect(response.values).toMatchObject({ unit: 'B-12' });
  // Its first try's key, the one it went with.
  expect(response.key).toMatch(/^send-/);
  expect(response.queued?.key).toBe(response.key);
});

test('a record saved without signal, then changed and saved once back, is saved in order: the later change last', async ({ page }) => {
  await page.goto('/script/');
  await expect(page.locator('#app .fd-form')).toBeVisible();
  // A record page with an outbox, from the one tag, on a memory source switched off and on.
  await page.evaluate(() => {
    const fieldia = (window as any).Fieldia;
    const demo = (window as any).fieldiaDemo;
    demo.handle.destroy();
    let off = false;
    demo.goOffline = (now: boolean) => (off = now);
    const shown = {
      fieldia: '0.11',
      id: 'visit-record',
      title: 'Visit',
      data: { kind: 'record', model: 'visit' },
      outbox: true,
      fields: { unit: { type: 'char', label: 'Unit' }, price: { type: 'float', label: 'Price' } },
      layout: { type: 'sheet', id: 'main', children: [{ type: 'field', id: 'f-unit', field: 'unit' }, { type: 'field', id: 'f-price', field: 'price' }] },
    };
    demo.dataSource = fieldia.createMemoryDataSource({ records: { visit: { 5: { unit: 'A-1', price: 10 } } }, offline: () => off });
    demo.handle = fieldia.mountViewer(document.getElementById('app'), { page: shown, dataSource: demo.dataSource, recordId: 5, skin: 'outlined' });
  });
  const price = node(page, 'f-price').locator('input');
  await expect(price).toHaveValue('10.00');
  await page.evaluate(() => (window as any).fieldiaDemo.goOffline(true));
  await price.fill('20');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.locator('#app .fd-outbox-said')).toContainText('1 send waits');
  await page.evaluate(() => (window as any).fieldiaDemo.goOffline(false));
  await price.fill('30');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect.poll(() => page.evaluate(() => (window as any).fieldiaDemo.dataSource.records.visit['5'].price)).toBe(30);
  const saves = await page.evaluate(() => (window as any).fieldiaDemo.dataSource.calls.filter((call: { method: string }) => call.method === 'save').map((call: { request: { changes: { values: unknown } } }) => call.request.changes.values));
  // Tried live without signal, then the kept one, then the later one.
  expect(saves.slice(-2)).toEqual([{ price: 20 }, { price: 30 }]);
  await expect(page.locator('#app .fd-banner')).toBeHidden();
});
