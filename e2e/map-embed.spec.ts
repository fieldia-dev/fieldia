import { type Locator, type Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { axeFindings } from './a11y-support';
import { at as pointOn, drag, mapReady, stubMaps, zoomOf } from './map-support';
import { expectNoSidewaysScroll, screen } from './support';

/**
 * A list's map in a page of its own (@fieldia/map's `mountListMap`): the
 * homes-for-sale demo, a page that is not Fieldia's, with its own bar, list,
 * filter and address, and Fieldia's map filling the column beside the list.
 * The map brings its own base, takes every gesture, opens where the address
 * says and writes where it stands back into it, and says how many homes a
 * view holds on "Search this area". The viewer's own list map, beside it,
 * keeps sharing gestures with its page. Every map image is a stand-in.
 */

const EMBED = '/map-embed/';
const theMap = (page: Page) => page.locator('.fd-map-embed .fd-map-box');
const here = (page: Page) => page.locator('.fd-map-embed .fd-map-here');
const homes = (page: Page) => page.locator('.hs-home');
const homeOf = (page: Page, id: string) => page.locator(`.hs-home[data-id="${id}"]`);
const pins = (page: Page) => page.locator('.fd-map-embed .fd-map-mark:not(.fd-map-ghost)[data-id]');
const zoomIn = (map: Locator) => map.getByRole('button', { name: 'Zoom in', exact: true });
/** Zamalek, close enough for its homes to stand apart: the address's own `area`, as a shared link would carry it. */
const ZAMALEK = '?area=30.054,31.211,30.071,31.228';

function watch(page: Page) {
  const problems: string[] = [];
  page.on('console', (message) => message.type() === 'error' && problems.push(`console: ${message.text()}`));
  page.on('pageerror', (error) => problems.push(`page error: ${error.message}`));
  return problems;
}

async function openEmbed(page: Page, query = '') {
  await stubMaps(page);
  const problems = watch(page);
  await page.goto(`${EMBED}${query}`);
  await mapReady(theMap(page));
  await expect(page.locator('.fd-map-embed .fd-map-mark').first()).toBeAttached();
  return problems;
}

/** How many homes the map shows: a pin each, a bubble its count. */
const onTheMap = (page: Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll('.fd-map-embed .fd-map-mark:not(.fd-map-ghost)')].reduce((sum, mark) => sum + (Number(mark.querySelector('.fd-map-bubble')?.textContent) || 1), 0)
  );
/** Where the map stands, as the page keeps it in its address: latitude, longitude, zoom. */
const atOf = (page: Page) => (new URL(page.url()).searchParams.get('at') ?? '').split(',').filter(Boolean).map(Number);
/** The number "Search this area (24)" says; null when it says none. */
const said = async (page: Page) => {
  const found = /\((\d+)\)$/.exec((await here(page).textContent()) ?? '');
  return found ? Number(found[1]) : null;
};
/** The counts the map asked its source for: one record, for its total. */
const countsAsked = (page: Page) =>
  page.evaluate(() => (window as any).fieldiaDemo.dataSource.calls.filter((call: { method: string; request: { limit: number } }) => call.method === 'list' && call.request.limit === 1).length as number);

