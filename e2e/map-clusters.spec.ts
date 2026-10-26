import { type Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { axeFindings } from './a11y-support';
import { at, drag, mapReady, mapSettled, stubMaps, zoomOf } from './map-support';
import { open, screen } from './support';

/**
 * A list's map whose data source gathers its records where they crowd (`clusters`): twenty thousand homes across
 * Egypt, never loaded — the source asked for the view's bubbles as the search changes and a moment after the map
 * stops, a new search's homes fitted first, a bubble pressed zooming to where its homes are, the streets showing each
 * home's own pin, a bubble on one spot listing its homes, Search this area counting from the bubbles drawn. The list
 * beside it pages as ever. Every map image is a stand-in (map-support.ts).
 */

const MANY = 'page=map-many-homes&skin=outlined';

const theMap = (page: Page) => page.locator('.fd-map-list .fd-map-box');
const marks = (page: Page) => page.locator('.fd-map-list .fd-map-mark:not(.fd-map-ghost)');
const pins = (page: Page) => page.locator('.fd-map-list .fd-map-mark:not(.fd-map-ghost)[data-id]');
const bubbles = (page: Page) => page.locator('.fd-map-list .fd-map-mark:not(.fd-map-ghost):has(.fd-map-bubble)');
const card = (page: Page) => page.locator('.fd-map-list .fd-map-card');
const rows = (page: Page) => page.locator('.fd-list-row');
const pager = (page: Page) => page.locator('.fd-pager-text');
const note = (page: Page) => page.locator('.fd-map-list-note');
const here = (page: Page) => page.getByRole('button', { name: /^Search this area/ });
const box = (page: Page) => page.locator('.fd-search').getByRole('combobox');

/** How many homes the map shows: a pin one, a bubble as many as its words say in full ("13,620 here."). */
const onTheMap = (page: Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll('.fd-map-list .fd-map-mark:not(.fd-map-ghost)')].reduce((sum, mark) => {
      const words = mark.querySelector('.fd-map-bubble') ? (mark.getAttribute('aria-label') ?? '') : null;
      return sum + (words === null ? 1 : Number(/^[\d,]+/.exec(words)?.[0].replace(/,/g, '')));
    }, 0)
  );

/** What the demo's data source was asked: each call's member, and a map's zoom or a list's limit. */
type Asked = { method: string; zoom?: number; limit?: number; filter: unknown[] };
const asked = (page: Page) =>
  page.evaluate(() =>
    (window as unknown as { fieldiaDemo: { dataSource: { calls: { method: string; request: Record<string, unknown> }[] } } }).fieldiaDemo.dataSource.calls.map(
      ({ method, request }) => ({ method, zoom: request['zoom'] as number | undefined, limit: request['limit'] as number | undefined, filter: (request['filter'] as unknown[]) ?? [] })
    )
  ) as Promise<Asked[]>;
const clusterAsks = async (page: Page) => (await asked(page)).filter((call) => call.method === 'clusters');
/** The pager's count: "1–12 of 20,000 homes" is 20,000. */
const total = async (page: Page) => Number(/of ([\d,]+)/.exec((await pager(page).textContent()) ?? '')?.[1].replace(/,/g, ''));

async function openMany(page: Page, variant = 'plain', query = MANY) {
  await stubMaps(page);
  const opened = await open(page, variant, query);
  await mapReady(theMap(page));
  await expect(bubbles(page).first()).toBeAttached();
  return opened;
}

/**
 * The biggest bubble well inside the map, pressed as a person presses it: the map zooms to where its homes are, and
 * the source's answer for where it stopped is drawn (asked a moment after it stops).
 */
async function pressBiggest(page: Page) {
  const asks = (await clusterAsks(page)).length;
  const map = (await theMap(page).boundingBox())!;
  const all = await bubbles(page).evaluateAll((list) =>
    list.map((mark) => ({ n: Number(/^[\d,]+/.exec(mark.getAttribute('aria-label') ?? '')?.[0].replace(/,/g, '')), at: mark.getBoundingClientRect().toJSON() as DOMRect }))
  );
  const inside = all.map((b, i) => ({ ...b, i })).filter(({ at }) => at.x > map.x + 50 && at.x + at.width < map.x + map.width - 60 && at.y > map.y + 20 && at.y + at.height < map.y + map.height - 40);
  const biggest = inside.sort((a, b) => b.n - a.n)[0];
  await bubbles(page).nth(biggest.i).click();
  await mapSettled(theMap(page));
  await expect.poll(async () => (await clusterAsks(page)).length).toBeGreaterThan(asks);
  return biggest.n;
}

