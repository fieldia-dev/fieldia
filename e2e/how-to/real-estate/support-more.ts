import type { Locator, Page } from '@playwright/test';
import { expect } from '../../fixtures';
import type { Hand } from '../hand';

/** The helpers the real-estate demos from Listing photos on (real-estate-more.ts) share: their frame, their maps, their photos. */

/** A field of the form, by its node's id. */
export const node = (page: Page, id: string) => page.locator(`[data-node="${id}"]`);
/**
 * A step's link followed (from the how-to panel where the line under the demo's name does not show it); on a phone the
 * panel, if the next page has it open over the demo, is closed as a person closes it, by its ×.
 */
export async function follow(hand: Hand, words: string | RegExp) {
  const { page, phone } = hand;
  const was = page.url();
  await hand.follow(words);
  await page.waitForURL((url) => url.href !== was);
  await expect(page.locator('.dh-title')).toBeVisible();
  if (phone) await closePanel(hand);
}
/** The how-to panel closed by its ×, as a person closes it to have the page back, if it is open. */
export async function closePanel({ page, press }: Hand) {
  const panel = page.getByRole('complementary', { name: 'About this demo' });
  // A followed link's page draws its frame as its scripts run, after its address shows: the header's Options and the
  // panel, open as it remembers, in one pass (demos/shell.mjs). Looked at sooner, the panel was not there, then opened.
  await expect(page.locator('#demo-head .dh-options')).toBeAttached();
  if (await panel.isVisible()) await press(panel.getByRole('button', { name: 'Close the panel' }));
  await expect(panel).toBeHidden();
}
/** A listing's photos field, and its files still on their way. */
export const photosField = (page: Page) => node(page, 'f-photos');
/** A list's map, its marks — pins and bubbles, not a lit row's pin drawn over its bubble — and its card. */
export const theMap = (page: Page) => page.locator('.fd-map-list .fd-map-box');
export const pins = (page: Page) => page.locator('.fd-map-list .fd-map-mark:not(.fd-map-ghost)[data-id]');
export const mapCard = (page: Page) => page.locator('.fd-map-list .fd-map-card');
export const listRows = (page: Page) => page.locator('.fd-list-row');
export const listRange = (page: Page) => page.locator('.fd-pager-text');
export const facets = (page: Page) => page.locator('.fd-facet .fd-facet-text');
/** The map has stopped moving: no zoom on its way, its panes where they were a moment ago (e2e/map-support.ts). */
export async function mapStill(map: Locator) {
  const where = () => map.evaluate((el) => `${el.querySelector('.leaflet-zoom-anim') ? 'zooming' : ''}|${el.querySelector<HTMLElement>('.leaflet-map-pane')?.style.transform}|${[...el.querySelectorAll<HTMLElement>('.leaflet-tile-container')].map((level) => level.style.transform).join(';')}`);
  let last = '';
  await expect.poll(async () => { const now = await where(); const still = now === last && !now.startsWith('zooming'); last = now; return still; }, { intervals: [150], timeout: 10_000 }).toBe(true);
}
/** The map's zoom, as the address of the images of the level it shows says it. */
export const zoomOf = (map: Locator) =>
  map.evaluate((el) => {
    const levels = [...el.querySelectorAll<HTMLElement>('.leaflet-tile-container')].filter((level) => level.querySelector('.leaflet-tile-loaded'));
    const top = levels.sort((a, b) => Number(b.style.zIndex || 0) - Number(a.style.zIndex || 0))[0];
    return Number(/\/(\d+)\/\d+\/\d+\.png/.exec(top?.querySelector('.leaflet-tile-loaded')?.getAttribute('src') ?? '')?.[1]);
  });
/**
 * Where a place is on the screen, read from the map's own images as a person reads a map: each image's address names
 * its zoom and its square of the world, and where it is drawn says where that square is.
 */
export async function whereOn(map: Locator, lat: number, lng: number) {
  return map.evaluate((el, [la, ln]) => {
    const levels = [...el.querySelectorAll<HTMLElement>('.leaflet-tile-container')].filter((level) => level.querySelector('.leaflet-tile-loaded'));
    const top = levels.sort((a, b) => Number(b.style.zIndex || 0) - Number(a.style.zIndex || 0))[0];
    const tile = top.querySelector<HTMLImageElement>('.leaflet-tile-loaded')!;
    const [z, x, y] = /\/(\d+)\/(\d+)\/(\d+)\.png/.exec(tile.src)!.slice(1).map(Number);
    const box = tile.getBoundingClientRect();
    const size = box.width;
    const world = size * 2 ** z;
    const px = ((ln + 180) / 360) * world;
    const rad = (la * Math.PI) / 180;
    const py = ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * world;
    return { x: box.x + px - x * size, y: box.y + py - y * size };
  }, [lat, lng] as const);
}
/** The map's own Zoom in or Zoom out, pressed a step at a time, each seen to be made, as a person presses them. */
export async function zoomBy({ page, press }: Hand, steps: number, map = theMap(page)) {
  for (let i = 0; i < Math.abs(steps); i++) {
    await mapStill(map);
    const was = await zoomOf(map);
    await press(map.getByRole('button', { name: steps > 0 ? 'Zoom in' : 'Zoom out', exact: true }));
    await expect.poll(() => zoomOf(map)).toBe(was + Math.sign(steps));
  }
  await mapStill(map);
}
/**
 * The map dragged by the mouse at a hand's pace, from a spot of its ground — no pin, bubble or button under the
 * pointer, which a press there would take — by so many pixels.
 */
export async function panMap(page: Page, by: { x: number; y: number }, map = theMap(page)) {
  await map.scrollIntoViewIfNeeded();
  const box = (await map.boundingBox())!;
  const ground = await map.evaluate((el, b) => {
    for (let fy = 0.5; fy < 0.9; fy += 0.05) for (const fx of [0.5, 0.4, 0.6, 0.3, 0.7]) {
      const x = b.x + b.width * fx;
      const y = b.y + b.height * fy;
      const under = document.elementFromPoint(x, y);
      if (under && el.contains(under) && !under.closest('.leaflet-marker-icon, .leaflet-control, .leaflet-popup, button')) return { x, y };
    }
    return null;
  }, box);
  expect(ground, 'a spot of the map with nothing on it').not.toBeNull();
  await page.mouse.move(ground!.x, ground!.y);
  await page.mouse.down();
  await page.mouse.move(ground!.x + by.x, ground!.y + by.y, { steps: 16 });
  await page.mouse.up();
  await mapStill(map);
}
/** Which of some marks stands well inside the map's box (one past its edge is under whatever is drawn there), or -1. */
export async function insideMap(page: Page, marks: Locator, map = theMap(page)) {
  const box = (await map.boundingBox())!;
  const all = await marks.evaluateAll((list) => list.map((mark) => (mark.querySelector('.fd-map-face') ?? mark).getBoundingClientRect().toJSON() as DOMRect));
  return all.findIndex((b) => b.x > box.x + 50 && b.x + b.width < box.x + box.width - 60 && b.y > box.y + 60 && b.y + b.height < box.y + box.height - 40);
}