test('a map in a page of its own: it fills its column, brings its own base, and none of it reaches the page round it', async ({ page }) => {
  const problems = await openEmbed(page);
  // No Fieldia form anywhere: the page is its own.
  await expect(page.locator('.fd-form')).toHaveCount(0);
  const listed = await homes(page).count();
  expect(listed).toBeGreaterThan(30);
  await expect(page.locator('.hs-count')).toHaveText(`${listed} homes`);
  // Each home the list shows is on the map, or said to have no place.
  const note = (await page.locator('.fd-map-embed .fd-map-list-note:visible').textContent().catch(() => '')) ?? '';
  const placeless = Number(/^(\d+) without a place/.exec(note)?.[1] ?? 0);
  await expect.poll(() => onTheMap(page)).toBe(listed - placeless);
  // As tall as its column, the column as tall as the window leaves it.
  const column = (await page.locator('.hs-map').boundingBox())!;
  const map = (await theMap(page).boundingBox())!;
  expect(Math.abs(map.height - column.height)).toBeLessThan(2);
  expect(map.height).toBeGreaterThan(420);
  // Its base: words for a screen reader alone take no room, the drawing's bar waits hidden, its buttons are drawn.
  await expect(theMap(page)).toHaveAccessibleDescription(/Arrow keys move the map/);
  expect((await theMap(page).locator('> .fd-sr-only').boundingBox())!.width).toBeLessThanOrEqual(1);
  await expect(page.locator('.fd-map-embed .fd-map-hint')).toBeHidden();
  const finish = page.locator('.fd-map-embed .fd-map-hint .fd-button-primary');
  expect(await finish.evaluate((b) => [getComputedStyle(b).cursor, getComputedStyle(b).borderTopLeftRadius])).toEqual(['pointer', '6px']);
  await expect(page.locator('.fd-map-embed .fd-map-here')).toBeHidden();
  await expectNoSidewaysScroll(page);
  await screen(page, 'map-embed');
  // None of it reaches the page: its own button of the same name, and a part it shows on purpose, are as the page draws them.
  await page.evaluate(() => {
    const bar = document.querySelector('.hs-bar')!;
    const button = Object.assign(document.createElement('button'), { className: 'fd-button', id: 'own-button', textContent: 'Own' });
    const shown = Object.assign(document.createElement('div'), { id: 'own-shown', hidden: true, textContent: 'Shown' });
    shown.style.display = 'block';
    bar.append(button, shown);
  });
  expect(await page.locator('#own-button').evaluate((b) => [getComputedStyle(b).cursor, getComputedStyle(b).paddingLeft])).not.toEqual(['pointer', '14px']);
  await expect(page.locator('#own-shown')).toBeVisible();
  expect(problems).toEqual([]);
});

test('the map takes every gesture: the wheel zooms it with no key held, a drag pans it', async ({ page }) => {
  await openEmbed(page);
  await expect.poll(() => atOf(page)).toHaveLength(3);
  const [, lng, zoom] = atOf(page);
  const middle = await pointOn(theMap(page), 0.6, 0.5);
  await page.mouse.move(middle.x, middle.y);
  await page.mouse.wheel(0, -300);
  await expect.poll(() => atOf(page)[2]).toBeGreaterThan(zoom);
  // Nothing asked the reader to hold Ctrl.
  await expect(theMap(page).locator('.fd-map-veil')).not.toHaveAttribute('data-show', '');
  await page.waitForTimeout(400);
  await drag(page, middle, { x: middle.x - 160, y: middle.y });
  await expect.poll(() => atOf(page)[1]).toBeGreaterThan(lng);
  // A move of the person's own: Search this area is offered.
  await expect(here(page)).toBeVisible();
});

test('the viewer’s list map still leaves the wheel to the page: a scroll over it says Ctrl, and does not zoom', async ({ page }) => {
  await stubMaps(page);
  await page.goto('/plain/?page=map-homes&skin=outlined');
  const map = page.locator('.fd-map-list .fd-map-box');
  await mapReady(map);
  const start = await zoomOf(map);
  const middle = await pointOn(map, 0.5, 0.5);
  await page.mouse.move(middle.x, middle.y);
  await page.mouse.wheel(0, -300);
  await expect(map.locator('.fd-map-veil')).toHaveAttribute('data-show', '');
  await page.waitForTimeout(500);
  expect(await zoomOf(map)).toBe(start);
});

test.describe('by touch', () => {
  test.use({ hasTouch: true });

  /** One finger dragged across the screen, as a touch screen sends it. */
  async function oneFinger(page: Page, from: { x: number; y: number }, to: { x: number; y: number }) {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: from.x, y: from.y }] });
    for (let i = 1; i <= 12; i++) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: from.x + ((to.x - from.x) * i) / 12, y: from.y + ((to.y - from.y) * i) / 12 }] });
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  }

  test('one finger moves the map in a page of its own; on the viewer’s list it leaves the map where it is', async ({ page }) => {
    await openEmbed(page);
    await expect.poll(() => atOf(page)).toHaveLength(3);
    const [, lng] = atOf(page);
    const middle = await pointOn(theMap(page), 0.6, 0.5);
    await oneFinger(page, middle, { x: middle.x - 150, y: middle.y });
    await expect.poll(() => atOf(page)[1]).toBeGreaterThan(lng);

    await page.goto('/plain/?page=map-homes&skin=outlined');
    const map = page.locator('.fd-map-list .fd-map-box');
    await mapReady(map);
    const tile = map.locator('.leaflet-tile-loaded').first();
    const before = (await tile.boundingBox())!;
    const there = await pointOn(map, 0.5, 0.5);
    await oneFinger(page, there, { x: there.x - 150, y: there.y });
    await expect(map.locator('.fd-map-veil')).toHaveAttribute('data-show', '');
    const after = (await tile.boundingBox())!;
    // The map stayed put: one finger is the page's.
    expect(Math.abs(after.x - before.x)).toBeLessThan(2);
  });
});

