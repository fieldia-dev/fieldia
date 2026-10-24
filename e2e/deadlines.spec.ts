import { expect, test } from './fixtures';
import { screen } from './support';

/**
 * Nothing waits for ever (audit R-M1), as a person meets a server that never answers a save: "Saving…" for as long as
 * the deadline (here the viewer's `timeout`, 1.5 s), then the network's banner with Retry, what was typed still there;
 * Retry, the server answering again, saves it — the same save, by its key.
 */

test('a save the server never answers ends at its deadline with Retry, and Retry saves it', async ({ page }) => {
  await page.goto('/script/');
  await expect(page.locator('#app .fd-form')).toBeVisible();
  await page.evaluate(() => {
    const fieldia = (window as any).Fieldia;
    const demo = (window as any).fieldiaDemo;
    demo.handle.destroy();
    const memory = fieldia.createMemoryDataSource({ records: { partner: { 1: { name: 'Nile Traders' } } } });
    demo.memory = memory;
    demo.hang = true;
    demo.signals = [];
    const dataSource = {
      load: (request: unknown) => memory.load(request),
      save: (request: { signal: { aborted: boolean } }) => {
        demo.signals.push(request.signal);
        return demo.hang ? new Promise(() => undefined) : memory.save(request);
      },
    };
    const shown = { fieldia: '0.11', id: 'customer', title: 'Customer', data: { kind: 'record', model: 'partner' }, fields: { name: { type: 'char', label: 'Name' } }, layout: { type: 'sheet', id: 'main', children: [{ type: 'field', id: 'name', field: 'name' }] } };
    demo.handle = fieldia.mountViewer(document.getElementById('app'), { page: shown, dataSource, recordId: 1, timeout: 1500, skin: 'outlined' });
  });
  const name = page.locator('#app [data-node="name"] input');
  await expect(name).toHaveValue('Nile Traders');
  await name.fill('Nile Traders Co');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.locator('#app .fd-status')).toHaveText('Saving…');
  const banner = page.locator('#app .fd-banner').filter({ hasText: 'Could not reach the server' });
  await expect(banner).toBeVisible();
  await expect(name).toHaveValue('Nile Traders Co');
  expect(await page.evaluate(() => (window as any).fieldiaDemo.signals[0].aborted)).toBe(true);
  await screen(page, 'deadline-save-banner');
  await page.evaluate(() => ((window as any).fieldiaDemo.hang = false));
  await banner.getByRole('button', { name: 'Retry' }).click();
  await expect(page.locator('#app .fd-status')).toHaveText('Saved');
  expect(await page.evaluate(() => (window as any).fieldiaDemo.memory.records.partner['1'].name)).toBe('Nile Traders Co');
});
