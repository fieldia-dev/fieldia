import { expect } from '../../fixtures';
import { drag as dragOn, mapSettled } from '../../map-support';
import type { Locator, Page } from '@playwright/test';
import type { DemoReplay } from '../hand';
import { node } from './support';

/** The area a map-zone form holds now, as the app reads it. */
type Zone = { properties: { shape: string; radius?: number }; geometry: { type: string; coordinates: any } } | null;
const zoneOf = (page: Page) => page.evaluate(() => (window as any).fieldiaDemo.handle.form.getState().values['zone']) as Promise<Zone>;
const ringOf = (zone: Zone) => (zone?.geometry.coordinates[0] ?? []) as [number, number][];
/** A point on a part of the page, by shares of its width and height. */
async function shareOf(target: Locator, x: number, y: number) {
  const box = (await target.boundingBox())!;
  return { x: box.x + box.width * x, y: box.y + box.height * y };
}
/** A grip of the area's drawing, by the words it is named with: its middle. */
async function gripOf(field: Locator, words: string) {
  const box = (await field.locator(`.fd-map-grip[aria-label^="${words}"]`).first().boundingBox())!;
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/** The map-zone demo's how-to steps, replayed by hand (e2e/how-to.spec.ts). */
export const replay: DemoReplay = {
  steps: [
    {
      says: 'Press Polygon and click points on the map; click the first point again',
      async run({ page, phone, press, see }) {
        const field = node(page, 'zone');
        const map = field.locator('.fd-map-box');
        await see(map.locator('.leaflet-tile-loaded').first()).toBeVisible();
        await mapSettled(map);
        const polygon = field.getByRole('button', { name: 'Polygon' });
        await press(polygon);
        await see(polygon).toHaveAttribute('aria-pressed', 'true');
        // Said for the hand that draws: a mouse's clicks, a finger's taps.
        await see(map.locator('.fd-map-hint')).toContainText(phone ? 'Tap to add points. Tap the first point or double-tap to finish.' : 'Click to add points.');
        // Points on the map's lower part, clear of the bar that says what to do.
        const box = (await map.boundingBox())!;
        const corners: [number, number][] = [[0.3, 0.45], [0.6, 0.45], [0.6, 0.85], [0.3, 0.85]];
        for (const [x, y] of corners) await press(map, { position: { x: box.width * x, y: box.height * y } });
        await see(map.locator('.fd-map-hint')).toContainText('4 points');
        // The first point again closes it.
        await press(map, { position: { x: box.width * 0.3, y: box.height * 0.45 } });
        await expect.poll(async () => ringOf(await zoneOf(page)).length).toBe(5);
        await see(polygon).toHaveAttribute('aria-pressed', 'false');
        await see(map.locator('.fd-map-hint')).toBeHidden();
        await see(map.locator('path.fd-map-shape')).toHaveCount(1);
        // Four corners, and a point between each two.
        await see(map.locator('.fd-map-grip')).toHaveCount(8);
      },
    },
    {
      says: 'Press Box and drag across the map, or Circle and drag out from its centre.',
      notOnPhone: 'a drag: Playwright’s WebKit has no finger drag',
      async run({ page, press, see }) {
        const field = node(page, 'zone');
        const map = field.locator('.fd-map-box');
        // A circle, dragged out from its centre: its edge where the drag ended.
        await press(field.getByRole('button', { name: 'Circle' }));
        const centre = await shareOf(map, 0.5, 0.5);
        await dragOn(page, centre, { x: centre.x + 120, y: centre.y });
        await expect.poll(async () => (await zoneOf(page))?.properties.shape).toBe('circle');
        await see(field.locator('.fd-map-grip[aria-label^="Centre"]')).toBeVisible();
        await see(field.locator('.fd-map-grip[aria-label^="Edge"]')).toBeVisible();
        const edge = await gripOf(field, 'Edge');
        expect(Math.abs(edge.x - (centre.x + 120))).toBeLessThanOrEqual(3);
        // Or a box, dragged across: its corners where the drag began and ended.
        await press(field.getByRole('button', { name: 'Box' }));
        const from = await shareOf(map, 0.25, 0.4);
        const to = await shareOf(map, 0.6, 0.8);
        await dragOn(page, from, to);
        await expect.poll(async () => (await zoneOf(page))?.properties.shape).toBe('box');
        await see(map.locator('path.fd-map-shape')).toHaveCount(1);
        await see(map.locator('.fd-map-grip')).toHaveCount(4);
        const grips = await map.locator('.fd-map-grip').evaluateAll((all) => all.map((one) => { const r = one.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; }));
        for (const corner of [from, to]) expect(grips.some((g) => Math.abs(g.x - corner.x) <= 2 && Math.abs(g.y - corner.y) <= 2)).toBe(true);
      },
    },
    {
      says: 'Drag a point or a corner to reshape the area',
      notOnPhone: 'a drag: Playwright’s WebKit has no finger drag',
      async run({ page, see }) {
        const field = node(page, 'zone');
        const map = field.locator('.fd-map-box');
        const shape = map.locator('path.fd-map-shape');
        // A corner, dragged: the area takes its new shape.
        const before = ringOf(await zoneOf(page));
        const corner = await gripOf(field, 'Point 1');
        await dragOn(page, corner, { x: corner.x - 50, y: corner.y - 30 });
        await expect.poll(async () => ringOf(await zoneOf(page))).not.toEqual(before);
        await expect.poll(async () => { const g = await gripOf(field, 'Point 1'); return Math.abs(g.x - (corner.x - 50)) <= 3 && Math.abs(g.y - (corner.y - 30)) <= 3; }).toBe(true);
        // A box has its corners alone: the small point between two, which adds one, is a polygon's — step 1's,
        // which step 2's box took the place of.
        await see(map.locator('.fd-map-grip')).toHaveCount(4);
        // The area itself, dragged: all of it moves.
        const was = (await shape.boundingBox())!;
        const inside = await shareOf(map, 0.45, 0.6);
        await dragOn(page, inside, { x: inside.x + 60, y: inside.y + 20 });
        await expect.poll(async () => Math.round((await shape.boundingBox())!.x - was.x)).toBe(60);
        await see(shape).toBeVisible();
        await see(map.locator('.fd-map-grip')).toHaveCount(4);
      },
    },
    {
      says: 'Choose “Within 2 km of Tahrir Square” from the list instead of drawing.',
      async run({ page, see }) {
        const field = node(page, 'zone');
        const map = field.locator('.fd-map-box');
        const list = field.getByRole('combobox', { name: 'Choose an area' });
        // The browser's own list of a select: picked from it as the browser offers it.
        await list.selectOption({ label: 'Within 2 km of Tahrir Square' });
        await expect.poll(() => zoneOf(page)).toEqual({ type: 'Feature', properties: { shape: 'circle', radius: 2000 }, geometry: { type: 'Point', coordinates: [31.2357, 30.0444] } });
        await see(map.locator('path.fd-map-shape')).toHaveCount(1);
        await see(map.locator('path.fd-map-shape')).toBeVisible();
      },
    },
    {
      says: 'Without a mouse: Tab to the map, press Space to put points at the cross',
      notOnPhone: 'a phone has no Tab, no Space on a map and no Enter there',
      async run({ page, keys, see }) {
        const field = node(page, 'zone');
        const map = field.locator('.fd-map-box');
        const polygon = field.getByRole('button', { name: 'Polygon' });
        const focused = (target: Locator) => target.evaluate((el) => el === document.activeElement);
        // Polygon, by the keys: back to it from the list, and Enter.
        for (let i = 0; i < 5 && !(await focused(polygon)); i++) await keys('Shift+Tab');
        await see(polygon).toBeFocused();
        await keys('Enter');
        await see(polygon).toHaveAttribute('aria-pressed', 'true');
        for (let i = 0; i < 6 && !(await focused(map)); i++) await keys('Tab');
        await see(map).toBeFocused();
        await see(map.locator('.fd-map-crosshair')).toBeVisible();
        await keys('Space');
        await see(map.locator('.fd-map-hint')).toContainText('1 point');
        await keys('ArrowRight', 'ArrowRight');
        await mapSettled(map);
        await keys('Space');
        await see(map.locator('.fd-map-hint')).toContainText('2 points');
        await keys('ArrowDown', 'ArrowDown');
        await mapSettled(map);
        await keys('Space');
        await see(map.locator('.fd-map-hint')).toContainText('3 points');
        await keys('Enter');
        await expect.poll(async () => ringOf(await zoneOf(page)).length).toBe(4);
        await see(field.locator('[aria-live]').first()).toHaveText('Area drawn.');
        await see(polygon).toHaveAttribute('aria-pressed', 'false');
      },
    },
  ],
};
