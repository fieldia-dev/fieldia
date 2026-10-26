import { expect } from '../../fixtures';
import type { DemoReplay } from '../hand';

/** The map-order demo's how-to steps, replayed by hand (e2e/how-to.spec.ts). */
export const replay: DemoReplay = {
  timeout: 90_000,
  steps: [
    {
      says: 'Watch the courier: a new place every two seconds, the pin gliding',
      async run({ page, see }) {
        const map = page.locator('.fd-map-form .fd-map-box');
        await see(map.locator('.leaflet-tile-loaded').first()).toBeVisible();
        const arrives = page.getByRole('textbox', { name: 'Arrives in' });
        await see(arrives).toHaveValue(/^\d+ min$/);
        const minutes = async () => Number(/^(\d+)/.exec(await arrives.inputValue())?.[1]);
        const first = await minutes();
        // The courier's pin (alone, or gathered with the kitchen's while still beside it), where it stands, again and again.
        const pin = map.locator('.leaflet-marker-icon').filter({ has: page.locator('.fd-map-face[data-look="photo"]') }).first();
        const places = new Set<string>();
        await expect
          .poll(async () => {
            places.add((await pin.getAttribute('style')) ?? '');
            return places.size;
          }, { timeout: 30_000 })
          .toBeGreaterThanOrEqual(6);
        // The road behind fades, the minutes count down.
        await see(map.locator('path.fd-map-route')).toHaveCount(1);
        await expect.poll(minutes, { timeout: 45_000 }).toBeLessThan(first);
        await see(arrives).toHaveValue(/^\d+ min$/);
      },
    },
    {
      says: 'Drag the map away: it stops following the courier, and Follow',
      notOnPhone: 'a drag: Playwright’s WebKit has no touch drag',
      async run({ page, press, drag, see }) {
        const map = page.locator('.fd-map-form .fd-map-box');
        const follow = page.getByRole('button', { name: 'Follow' });
        await see(follow).toBeHidden();
        const box = (await map.boundingBox())!;
        await drag(map, { x: box.x + box.width / 2 + 300, y: box.y + box.height / 2 + 150 });
        await see(follow).toBeVisible();
        await press(follow);
        await see(follow).toBeHidden();
        // Back in view: the courier inside the map.
        const courier = map.locator('.leaflet-marker-icon').filter({ has: page.locator('.fd-map-face[data-look="photo"]') }).first();
        await expect
          .poll(async () => {
            const [where, at] = [(await courier.boundingBox())!, (await map.boundingBox())!];
            return where.x > at.x && where.x + where.width < at.x + at.width && where.y > at.y && where.y + where.height < at.y + at.height;
          })
          .toBe(true);
        await see(courier).toBeVisible();
      },
    },
    {
      says: 'Press My location at the map’s corner: once you allow it, a dot',
      async run({ page, press, see }) {
        // The browser asks; the person allows it, and is in Zamalek.
        await page.context().grantPermissions(['geolocation']);
        await page.context().setGeolocation({ latitude: 30.0561, longitude: 31.2243 });
        const locate = page.getByRole('button', { name: 'My location' });
        await see(page.locator('.fd-map-form .fd-map-me')).toHaveCount(0);
        await press(locate);
        await see(locate).toHaveAttribute('aria-pressed', 'true');
        await see(page.locator('.fd-map-form .fd-map-me')).toHaveCount(1);
        await see(page.locator('.fd-map-form .fd-map-me').first()).toBeVisible();
      },
    },
    {
      says: 'Tab to the courier’s pin and press Enter: their card says how far',
      notOnPhone: 'a phone has no Tab key: a tap on the courier opens the card there',
      async run({ page, press, keys, see }) {
        const map = page.locator('.fd-map-form .fd-map-box');
        // From the words over the map (a press there, where the next Tab starts from), Tab after Tab to the courier.
        await press(page.getByText('Where your order is', { exact: true }));
        await keys('Tab');
        await see(map, 'the map, the first stop after the words over it').toBeFocused();
        const focused = page.locator(':focus');
        const named = () => page.evaluate(() => document.activeElement?.getAttribute('aria-label') ?? '');
        const onTheMap = () => page.evaluate(() => !!document.activeElement?.closest('.fd-map-form .fd-map-box'));
        for (let i = 0; i < 12 && !(await named()).startsWith('Courier'); i++) {
          const now = await named();
          expect(await onTheMap(), `Tab after Tab through the map: the focus left it at “${now}”`).toBe(true);
          // The courier gathered with a place near them ("2 here: …, Courier"): Enter zooms in on them, and once the
          // map has, they part, the focus going on with them.
          if (/Courier.*Zoom in to see them/.test(now)) {
            await keys('Enter');
            await expect.poll(named, { message: `Enter on “${now}”: the map zoomed in and the focus went on` }).not.toBe(now);
          } else await keys('Tab');
        }
        await see(focused).toHaveAttribute('aria-label', /^Courier, Mona Adel/);
        await keys('Enter');
        const card = map.locator('.fd-map-card');
        await see(card).toBeVisible();
        await see(card.locator('.fd-map-card-title')).toHaveText('Mona Adel');
        await see(card.locator('dt')).toHaveText(['Arrives in', 'Metres left']);
        await see(card.locator('dd').nth(1)).toHaveText(/\d/);
        await keys('Escape');
        await see(card).toHaveCount(0);
      },
    },
  ],
};
