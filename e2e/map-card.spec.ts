import { type Locator, type Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { mapReady, mapSettled, ROUTE_LINE, stubMaps, stubRoutes } from './map-support';
import { open, screen } from './support';

/**
 * A card a map opens — a list's map's (the homes demo) and a form's (an order's courier) — keeps itself and its buttons
 * inside the map, over everything drawn on it and clear of its credits, on a phone as on a desktop; each engine laying
 * out the card and the map its own way. 0.35's card was 320 pixels tall on a phone's list map of 305: its Choose under
 * the map's note ("2 without a place, not on the map"), its Open past the map's foot. Now no taller than the map
 * leaves room for — its picture shorter, its lines scrolling under its buttons — and the words over the map step aside
 * while it is open. Every map image is a stand-in (map-support.ts).
 */

const listMap = (page: Page) => page.locator('.fd-map-list .fd-map-box');
const formMap = (page: Page) => page.locator('.fd-map-form .fd-map-box');

/** What a press at the middle of `target` reaches is `target` itself (or inside it): nothing over it. */
async function reachable(page: Page, target: Locator, name: string) {
  const box = (await target.boundingBox())!;
  const hit = await target.evaluate((element, at) => {
    const under = document.elementFromPoint(at.x, at.y);
    return !!under && (element === under || element.contains(under));
  }, { x: box.x + box.width / 2, y: box.y + box.height / 2 });
  expect(hit, `${name}: a press at its middle reaches it`).toBe(true);
}

/** The card wholly inside its map, above the credits at the map's foot. */
async function insideTheMap(map: Locator, card: Locator) {
  const room = (await map.boundingBox())!;
  const at = (await card.boundingBox())!;
  const credits = (await map.locator('.fd-map-credits').boundingBox())!;
  expect(at.y).toBeGreaterThanOrEqual(room.y);
  expect(at.x).toBeGreaterThanOrEqual(room.x);
  expect(at.x + at.width).toBeLessThanOrEqual(room.x + room.width);
  expect(at.y + at.height, 'the card above the credits').toBeLessThanOrEqual(credits.y);
}

/** The homes' map, closer a bubble at a time until a pin stands well inside it; that pin pressed: its card. */
async function homeCard(page: Page) {
  const map = listMap(page);
  const inside = async (marks: Locator) => {
    const room = (await map.boundingBox())!;
    const all = await marks.evaluateAll((list) => list.map((mark) => mark.getBoundingClientRect().toJSON() as DOMRect));
    return all.findIndex((b) => b.x > room.x + 50 && b.x + b.width < room.x + room.width - 50 && b.y > room.y + 50 && b.y + b.height < room.y + room.height - 40);
  };
  const pins = map.locator('.fd-map-mark[data-id]');
  const bubbles = map.locator('.fd-map-mark:has(.fd-map-bubble)');
  for (let i = 0; i < 6 && (await inside(pins)) < 0; i++) {
    await bubbles.nth(Math.max(0, await inside(bubbles))).click();
    await mapSettled(map);
  }
  await pins.nth(await inside(pins)).click();
  const card = map.locator('.fd-map-card');
  await expect(card).toBeVisible();
  await expect(page.locator('.fd-map-list .leaflet-popup')).toHaveCSS('opacity', '1');
  await mapSettled(map);
  return card;
}

for (const look of [
  { name: 'phone', viewport: { width: 390, height: 664 } },
  { name: 'desktop', viewport: { width: 1280, height: 800 } },
]) {
  test.describe(look.name, () => {
    test.use({ viewport: look.viewport });

    test('a list’s map: a home’s card inside the map, its buttons over the note and clear of the credits, each a press away', async ({ page }) => {
      await stubMaps(page);
      await open(page, 'plain', 'page=map-homes&skin=outlined');
      const map = listMap(page);
      await mapReady(map);
      const note = map.locator('.fd-map-list-note');
      await expect(note).toHaveText('2 without a place, not on the map');
      const card = await homeCard(page);
      await insideTheMap(map, card);
      for (const [name, button] of [
        ['Close', card.getByRole('button', { name: 'Close' })],
        ['Choose', card.locator('.fd-map-card-choose')],
        ['Add to shortlist', card.getByRole('button', { name: 'Add to shortlist' })],
        ['Open', card.getByRole('button', { name: 'Open' })],
      ] as const)
        await reachable(page, button, name);
      // The note steps aside while the card is open, and is back when it closes.
      await expect(note).toBeHidden();
      await screen(page, `map-card-${look.name}`, { viewport: true });
      // Choose, pressed where it is: the home chosen.
      const choose = (await card.locator('.fd-map-card-choose').boundingBox())!;
      await page.mouse.click(choose.x + choose.width / 2, choose.y + choose.height / 2);
      await expect(card.getByRole('checkbox')).toBeChecked();
      await card.getByRole('button', { name: 'Close' }).click();
      await expect(card).toHaveCount(0);
      await expect(note).toBeVisible();
    });

    test('a form’s map: the courier’s card inside the map, clear of its credits', async ({ page }) => {
      await stubMaps(page);
      await stubRoutes(page);
      await open(page, 'plain', 'page=map-order&skin=outlined&readonly=1&ride=off');
      const map = formMap(page);
      await mapReady(map);
      await expect(map.locator('path.fd-map-route')).toHaveCount(1);
      // On the way, clear of the kitchen: a pin of their own, its card a press away.
      const place = ROUTE_LINE[60];
      await page.evaluate((p) => (window as unknown as { fieldiaDemo: { handle: { form: { setValues(values: Record<string, unknown>): void } } } }).fieldiaDemo.handle.form.setValues({ courier_lat: p.lat, courier_lng: p.lng }), place);
      const courier = map.locator('.leaflet-marker-icon.fd-map-mark').filter({ has: page.locator('.fd-map-face[data-look="photo"]') });
      await expect(courier).toHaveAttribute('aria-label', /^Courier, Mona Adel/);
      await mapSettled(map);
      await courier.click();
      const card = map.locator('.fd-map-card');
      await expect(card).toBeVisible();
      await expect(page.locator('.fd-map-form .leaflet-popup')).toHaveCSS('opacity', '1');
      await mapSettled(map);
      await insideTheMap(map, card);
      await reachable(page, card.getByRole('button', { name: 'Close' }), 'Close');
    });
  });
}
