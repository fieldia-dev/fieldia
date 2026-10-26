import { type Locator, type Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { axeFindings } from './a11y-support';
import { at, drag, fingerDrag, mapOf, mapReady, stubMaps, valueOf } from './map-support';
import { node, open, screen } from './support';

/**
 * An area on a map (@fieldia/map's `area` widget), in the zone demo: a
 * polygon, a box or a circle, drawn by mouse, finger and keyboard, reshaped
 * and moved by its grips, chosen from named areas, written as a GeoJSON
 * Feature. Map images are a stand-in (map-support.ts).
 */

const QUERY = 'page=map-zone&skin=outlined';

async function openArea(page: Page, query = QUERY) {
  await stubMaps(page);
  const { problems } = await open(page, 'plain', query);
  const map = mapOf(page, 'zone');
  await mapReady(map);
  return { map, problems, field: node(page, 'zone') };
}

type Feature = { type: 'Feature'; properties: { shape: string; radius?: number }; geometry: { type: string; coordinates: any } };
const zone = (page: Page) => valueOf(page, 'zone') as Promise<Feature | null>;
const ring = (feature: Feature | null) => (feature?.geometry.coordinates[0] ?? []) as [number, number][];

/** A grip's middle, by its words. */
async function gripAt(field: Locator, words: string) {
  const box = (await field.locator(`.fd-map-grip[aria-label^="${words}"]`).first().boundingBox())!;
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

async function clickAll(page: Page, map: Locator, shares: [number, number][]) {
  for (const [x, y] of shares) {
    const p = await at(map, x, y);
    await page.mouse.click(p.x, p.y);
  }
}

const SQUARE: [number, number][] = [
  [0.3, 0.3],
  [0.6, 0.3],
  [0.6, 0.7],
  [0.3, 0.7],
];

test('a polygon: points clicked in turn, closed on the first; the tool is put down, the area has its grips', async ({ page }) => {
  const { map, field, problems } = await openArea(page);
  const polygon = field.getByRole('button', { name: 'Polygon' });
  await polygon.click();
  await expect(polygon).toHaveAttribute('aria-pressed', 'true');
  await expect(map.locator('.fd-map-hint')).toContainText('Click to add points.');
  await clickAll(page, map, SQUARE);
  await expect(map.locator('.fd-map-hint')).toContainText('4 points');
  await expect(map.getByRole('button', { name: 'Finish' })).toBeVisible();
  // Near the first point, it lights up: a click there closes the ring.
  const first = await at(map, 0.3, 0.3);
  await page.mouse.move(first.x + 6, first.y + 4);
  await expect(map.locator('.fd-map-grip[data-closes]')).toHaveCount(1);
  await screen(page, 'map-area-drawing');
  await page.mouse.click(first.x + 6, first.y + 4);

  await expect.poll(() => zone(page)).toMatchObject({ type: 'Feature', properties: { shape: 'polygon' }, geometry: { type: 'Polygon' } });
  const points = ring(await zone(page));
  expect(points).toHaveLength(5);
  expect(points[0]).toEqual(points[4]);
  await expect(polygon).toHaveAttribute('aria-pressed', 'false');
  await expect(map.locator('.fd-map-hint')).toBeHidden();
  // Four corners, and a point between each two to add one.
  await expect(map.locator('.fd-map-grip')).toHaveCount(8);
  await expect(field.getByRole('button', { name: 'Clear' })).toBeVisible();
  await screen(page, 'map-area-drawn');
  expect(problems).toEqual([]);
});

test('a double-click finishes a polygon without a doubled point; Enter finishes it; Backspace takes a point back; Escape stops', async ({ page }) => {
  const { map, field } = await openArea(page);
  const polygon = field.getByRole('button', { name: 'Polygon' });
  await polygon.click();
  await clickAll(page, map, SQUARE.slice(0, 3));
  const last = await at(map, 0.3, 0.7);
  await page.mouse.dblclick(last.x, last.y);
  await expect.poll(async () => ring(await zone(page)).length).toBe(5);

  await polygon.click();
  await clickAll(page, map, [...SQUARE, [0.45, 0.5]]);
  await page.keyboard.press('Backspace');
  await expect(map.locator('.fd-map-hint')).toContainText('4 points');
  await page.keyboard.press('Enter');
  await expect.poll(async () => ring(await zone(page)).length).toBe(5);

  const before = await zone(page);
  await polygon.click();
  await clickAll(page, map, SQUARE.slice(0, 2));
  await page.keyboard.press('Escape');
  await expect(polygon).toHaveAttribute('aria-pressed', 'false');
  await expect(map.locator('.fd-map-hint')).toBeHidden();
  // Stopped: the area there before is there still.
  expect(await zone(page)).toEqual(before);
});

test('a box, dragged across the map; a press with no drag draws nothing and keeps the tool in hand', async ({ page }) => {
  const { map, field } = await openArea(page);
  const box = field.getByRole('button', { name: 'Box' });
  await box.click();
  const p = await at(map, 0.5, 0.5);
  await page.mouse.click(p.x, p.y);
  expect(await zone(page)).toBeNull();
  await expect(box).toHaveAttribute('aria-pressed', 'true');

  const from = await at(map, 0.25, 0.3);
  const to = await at(map, 0.65, 0.75);
  await drag(page, from, to);
  await expect.poll(() => zone(page)).toMatchObject({ properties: { shape: 'box' } });
  const corners = ring(await zone(page));
  expect(corners).toHaveLength(5);
  // Square with the map: two longitudes and two latitudes.
  expect(new Set(corners.map((c) => c[0])).size).toBe(2);
  expect(new Set(corners.map((c) => c[1])).size).toBe(2);
  // Its corner grips sit where the drag began and ended.
  const grips = await map.locator('.fd-map-grip').evaluateAll((els) => els.map((el) => { const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; }));
  for (const corner of [from, to]) expect(grips.some((g) => Math.abs(g.x - corner.x) <= 2 && Math.abs(g.y - corner.y) <= 2)).toBe(true);
});

test('a circle, dragged out from its centre: its edge grip where the drag ended', async ({ page }) => {
  const { map, field } = await openArea(page);
  await field.getByRole('button', { name: 'Circle' }).click();
  const centre = await at(map, 0.5, 0.5);
  await drag(page, centre, { x: centre.x + 150, y: centre.y });
  await expect.poll(() => zone(page)).toMatchObject({ properties: { shape: 'circle' }, geometry: { type: 'Point' } });
  expect((await zone(page))!.properties.radius).toBeGreaterThan(0);
  const middle = await gripAt(field, 'Centre');
  const edge = await gripAt(field, 'Edge');
  expect(Math.abs(middle.x - centre.x)).toBeLessThanOrEqual(2);
  expect(Math.abs(edge.x - (centre.x + 150))).toBeLessThanOrEqual(3);
  expect(Math.abs(edge.y - centre.y)).toBeLessThanOrEqual(2);
});

test('by finger: a box drawn with a touch', async ({ page }) => {
  const { map, field } = await openArea(page);
  await field.getByRole('button', { name: 'Box' }).click();
  await fingerDrag(page, map, await at(map, 0.3, 0.3), await at(map, 0.7, 0.7));
  await expect.poll(() => zone(page)).toMatchObject({ properties: { shape: 'box' } });
});

test('grips: a corner drags to reshape; a point between two drags to add one; Delete on a corner takes it away; the arrow keys move one', async ({ page }) => {
  const { map, field } = await openArea(page);
  await field.getByRole('button', { name: 'Polygon' }).click();
  await clickAll(page, map, SQUARE);
  await page.keyboard.press('Enter');
  await expect.poll(async () => ring(await zone(page)).length).toBe(5);
  const before = ring(await zone(page));

  const corner = await gripAt(field, 'Point 1');
  await drag(page, corner, { x: corner.x - 60, y: corner.y - 30 });
  await expect.poll(async () => ring(await zone(page))).not.toEqual(before);
  expect(ring(await zone(page))).toHaveLength(5);

  const middle = await gripAt(field, 'Drag to add a point here');
  await drag(page, middle, { x: middle.x, y: middle.y - 50 });
  await expect.poll(async () => ring(await zone(page)).length).toBe(6);
  await expect(map.locator('.fd-map-grip')).toHaveCount(10);

  const third = field.locator('.fd-map-grip[aria-label^="Point 3"]');
  await third.focus();
  const was = ring(await zone(page));
  await page.keyboard.press('ArrowRight');
  await expect.poll(async () => ring(await zone(page))).not.toEqual(was);
  await expect(field.locator('.fd-map-grip[aria-label^="Point 3"]')).toBeFocused();
  await page.keyboard.press('Delete');
  await expect.poll(async () => ring(await zone(page)).length).toBe(5);
});

test('a box’s corner, dragged past the corner across from it, leaves a box square with the map', async ({ page }) => {
  const { map, field } = await openArea(page);
  await field.getByRole('button', { name: 'Box' }).click();
  await drag(page, await at(map, 0.4, 0.4), await at(map, 0.6, 0.6));
  await expect.poll(() => zone(page)).toMatchObject({ properties: { shape: 'box' } });
  const corner = await gripAt(field, 'Point 1');
  const target = await at(map, 0.75, 0.8);
  await page.mouse.move(corner.x, corner.y);
  await page.mouse.down();
  await page.mouse.move(target.x, target.y, { steps: 12 });
  // Still in hand, past the corner across: the grip is under the hand, not thrown to another corner.
  const held = (await map.locator('.fd-map-grip[aria-label^="Point 1"]').boundingBox())!;
  expect(Math.abs(held.x + held.width / 2 - target.x)).toBeLessThanOrEqual(2);
  expect(Math.abs(held.y + held.height / 2 - target.y)).toBeLessThanOrEqual(2);
  await page.mouse.up();
  await page.waitForTimeout(200);
  const corners = ring(await zone(page));
  expect(new Set(corners.map((c) => c[0])).size).toBe(2);
  expect(new Set(corners.map((c) => c[1])).size).toBe(2);
  // The box spans from where the corner was let go to the corner across from it.
  const grips = await map.locator('.fd-map-grip').evaluateAll((els) => els.map((el) => { const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; }));
  expect(grips.some((g) => Math.abs(g.x - target.x) <= 2 && Math.abs(g.y - target.y) <= 2)).toBe(true);
});

test('a circle’s edge drags to resize it, and its centre to move it', async ({ page }) => {
  const { map, field } = await openArea(page);
  await field.getByRole('button', { name: 'Circle' }).click();
  const centre = await at(map, 0.4, 0.5);
  await drag(page, centre, { x: centre.x + 80, y: centre.y });
  await expect.poll(() => zone(page)).toMatchObject({ properties: { shape: 'circle' } });
  const small = (await zone(page))!.properties.radius!;
  const edge = await gripAt(field, 'Edge');
  await drag(page, edge, { x: edge.x + 60, y: edge.y });
  await expect.poll(async () => (await zone(page))!.properties.radius!).toBeGreaterThan(small);
  const bigger = (await zone(page))!;
  const middle = await gripAt(field, 'Centre');
  await drag(page, middle, { x: middle.x + 100, y: middle.y + 30 });
  await expect.poll(async () => (await zone(page))!.geometry.coordinates).not.toEqual(bigger.geometry.coordinates);
  expect((await zone(page))!.properties.radius).toBe(bigger.properties.radius);
});

test('the whole area drags to move, every point by the same', async ({ page }) => {
  const { map, field } = await openArea(page);
  await field.getByRole('button', { name: 'Box' }).click();
  await drag(page, await at(map, 0.3, 0.3), await at(map, 0.5, 0.6));
  await expect.poll(() => zone(page)).toMatchObject({ properties: { shape: 'box' } });
  const before = ring(await zone(page));
  await drag(page, await at(map, 0.4, 0.45), await at(map, 0.6, 0.55));
  await expect.poll(async () => ring(await zone(page))).not.toEqual(before);
  const after = ring(await zone(page));
  const shifts = after.map((p, i) => [p[0] - before[i][0], p[1] - before[i][1]]);
  for (const shift of shifts) {
    expect(shift[0]).toBeCloseTo(shifts[0][0], 5);
    expect(shift[1]).toBeCloseTo(shifts[0][1], 5);
  }
  expect(shifts[0][0]).toBeGreaterThan(0);
});

test('in the demo’s frame, as a person opens it: a box drawn across the map selects nothing, and the area then drags the whole way', async ({ page }) => {
  // A person, not a test browser: the frame draws its menu, its how-to and its code drawer round the form. In 0.35 the
  // box's drag selected the zoom's "+ −" there, and the browser took the next press on the area for a drag and drop of
  // the words (dragstart, pointercancel): the area moved 5 pixels of 60.
  await page.addInitScript(() => Object.defineProperty(navigator, 'webdriver', { get: () => false }));
  const { map, field } = await openArea(page);
  await expect(page.locator('.dh-title')).toBeVisible();
  await field.getByRole('button', { name: 'Box' }).click();
  await drag(page, await at(map, 0.25, 0.4), await at(map, 0.6, 0.8));
  await expect.poll(() => zone(page)).toMatchObject({ properties: { shape: 'box' } });
  expect(await page.evaluate(() => String(getSelection()))).toBe('');
  await dragsWhole(page, map);
});

test('words left selected over the map: a press on the area drags the area, never the words', async ({ page }) => {
  const { map, field } = await openArea(page);
  await field.getByRole('button', { name: 'Box' }).click();
  await drag(page, await at(map, 0.25, 0.4), await at(map, 0.6, 0.8));
  await expect.poll(() => zone(page)).toMatchObject({ properties: { shape: 'box' } });
  // Every word over the map selected (its zoom's, its credits'), as a person's Ctrl+A selects them.
  await map.evaluate((element) => getSelection()!.selectAllChildren(element));
  await dragsWhole(page, map);
});

/** The area dragged 60 pixels across and 20 down from its middle: all of it moves the whole way, the browser dragging nothing of its own. */
async function dragsWhole(page: Page, map: Locator) {
  const dropped: string[] = [];
  await page.exposeFunction('fieldiaDropped', (type: string) => dropped.push(type));
  // A drag and drop the browser began and was let begin (read once the event is through), and a pointer taken from the drag.
  await page.evaluate(() =>
    ['dragstart', 'pointercancel'].forEach((type) =>
      document.addEventListener(type, (event) => setTimeout(() => event.defaultPrevented || (window as unknown as { fieldiaDropped(type: string): void }).fieldiaDropped(type)), true)
    )
  );
  const shape = map.locator('path.fd-map-shape');
  const was = (await shape.boundingBox())!;
  const inside = { x: was.x + was.width / 2, y: was.y + was.height / 2 };
  await drag(page, inside, { x: inside.x + 60, y: inside.y + 20 });
  await expect.poll(async () => Math.round((await shape.boundingBox())!.x - was.x)).toBe(60);
  expect(Math.round((await shape.boundingBox())!.y - was.y)).toBe(20);
  expect(dropped).toEqual([]);
}

test('by keyboard alone: Space puts points at the cross, the arrow keys move the map between them, Enter finishes', async ({ page }) => {
  const { map, field } = await openArea(page);
  await field.getByRole('button', { name: 'Polygon' }).focus();
  await page.keyboard.press('Enter');
  await expect(field.getByRole('button', { name: 'Polygon' })).toHaveAttribute('aria-pressed', 'true');
  for (let i = 0; i < 6 && !(await map.evaluate((el) => el === document.activeElement)); i++) await page.keyboard.press('Tab');
  await expect(map).toBeFocused();
  await expect(map.locator('.fd-map-crosshair')).toBeVisible();
  const keys = await map.getAttribute('aria-describedby');
  await expect(page.locator(`[id="${keys}"]`)).toContainText('Space puts a point at the centre of the map');
  await page.keyboard.press('Space');
  for (const key of ['ArrowRight', 'ArrowRight']) await page.keyboard.press(key);
  await page.waitForTimeout(300);
  await page.keyboard.press('Space');
  for (const key of ['ArrowDown', 'ArrowDown']) await page.keyboard.press(key);
  await page.waitForTimeout(300);
  await page.keyboard.press('Space');
  await expect(map.locator('.fd-map-hint')).toContainText('3 points');
  await page.keyboard.press('Enter');
  await expect.poll(async () => ring(await zone(page)).length).toBe(4);
  await expect(field.locator('[aria-live]').first()).toHaveText('Area drawn.');
});

test('a named area, chosen instead of drawn', async ({ page }) => {
  const { field, map } = await openArea(page);
  await field.getByRole('combobox', { name: 'Choose an area' }).selectOption({ label: 'Within 2 km of Tahrir Square' });
  await expect.poll(() => zone(page)).toEqual({ type: 'Feature', properties: { shape: 'circle', radius: 2000 }, geometry: { type: 'Point', coordinates: [31.2357, 30.0444] } });
  await expect(map.locator('path.fd-map-shape')).toHaveCount(1);
});

test('an area given from outside is drawn and brought into view', async ({ page }) => {
  const { map } = await openArea(page);
  await page.evaluate(() =>
    (window as any).fieldiaDemo.handle.form.setValue('zone', { type: 'Feature', properties: { shape: 'polygon' }, geometry: { type: 'Polygon', coordinates: [[[2.29, 48.85], [2.3, 48.85], [2.3, 48.86], [2.29, 48.85]]] } })
  );
  const shape = map.locator('path.fd-map-shape');
  await expect(shape).toHaveCount(1);
  const drawn = (await shape.boundingBox())!;
  const box = (await map.boundingBox())!;
  expect(drawn.x).toBeGreaterThanOrEqual(box.x);
  expect(drawn.x + drawn.width).toBeLessThanOrEqual(box.x + box.width);
  expect(drawn.width).toBeGreaterThan(40);
});

test('read-only: no tools, no grips, the area stays put', async ({ page }) => {
  const { map, field } = await openArea(page);
  await field.getByRole('button', { name: 'Box' }).click();
  await drag(page, await at(map, 0.3, 0.3), await at(map, 0.6, 0.6));
  await expect.poll(() => zone(page)).toMatchObject({ properties: { shape: 'box' } });
  const drawn = await zone(page);
  await page.evaluate(() => (window as any).fieldiaDemo.handle.setReadonly(true));
  await expect(field.locator('.fd-map-tools')).toBeHidden();
  await expect(map.locator('.fd-map-grip')).toHaveCount(0);
  await drag(page, await at(map, 0.45, 0.45), await at(map, 0.7, 0.7));
  await page.waitForTimeout(200);
  expect(await zone(page)).toEqual(drawn);
});

test('the bar that says what to do never covers the zoom buttons, left to right or right to left', async ({ page }) => {
  for (const query of [QUERY, `${QUERY}&locale=ar&dir=rtl`]) {
    const { map, field } = await openArea(page, query);
    await field.locator('.fd-map-tools .fd-button').first().click();
    const hint = (await map.locator('.fd-map-hint').boundingBox())!;
    const zoom = (await map.locator('.fd-map-zoom').boundingBox())!;
    const apart = hint.x + hint.width <= zoom.x || zoom.x + zoom.width <= hint.x || hint.y + hint.height <= zoom.y;
    expect(apart, `${query}: the bar covers the zoom buttons`).toBe(true);
    if (query.includes('ar')) {
      await expect(field.getByRole('button', { name: 'مضلّع' })).toBeVisible();
      // Its words run right to left, though the map under them does not.
      await expect(map.locator('.fd-map-hint')).toHaveAttribute('dir', 'rtl');
      await screen(page, 'map-area-arabic');
    }
  }
});

test('no accessibility findings: empty, drawing, and drawn', async ({ page }) => {
  const { map, field } = await openArea(page);
  expect(await axeFindings(page, 'area, empty')).toEqual([]);
  await field.getByRole('button', { name: 'Polygon' }).click();
  await clickAll(page, map, SQUARE.slice(0, 2));
  expect(await axeFindings(page, 'area, drawing')).toEqual([]);
  await clickAll(page, map, SQUARE.slice(2));
  await page.keyboard.press('Enter');
  await expect.poll(async () => ring(await zone(page)).length).toBe(5);
  expect(await axeFindings(page, 'area, drawn')).toEqual([]);
});
