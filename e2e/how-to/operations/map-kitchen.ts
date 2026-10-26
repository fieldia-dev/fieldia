import { expect } from '../../fixtures';
import type { Locator } from '@playwright/test';
import type { DemoReplay } from '../hand';

/**
 * A spot of a map's area a person can point at: inside it, with nothing over it — found in the page as the pointer
 * finds what is under it (as e2e/map-areas.spec.ts finds it), as a point within the area's box.
 */
async function spotOf(area: Locator): Promise<{ x: number; y: number }> {
  const box = (await area.boundingBox())!;
  const spot = await area.evaluate((path, b) => {
    for (let y = 0.3; y <= 0.7; y += 0.05)
      for (let x = 0.3; x <= 0.7; x += 0.05) {
        const px = b.x + b.width * x;
        const py = b.y + b.height * y;
        if (document.elementFromPoint(px, py) === path) return { x: px - b.x, y: py - b.y };
      }
    return null;
  }, box);
  expect(spot, 'a spot of the area with nothing over it').not.toBeNull();
  return spot!;
}

/** The map-kitchen demo's how-to steps, replayed by hand (e2e/how-to.spec.ts). */
export const replay: DemoReplay = {
  timeout: 180_000,
  steps: [
    {
      says: 'Click Mohandessin on the map: Tonight’s offer goes to Mohandessin',
      async run({ page, press, see }) {
        const map = page.getByRole('region', { name: "Tonight's deliveries, map" });
        await see(map.locator('.leaflet-tile-loaded').first()).toBeVisible();
        const district = (name: string) => page.locator(`path.fd-map-region[aria-label^="${name}:"]`);
        const offer = page.getByRole('combobox', { name: "Tonight's offer goes to" });
        await see(offer.locator('option:checked')).toHaveText('Zamalek');
        await district('Mohandessin').scrollIntoViewIfNeeded();
        await press(district('Mohandessin'), { position: await spotOf(district('Mohandessin')) });
        await see(offer.locator('option:checked')).toHaveText('Mohandessin');
        await see(district('Mohandessin')).toHaveAttribute('data-chosen', '');
        await see(district('Zamalek')).not.toHaveAttribute('data-chosen', '');
        // Its border drawn strong: wider than a district's not chosen.
        const width = async (name: string) => parseFloat(await district(name).evaluate((path) => getComputedStyle(path).strokeWidth));
        await expect.poll(async () => (await width('Mohandessin')) > (await width('Zamalek'))).toBe(true);
      },
    },
    {
      says: 'Watch the courier ride to Zamalek: as they cross into the drop-off',
      async run({ page, see }) {
        const zone = page.getByRole('checkbox', { name: 'In the drop-off zone' });
        await see(zone).not.toBeChecked();
        // On the way from the kitchen: a new place every two seconds, into the zone round the next door.
        await see(page.getByText('The courier is in the drop-off zone: tell the customer they are almost there.')).toBeVisible({ timeout: 120_000 });
        await see(zone).toBeChecked();
      },
    },
    {
      says: 'Draw a new drop-off zone under the map, round the courier’s way',
      notOnPhone: 'a drag: Playwright’s WebKit has no touch drag',
      async run({ page, press, see }) {
        const field = page.getByRole('group', { name: 'Drop-off zone' });
        const map = field.getByRole('region', { name: 'Drop-off zone, map' });
        await map.scrollIntoViewIfNeeded();
        // Where the zone's corners stand on the screen, for the places on the way ahead (the zone's own corners'
        // places are the record's): the road's last stretch before the door, in Zamalek.
        const corner = async (n: number) => {
          const b = (await map.getByRole('button', { name: `Point ${n}. Arrow keys move it.` }).boundingBox())!;
          return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
        };
        const [p1, p2, p4] = [await corner(1), await corner(2), await corner(4)];
        const [l1, l2, l4] = [[31.2165, 30.0598], [31.2262, 30.0581], [31.2172, 30.0668]];
        const screenOf = (lng: number, lat: number) => {
          // The plane through the three corners: x and y as lng and lat go.
          const det = (l2[0] - l1[0]) * (l4[1] - l1[1]) - (l4[0] - l1[0]) * (l2[1] - l1[1]);
          const u = ((lng - l1[0]) * (l4[1] - l1[1]) - (l4[0] - l1[0]) * (lat - l1[1])) / det;
          const v = ((l2[0] - l1[0]) * (lat - l1[1]) - (lng - l1[0]) * (l2[1] - l1[1])) / det;
          return { x: p1.x + u * (p2.x - p1.x) + v * (p4.x - p1.x), y: p1.y + u * (p2.y - p1.y) + v * (p4.y - p1.y) };
        };
        await press(field.getByRole('button', { name: 'Clear' }));
        await press(field.getByRole('button', { name: 'Box' }));
        // Dragged corner to corner at a hand's pace, as hand.drag does from a place on the map.
        const from = screenOf(31.2185, 30.0642);
        const to = screenOf(31.2241, 30.0594);
        await page.mouse.move(from.x, from.y);
        await page.mouse.down();
        await page.mouse.move(to.x, to.y, { steps: 12 });
        await page.mouse.up();
        await see(map.locator('path').first()).toBeVisible();
        // The courier, out of the new zone (they leave the old one, or ride on from the door to their next order),
        // then reaching it: its step runs. They ride the stretch again and again, a lap in under forty seconds.
        const zone = page.getByRole('checkbox', { name: 'In the drop-off zone' });
        await see(zone).not.toBeChecked({ timeout: 45_000 });
        await see(zone).toBeChecked({ timeout: 45_000 });
        await see(page.getByText('The courier is in the drop-off zone: tell the customer they are almost there.').last()).toBeVisible();
      },
    },
    {
      says: 'Tab to the districts and press Enter on one to choose it',
      notOnPhone: 'a phone has no Tab key: its districts are tapped (the first step)',
      async run({ page, press, keys, see }) {
        const offer = page.getByRole('combobox', { name: "Tonight's offer goes to" });
        // From the words over the map (a press there, where the next Tab starts from), Tab after Tab to the districts.
        await press(page.getByText("Tonight's deliveries", { exact: true }));
        const named = () => page.evaluate(() => document.activeElement?.getAttribute('aria-label') ?? '');
        for (let i = 0; i < 6 && !/· Delivery fee, EGP$/.test(await named()); i++) await keys('Tab');
        await see(page.locator('path.fd-map-region:focus')).toHaveCount(1);
        await keys('ArrowRight');
        const next = (await named()).split(':')[0];
        expect(next).not.toBe('');
        await keys('Enter');
        await see(offer.locator('option:checked')).toHaveText(next);
        await see(page.locator(`path.fd-map-region[aria-label^="${next}:"]`)).toHaveAttribute('data-chosen', '');
      },
    },
  ],
};
