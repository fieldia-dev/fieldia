import type { Locator, Page } from '@playwright/test';
import { expect } from '../../fixtures';
import type { DemoReplay, Hand } from '../hand';
import { theMap, pins, mapCard, listRows, listRange, facets, mapStill, zoomOf, whereOn, zoomBy, panMap, insideMap } from './support-more';

/** Twenty thousand homes: the pager's count, the homes on the map as its bubbles say them in full, pins with a price. */
const manyTotal = async (page: Page) => Number(/of ([\d,]+)/.exec((await listRange(page).textContent()) ?? '')?.[1].replace(/,/g, ''));
const onTheMapCounted = (page: Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll('.fd-map-list .fd-map-mark:not(.fd-map-ghost)')].reduce((sum, mark) => {
      const words = mark.querySelector('.fd-map-bubble') ? (mark.getAttribute('aria-label') ?? '') : null;
      // Its name holds what its face shows first where the face says it shorter (WCAG 2.5.3, 0.36): "15K, 15,076 here."
      return sum + (words === null ? 1 : Number(/([\d,]+) here\./.exec(words)?.[1].replace(/,/g, '')));
    }, 0)
  );
/** A bubble of the source's, its words — "14K, 13,620 here." — on the mark itself. */
const clusters = (page: Page) => page.locator('.fd-map-list .fd-map-mark:not(.fd-map-ghost):has(.fd-map-bubble)');
const pricedPins = (page: Page) => pins(page).filter({ has: page.locator('.fd-map-face-text') });
/** The zooms the demo's data source was asked to gather its homes at: what reached the app, beside what is seen. */
const clusterZooms = async ({ demo }: Hand) => ((await demo<{ method: string; request: { zoom?: number } }[]>('dataSource.calls')) ?? []).filter((call) => call.method === 'clusters').map((call) => call.request.zoom);
/** The source's bubble nearest a place on the screen, and how far from it; -1 when there is none. */
async function bubbleAt(page: Page, map: Locator, place: { lat: number; lng: number }) {
  const at = await whereOn(map, place.lat, place.lng);
  const marks = await clusters(page).evaluateAll((list) => list.map((one) => one.getBoundingClientRect().toJSON() as DOMRect));
  const near = marks.map((b, i) => ({ i, d: Math.hypot(b.x + b.width / 2 - at.x, b.y + b.height / 2 - at.y) })).sort((x, y) => x.d - y.d)[0];
  return near ?? { i: -1, d: Infinity };
}
/**
 * The source's bubbles drawn for where the map stopped: it is asked a moment after the map stops, and its answer drawn
 * then — the same bubbles, where they were, twice running.
 */
async function bubblesStill(page: Page) {
  const drawn = () => clusters(page).evaluateAll((list) => list.map((one) => `${one.getAttribute('aria-label')}@${Math.round(one.getBoundingClientRect().x)},${Math.round(one.getBoundingClientRect().y)}`).join('|'));
  let last = '';
  await expect.poll(async () => { const now = await drawn(); const still = now === last; last = now; return still; }, { intervals: [400], timeout: 10_000 }).toBe(true);
}
/** A step closer on a place, as a person zooms in on it with a mouse: the place dragged back to the map's middle, then the map's +. */
async function closerOn(hand: Hand, place: { lat: number; lng: number }) {
  const { page } = hand;
  const map = theMap(page);
  await mapStill(map);
  const box = (await map.boundingBox())!;
  const at = await whereOn(map, place.lat, place.lng);
  if (Math.hypot(box.x + box.width / 2 - at.x, box.y + box.height / 2 - at.y) > 20) await panMap(page, { x: box.x + box.width / 2 - at.x, y: box.y + box.height / 2 - at.y });
  await zoomBy(hand, 1);
  await bubblesStill(page);
}