test('Search this area says how many homes are in view: the number the page’s list then keeps; past the area searched, the source counts them', async ({ page }) => {
  await openEmbed(page);
  await expect(here(page)).toBeHidden();
  await zoomIn(theMap(page)).click();
  await zoomIn(theMap(page)).click();
  await expect(here(page)).toBeVisible();
  await expect(here(page)).toHaveText(/^Search this area \(\d+\)$/);
  const inView = (await said(page))!;
  expect(inView).toBeGreaterThan(0);
  // Every home on hand: counted there, nothing asked of the source.
  expect(await countsAsked(page)).toBe(0);
  await screen(page, 'map-embed-count');
  await here(page).click();
  await expect(here(page)).toBeHidden();
  await expect(page.locator('.hs-chip')).toHaveText(['In this area×']);
  await expect(page.locator('.hs-count')).toHaveText(inView === 1 ? '1 home' : `${inView} homes`);
  await expect.poll(() => onTheMap(page)).toBe(inView);
  // The area searched, in the address.
  expect(new URL(page.url()).searchParams.get('area')).toMatch(/^-?[\d.]+(,-?[\d.]+){3}$/);

  // Out past it: the homes on hand are only the area's, so the source counts the view.
  await theMap(page).getByRole('button', { name: 'Zoom out', exact: true }).click();
  await expect(here(page)).toBeVisible();
  await expect(here(page)).toHaveText(/^Search this area \(\d+\)$/);
  expect(await countsAsked(page)).toBeGreaterThan(0);
  const wider = (await said(page))!;
  expect(wider).toBeGreaterThanOrEqual(inView);
  await here(page).click();
  // One area at a time: the wider one in the first one's place.
  await expect(page.locator('.hs-chip')).toHaveCount(1);
  await expect(page.locator('.hs-count')).toHaveText(`${wider} homes`);
  await expect.poll(() => onTheMap(page)).toBe(wider);
  // Taken away: every home again, and the map fits them.
  await page.locator('.hs-chip').getByRole('button', { name: 'Take away: In this area' }).click();
  await expect(page.locator('.hs-chip')).toHaveCount(0);
  await expect.poll(() => homes(page).count()).toBeGreaterThan(wider);
});

test('where the map stands is kept in the address: a reload opens there and fits nothing; a lone home is shown no closer than a neighbourhood', async ({ page }) => {
  await openEmbed(page);
  await expect.poll(() => atOf(page)).toHaveLength(3);
  const fitted = atOf(page);
  await zoomIn(theMap(page)).click();
  await expect.poll(() => atOf(page)[2]).toBe(fitted[2] + 1);
  const kept = new URL(page.url()).searchParams.get('at');
  await page.reload();
  await mapReady(theMap(page));
  await expect(page.locator('.fd-map-embed .fd-map-mark').first()).toBeAttached();
  await page.waitForTimeout(500);
  // Opened where it was, the homes loaded, and no fit moved it.
  expect(await zoomOf(theMap(page))).toBe(fitted[2] + 1);
  expect(new URL(page.url()).searchParams.get('at')).toBe(kept);

  // One home alone in the area searched: a fit, at most a neighbourhood's zoom (the page's fitZoom, 14).
  const lone = await page.evaluate(() => {
    const all = Object.values((window as any).fieldiaDemo.dataSource.records.home) as { offer: string; lat: number | null; lng: number | null }[];
    const home = all.find((h) => h.offer === 'sale' && h.lat !== null && all.filter((o) => o !== h && o.lat !== null && Math.abs((o.lat as number) - (h.lat as number)) < 0.002 && Math.abs((o.lng as number) - (h.lng as number)) < 0.002).length === 0)!;
    return { lat: home.lat as number, lng: home.lng as number };
  });
  await page.goto(`${EMBED}?area=${lone.lat - 0.001},${lone.lng - 0.001},${lone.lat + 0.001},${lone.lng + 0.001}`);
  await mapReady(theMap(page));
  await expect(page.locator('.hs-count')).toHaveText('1 home');
  await expect(pins(page)).toHaveCount(1);
  await expect.poll(() => zoomOf(theMap(page))).toBe(14);
});

