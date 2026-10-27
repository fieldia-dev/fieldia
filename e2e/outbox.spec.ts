import { type Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { node, open, screen } from './support';

/**
 * Sends kept without signal, as a broker meets them on a site visit (its page's `outbox`): Work offline, a report with a
 * photo sent — "Kept on this device", what waits said over the form — still there after a reload, and sent with its
 * photo stored once back online; the browser's own connection going and coming back, sent by itself; and a network gone
 * without the browser saying so, sent by the outbox's own next try. The demo's stand-in source finds the network as the
 * outbox's sends do, by a request (shared/viewing-report.ts), never by the browser's word for its connection.
 */

const sent = (page: Page) => page.evaluate(() => (window as any).fieldiaDemo.dataSource.responses as { values: Record<string, unknown>; queued?: { key: string } }[]);
/** What the browser itself says of a request the network did not answer while it was off: its words, not the page's fault. */
// Chromium 156 says a request its service worker could not make with no signal as "Failed to load resource:
// net::ERR_FAILED" (141 said ERR_INTERNET_DISCONNECTED): the network's words, as the others.
const NO_NETWORK = /ERR_INTERNET_DISCONNECTED|net::ERR_FAILED|Failed to fetch|NetworkError|WebKit encountered an internal error/;
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
  // Kept by the key its first try carried, sent with it as its own and as `queued.key`.
  expect(response.queued?.key).toMatch(/^send-/);
  const photos = response.values['photos'] as { name: string; url?: string; data?: string }[];
  expect(photos).toHaveLength(1);
  expect(photos[0]).toMatchObject({ name: 'kitchen.png' });
  expect(photos[0].data).toBeUndefined();
  await expect(page.locator('.demo-sent-log dt', { hasText: 'Photos' }).locator('xpath=following-sibling::dd[1]')).toHaveText('kitchen.png (stored)');
  await screen(page, 'outbox-sent');
});

test('the browser’s connection going and coming back: kept, then sent by itself', async ({ page, context }) => {
  // In WebKit too. There, on a Linux whose NetworkManager runs none of its network (as on a machine whose network
  // systemd-networkd runs), the browser says offline throughout — navigator.onLine false, `offline` said as the
  // connection goes and again as it comes back, never `online` (f7's probe): the outbox, which learns the signal from
  // its own tries, sends it by its next one, 2 seconds after it was kept.
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
  problems = problems.filter((problem) => !NO_NETWORK.test(problem));
});

test.describe('a network that answers nothing', () => {
  // Its service worker kept out: this is the network's part alone, and a request a worker saw is one Playwright's route
  // does not stop in WebKit.
  test.use({ serviceWorkers: 'block' });

  test('the browser saying nothing of it — a captive portal, Wi-Fi with no way out: kept, then sent by the outbox’s next try', async ({ page, context }) => {
    ({ problems } = await open(page, 'plain', 'page=viewing-report&skin=outlined'));
    // Whatever the browser says of its connection, it says nothing new from here: no `online` sends it.
    await page.evaluate(() => {
      (window as any).saidOnline = 0;
      addEventListener('online', () => (window as any).saidOnline++);
    });
    // The network answers nothing, the browser's connection untouched: every request the page makes fails as a dead
    // network's does — the demo's source's, as a send to a server would.
    let dead = true;
    await context.route('**/*', (route) => (dead ? route.abort('internetdisconnected') : route.continue()));
    await node(page, 'f-unit').locator('input').fill('F-2');
    await node(page, 'f-condition').getByRole('radio', { name: 'Needs repairs' }).check();
    await page.getByRole('button', { name: 'Submit', exact: true }).click();
    await expect(page.locator('.fd-done-title')).toHaveText('Kept on this device');
    await expect(page.locator('.fd-done .fd-outbox-said')).toHaveText('No signal: 1 send waits on this device.');
    dead = false;
    // Sent by the outbox's own try, soon after it was kept: no word from the browser, no press.
    await expect(page.locator('.fd-done .fd-outbox-said')).toHaveText('Everything that waited was sent.');
    expect((await sent(page)).map((response) => response.values['unit'])).toEqual(['F-2']);
    expect(await page.evaluate(() => (window as any).saidOnline)).toBe(0);
    problems = problems.filter((problem) => !NO_NETWORK.test(problem));
  });
});

test('opened again with no signal at all — the connection really off — the page comes from the device, its send still waiting', async ({ page, context, browserName }) => {
  // The walk of 0.31: with the connection off, a reload gave a blank page. What each engine can show of it (f7's
  // probes, tools-local/p3-real-tests/f7):
  // - WebKit, set offline, reaches no server for any request: the page's address, each script and each fetch are
  //   answered by its service worker from its copy because they must. Under Playwright 1.56 it failed every such load
  //   before the worker was asked (microsoft/playwright#42775); from 1.64.1 it runs here (20 of 20 at the 0.36 merge).
  // - Firefox, set offline, refuses the page's reload (NS_ERROR_OFFLINE) before its worker is asked — not every time:
  //   where it lets one through, the worker's own requests still reach the network.
  // - Chromium opens the page and its send waits — but Playwright sets the page offline, never its service worker
  //   (microsoft/playwright#2311), whose network-first requests still reach the server: what this shows is the page
  //   opening and its kept copy there (caches.match, below), not the page coming from that copy. That is a real
  //   device's to show (the lane's real-device checklist), and WebKit's once Playwright is 1.64; the outbox's own part —
  //   the send kept, still waiting after the reload, sent once back — every engine's, in the tests above.
  test.skip(browserName === 'firefox', 'Playwright’s Firefox, set offline, refuses the reload (NS_ERROR_OFFLINE) before its service worker is asked');
  ({ problems } = await open(page, 'plain', 'page=viewing-report&skin=outlined'));
  // Its service worker in place, and what the page loaded kept.
  await expect
    .poll(() => page.evaluate(async () => !!navigator.serviceWorker.controller && !!(await caches.match(location.href)) && !!(await caches.match(new URL('main.js', location.href).href))))
    .toBe(true);
  await context.setOffline(true);
  await node(page, 'f-unit').locator('input').fill('D-7');
  await node(page, 'f-condition').getByRole('radio', { name: 'Ready to move in' }).check();
  await page.getByRole('button', { name: 'Submit', exact: true }).click();
  await expect(page.locator('.fd-done .fd-outbox-said')).toHaveText('No signal: 1 send waits on this device.');
  // A reload with no signal: the page opens, the send still waits.
  await page.reload();
  await expect(page.locator('.fd-form')).toBeVisible();
  await expect(page.locator('.fd-outbox-said')).toHaveText('No signal: 1 send waits on this device.');
  await expect(page.locator('.dh-title')).toHaveText('A viewing report with no signal');
  await expect(page.locator('.demo-meanwhile-said')).toHaveText('No signal: what you send is kept on this device.');
  await screen(page, 'outbox-reopened-offline', { viewport: true });
  // The signal back: sent by itself.
  await context.setOffline(false);
  await expect(page.locator('.fd-outbox-said')).toHaveText('Everything that waited was sent.');
  expect((await sent(page)).map((response) => response.values['unit'])).toEqual(['D-7']);
  // Its worker is the viewing report's alone: every other demo here is left to the network.
  await page.goto('/plain/?page=customer&skin=underline');
  await expect(page.locator('.fd-form').first()).toBeVisible();
  expect(await page.evaluate(() => navigator.serviceWorker.controller)).toBeNull();
  problems = problems.filter((problem) => !NO_NETWORK.test(problem));
});