/** The map-many-homes demo’s how-to steps, replayed by hand (e2e/how-to.spec.ts). */
export const replay: DemoReplay = {
  timeout: 150_000,
  steps: [
    {
      says: 'Zoom in on Cairo: each bubble parts into smaller ones',
      notOnPhone: 'zooming in on a place is a pinch on a phone, and Playwright’s WebKit has no pinch (the map’s + zooms on its middle, not on Cairo)',
      async run(hand) {
        const { page, see } = hand;
        const map = theMap(page);
        await see(listRange(page)).toHaveText('1–12 of 20,000 homes');
        await expect.poll(() => onTheMapCounted(page)).toBe(19_900);
        await mapStill(map);
        // Cairo — its Zamalek, where homes crowd — kept in the map's middle as it comes closer a step at a time: its
        // bubble parts into smaller ones, each counted, until the streets show each home's own price.
        const cairo = { lat: 30.0626, lng: 31.2197 };
        const bubblesInView = async () => {
          const box = (await map.boundingBox())!;
          const all = await clusters(page).evaluateAll((list) => list.map((one) => one.getBoundingClientRect().toJSON() as DOMRect));
          return all.filter((b) => b.x > box.x && b.x + b.width < box.x + box.width && b.y > box.y && b.y + b.height < box.y + box.height).length;
        };
        await see(clusters(page).first()).toHaveAttribute('aria-label', /^(?:[\d.,]+K?, )?[\d,]+ here\. Zoom in to see them\.$/);
        let before = await bubblesInView();
        let parted = false;
        for (let i = 0; i < 14 && !(await pricedPins(page).count()); i++) {
          await closerOn(hand, cairo);
          // Each step's bubbles counted by the data source, asked for the zoom the map stopped at.
          const zoom = await zoomOf(map);
          await expect.poll(async () => (await clusterZooms(hand)).at(-1)).toBe(zoom);
          await mapStill(map);
          const now = await bubblesInView();
          if (now > before) parted = true;
          before = now;
        }
        expect(parted, 'a bubble parted into smaller ones').toBe(true);
        await see(pricedPins(page).first()).toBeVisible();
        await see(pricedPins(page).first().locator('.fd-map-face-text')).toHaveText(/^(\$\s)?[\d.]+[KM](\/month)?$/);
      },
    },
    {
      says: 'Click a bubble: the map zooms to where its homes are',
      async run(hand) {
        const { page, press, see } = hand;
        const map = theMap(page);
        // Back out a little, so there are bubbles to press.
        for (let i = 0; i < 4 && (await insideMap(page, clusters(page))) < 0; i++) await zoomBy(hand, -1);
        const at = await insideMap(page, clusters(page));
        expect(at, 'a bubble inside the map').toBeGreaterThanOrEqual(0);
        const before = await zoomOf(map);
        await press(clusters(page).nth(at));
        await expect.poll(() => zoomOf(map)).toBeGreaterThan(before);
        await mapStill(map);
        await see(page.locator('.fd-map-list .fd-map-mark').first()).toBeVisible();
      },
    },
    {
      says: 'Move the map: Search this area says how many homes are in view',
      notOnPhone: 'moving the list’s map is a drag — two fingers on a phone — and Playwright’s WebKit has no touch drag',
      async run({ page, press, see }) {
        await panMap(page, { x: 90, y: -50 });
        const here = page.getByRole('button', { name: /^Search this area/ });
        await see(here).toHaveText(/^Search this area \([\d,]+\)$/);
        // The count is the bubbles' and pins' drawn in view.
        const inView = await onTheMapCounted(page);
        await see(here).toHaveText(`Search this area (${inView.toLocaleString('en')})`);
        await press(here);
        await see(facets(page)).toHaveText(['In this area']);
        await expect.poll(() => manyTotal(page)).toBe(inView);
      },
    },
    {
      says: 'Pick For rent from the search menu: the map fits the rentals',
      async run({ page, press, keys, see }) {
        await press(page.getByRole('button', { name: 'Search options' }));
        await press(page.locator('.fd-search-panel').getByRole('button', { name: 'For rent' }));
        await keys('Escape');
        await see(facets(page)).toContainText(['For rent']);
        // Every rental counted on the map, but those with no place, said under it.
        const rentals = await manyTotal(page);
        const unplaced = Number(/^(\d+) without a place/.exec((await page.locator('.fd-map-list-note').textContent()) ?? '')?.[1] ?? 0);
        await expect.poll(() => onTheMapCounted(page)).toBe(rentals - unplaced);
        await see(listRows(page).first()).toContainText('For rent');
      },
    },
    {
      says: 'Point at a row in the list: its pin lights up on the map',
      notOnPhone: 'pointing is a mouse’s: a phone has no pointer to rest on a row',
      async run({ page, hover, see }) {
        await hover(listRows(page).first());
        const lit = page.locator('.fd-map-list .fd-map-ghost .fd-map-face[data-hot]');
        await see(lit).toHaveCount(1);
        await see(lit).toBeVisible();
        // Its own pin, drawn over the bubble it is in, with its price.
        await see(lit.locator('.fd-map-face-text')).toHaveText(/^(\$\s)?[\d.]+[KM](\/month)?$/);
      },
    },
    {
      says: 'Take For rent and the area out of the search, zoom in on the New Capital',
      notOnPhone: 'zooming in on one place is a pinch on a phone, and Playwright’s WebKit has no pinch (the map’s + zooms on its middle, a bubble pressed on all its homes)',
      async run(hand) {
        const { page, press, see } = hand;
        const map = theMap(page);
        // The search's chips taken away by their ×: every home again.
        await press(page.getByRole('button', { name: 'Remove For rent' }));
        await press(page.getByRole('button', { name: 'Remove In this area' }));
        await see(facets(page)).toHaveCount(0);
        await see(listRange(page)).toHaveText('1–12 of 20,000 homes');
        const tower = { lat: 30.0155, lng: 31.7125 };
        // Out until the New Capital is in the map, then closer on the tower until its bubble stands alone: on its spot,
        // the homes round it parted into pins of their own.
        const inMap = async () => {
          const box = (await map.boundingBox())!;
          const at = await whereOn(map, tower.lat, tower.lng);
          return at.x > box.x + 40 && at.x < box.x + box.width - 40 && at.y > box.y + 40 && at.y < box.y + box.height - 40;
        };
        await mapStill(map);
        for (let i = 0; i < 8 && !(await inMap()); i++) await zoomBy(hand, -1);
        await bubblesStill(page);
        const alone = async () => {
          const near = await bubbleAt(page, map, tower);
          const box = (await map.boundingBox())!;
          const inView = (await clusters(page).evaluateAll((list) => list.map((one) => one.getBoundingClientRect().toJSON() as DOMRect))).filter((b) => b.x + b.width > box.x && b.x < box.x + box.width && b.y + b.height > box.y && b.y < box.y + box.height);
          return near.i >= 0 && near.d < 16 && inView.length === 1;
        };
        for (let i = 0; i < 16 && !(await alone()) && (await clusters(page).count()); i++) await closerOn(hand, tower);
        await bubblesStill(page);
        expect((await bubbleAt(page, map, tower)).d, 'the tower’s bubble, on its spot').toBeLessThan(16);
        // Alone on its spot, its sixty flats: pressed.
        const sixty = page.locator('.fd-map-list .fd-map-mark[aria-label="60 here. Zoom in to see them."]');
        await see(sixty).toHaveCount(1);
        await see(sixty).toBeVisible();
        await press(sixty);
        const card = mapCard(page);
        await see(card.locator('.fd-map-card-title')).toHaveText('60 in one place');
        await see(card.locator('.fd-map-crowd-list button')).toHaveCount(50);
        await see(card.locator('.fd-map-crowd-list li').last()).toHaveText('And 10 more here');
      },
    },
  ],
};