test('every one of 20,000 homes on the map, never loaded: the source’s bubbles for the view, the map fitted to them first, those without a place said', async ({ page }) => {
  const { problems } = await openMany(page);
  await expect(pager(page)).toHaveText('1–12 of 20,000 homes');
  // Every home with a place is on the map, in the source's bubbles; the hundred without one are said under it.
  await expect.poll(() => onTheMap(page)).toBe(19_900);
  await expect(note(page)).toHaveText('100 without a place, not on the map');
  const calls = await asked(page);
  // The table's page of twelve, and no map's load of 500: the map asked its bubbles of the whole world (zoom 0), to fit
  // where the homes are, then of the view it fitted.
  expect(calls.filter((call) => call.method === 'list').map((call) => call.limit)).toEqual([12]);
  const gathered = calls.filter((call) => call.method === 'clusters');
  expect(gathered.map((call) => call.zoom)).toEqual([0, await zoomOf(theMap(page))]);
  await expect(bubbles(page).first()).toHaveAttribute('aria-label', /^[\d,]+ here\. Zoom in to see them\.$/);
  await screen(page, 'map-clusters-opened');
  expect(problems).toEqual([]);
});

test('a bubble pressed zooms to where its homes are, and the source is asked for the view where the map stops', async ({ page }) => {
  await openMany(page);
  const before = await zoomOf(theMap(page));
  const asks = (await clusterAsks(page)).length;
  const n = await pressBiggest(page);
  await expect.poll(() => zoomOf(theMap(page))).toBeGreaterThan(before);
  // One ask for where it stopped, at its zoom: fewer homes in view, but those of the bubble among them.
  await expect.poll(async () => (await clusterAsks(page)).length).toBe(asks + 1);
  expect((await clusterAsks(page)).at(-1)?.zoom).toBe(await zoomOf(theMap(page)));
  await expect.poll(() => onTheMap(page)).toBeLessThan(19_900);
  expect(await onTheMap(page)).toBeGreaterThanOrEqual(n);
  await screen(page, 'map-clusters-zoomed');
  // By the keys too: Tab to a bubble, Enter.
  const zoom = await zoomOf(theMap(page));
  await theMap(page).focus();
  await page.keyboard.press('Tab');
  await expect(page.locator(':focus')).toHaveAttribute('aria-label', /^[\d,]+ here\. Zoom in to see them\.$/);
  await page.keyboard.press('Enter');
  await expect.poll(() => zoomOf(theMap(page))).toBeGreaterThan(zoom);
});

test('a run of zoom steps asks once, a moment after the map stops; a pan asks again', async ({ page }) => {
  await openMany(page);
  await expect.poll(async () => (await clusterAsks(page)).length).toBe(2);
  const zoomIn = theMap(page).getByRole('button', { name: 'Zoom in', exact: true });
  const start = await zoomOf(theMap(page));
  await zoomIn.click();
  await zoomIn.click();
  await zoomIn.click();
  await expect.poll(() => zoomOf(theMap(page))).toBe(start + 3);
  await mapSettled(theMap(page));
  // The three steps were one move: one ask, for where it stopped.
  await expect.poll(async () => (await clusterAsks(page)).map((call) => call.zoom)).toEqual([0, start, start + 3]);
  const from = await at(theMap(page), 0.5, 0.5);
  await drag(page, from, { x: from.x - 160, y: from.y + 60 });
  await mapSettled(theMap(page));
  await expect.poll(async () => (await clusterAsks(page)).map((call) => call.zoom)).toEqual([0, start, start + 3, start + 3]);
  // No list of the map's own was asked for, however it moved.
  expect((await asked(page)).filter((call) => call.method === 'list' && call.limit !== 12)).toEqual([]);
});

