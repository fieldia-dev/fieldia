import { expect } from '../../fixtures';
import type { DemoReplay } from '../hand';

/** The map-round demo's how-to steps, replayed by hand (e2e/how-to.spec.ts). */
export const replay: DemoReplay = {
  steps: [
    {
      says: 'Press the 3 over Zamalek on the map: its three stops part',
      async run({ page, press, see }) {
        const map = page.locator('.fd-map-form .fd-map-box');
        await see(map.locator('.leaflet-tile-loaded').first()).toBeVisible();
        const stop = map.getByRole('button', { name: 'Stop, Bayt Interiors, 3' });
        await see(stop).toBeHidden();
        await press(map.getByRole('button', { name: '3 here: Nile Traders, Zamalek Studio, Bayt Interiors. Zoom in to see them.' }));
        for (const name of ['Stop, Nile Traders, 1', 'Stop, Zamalek Studio, 2', 'Stop, Bayt Interiors, 3']) await see(map.getByRole('button', { name })).toBeVisible();
        // Tick Delivered on the third stop in the table: its number greys on the map.
        const third = page.locator('[data-node="f-stops"] tbody tr[data-line]').nth(2);
        await see(third.getByRole('textbox', { name: 'Customer' })).toHaveValue('Bayt Interiors');
        const delivered = third.getByRole('checkbox', { name: 'Delivered' });
        await see(stop.locator('.fd-map-face')).not.toHaveAttribute('data-tone', /./);
        await see(delivered).not.toBeChecked();
        await press(delivered);
        await see(delivered).toBeChecked();
        await see(stop).toHaveText('3');
        await see(stop.locator('.fd-map-face')).toHaveAttribute('data-tone', 'muted');
      },
    },
    {
      says: 'Delete the fourth stop from the table: it leaves the map',
      async run({ page, press, see }) {
        const map = page.locator('.fd-map-form .fd-map-box');
        const routes: string[] = [];
        page.on('request', (request) => request.url().includes('/route/v1/') && routes.push(request.url()));
        const fourth = map.getByRole('button', { name: 'Stop, Delta Foods, 4' });
        await see(fourth).toBeVisible();
        const lines = page.locator('[data-node="f-stops"] tbody tr[data-line]');
        await see(lines.nth(3).getByRole('textbox', { name: 'Customer' })).toHaveValue('Delta Foods');
        await press(lines.nth(3).getByRole('button', { name: 'Delete line' }));
        await see(lines).toHaveCount(4);
        await see(fourth).toHaveCount(0);
        // The way asked for again, without the fourth stop's place, and drawn.
        await expect.poll(() => routes.length).toBeGreaterThan(0);
        expect(routes.at(-1)).not.toContain('31.2091,30.0389');
        await see(map.locator('path.fd-map-route')).toHaveCount(1);
      },
    },
    {
      says: 'Tab through the stops on the map and press Enter for one’s card',
      notOnPhone: 'a phone has no Tab key: a tap on a stop opens its card there',
      async run({ page, press, keys, see }) {
        const map = page.locator('.fd-map-form .fd-map-box');
        // From the words over the map (a press there, where the next Tab starts from), Tab after Tab to a stop.
        await press(page.getByText('The round', { exact: true }));
        const named = () => page.evaluate(() => document.activeElement?.getAttribute('aria-label') ?? '');
        for (let i = 0; i < 8 && !/^Stop, /.test(await named()); i++) await keys('Tab');
        await see(page.locator(':focus')).toHaveAttribute('aria-label', /^Stop, .+, \d$/);
        const name = /^Stop, (.+), \d$/.exec(await named())![1];
        await keys('Enter');
        const card = map.locator('.fd-map-card');
        await see(card).toBeVisible();
        await see(card.locator('.fd-map-card-title')).toHaveText(name);
        await see(card.locator('dt')).toHaveText(['Address', 'Delivered']);
        await keys('Escape');
        await see(card).toHaveCount(0);
      },
    },
  ],
};
