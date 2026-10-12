import { type Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { axeFindings } from './a11y-support';
import { at, drag, mapReady, ROUTE_LINE, stubMaps, stubRoutes } from './map-support';
import { open, screen } from './support';

/**
 * A map on a form (`type: "map"`, @fieldia/map's mapParts): the order demo's
 * kitchen, door and courier as layers, the route from the courier to the
 * door, its minutes and metres written into the order. The demo's own ride
 * is kept still (`ride=off`): each test moves the courier itself, as a
 * courier's app sends their place. Map images and routes are stand-ins.
 */

const ORDER = 'page=map-order&skin=outlined&readonly=1&ride=off';
const theMap = (page: Page) => page.locator('.fd-map-form .fd-map-box');
const marks = (page: Page) => page.locator('.fd-map-form .leaflet-marker-icon.fd-map-mark');
const courier = (page: Page) => marks(page).filter({ has: page.locator('.fd-map-face[data-look="photo"]') });
const route = (page: Page) => page.locator('.fd-map-form path.fd-map-route');
const travelled = (page: Page) => page.locator('.fd-map-form path.fd-map-route-done');

type Demo = { fieldiaDemo: { handle: { form: { getState(): { values: Record<string, unknown> }; setValues(values: Record<string, unknown>): void } } } };
const values = (page: Page) => page.evaluate(() => (window as unknown as Demo).fieldiaDemo.handle.form.getState().values);
const send = (page: Page, place: { lat: number; lng: number }, more: Record<string, unknown> = {}) =>
  page.evaluate(([p, rest]) => (window as unknown as Demo).fieldiaDemo.handle.form.setValues({ courier_lat: p.lat, courier_lng: p.lng, ...rest }), [place, more] as const);

async function openOrder(page: Page, query = ORDER) {
  await stubMaps(page);
  const routes = await stubRoutes(page);
  const opened = await open(page, 'plain', query);
  await mapReady(theMap(page));
  await expect(route(page)).toHaveCount(1);
  return { ...opened, routes };
}

/**
 * Time jumped ahead in the page, as a laptop's lid closed for a while: under
 * load Playwright's jump can miss the page, so it is made again (at most
 * three times) until the page's own clock shows it.
 */
async function jump(page: Page, ms: number) {
  const before = await page.evaluate(() => Date.now());
  for (let i = 0; i < 3; i++) {
    await page.clock.fastForward(ms);
    if ((await page.evaluate(() => Date.now())) >= before + ms) return;
  }
  throw new Error('The page’s clock did not move on');
}

/** The map at rest: its pane where it stays, once a drag's glide has ended. */
async function atRest(page: Page) {
  const pane = () => page.locator('.fd-map-form .leaflet-map-pane').getAttribute('style');
  let last = await pane();
  for (let i = 0; i < 20; i++) {
    await page.waitForTimeout(150);
    const now = await pane();
    if (now === last) return now;
    last = now;
  }
  return last;
}

/** The kitchen's own place, as the order's record keeps it. */
const KITCHEN = { lat: 30.0443, lng: 31.2353 };
/** The pins a person sees and presses on the order's map: those gathered under another are not among them. */
const shown = (page: Page) => page.locator('.fd-map-form .leaflet-marker-icon:visible');
/** The courier and the kitchen as one pin. */
const together = (page: Page) => theMap(page).getByRole('button', { name: '2 here: Kitchen, Courier. Zoom in to see them.' });

/** No pin stands on another: each one's box is clear of every other's. */
async function noneOverlap(page: Page) {
  const boxes = await shown(page).evaluateAll((icons) => icons.map((icon) => icon.getBoundingClientRect().toJSON() as DOMRect));
  for (let i = 0; i < boxes.length; i++)
    for (let j = i + 1; j < boxes.length; j++) {
      const [a, b] = [boxes[i], boxes[j]];
      const apart = a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top;
      expect(apart, `pins ${i} and ${j} overlap`).toBe(true);
    }
}

/** Where a mark stands on the screen. */
const spot = async (page: Page, index = 0) => {
  const box = (await courier(page).nth(index).locator('.fd-map-face-photo').boundingBox())!;
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
};

test('an order’s map: the kitchen, the door and the courier, each named; the way to the door; its minutes and metres in the order', async ({ page }) => {
  const { problems, routes } = await openOrder(page);
  await expect(marks(page)).toHaveCount(3);
  // A street from the kitchen, the courier is gathered with it in this view: one pin, named for both.
  await expect(together(page)).toBeVisible();
  await expect(marks(page).nth(1)).toHaveAttribute('aria-label', 'Your door, 14 Shagaret El Dor, Zamalek');
  await expect(theMap(page)).toHaveAttribute('aria-label', 'Where your order is, map');
  // Asked once, from the courier to the door, longitude first.
  expect(routes).toHaveLength(1);
  expect(routes[0]).toContain('/route/v1/driving/31.23592,30.04506;31.21971,30.06259?');
  // The route's numbers are the order's: the minutes under the courier's photo, and in Arrives in.
  await expect.poll(async () => (await values(page))['eta_seconds']).toBeGreaterThan(0);
  const now = await values(page);
  expect(now['distance_m']).toBeGreaterThan(1000);
  expect(now['route_line']).toMatchObject({ type: 'LineString' });
  const minutes = `${Math.round((now['eta_seconds'] as number) / 60)} min`;
  await expect(page.locator('[data-node="f-eta"] input')).toHaveValue(minutes);
  await expect(courier(page).locator('.fd-map-face-text')).toHaveText(minutes);
  // A page with no Save: the app writes these, the reader cannot.
  await expect(page.getByRole('button', { name: 'Save' })).toHaveCount(0);
  await screen(page, 'map-form-order');
  // Closer, each its own pin, named.
  await together(page).locator('.fd-map-face').click();
  await expect(marks(page).nth(0)).toBeVisible();
  await expect(marks(page).nth(0)).toHaveAttribute('aria-label', 'Kitchen, Koshary Tahrir');
  await expect(courier(page)).toHaveAttribute('aria-label', `Courier, Mona Adel, ${minutes}`);
  expect(problems).toEqual([]);
});

test('the courier glides along the road to a new place, the road behind fades, and the minutes count down', async ({ page }) => {
  const { routes } = await openOrder(page);
  await expect.poll(async () => (await values(page))['eta_seconds']).toBeGreaterThan(0);
  const before = (await values(page))['eta_seconds'] as number;
  const from = await spot(page);
  // Well along the road: a point a third of the way.
  const ahead = ROUTE_LINE[Math.floor(ROUTE_LINE.length / 3)];
  await send(page, ahead);
  // Midway through its glide it is neither where it was nor where it is going.
  await page.waitForTimeout(400);
  const midway = await spot(page);
  await page.waitForTimeout(900);
  const to = await spot(page);
  expect(Math.hypot(midway.x - from.x, midway.y - from.y)).toBeGreaterThan(3);
  expect(Math.hypot(to.x - midway.x, to.y - midway.y)).toBeGreaterThan(3);
  await expect(travelled(page)).toHaveCount(1);
  await expect.poll(async () => (await values(page))['eta_seconds']).toBeLessThan(before);
  // Still on its road: no new route asked for.
  expect(routes).toHaveLength(1);
  await screen(page, 'map-form-on-the-way');
});

test('a courier who leaves the road is given a new route, but not more than every ten seconds', async ({ page }) => {
  await page.clock.install();
  const { routes } = await openOrder(page);
  // Two hundred metres east of the road.
  const off = { lat: ROUTE_LINE[20].lat, lng: ROUTE_LINE[20].lng + 0.002 };
  await jump(page, 11_000);
  await send(page, off);
  await expect.poll(() => routes.length).toBe(2);
  expect(routes[1]).toContain(`/route/v1/driving/${off.lng},${off.lat};31.21971,30.06259?`);
  // Off again at once: it waits.
  await send(page, { lat: off.lat + 0.001, lng: off.lng + 0.001 });
  await page.waitForTimeout(500);
  expect(routes).toHaveLength(2);
});

test('news grown old: the courier greys and says when they were last seen', async ({ page }) => {
  await page.clock.install();
  await openOrder(page);
  // On the way, clear of the kitchen: a pin of their own.
  await send(page, ROUTE_LINE[60]);
  await expect(courier(page)).toHaveAttribute('aria-label', /^Courier, Mona Adel/);
  await expect(courier(page).locator('.fd-map-face')).not.toHaveAttribute('data-stale', /.*/);
  await jump(page, 76_000);
  await expect(courier(page).locator('.fd-map-face')).toHaveAttribute('data-stale', '');
  await expect(courier(page).locator('.fd-map-face-stale')).toHaveText(/^Last seen \d+ minutes? ago$/);
  await expect(courier(page)).toHaveAttribute('aria-label', /, Last seen \d+ minutes? ago$/);
  await screen(page, 'map-form-stale');
  // News again: fresh.
  await send(page, ROUTE_LINE[30]);
  await expect(courier(page).locator('.fd-map-face')).not.toHaveAttribute('data-stale', /.*/);
  await expect(courier(page).locator('.fd-map-face-stale')).toHaveCount(0);
});

test('the map follows the courier until the person moves it; Follow brings the courier back into view', async ({ page }) => {
  await openOrder(page);
  const follow = page.getByRole('button', { name: 'Follow' });
  const pane = () => page.locator('.fd-map-form .leaflet-map-pane').getAttribute('style');
  await expect(follow).toBeHidden();
  // Followed: a courier sent out of view, 3 km north of the door, brings the map along to keep them in view.
  const followed = await pane();
  await send(page, { lat: 30.09, lng: 31.2197 });
  await expect.poll(pane).not.toBe(followed);
  // The person moves the map: it is theirs now, and Follow is offered.
  const middle = await at(theMap(page), 0.5, 0.5);
  await drag(page, middle, { x: middle.x + 300, y: middle.y + 150 });
  await expect(follow).toBeVisible();
  const theirs = await atRest(page);
  await send(page, ROUTE_LINE[10]);
  await page.waitForTimeout(1300);
  expect(await pane()).toBe(theirs);
  // Follow: back to the courier, in view.
  await follow.click();
  await expect(follow).toBeHidden();
  await expect.poll(pane).not.toBe(theirs);
  await page.waitForTimeout(500);
  // Measured again: pressing Follow may have scrolled the page to it.
  const now = (await theMap(page).boundingBox())!;
  const back = await spot(page);
  expect(back.x > now.x && back.x < now.x + now.width && back.y > now.y && back.y < now.y + now.height).toBe(true);
});

test('still being prepared: the courier waits at the kitchen, and no route is drawn until they set off', async ({ page }) => {
  await openOrder(page);
  await page.evaluate(() => (window as unknown as Demo).fieldiaDemo.handle.form.setValues({ state: 'preparing' }));
  await expect(route(page)).toHaveCount(0);
  await expect(courier(page)).toHaveCount(1);
  await page.evaluate(() => (window as unknown as Demo).fieldiaDemo.handle.form.setValues({ state: 'on_the_way' }));
  await expect(route(page)).toHaveCount(1);
});

test('delivered: the courier and the route go, and the door turns to the delivered colour', async ({ page }) => {
  await openOrder(page);
  await send(page, ROUTE_LINE[ROUTE_LINE.length - 1], { state: 'delivered' });
  await expect(courier(page)).toHaveCount(0);
  await expect(route(page)).toHaveCount(0);
  await expect(marks(page).nth(1).locator('.fd-map-face')).toHaveAttribute('data-tone', 'success');
});

test('My location is asked for only when pressed, then shown where the browser says', async ({ page, context }) => {
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation({ latitude: 30.0561, longitude: 31.2243 });
  await openOrder(page);
  const locate = page.getByRole('button', { name: 'My location' });
  await expect(page.locator('.fd-map-form .fd-map-me')).toHaveCount(0);
  await locate.click();
  await expect(locate).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.fd-map-form .fd-map-me')).toHaveCount(1);
  await expect(page.locator('.fd-map-form path.fd-map-accuracy')).toHaveCount(1);
  await locate.click();
  await expect(locate).toHaveAttribute('aria-pressed', 'false');
});

test('by the keyboard: Tab to the courier, Enter for their card with how far they are, Escape back', async ({ page }) => {
  await openOrder(page);
  await expect.poll(async () => (await values(page))['distance_m']).toBeGreaterThan(0);
  // On the way, clear of the kitchen: a pin of their own.
  await send(page, ROUTE_LINE[60]);
  await expect(courier(page)).toHaveAttribute('aria-label', /^Courier, Mona Adel/);
  await theMap(page).focus();
  const focused = page.locator(':focus');
  for (let i = 0; i < 4 && !((await focused.getAttribute('aria-label')) ?? '').startsWith('Courier'); i++) await page.keyboard.press('Tab');
  await expect(focused).toHaveAttribute('aria-label', /^Courier/);
  await page.keyboard.press('Enter');
  const card = page.locator('.fd-map-form .fd-map-card');
  await expect(card).toBeVisible();
  await expect(card.locator('.fd-map-card-title')).toHaveText('Mona Adel');
  await expect(card.locator('dt')).toHaveText(['Arrives in', 'Metres left']);
  // A form's card has no Choose and no Open: there is no list to choose in, and the record is open.
  await expect(card.getByRole('checkbox')).toHaveCount(0);
  await expect(card.getByRole('button', { name: 'Open' })).toHaveCount(0);
  await expect(card.getByRole('button', { name: 'Close' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(card).toHaveCount(0);
  await expect(focused).toHaveAttribute('aria-label', /^Courier/);
});

test('in Arabic, right to left: its layers named in Arabic, its words over the map, and axe finds nothing', async ({ page }) => {
  await openOrder(page, `${ORDER}&locale=ar&dir=rtl`);
  await expect(page.locator('.fd-map-form-label')).toHaveText('أين طلبك');
  await expect(marks(page).nth(0)).toHaveAttribute('aria-label', /^المطبخ، /);
  await expect(page.getByRole('button', { name: 'موقعي' })).toBeVisible();
  // The tools at the map's start: on the right of a right-to-left page.
  const map = (await theMap(page).boundingBox())!;
  const locate = (await page.getByRole('button', { name: 'موقعي' }).boundingBox())!;
  expect(locate.x).toBeGreaterThan(map.x + map.width / 2);
  await screen(page, 'map-form-arabic');
  expect(await axeFindings(page, 'order map, Arabic')).toEqual([]);
});

test('axe finds nothing on the order and its map, a card open', async ({ page }) => {
  await openOrder(page);
  expect(await axeFindings(page, 'order map')).toEqual([]);
  // On its way, off the kitchen's pin.
  await send(page, ROUTE_LINE[60]);
  await page.waitForTimeout(1200);
  await courier(page).locator('.fd-map-face').click();
  await expect(page.locator('.fd-map-form .fd-map-card')).toBeVisible();
  await page.waitForTimeout(400);
  expect(await axeFindings(page, 'order map, a card open')).toEqual([]);
});

/**
 * The pins that crowd, as the gallery's sweep met them: the way not yet
 * found, so no minutes under the courier's photo, and the courier at the
 * kitchen or a few metres from it. axe then found the courier's pin half
 * under the kitchen's, too little of it left to press.
 */
test('pins that crowd are gathered: the courier at the kitchen is one pin with their count, named for both, and axe finds nothing', async ({ page }) => {
  await page.clock.install();
  await stubMaps(page);
  // The way is asked for, and has not answered yet.
  const routes: string[] = [];
  await page.route('https://router.project-osrm.org/**', (asked) => void routes.push(asked.request().url()));
  await open(page, 'plain', ORDER);
  await mapReady(theMap(page));
  await jump(page, 11_000);
  for (const [i, place] of [KITCHEN, { lat: KITCHEN.lat + 0.0003, lng: KITCHEN.lng + 0.0003 }].entries()) {
    await send(page, place);
    // The courier stays themself, the count at their shoulder; the kitchen's pin is gathered under theirs, not drawn over it.
    await expect(together(page)).toBeVisible();
    await expect(together(page).locator('.fd-map-face-photo')).toBeVisible();
    await expect(together(page).locator('.fd-map-count')).toHaveText('2');
    await expect(shown(page)).toHaveCount(2);
    await expect(theMap(page).getByRole('button', { name: /^Kitchen/ })).toHaveCount(0);
    await expect(theMap(page).getByRole('button', { name: 'Your door, 14 Shagaret El Dor, Zamalek' })).toBeVisible();
    await noneOverlap(page);
    if (!i) await screen(page, 'map-form-crowd');
    expect(await axeFindings(page, `order map, the courier ${i ? 'by' : 'at'} the kitchen`)).toEqual([]);
  }
  // The way is asked from where the courier is, never from where their pin is drawn.
  expect(routes[1]).toContain(`/route/v1/driving/${KITCHEN.lng},${KITCHEN.lat};31.21971,30.06259?`);
});

test('crowded pins part as the map zooms in and gather again as it zooms out; by the keys, Enter zooms in and the courier keeps the focus', async ({ page }) => {
  await openOrder(page);
  // A street from the kitchen, the courier is gathered with it in the order's first view.
  await expect(together(page)).toBeVisible();
  await theMap(page).focus();
  const focused = page.locator(':focus');
  for (let i = 0; i < 4 && !((await focused.getAttribute('aria-label')) ?? '').startsWith('2 here'); i++) await page.keyboard.press('Tab');
  await expect(focused).toHaveAttribute('aria-label', '2 here: Kitchen, Courier. Zoom in to see them.');
  await page.keyboard.press('Enter');
  // Closer, until they part: each its own pin again, and the courier still has the focus.
  await expect(theMap(page).getByRole('button', { name: 'Kitchen, Koshary Tahrir' })).toBeVisible();
  await expect(focused).toHaveAttribute('aria-label', /^Courier, Mona Adel, \d+ min$/);
  await expect(page.locator('.fd-map-form .fd-map-count')).toHaveCount(0);
  await expect(shown(page)).toHaveCount(3);
  await noneOverlap(page);
  await page.keyboard.press('Enter');
  const card = page.locator('.fd-map-form .fd-map-card');
  await expect(card.locator('.fd-map-card-title')).toHaveText('Mona Adel');
  await page.keyboard.press('Escape');
  // Out again: gathered again, at each zoom.
  for (let i = 0; i < 4; i++) {
    await theMap(page).getByRole('button', { name: 'Zoom out' }).click();
    await page.waitForTimeout(350);
  }
  await expect(together(page)).toBeVisible();
  await noneOverlap(page);
});

test('pins on one spot that no zoom parts are listed, each opening its own card', async ({ page }) => {
  await openOrder(page);
  await send(page, KITCHEN);
  await together(page).locator('.fd-map-face').click();
  const list = page.locator('.fd-map-form .fd-map-crowd');
  await expect(list.locator('.fd-map-card-title')).toHaveText('2 in one place');
  await expect(list.getByRole('button', { name: /^(Kitchen|Courier)/ })).toHaveText(['Kitchen, Koshary Tahrir', /^Courier, Mona Adel, \d+ min$/]);
  await screen(page, 'map-form-crowd-list');
  await list.getByRole('button', { name: 'Kitchen, Koshary Tahrir' }).click();
  await expect(list).toHaveCount(0);
  await expect(page.locator('.fd-map-form .fd-map-card-title')).toHaveText('Koshary Tahrir');
  await page.keyboard.press('Escape');
  await expect(page.locator('.fd-map-form .fd-map-card')).toHaveCount(0);
  await expect(page.locator(':focus')).toHaveAttribute('aria-label', '2 here: Kitchen, Courier. Zoom in to see them.');
});

test('a courier gathered with the kitchen still greys when their news is old, and glides out of it on their way', async ({ page }) => {
  await page.clock.install();
  await openOrder(page);
  await send(page, KITCHEN);
  await expect(together(page)).toBeVisible();
  await jump(page, 76_000);
  await expect(together(page).locator('.fd-map-face')).toHaveAttribute('data-stale', '');
  await expect(together(page).locator('.fd-map-face-stale')).toHaveText(/^Last seen \d+ minutes? ago$/);
  await screen(page, 'map-form-crowd-stale');
  // On their way again: out of the gathering, gliding, and the kitchen's own pin is back.
  const from = await spot(page);
  await send(page, ROUTE_LINE[40]);
  await page.waitForTimeout(400);
  const midway = await spot(page);
  await page.waitForTimeout(900);
  const to = await spot(page);
  expect(Math.hypot(midway.x - from.x, midway.y - from.y)).toBeGreaterThan(3);
  expect(Math.hypot(to.x - midway.x, to.y - midway.y)).toBeGreaterThan(3);
  await expect(theMap(page).getByRole('button', { name: 'Kitchen, Koshary Tahrir' })).toBeVisible();
  await expect(page.locator('.fd-map-form .fd-map-count')).toHaveCount(0);
});

const ROUND = 'page=map-round&skin=outlined';
const stops = (page: Page) => page.locator('.fd-map-form .fd-map-mark').filter({ has: page.locator('.fd-map-face[data-look="label"]') });

test('a place for each line: a round’s stops numbered in their order, greyed once done, and the way through them', async ({ page }) => {
  await stubMaps(page);
  const routes = await stubRoutes(page);
  const { problems } = await open(page, 'plain', ROUND);
  await mapReady(theMap(page));
  await expect(stops(page)).toHaveCount(5);
  await expect(stops(page).locator('.fd-map-face-text')).toHaveText(['1', '2', '3', '4', '5']);
  // With the whole round in view, the three stops in Zamalek crowd: one bubble, named for them.
  const zamalek = theMap(page).getByRole('button', { name: '3 here: Nile Traders, Zamalek Studio, Bayt Interiors. Zoom in to see them.' });
  await expect(zamalek).toBeVisible();
  // The way from the van through each stop, in order, longitude first: each stop's own place, not the bubble's.
  await expect(route(page)).toHaveCount(1);
  expect(routes[0]).toContain('/route/v1/driving/31.2353,30.0443;31.2218,30.0659;31.2165,30.0606;31.2238,30.0577;31.2091,30.0389;31.2205,30.0388?');
  await expect.poll(async () => (await values(page))['distance_m']).toBeGreaterThan(0);
  // Closer, they part: each named by the layer's words, the stop's customer and its number.
  await zamalek.click();
  await expect(stops(page).nth(2)).toBeVisible();
  await expect(stops(page).nth(2)).toHaveAttribute('aria-label', 'Stop, Bayt Interiors, 3');
  await expect(stops(page).nth(0).locator('.fd-map-face')).toHaveAttribute('data-tone', 'muted');
  await expect(stops(page).nth(2).locator('.fd-map-face')).not.toHaveAttribute('data-tone', /.*/);
  // A stop ticked done in the table greys on the map.
  const third = page.locator('[data-node="f-stops"] tbody tr').nth(2);
  await third.getByRole('checkbox').check();
  await expect(stops(page).nth(2).locator('.fd-map-face')).toHaveAttribute('data-tone', 'muted');
  await screen(page, 'map-form-round');
  // A stop taken off the round: off the map, and the way asked for again without it.
  await page.locator('[data-node="f-stops"] tbody tr').nth(3).getByRole('button', { name: /Delete|Remove/ }).click();
  await expect(stops(page)).toHaveCount(4);
  await expect.poll(() => routes.length).toBe(2);
  expect(routes[1]).not.toContain('31.2091,30.0389');
  // A stop's card, from its pin.
  await stops(page).nth(0).locator('.fd-map-face').click();
  const card = page.locator('.fd-map-form .fd-map-card');
  await expect(card.locator('.fd-map-card-title')).toHaveText('Nile Traders');
  await expect(card.locator('dt')).toHaveText(['Address', 'Delivered']);
  expect(problems).toEqual([]);
});

test('a round’s stops that crowd become a bubble, and the way still goes through each one’s own place', async ({ page }) => {
  await stubMaps(page);
  const routes = await stubRoutes(page);
  await open(page, 'plain', ROUND);
  await mapReady(theMap(page));
  await expect(route(page)).toHaveCount(1);
  // The last stop moved to the door next to the one before it, thirty metres away.
  await page.evaluate(() => {
    const form = (window as unknown as Demo).fieldiaDemo.handle.form;
    const lines = structuredClone(form.getState().values['stop_ids']) as { values: Record<string, unknown> }[];
    lines[4].values['place'] = { type: 'Point', coordinates: [31.2094, 30.0391] };
    form.setValues({ stop_ids: lines });
  });
  const bubble = theMap(page).getByRole('button', { name: '2 here: Delta Foods, Amira Clinics. Zoom in to see them.' });
  await expect(bubble).toBeVisible();
  await expect(bubble.locator('.fd-map-bubble')).toHaveText('2');
  // With the whole round in view, the three in Zamalek are a bubble of their own.
  await expect(theMap(page).getByRole('button', { name: '3 here: Nile Traders, Zamalek Studio, Bayt Interiors. Zoom in to see them.' })).toBeVisible();
  await expect(stops(page).filter({ visible: true })).toHaveCount(0);
  await noneOverlap(page);
  await expect.poll(() => routes.length).toBe(2);
  expect(routes[1]).toContain('31.2091,30.0389;31.2094,30.0391?');
  await screen(page, 'map-form-round-crowd');
  expect(await axeFindings(page, 'round map, two stops crowding')).toEqual([]);
  // Drawn again, as any change to the record draws it: the same bubble, and the keys stay on it.
  await bubble.focus();
  const same = await bubble.evaluate((element) => ((element as HTMLElement & { seen?: boolean }).seen = true));
  await page.evaluate(() => (window as unknown as Demo).fieldiaDemo.handle.form.setValues({ driver: 'Hana Wael' }));
  await expect(bubble).toBeFocused();
  expect(await bubble.evaluate((element) => (element as HTMLElement & { seen?: boolean }).seen)).toBe(same);
  // Pressed: closer, until they part.
  await bubble.click();
  await expect(stops(page).filter({ visible: true })).toHaveCount(5);
  await expect(bubble).toHaveCount(0);
});

for (const variant of ['react', 'vue', 'angular']) {
  test(`${variant}: the order’s map, its three places and the way to the door`, async ({ page }) => {
    await stubMaps(page);
    await stubRoutes(page);
    const { problems } = await open(page, variant, ORDER);
    await mapReady(theMap(page));
    await expect(marks(page)).toHaveCount(3);
    await expect(route(page)).toHaveCount(1);
    expect(problems).toEqual([]);
  });
}