test('Search this area says how many homes are in view from the bubbles drawn, and the list keeps those', async ({ page }) => {
  await openMany(page);
  await pressBiggest(page);
  const from = await at(theMap(page), 0.5, 0.5);
  await drag(page, from, { x: from.x + 80, y: from.y - 40 });
  await mapSettled(theMap(page));
  // The count is the view's bubbles and pins, said as soon as they come: no count asked of its own.
  await expect(here(page)).toHaveText(/^Search this area \([\d,]+\)$/);
  const inView = await onTheMap(page);
  await expect(here(page)).toHaveText(`Search this area (${inView.toLocaleString('en')})`);
  expect((await asked(page)).filter((call) => call.method === 'list' && call.limit === 1)).toEqual([]);
  await screen(page, 'map-clusters-this-area');
  await here(page).click();
  await expect(page.locator('.fd-facet .fd-facet-text')).toHaveText(['In this area']);
  await expect.poll(() => total(page)).toBe(inView);
  // The map stays where it was put, every home of the search on it.
  await expect.poll(() => onTheMap(page)).toBe(inView);
});

test('a search: the map fits its homes again, every one of them counted, the list beside it the same homes', async ({ page }) => {
  await openMany(page);
  await page.getByRole('button', { name: 'Search options' }).click();
  await page.locator('.fd-search-panel').getByRole('button', { name: 'For rent' }).click();
  await page.keyboard.press('Escape');
  await expect.poll(() => total(page)).toBeLessThan(20_000);
  const rentals = await total(page);
  // Every rental the search finds is on the map but those with no place, said under it.
  const unplaced = Number(/^(\d+) without a place/.exec((await note(page).textContent()) ?? '')?.[1] ?? 0);
  await expect.poll(() => onTheMap(page)).toBe(rentals - unplaced);
  const last = (await clusterAsks(page)).slice(-2);
  expect(last.map((call) => call.zoom)[0]).toBe(0);
  expect(last.every((call) => JSON.stringify(call.filter).includes('"rent"'))).toBe(true);
  // Typed: the sixty flats of one tower, fitted as close as the page lets a fit come, one bubble on their one spot.
  await page.getByRole('button', { name: 'Search options' }).click();
  await page.locator('.fd-search-panel').getByRole('button', { name: 'For rent' }).click();
  await page.keyboard.press('Escape');
  await box(page).pressSequentially('Capital Tower');
  await box(page).press('Enter');
  await expect(pager(page)).toHaveText('1–12 of 60 homes');
  await expect(bubbles(page)).toHaveCount(1);
  await expect(bubbles(page)).toHaveAttribute('aria-label', '60 here. Zoom in to see them.');
  expect(await zoomOf(theMap(page))).toBe(16);
});

test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test('every bubble tapped comes closer, its homes however widely spread on the phone’s small map: never a tap that does nothing', async ({ page }) => {
    await openMany(page);
    // The biggest bubble in view, tapped five times over: by the fourth (zoom 8) 0.35's "12,134 here" spread wider than
    // the phone's map shows, and a fit to them came no closer — the map panned, the bubble stayed whole.
    for (let i = 0; i < 5; i++) {
      await mapSettled(theMap(page));
      const before = await zoomOf(theMap(page));
      const asks = (await clusterAsks(page)).length;
      const map = (await theMap(page).boundingBox())!;
      const all = await bubbles(page).evaluateAll((list) => list.map((mark) => ({ n: Number(/^[\d,]+/.exec(mark.getAttribute('aria-label') ?? '')?.[0].replace(/,/g, '')), at: mark.getBoundingClientRect().toJSON() as DOMRect })));
      const inside = all.map((b, at) => ({ ...b, i: at })).filter(({ at }) => at.x > map.x && at.x + at.width < map.x + map.width - 44 && at.y > map.y && at.y + at.height < map.y + map.height - 30);
      expect(inside.length, `a bubble in view at zoom ${before}`).toBeGreaterThan(0);
      const biggest = inside.sort((a, b) => b.n - a.n)[0];
      await bubbles(page).nth(biggest.i).tap();
      await expect.poll(() => zoomOf(theMap(page)), { message: `tap ${i + 1}, ${biggest.n} here at zoom ${before}` }).toBeGreaterThan(before);
      await expect.poll(async () => (await clusterAsks(page)).length).toBeGreaterThan(asks);
    }
  });
});

