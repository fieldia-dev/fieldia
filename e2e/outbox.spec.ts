import { type Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { node, open, screen } from './support';

/**
 * Sends kept without signal, as a broker meets them on a site visit (its page's `outbox`): Work offline, a report with a
 * photo sent — "Kept on this device", what waits said over the form — still there after a reload, and sent with its
 * photo stored once back online; and the browser's own connection going and coming back, sent by itself.
 */

const sent = (page: Page) => page.evaluate(() => (window as any).fieldiaDemo.dataSource.responses as { values: Record<string, unknown>; queued?: { key: string } }[]);
const PHOTO = { name: 'kitchen.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64') };

let problems: string[] = [];
test.afterEach(() => expect(problems).toEqual([]));

async function report(page: Page, unit: string) {
  await node(page, 'f-unit').locator('input').fill(unit);
  await node(page, 'f-condition').getByRole('radio', { name: 'Needs finishing' }).check();
  await node(page, 'f-photos').locator('input[type="file"]').setInputFiles(PHOTO);
  await expect(node(page, 'f-photos')).toContainText('kitchen.png');
  await page.getByRole('button', { name: 'Submit', exact: true }).click();
}

test('a report sent without signal is kept on the device, kept through a reload, and sent with its photo once back', async ({ page }) => {
  ({ problems } = await open(page, 'plain', 'page=viewing-report&skin=outlined'));
  await page.getByRole('button', { name: 'Work offline' }).click();
  await report(page, 'B-12');
  await expect(page.locator('.fd-done-title')).toHaveText('Kept on this device');
  // Said where the person is, under the ending: the form is hidden.
  await expect(page.locator('.fd-done .fd-outbox-said')).toHaveText('No signal: 1 send waits on this device.');
  await expect(page.locator('.fd-done .fd-outbox-said')).toBeVisible();
  expect(await sent(page)).toEqual([]);
  await screen(page, 'outbox-kept');
  await page.reload();
  await expect(page.locator('.fd-form')).toBeVisible();
  // Tried again as the page opens: still no signal.
  await expect(page.locator('.fd-outbox-said')).toHaveText('No signal: 1 send waits on this device.');
  await page.getByRole('button', { name: 'Back online' }).click();
  await expect(page.locator('.fd-outbox-said')).toHaveText('Everything that waited was sent.');
  const [response] = await sent(page);
  expect(response.values).toMatchObject({ unit: 'B-12', condition: 'finishing' });
  expect(response.queued?.key).toMatch(/^outbox-/);
  const photos = response.values['photos'] as { name: string; url?: string; data?: string }[];
  expect(photos).toHaveLength(1);
  expect(photos[0]).toMatchObject({ name: 'kitchen.png' });
  expect(photos[0].data).toBeUndefined();
  await expect(page.locator('.demo-sent-log dt', { hasText: 'Photos' }).locator('xpath=following-sibling::dd[1]')).toHaveText('kitchen.png (stored)');
  await screen(page, 'outbox-sent');
});

test('the browser’s connection going and coming back: kept, then sent by itself', async ({ page, context, browserName }) => {
  // Playwright's WebKit on Linux says it is offline throughout (navigator.onLine false, `offline` fired both ways): the
  // demo, whose stand-in source reads the browser's word for its connection, could not come back online there.
  test.skip(browserName === 'webkit', 'WebKit under Playwright on Linux never says it is online');
  ({ problems } = await open(page, 'plain', 'page=viewing-report&skin=outlined'));
  await context.setOffline(true);
  await node(page, 'f-unit').locator('input').fill('C-3');
  await node(page, 'f-condition').getByRole('radio', { name: 'Ready to move in' }).check();
  await page.getByRole('button', { name: 'Submit', exact: true }).click();
  await expect(page.locator('.fd-done .fd-outbox-said')).toHaveText('No signal: 1 send waits on this device.');
  await context.setOffline(false);
  await expect(page.locator('.fd-done .fd-outbox-said')).toHaveText('Everything that waited was sent.');
  await expect(page.locator('.fd-done .fd-outbox-said')).toBeVisible();
  expect((await sent(page)).map((response) => response.values['unit'])).toEqual(['C-3']);
});