test('the page’s list and the map light each other, and a card’s Open marks the home in the list', async ({ page }) => {
  const problems = await openEmbed(page, ZAMALEK);
  await expect.poll(() => pins(page).count()).toBeGreaterThan(1);
  const pin = pins(page).first();
  const id = (await pin.getAttribute('data-id'))!;
  await pin.hover();
  await expect(homeOf(page, id)).toHaveClass(/is-lit/);
  await page.mouse.move(5, 5);
  await expect(page.locator('.hs-home.is-lit')).toHaveCount(0);
  await homeOf(page, id).hover();
  await expect(pin.locator('.fd-map-face')).toHaveAttribute('data-hot', '');
  await page.mouse.move(5, 5);
  await pin.click();
  const card = page.locator('.fd-map-embed .fd-map-card');
  await expect(card).toBeVisible();
  await expect(page.locator('.fd-map-embed .leaflet-popup')).toHaveCSS('opacity', '1');
  await screen(page, 'map-embed-card');
  await card.getByRole('button', { name: 'Open' }).click();
  await expect(homeOf(page, id)).toHaveAttribute('aria-current', 'true');
  await expect(homeOf(page, id)).toBeFocused();
  expect(await axeFindings(page, 'map in a page of its own, a card open')).toEqual([]);
  expect(problems).toEqual([]);
});

test('To rent, the page’s own filter: the map follows it, the rentals in their tone', async ({ page }) => {
  await openEmbed(page);
  await page.getByRole('button', { name: 'To rent' }).click();
  await expect(page.locator('.hs-title')).toHaveText('Homes to rent');
  const listed = await homes(page).count();
  await expect(page.locator('.hs-count')).toHaveText(`${listed} homes`);
  await expect.poll(() => onTheMap(page)).toBeLessThanOrEqual(listed);
  await expect.poll(() => page.locator('.fd-map-embed .fd-map-face[data-tone="info"]').count()).toBeGreaterThan(0);
  expect(new URL(page.url()).searchParams.get('offer')).toBe('rent');
});

test('in Arabic, right to left, and dark: the map’s words in Arabic, its zoom on the left, the card right to left; axe finds nothing', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  const problems = await openEmbed(page, `${ZAMALEK}&locale=ar&scheme=dark`);
  await expect(page.locator('.hs-title')).toHaveText('منازل للبيع');
  await expect(theMap(page)).toHaveAttribute('aria-label', 'المنازل، خريطة');
  await expect(theMap(page).locator('.fd-map-zoom')).toHaveAttribute('data-side', 'left');
  // The list on the right, the map on the left.
  expect((await theMap(page).boundingBox())!.x).toBeLessThan((await page.locator('.hs-list').boundingBox())!.x);
  // Dark, by the page's scheme: the map's buttons on a dark surface.
  expect(await theMap(page).getByRole('button', { name: 'تكبير', exact: true }).evaluate((b) => getComputedStyle(b).backgroundColor)).toBe('rgb(31, 35, 41)');
  await theMap(page).getByRole('button', { name: 'تكبير', exact: true }).click();
  await expect(here(page)).toHaveText(/^ابحث في هذه المنطقة \(\d+\)$/);
  await pins(page).first().click();
  await expect(page.locator('.fd-map-embed .fd-map-card')).toHaveAttribute('dir', 'rtl');
  await expect(page.locator('.fd-map-embed .leaflet-popup')).toHaveCSS('opacity', '1');
  await screen(page, 'map-embed-arabic-dark');
  expect(await axeFindings(page, 'map in a page of its own, Arabic, dark')).toEqual([]);
  expect(problems).toEqual([]);
});

test('at a phone’s width: the map over the list, nothing sideways', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openEmbed(page);
  const map = (await theMap(page).boundingBox())!;
  const list = (await page.locator('.hs-list').boundingBox())!;
  expect(map.y + map.height).toBeLessThanOrEqual(list.y + 1);
  expect(map.height).toBeGreaterThan(400);
  await expectNoSidewaysScroll(page);
  await screen(page, 'map-embed-phone', { viewport: true });
});