test('a bubble on one spot lists its homes: the first fifty, and how many more', async ({ page }) => {
  await openMany(page);
  await box(page).pressSequentially('Capital Tower');
  await box(page).press('Enter');
  await expect(bubbles(page)).toHaveAttribute('aria-label', '60 here. Zoom in to see them.');
  const zoom = await zoomOf(theMap(page));
  await bubbles(page).click();
  // No zoom parts sixty flats on one spot: the source's records there, asked for and listed.
  await expect(card(page).locator('.fd-map-card-title')).toHaveText('60 in one place');
  await expect(card(page).locator('.fd-map-crowd-list button')).toHaveCount(50);
  await expect(card(page).locator('.fd-map-crowd-list li').last()).toHaveText('And 10 more here');
  expect(await zoomOf(theMap(page))).toBe(zoom);
  // Faded in, the map moved to show it whole.
  await expect(page.locator('.fd-map-list .leaflet-popup')).toHaveCSS('opacity', '1');
  await mapSettled(theMap(page));
  await screen(page, 'map-clusters-one-spot');
  // One of them: its own card, its name and its price.
  const said = (await card(page).locator('.fd-map-crowd-list button').first().textContent())!;
  await card(page).locator('.fd-map-crowd-list button').first().click();
  await expect(card(page)).toHaveCount(1);
  const name = (await card(page).locator('.fd-map-card-title').textContent())!;
  expect(name).toMatch(/Capital Tower$/);
  expect(said.startsWith(`${name}, `)).toBe(true);
});

test('the streets show each home’s own pin with its price, its card a press away; a row lights its home, in a bubble too', async ({ page }) => {
  await openMany(page);
  // A row's home, in a bubble at the country's zoom: its own pin drawn over the map, where the source says it is.
  await rows(page).first().hover();
  await expect(page.locator('.fd-map-list .fd-map-ghost .fd-map-face[data-hot]')).toHaveCount(1);
  await screen(page, 'map-clusters-row-lit');
  await page.mouse.move(5, 5);
  await expect(page.locator('.fd-map-list .fd-map-ghost')).toHaveCount(0);
  // Closer, a bubble at a time, until homes stand alone.
  for (let i = 0; i < 10 && !(await pins(page).count()); i++) await pressBiggest(page);
  await expect(pins(page).first()).toBeAttached();
  const pin = pins(page).first();
  await expect(pin).toHaveAttribute('aria-label', /.+/);
  await pin.click();
  await expect(card(page)).toBeVisible();
  await expect(card(page).locator('.fd-map-card-title')).toHaveText(/bedroom/);
  await expect(card(page).locator('img.fd-map-card-image')).toBeVisible();
  await expect(page.locator('.fd-map-list .leaflet-popup')).toHaveCSS('opacity', '1');
  await mapSettled(theMap(page));
  await screen(page, 'map-clusters-streets');
});

test('axe finds nothing on the homes, their bubbles and a bubble’s list', async ({ page }) => {
  await openMany(page);
  expect(await axeFindings(page)).toEqual([]);
  await box(page).pressSequentially('Capital Tower');
  await box(page).press('Enter');
  await expect(bubbles(page)).toHaveAttribute('aria-label', '60 here. Zoom in to see them.');
  await bubbles(page).click();
  await expect(card(page)).toBeVisible();
  // Once it has faded in: axe reads colours as they are drawn.
  await expect(page.locator('.fd-map-list .leaflet-popup')).toHaveCSS('opacity', '1');
  expect(await axeFindings(page)).toEqual([]);
});

test('without the source’s clusters, a map loads its records and gathers them itself, as before', async ({ page }) => {
  await stubMaps(page);
  await open(page, 'plain', 'page=map-homes&skin=outlined');
  await mapReady(theMap(page));
  await expect(marks(page).first()).toBeAttached();
  const calls = await asked(page);
  expect(calls.some((call) => call.method === 'clusters')).toBe(false);
  expect(calls.filter((call) => call.method === 'list').map((call) => call.limit)).toContain(500);
});

for (const variant of ['react', 'vue', 'angular']) {
  test(`${variant}: the source’s bubbles on the map, every home counted`, async ({ page }) => {
    const { problems } = await openMany(page, variant);
    await expect.poll(() => onTheMap(page)).toBe(19_900);
    expect(problems).toEqual([]);
  });
}
