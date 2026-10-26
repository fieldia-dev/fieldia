import { type Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { axeFindings } from './a11y-support';
import { at, drag, mapOf, mapReady, mapSettled, stubMaps, valueOf, zoomOf } from './map-support';
import { node, open, screen } from './support';

/**
 * A place on a map (@fieldia/map's `place` widget), in the delivery demo: set
 * by a press, a dragged pin, a search, typed coordinates, the keyboard and
 * "My location"; written as a GeoJSON Point; Address named from it unless a
 * person typed their own. Every map image and search is a stand-in
 * (map-support.ts).
 */

const QUERY = 'page=map-delivery&skin=outlined';
const TAHRIR = { lat: 30.0444, lon: 31.2357, name: 'Tahrir Square', district: 'Downtown', city: 'Cairo', country: 'Egypt' };
const ZAMALEK = { lat: 30.0609, lon: 31.2197, name: 'Zamalek', city: 'Cairo', country: 'Egypt' };

async function openPlace(page: Page, query = QUERY, answers: Parameters<typeof stubMaps>[1] = {}) {
  const asked = await stubMaps(page, answers);
  const { problems } = await open(page, 'plain', query);
  const map = mapOf(page, 'deliver_to');
  await mapReady(map);
  return { map, asked, problems, field: node(page, 'deliver_to') };
}

/** Where the pin's tip is: the bottom middle of its drawing. */
async function pinTip(page: Page) {
  const box = (await node(page, 'deliver_to').locator('.fd-map-pin').boundingBox())!;
  return { x: box.x + box.width / 2, y: box.y + box.height - 1 };
}

const point = (value: unknown) => {
  const coordinates = (value as { coordinates: [number, number] }).coordinates;
  return { lng: coordinates[0], lat: coordinates[1] };
};

test('a press on the map puts the place there: the pin’s tip on it, the coordinates under the map; Clear takes it away', async ({ page }) => {
  const { map, field, problems } = await openPlace(page);
  await expect(field.locator('.fd-map-pin')).toHaveCount(0);
  const spot = await at(map, 0.3, 0.6);
  await page.mouse.click(spot.x, spot.y);
  await expect.poll(() => valueOf(page, 'deliver_to')).toMatchObject({ type: 'Point' });
  const tip = await pinTip(page);
  expect(Math.abs(tip.x - spot.x)).toBeLessThanOrEqual(2);
  expect(Math.abs(tip.y - spot.y)).toBeLessThanOrEqual(2);
  const placed = point(await valueOf(page, 'deliver_to'));
  await expect(field.getByLabel('Latitude')).toHaveValue(String(placed.lat));
  await expect(field.getByLabel('Longitude')).toHaveValue(String(placed.lng));
  // Six decimals: about 11 cm on the ground.
  expect(String(placed.lat).split('.')[1]?.length ?? 0).toBeLessThanOrEqual(6);
  await screen(page, 'map-place-pressed');

  await field.getByRole('button', { name: 'Clear' }).click();
  await expect.poll(() => valueOf(page, 'deliver_to')).toBeNull();
  await expect(field.locator('.fd-map-pin')).toHaveCount(0);
  await expect(field.getByRole('button', { name: 'Clear' })).toBeHidden();
  await expect(field.getByLabel('Latitude')).toHaveValue('');
  expect(problems).toEqual([]);
});

test('the pin drags to a new place, at a hand’s speed', async ({ page }) => {
  const { map } = await openPlace(page);
  const first = await at(map, 0.4, 0.5);
  await page.mouse.click(first.x, first.y);
  await expect.poll(() => valueOf(page, 'deliver_to')).toMatchObject({ type: 'Point' });
  const before = point(await valueOf(page, 'deliver_to'));
  // Taken by its body, a little above its tip, and carried 120 pixels east and 40 south.
  await drag(page, { x: first.x, y: first.y - 18 }, { x: first.x + 120, y: first.y - 18 + 40 });
  await expect.poll(async () => point(await valueOf(page, 'deliver_to')).lng).toBeGreaterThan(before.lng);
  const after = point(await valueOf(page, 'deliver_to'));
  expect(after.lat).toBeLessThan(before.lat);
  const tip = await pinTip(page);
  expect(Math.abs(tip.x - (first.x + 120))).toBeLessThanOrEqual(3);
  expect(Math.abs(tip.y - (first.y + 40))).toBeLessThanOrEqual(3);
});

test('typed coordinates move the pin there; a wrong one is said and changes nothing', async ({ page }) => {
  const { field, map } = await openPlace(page);
  await field.getByLabel('Latitude').fill('30.0609');
  await field.getByLabel('Longitude').fill('31.2197');
  await field.getByLabel('Longitude').press('Enter');
  await expect.poll(() => valueOf(page, 'deliver_to')).toEqual({ type: 'Point', coordinates: [31.2197, 30.0609] });
  // The map came to it: the pin is in view.
  const pin = (await field.locator('.fd-map-pin').boundingBox())!;
  const box = (await map.boundingBox())!;
  expect(pin.x).toBeGreaterThan(box.x);
  expect(pin.x + pin.width).toBeLessThan(box.x + box.width);

  // A comma for the decimals and Arabic digits are read too.
  await field.getByLabel('Latitude').fill('٣٠٫٠٥');
  await field.getByLabel('Longitude').fill('31,22');
  await field.getByLabel('Longitude').press('Enter');
  await expect.poll(() => valueOf(page, 'deliver_to')).toEqual({ type: 'Point', coordinates: [31.22, 30.05] });

  // Letters are refused as they are typed, as every number box refuses them; Enter shows what was typed, marked, with why.
  await field.getByLabel('Latitude').fill('north');
  await field.getByLabel('Latitude').press('Enter');
  await expect(field.getByLabel('Latitude')).toHaveAttribute('aria-invalid', 'true');
  await expect(field.getByLabel('Latitude')).toHaveValue('north');
  await expect(field.locator('.fd-map-note')).toHaveText('Latitude: numbers only');
  // One that reads but is past the poles: the box says which numbers it takes.
  await field.getByLabel('Latitude').fill('95');
  await field.getByLabel('Latitude').press('Enter');
  await expect(field.locator('.fd-map-note')).toHaveText('Latitude: a number from -90 to 90');
  expect(await valueOf(page, 'deliver_to')).toEqual({ type: 'Point', coordinates: [31.22, 30.05] });
});

test('a search suggests places as people type, nearest the map first, each on two lines; Enter takes the first, the arrows another, and Address takes its name', async ({ page }) => {
  const { field, asked, map } = await openPlace(page, QUERY, { search: [TAHRIR, ZAMALEK] });
  // The map moved east first: the search asks near where it now is, not where it opened.
  // Moved by its keys until it has moved: WebKit can take the first presses before the map listens for them.
  const panes = () => map.locator('.leaflet-map-pane').evaluate((el) => (el as HTMLElement).style.transform);
  const before = await panes();
  await expect(async () => {
    await map.focus();
    for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowRight');
    await mapSettled(map);
    expect(await panes()).not.toBe(before);
  }).toPass({ timeout: 8000 });
  const search = field.getByRole('combobox');
  await search.pressSequentially('tah', { delay: 60 });
  const options = field.getByRole('option');
  // No Enter: the suggestions come as the typing pauses.
  await expect(options).toHaveCount(2);
  await expect(options.nth(0).locator('.fd-map-result-name')).toHaveText('Tahrir Square');
  await expect(options.nth(0).locator('.fd-map-result-detail')).toHaveText('Downtown, Cairo, Egypt');
  await expect(options.nth(1).locator('.fd-map-result-name')).toHaveText('Zamalek');
  await expect(search).toHaveAttribute('aria-expanded', 'true');
  // Asked near where the map is, at its zoom: the nearest come first.
  const searched = asked.filter((url) => url.includes('photon.komoot.io/api')).at(-1)!;
  expect(searched).toContain('q=tah');
  const lon = Number(/lon=([\d.]+)/.exec(searched)?.[1]);
  expect(lon).toBeGreaterThan(31.25);
  expect(searched).toMatch(/lat=30\.04\d*&lon=[\d.]+&zoom=12/);
  expect(searched).toContain('lang=en');
  await screen(page, 'map-place-search');

  // Enter takes the first, the nearest.
  await search.press('Enter');
  await expect.poll(() => valueOf(page, 'deliver_to')).toEqual({ type: 'Point', coordinates: [31.2357, 30.0444] });
  // Address takes the whole address, both lines.
  expect(await valueOf(page, 'street')).toBe('Tahrir Square, Downtown, Cairo, Egypt');
  await expect(field.getByRole('listbox')).toBeHidden();
  // Enter in the search never sends the form.
  await expect(page.locator('.fd-form')).toBeVisible();

  // The arrows choose another.
  await search.fill('');
  await search.pressSequentially('zam', { delay: 60 });
  await expect(options).toHaveCount(2);
  await search.press('ArrowDown');
  await search.press('ArrowDown');
  await expect(options.nth(1)).toHaveAttribute('aria-selected', 'true');
  await expect(search).toHaveAttribute('aria-activedescendant', (await options.nth(1).getAttribute('id'))!);
  await search.press('Enter');
  await expect.poll(() => valueOf(page, 'deliver_to')).toEqual({ type: 'Point', coordinates: [31.2197, 30.0609] });
  expect(await valueOf(page, 'street')).toBe('Zamalek, Cairo, Egypt');
});

test('a search that finds nothing says so; a search that fails says so', async ({ page }) => {
  const { field } = await openPlace(page, QUERY, { search: [] });
  await field.getByRole('combobox').fill('nowhere at all');
  await expect(field.locator('.fd-map-note')).toHaveText('No address found');
  await page.route('https://photon.komoot.io/**', (route) => route.fulfill({ status: 503, body: 'busy' }));
  await field.getByRole('combobox').fill('nowhere at all, again');
  await expect(field.locator('.fd-map-note')).toHaveText('The search did not answer. Try again.');
});

test('a place pressed on the map names Address, but never writes over an address a person typed', async ({ page }) => {
  const { map } = await openPlace(page, QUERY, { reverse: { lat: 30.06, lon: 31.22, street: '26 July Street', housenumber: '3', district: 'Zamalek', city: 'Cairo' } });
  const first = await at(map, 0.5, 0.5);
  await page.mouse.click(first.x, first.y);
  await expect.poll(() => valueOf(page, 'street')).toBe('26 July Street 3, Zamalek, Cairo');
  // Pressed again: the name it gave is its own to change.
  await page.route('https://photon.komoot.io/reverse**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ type: 'FeatureCollection', features: [{ type: 'Feature', geometry: { type: 'Point', coordinates: [31.21, 30.07] }, properties: { street: 'Brazil Street', district: 'Zamalek', city: 'Cairo' } }] }) })
  );
  const second = await at(map, 0.6, 0.4);
  await page.mouse.click(second.x, second.y);
  await expect.poll(() => valueOf(page, 'street')).toBe('Brazil Street, Zamalek, Cairo');
  // A person's own words stay.
  await node(page, 'street').locator('input').fill('Flat 4, 12 Brazil Street');
  const third = await at(map, 0.3, 0.3);
  await page.mouse.click(third.x, third.y);
  await page.waitForTimeout(600);
  expect(await valueOf(page, 'street')).toBe('Flat 4, 12 Brazil Street');
});

test('by keyboard: Tab reaches the map and shows its cross; Enter puts the place at the cross; the arrow keys carry the pin', async ({ page }) => {
  const { map, field } = await openPlace(page);
  await field.getByRole('combobox').focus();
  // Past My location (no permission here: it may be gone) to the map.
  for (let i = 0; i < 4 && !(await map.evaluate((el) => el === document.activeElement)); i++) await page.keyboard.press('Tab');
  await expect(map).toBeFocused();
  await expect(map.locator('.fd-map-crosshair')).toBeVisible();
  await expect(map).toHaveAttribute('aria-label', 'Delivery to, map');
  const keys = await map.getAttribute('aria-describedby');
  await expect(page.locator(`[id="${keys}"]`)).toContainText('Press Enter to put the place at the centre of the map.');
  await screen(page, 'map-place-keyboard');

  await page.keyboard.press('Enter');
  await expect.poll(() => valueOf(page, 'deliver_to')).toMatchObject({ type: 'Point' });
  const box = (await map.boundingBox())!;
  const tip = await pinTip(page);
  expect(Math.abs(tip.x - (box.x + box.width / 2))).toBeLessThanOrEqual(2);
  expect(Math.abs(tip.y - (box.y + box.height / 2))).toBeLessThanOrEqual(2);
  const placed = point(await valueOf(page, 'deliver_to'));

  // The arrow keys move the map...
  await page.keyboard.press('ArrowLeft');
  // ...and on the pin, the pin.
  await page.keyboard.press('Tab');
  await expect(field.locator('.fd-map-pin')).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Shift+ArrowRight');
  await expect.poll(async () => point(await valueOf(page, 'deliver_to')).lng).toBeGreaterThan(placed.lng);
  expect(point(await valueOf(page, 'deliver_to')).lat).toBe(placed.lat);
  // A press of the mouse puts the cross away.
  await page.mouse.click(box.x + 20, box.y + box.height - 20);
  await expect(map.locator('.fd-map-crosshair')).toBeHidden();
});

test.describe('My location, sure of itself', () => {
  test.use({ permissions: ['geolocation'], geolocation: { latitude: 30.0566, longitude: 31.2296, accuracy: 15 } });

  test('My location puts the place where the reader is, and says nothing more', async ({ page }) => {
    const { field } = await openPlace(page);
    await field.getByRole('button', { name: 'My location' }).click();
    await expect.poll(() => valueOf(page, 'deliver_to')).toEqual({ type: 'Point', coordinates: [31.2296, 30.0566] });
    await expect(field.locator('.fd-map-note')).toBeHidden();
  });
});

test.describe('My location, rough (a desktop placed by its network)', () => {
  test.use({ permissions: ['geolocation'], geolocation: { latitude: 50.1109, longitude: 8.6821, accuracy: 3200 } });

  test('says how rough, draws the circle it may be anywhere in, fits the map to it, and names no address from it; a press elsewhere takes the circle away', async ({ page }) => {
    const { field, map } = await openPlace(page, QUERY, { reverse: { lat: 50.11, lon: 8.68, street: 'Zeil', city: 'Frankfurt' } });
    await field.getByRole('button', { name: 'My location' }).click();
    await expect.poll(() => valueOf(page, 'deliver_to')).toEqual({ type: 'Point', coordinates: [8.6821, 50.1109] });
    await expect(field.locator('.fd-map-note')).toHaveText('Placed within about 3 km of where you are. Drag the pin to the right spot.');
    const circle = map.locator('path.fd-map-accuracy');
    await expect(circle).toHaveCount(1);
    // The whole circle in view.
    const drawn = (await circle.boundingBox())!;
    const box = (await map.boundingBox())!;
    expect(drawn.y).toBeGreaterThanOrEqual(box.y);
    expect(drawn.y + drawn.height).toBeLessThanOrEqual(box.y + box.height);
    await screen(page, 'map-place-rough-location');
    await page.waitForTimeout(500);
    expect(await valueOf(page, 'street')).toBeNull();
    const spot = await at(map, 0.3, 0.3);
    await page.mouse.click(spot.x, spot.y);
    await expect(circle).toHaveCount(0);
  });
});

test('My location, refused: the button goes, and the reason is said in its place', async ({ page, context, browserName }) => {
  await context.clearPermissions();
  // Chromium refuses a page with no permission at once. Firefox and WebKit ask the person, and wait for the answer;
  // here, they answer as a browser does once the person blocks the site.
  if (browserName !== 'chromium') {
    await page.addInitScript(() => {
      navigator.geolocation.getCurrentPosition = (_found, failed) =>
        void setTimeout(() => failed?.({ code: 1, message: 'User denied Geolocation', PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 } as GeolocationPositionError));
    });
  }
  const { field } = await openPlace(page);
  const button = field.getByRole('button', { name: 'My location' });
  if (await button.isVisible()) await button.click();
  await expect(button).toBeHidden();
  await expect(field.locator('.fd-map-note')).toHaveText('This site may not ask for your location.');
  expect(await valueOf(page, 'deliver_to')).toBeNull();
});

test('read-only: no tools, the pin stays where it is, a press moves nothing', async ({ page }) => {
  const { map, field } = await openPlace(page);
  const spot = await at(map, 0.5, 0.5);
  await page.mouse.click(spot.x, spot.y);
  await expect.poll(() => valueOf(page, 'deliver_to')).toMatchObject({ type: 'Point' });
  const placed = await valueOf(page, 'deliver_to');
  await page.evaluate(() => (window as any).fieldiaDemo.handle.setReadonly(true));
  await expect(field.locator('.fd-map-tools')).toBeHidden();
  await expect(field.getByLabel('Latitude')).toHaveAttribute('readonly', '');
  const other = await at(map, 0.2, 0.2);
  await page.mouse.click(other.x, other.y);
  await drag(page, { x: spot.x, y: spot.y - 18 }, { x: spot.x + 80, y: spot.y + 60 });
  await page.waitForTimeout(300);
  expect(await valueOf(page, 'deliver_to')).toEqual(placed);
  await screen(page, 'map-place-readonly');
});

test('a scroll over the map scrolls the page and says how to zoom; Ctrl with it zooms the map', async ({ page }) => {
  const { map } = await openPlace(page);
  const zoom = await zoomOf(map);
  const middle = await at(map, 0.5, 0.5);
  await page.mouse.move(middle.x, middle.y);
  await page.mouse.wheel(0, 240);
  // The veil says how to zoom for 1.4 s from the wheel: read it first, before waiting for the page to scroll, which a
  // slow runner may take longer than that to show.
  await expect(map.locator('.fd-map-veil')).toHaveAttribute('data-show', '');
  await expect(map.locator('.fd-map-veil')).toHaveText('Use Ctrl + scroll to zoom the map');
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
  expect(await zoomOf(map)).toBe(zoom);
  // Ctrl with the wheel zooms. Playwright's WebKit now and then drops one synthetic wheel (it passed and failed on the
  // same commit): the gesture is made again until the map answers it, a few seconds at most.
  await expect(async () => {
    const now = await at(map, 0.5, 0.5);
    await page.mouse.move(now.x, now.y);
    await page.keyboard.down('Control');
    await page.mouse.wheel(0, -300);
    await page.keyboard.up('Control');
    await expect.poll(() => zoomOf(map), { timeout: 1500 }).toBeGreaterThan(zoom);
  }).toPass({ timeout: 8000 });
});

test('map images overlap their neighbours by a pixel, so no hairline shows between them at 125%', async ({ page }) => {
  const { map } = await openPlace(page);
  const tiles = await map.locator('.leaflet-tile-loaded').evaluateAll((els) => els.map((el) => el.getBoundingClientRect()).map((r) => ({ x: r.x, y: r.y, w: r.width, h: r.height })));
  expect(tiles.length).toBeGreaterThan(1);
  for (const t of tiles) {
    expect(t.w).toBe(257);
    expect(t.h).toBe(257);
  }
  // Two side by side: the second begins a pixel before the first ends.
  const row = tiles.filter((t) => t.y === tiles[0].y).sort((a, b) => a.x - b.x);
  expect(row[1].x).toBeLessThan(row[0].x + row[0].w);
  // Drawn plainly over each other: Leaflet's own fix adds their light, which turns every overlap into a white line.
  expect(await map.locator('.leaflet-tile-loaded').first().evaluate((el) => getComputedStyle(el).mixBlendMode)).toBe('normal');
});

test('the zoom buttons zoom, and a press on them is not a place', async ({ page }) => {
  const { map, field } = await openPlace(page);
  const zoom = await zoomOf(map);
  await map.getByRole('button', { name: 'Zoom in' }).click();
  await expect.poll(() => zoomOf(map)).toBe(zoom + 1);
  await map.getByRole('button', { name: 'Zoom out' }).click();
  await expect.poll(() => zoomOf(map)).toBe(zoom);
  expect(await valueOf(page, 'deliver_to')).toBeNull();
  await expect(field.locator('.fd-map-pin')).toHaveCount(0);
});

test('the keys zoom as the buttons do: a second key pressed while the map still zooms from the first is kept, never dropped', async ({ page }) => {
  const { map } = await openPlace(page);
  const zoom = await zoomOf(map);
  await map.focus();
  // Two quick presses of each, the second 120 ms after the first, while the map still glides (0.35 dropped it).
  const twice = (key: string, keyCode: number) =>
    map.evaluate(
      (element, { key, keyCode }) =>
        new Promise<void>((done) => {
          const press = () => element.dispatchEvent(new KeyboardEvent('keydown', { key, keyCode, bubbles: true, cancelable: true } as KeyboardEventInit));
          press();
          setTimeout(() => (press(), done()), 120);
        }),
      { key, keyCode }
    );
  await twice('+', 187);
  await expect.poll(() => zoomOf(map)).toBe(zoom + 2);
  await mapSettled(map);
  await twice('-', 189);
  await expect.poll(() => zoomOf(map)).toBe(zoom);
});

test('in Arabic, right to left: the map’s words are Arabic, its buttons on the left, the map itself not mirrored', async ({ page }) => {
  const { map, field } = await openPlace(page, `${QUERY}&locale=ar&dir=rtl`);
  await expect(field.getByRole('combobox')).toHaveAttribute('placeholder', 'ابحث عن عنوان');
  await expect(map).toHaveAttribute('aria-label', 'التوصيل إلى، خريطة');
  await expect(map).toHaveAttribute('dir', 'ltr');
  const zoom = (await map.locator('.fd-map-zoom').boundingBox())!;
  const box = (await map.boundingBox())!;
  expect(zoom.x - box.x).toBeLessThan(20);
  await expect(map.getByRole('button', { name: 'تكبير' })).toBeVisible();
  const spot = await at(map, 0.6, 0.5);
  await page.mouse.click(spot.x, spot.y);
  await expect.poll(() => valueOf(page, 'deliver_to')).toMatchObject({ type: 'Point' });
  await expect(field.getByRole('button', { name: 'مسح' })).toBeVisible();
  await screen(page, 'map-place-arabic');
});

test('in the dark scheme the map’s own parts take the dark colours', async ({ page }) => {
  const { map, field } = await openPlace(page, `${QUERY}&scheme=dark`);
  const surface = await map.getByRole('button', { name: 'Zoom in' }).evaluate((el) => getComputedStyle(el).backgroundColor);
  const page_ = await page.locator('.fd-form').evaluate((el) => getComputedStyle(el).getPropertyValue('--fd-surface').trim());
  expect(surface).not.toBe('rgb(255, 255, 255)');
  expect(page_).not.toBe('');
  await field.getByRole('combobox').fill('x');
  await screen(page, 'map-place-dark');
});

test('no accessibility findings, empty and with a place', async ({ page }) => {
  const { map } = await openPlace(page);
  expect(await axeFindings(page, 'place, empty')).toEqual([]);
  const spot = await at(map, 0.5, 0.5);
  await page.mouse.click(spot.x, spot.y);
  await expect.poll(() => valueOf(page, 'deliver_to')).toMatchObject({ type: 'Point' });
  expect(await axeFindings(page, 'place, set')).toEqual([]);
});

test('the credits’ link is a finger’s size (24px), inside its strip: a place set just over it leaves no target too small', async ({ page }) => {
  const { map } = await openPlace(page);
  const link = map.locator('.fd-map-credits a');
  await expect(link).toHaveText('© OpenStreetMap contributors');
  const [box, strip] = [(await link.boundingBox())!, (await map.locator('.fd-map-credits').boundingBox())!];
  expect(box.height, 'the link is shorter than 24px').toBeGreaterThanOrEqual(24);
  expect(box.width).toBeGreaterThanOrEqual(24);
  // All of it is where it is drawn: a press anywhere on it is on it, none on the map around it.
  expect(box.y).toBeGreaterThanOrEqual(strip.y - 0.5);
  expect(box.y + box.height).toBeLessThanOrEqual(strip.y + strip.height + 0.5);
  expect(await link.evaluate((a) => getComputedStyle(a).fontSize)).toBe('11px');
  // A pin a hair over the link: axe's spacing allowance no longer holds, so the link's own size must.
  await page.mouse.click(box.x + box.width / 2, strip.y - 3);
  await expect.poll(() => valueOf(page, 'deliver_to')).toMatchObject({ type: 'Point' });
  await screen(page, 'map-credits-under-a-pin', { viewport: true });
  expect(await axeFindings(page, 'a place just over the credits')).toEqual([]);
});

for (const variant of ['react', 'vue', 'angular']) {
  test(`${variant}: the place widget is there and a press writes the place`, async ({ page }) => {
    await stubMaps(page);
    const { problems } = await open(page, variant, QUERY);
    const map = mapOf(page, 'deliver_to');
    await mapReady(map);
    const spot = await at(map, 0.5, 0.5);
    await page.mouse.click(spot.x, spot.y);
    await expect.poll(() => valueOf(page, 'deliver_to')).toMatchObject({ type: 'Point' });
    expect(problems).toEqual([]);
  });
}