test('the viewer’s list map counts its view too, and says where it stops with fd-map-view', async ({ page }) => {
  await stubMaps(page);
  await page.goto('/plain/?page=map-homes&skin=outlined');
  const map = page.locator('.fd-map-list .fd-map-box');
  await mapReady(map);
  await page.evaluate(() => {
    (window as any).views = [];
    document.addEventListener('fd-map-view', (event) => (window as any).views.push((event as CustomEvent).detail));
  });
  const start = await zoomOf(map);
  await zoomIn(map).click();
  await zoomIn(map).click();
  const button = page.getByRole('button', { name: /^Search this area/ });
  await expect(button).toHaveText(/^Search this area \(\d+\)$/);
  const inView = Number(/\((\d+)\)/.exec((await button.textContent())!)![1]);
  await button.click();
  await expect.poll(async () => Number(((await page.locator('.fd-pager-text').textContent()) ?? '').split('/ ')[1])).toBe(inView);
  const views = await page.evaluate(() => (window as any).views as { zoom: number; byPerson: boolean; bounds: { south: number; north: number } }[]);
  // The person's last move, the two steps closer; any view after it (the page's scroll bar gone, the map wider) the map's own.
  const last = views.filter((view) => view.byPerson).pop()!;
  expect(last.zoom).toBe(start + 2);
  expect(last.bounds.south).toBeLessThan(last.bounds.north);
  expect(views.every((view, i) => i === 0 || JSON.stringify(view) !== JSON.stringify(views[i - 1]))).toBe(true);
});

for (const look of [
  { name: 'en-dark', query: '?scheme=dark', dark: true, phone: false },
  { name: 'ar-light', query: '?locale=ar&scheme=light', dark: false, phone: false },
  { name: 'phone-ar-light', query: '?locale=ar&scheme=light', dark: false, phone: true },
  { name: 'phone-en-dark', query: '?scheme=dark', dark: true, phone: true },
]) {
  test(`looks right · ${look.name}: moved, the count on its button, nothing sideways`, async ({ page }) => {
    if (look.phone) await page.setViewportSize({ width: 390, height: 844 });
    if (look.dark) await page.emulateMedia({ colorScheme: 'dark' });
    const problems = await openEmbed(page, look.query);
    await zoomIn(theMap(page)).or(theMap(page).getByRole('button', { name: 'تكبير', exact: true })).click();
    await expect(here(page)).toHaveText(/\(\d+\)$/);
    await expectNoSidewaysScroll(page);
    await screen(page, `map-embed-${look.name}`, { viewport: true });
    expect(problems).toEqual([]);
  });
}

test('its Code drawer shows the page and the page’s own script: one call to mountListMap, no framework tabs it cannot back', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, 'webdriver', { get: () => false }));
  await page.setViewportSize({ width: 1440, height: 900 });
  await openEmbed(page);
  await expect(page.locator('.dh-title')).toHaveText('A map in a page of your own');
  // Its look: the scheme alone, no skin or theme of a Fieldia form.
  await expect(page.getByRole('navigation', { name: 'Scheme' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Look' })).toHaveCount(0);
  await page.getByRole('button', { name: '‹/› Code' }).click();
  const drawer = page.locator('#demo-code');
  await expect(drawer.getByRole('tab')).toHaveText(['Page JSON', 'JavaScript']);
  await expect(drawer.locator('code')).toContainText('"id": "homes-for-sale"');
  await expect(drawer.locator('code')).toContainText('"gestures": "all"');
  await drawer.getByRole('tab', { name: 'JavaScript' }).click();
  for (const words of ['mountListMap(', 'countArea: true', 'onSearch(search)', 'onViewChange(', 'map.highlight(id)', '.fd-map-embed { --fd-accent']) await expect(drawer.locator('code')).toContainText(words);
});

test('two quick presses of + at the closest zoom: the second has nowhere to go, and the map still says where it stops after', async ({ page }) => {
  // One step from the closest the map images go (19), over Zamalek.
  await openEmbed(page, '?at=30.0626,31.2197,18');
  // The second press while the first zoom is still under way: kept, and made when it ends.
  await zoomIn(theMap(page)).evaluate((button: HTMLElement) => {
    button.click();
    setTimeout(() => button.click(), 80);
  });
  await expect.poll(() => zoomOf(theMap(page))).toBe(19);
  await expect.poll(() => atOf(page)[2]).toBe(19);
  // A drag after it: a stop of its own, said in the address, Search this area offered.
  const before = atOf(page)[1];
  const middle = await pointOn(theMap(page), 0.6, 0.5);
  await drag(page, middle, { x: middle.x - 160, y: middle.y });
  await expect.poll(() => atOf(page)[1]).toBeGreaterThan(before);
  await expect(here(page)).toBeVisible();
});
