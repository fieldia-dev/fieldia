import { type Locator, type Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { axeFindings } from './a11y-support';
import { at, mapReady, stubAzure, stubMaps, valueOf } from './map-support';
import { open, screen } from './support';

/**
 * Areas by colour and the rest of the map's box: the week's orders by
 * district (each district shaded by its orders, a legend, a district pressed
 * searching for them, Nearest first, measuring a way), the same orders as a
 * heat map, and a kitchen's map (districts shaded by their fee, one chosen by
 * a press, the area within fifteen minutes, a fence whose steps run as the
 * courier reaches the drop-off zone), its live traffic from Azure Maps. The
 * districts are the demo's own rough shapes; every map image is a stand-in
 * (map-support.ts).
 */

const ZONES = 'page=map-zones&skin=outlined';
const HEAT = 'page=map-heat&skin=outlined';
const KITCHEN = 'page=map-kitchen&skin=outlined&ride=off';
const theMap = (page: Page) => page.locator('.fd-map-box').first();
const regions = (page: Page) => page.locator('path.fd-map-region');
const region = (page: Page, name: string) => page.locator(`path.fd-map-region[aria-label^="${name}"]`);
const legend = (page: Page) => page.locator('.fd-map-legend');
const rows = (page: Page) => page.locator('.fd-list-row');
const range = (page: Page) => page.locator('.fd-pager-text');
const chips = (page: Page) => page.locator('.fd-facet .fd-facet-text');
const tool = (page: Page, name: string) => theMap(page).getByRole('button', { name, exact: true });
const total = async (page: Page) => Number((await range(page).textContent())!.split('/ ')[1]);

async function openMap(page: Page, query: string) {
  await stubMaps(page);
  const opened = await open(page, 'plain', query);
  await mapReady(theMap(page));
  return opened;
}

/**
 * A spot of an area a person can point at: inside it, with no pin over it.
 * Found in the page, as the pointer finds what is under it.
 */
async function spotOf(page: Page, area: Locator) {
  const box = (await area.boundingBox())!;
  const spot = await area.evaluate((path, b) => {
    for (let y = 0.3; y <= 0.7; y += 0.05)
      for (let x = 0.3; x <= 0.7; x += 0.05) {
        const px = b.x + b.width * x;
        const py = b.y + b.height * y;
        if (document.elementFromPoint(px, py) === path) return { x: px, y: py };
      }
    return null;
  }, box);
  expect(spot, 'a spot of the area with nothing over it').not.toBeNull();
  return spot!;
}

test.describe('orders by district', () => {
  test('each district shaded by its orders, with a legend from the least to the most', async ({ page }) => {
    await openMap(page, ZONES);
    await expect(regions(page)).toHaveCount(14);
    await expect(legend(page)).toBeVisible();
    // The legend says what it counts — the week's orders in each district — and the page what a bubble counts: orders
    // close together on the map, whichever district they are in. Two measures, each said, never taken for the other.
    await expect(legend(page).locator('.fd-map-legend-title')).toHaveText('Orders this week, by district');
    await expect(page.locator('.fd-page-description, .fd-page-head').first()).toContainText('counts the orders close together on the map, whichever district they are in');
    // And the legend itself says what a round mark with a number means, under the shades — a bubble says 92 while the
    // shades top out at 25, and the walk read one for the other.
    const bubble = legend(page).locator('li.fd-map-legend-bubble');
    await expect(bubble).toHaveText('12How many are close together: zoom in to part them');
    await expect(bubble.locator('b')).toHaveCSS('border-radius', '50%');
    await expect(legend(page).locator('li').last()).toHaveClass('fd-map-legend-bubble');
    // Open on a desktop's map, beside the tools under the zoom, never over them; its title folds it.
    await expect(legend(page).getByRole('button', { name: 'Orders this week, by district' })).toHaveAttribute('aria-expanded', 'true');
    const tools = (await theMap(page).locator('.fd-map-zoom').boundingBox())!;
    const key = (await legend(page).boundingBox())!;
    expect(key.x + key.width).toBeLessThanOrEqual(tools.x);
    await screen(page, 'map-zones-legend-bubble', { viewport: true });
    // Counts step by whole numbers, from 1: "1–5", "6–10"…
    const steps = await legend(page).locator('li:not(.fd-map-legend-bubble)').allTextContents();
    expect(steps[0]).toMatch(/^1–\d+$/);
    expect(steps.length).toBeGreaterThanOrEqual(3);
    // Every district has orders this week: each one shaded, none called None.
    await expect(page.locator('path.fd-map-region[data-shade]')).toHaveCount(14);
    expect(steps).not.toContain('None');
    // Downtown, with more orders than Mokattam, is shaded deeper.
    const shade = async (name: string) => Number(await region(page, name).getAttribute('data-shade'));
    expect(await shade('Downtown')).toBeGreaterThan(await shade('Mokattam'));
  });

  test('pointing at a district says its orders; a click searches for them, and the shades stay', async ({ page }) => {
    await openMap(page, ZONES);
    const spot = await spotOf(page, region(page, 'Zamalek'));
    await page.mouse.move(spot.x, spot.y);
    const tip = page.locator('.leaflet-tooltip.fd-map-tip');
    await expect(tip).toHaveText(/^Zamalek: \d+$/);
    const orders = Number((await tip.textContent())!.split(': ')[1]);
    await page.mouse.click(spot.x, spot.y);
    await expect(chips(page)).toHaveText(['In Zamalek']);
    await expect.poll(() => total(page)).toBe(orders);
    await expect(rows(page).locator('td:nth-child(4)').first()).toHaveText('Zamalek');
    await expect(region(page, 'Zamalek')).toHaveAttribute('data-chosen', '');
    // The other districts keep their shades: the counts leave the district searched out.
    await expect(page.locator('path.fd-map-region[data-shade]')).toHaveCount(14);
    // The chip taken away: every order again, no district chosen.
    const search = page.locator('.fd-search').getByRole('combobox');
    await search.focus();
    await search.press('Backspace');
    await expect.poll(() => total(page)).toBe(180);
    await expect(page.locator('path.fd-map-region[data-chosen]')).toHaveCount(0);
  });

  test('the search menu changes the shades: Not delivered counts the orders still out', async ({ page }) => {
    await openMap(page, ZONES);
    const spot = await spotOf(page, region(page, 'Downtown'));
    await page.mouse.move(spot.x, spot.y);
    const tip = page.locator('.leaflet-tooltip.fd-map-tip');
    const all = Number((await tip.textContent())!.split(': ')[1]);
    await page.mouse.move(5, 5);
    await page.getByRole('button', { name: 'Search options' }).click();
    await page.locator('.fd-search-panel').getByRole('button', { name: 'Not delivered' }).click();
    await expect.poll(() => total(page)).toBeLessThan(180);
    await page.keyboard.press('Escape');
    await page.mouse.move(spot.x, spot.y);
    await expect.poll(async () => Number(((await tip.textContent()) ?? '').split(': ')[1])).toBeLessThan(all);
  });

  test('by the keyboard: the districts are one stop, the arrows go from one to the next, Enter searches it', async ({ page }) => {
    await openMap(page, ZONES);
    await theMap(page).focus();
    await page.keyboard.press('Tab');
    const focused = page.locator('path.fd-map-region:focus');
    await expect(focused).toHaveCount(1);
    await expect(focused).toHaveAttribute('aria-label', /^[A-Z][a-z ]+: \d+ · Orders this week, by district$/);
    // Its words shown as the pointer would show them.
    await expect(page.locator('.leaflet-tooltip.fd-map-tip')).toBeVisible();
    const first = (await focused.getAttribute('aria-label'))!;
    const pane = () => page.locator('.fd-map-list .leaflet-map-pane').getAttribute('style');
    const before = await pane();
    await page.keyboard.press('ArrowRight');
    await expect(focused).not.toHaveAttribute('aria-label', first);
    // The map stays put: the arrow was the districts', not the map's to pan by.
    await page.waitForTimeout(300);
    expect(await pane()).toBe(before);
    const name = (await focused.getAttribute('aria-label'))!.split(':')[0];
    await page.keyboard.press('Enter');
    await expect(chips(page)).toHaveText([`In ${name}`]);
    // The keys stay on the district, to go on from there; Tab leaves the districts for what comes after them: one stop.
    await expect(focused).toHaveAttribute('aria-label', new RegExp(`^${name}:`));
    await page.keyboard.press('Tab');
    await expect(page.locator('path.fd-map-region:focus')).toHaveCount(0);
  });

  test.describe('nearest first, from where the reader is', () => {
    test.use({ geolocation: { latitude: 30.0444, longitude: 31.2357 }, permissions: ['geolocation'] });
    test('the orders nearest Tahrir come first; pressed again, the list’s own order', async ({ page }) => {
      await openMap(page, ZONES);
      await expect(rows(page).first().locator('td').nth(1)).toHaveText('#1041');
      await tool(page, 'Nearest first').click();
      await expect(tool(page, 'Nearest first')).toHaveAttribute('aria-pressed', 'true');
      await expect(rows(page).first().locator('td').nth(3)).toHaveText(/Downtown|Garden City/);
      // No column claims the order.
      await expect(page.locator('th[aria-sort]')).toHaveCount(0);
      await tool(page, 'Nearest first').click();
      await expect(tool(page, 'Nearest first')).toHaveAttribute('aria-pressed', 'false');
      await expect(rows(page).first().locator('td').nth(1)).toHaveText('#1041');
    });
  });

  test('nearest first without the reader’s place: from the middle of the map, and said so', async ({ page }) => {
    await openMap(page, ZONES);
    await tool(page, 'Nearest first').click();
    await expect(page.locator('.fd-map-list-note')).toHaveText('Nearest the middle of the map first: your place was not given.');
    await expect(tool(page, 'Nearest first')).toHaveAttribute('aria-pressed', 'true');
  });

  test('measuring a way: points clicked along it, its length said as it grows, a double-click to finish, Escape to clear', async ({ page }) => {
    await openMap(page, ZONES);
    const map = theMap(page);
    await tool(page, 'Measure a distance').click();
    await expect(tool(page, 'Measure a distance')).toHaveAttribute('aria-pressed', 'true');
    await expect(map.locator('.fd-map-measure-hint')).toContainText('Click points along the way');
    // Points where the districts are not, so the clicks reach the map: over the legend's side is the map's own ground.
    const a = await at(map, 0.06, 0.4);
    const b = await at(map, 0.06, 0.8);
    await page.mouse.click(a.x, a.y);
    await page.mouse.click(b.x, b.y);
    const tag = map.locator('.fd-map-measure-tag span');
    await expect(tag).toHaveText(/^\d+(\.\d)? km$/);
    await expect(map.locator('.fd-sr-only[aria-live]').last()).toHaveText(/^The way measures \d+(\.\d)? km\.$/);
    const two = await tag.textContent();
    // Over a district and its orders: while measuring, the press is the map's, never the district's search.
    const c = await at(map, 0.5, 0.5);
    await page.mouse.dblclick(c.x, c.y);
    await expect(chips(page)).toHaveCount(0);
    await expect(tag).not.toHaveText(two!);
    await expect(map.locator('.fd-map-measure-hint')).toHaveCount(0);
    // Done: the map keeps it until Escape.
    await map.focus();
    await page.keyboard.press('Escape');
    await expect(tag).toHaveCount(0);
    await expect(tool(page, 'Measure a distance')).toHaveAttribute('aria-pressed', 'false');
    await expect(tool(page, 'Measure a distance')).toBeFocused();
  });

  test('measuring by the keys: Space puts a point at the cross, Backspace takes it back, Enter finishes', async ({ page }) => {
    // Its code comes with the map, before the tool is pressed: a key pressed straight after the press is never lost.
    const fetched = page.waitForResponse((r) => /\/chunks\/measure-[A-Z0-9]+\.js$/.test(r.url()), { timeout: 15_000 });
    await openMap(page, ZONES);
    await fetched;
    const map = theMap(page);
    await tool(page, 'Measure a distance').press('Enter');
    await map.focus();
    await page.keyboard.press('Space');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(400);
    await page.keyboard.press('Space');
    const tag = map.locator('.fd-map-measure-tag span');
    await expect(tag).toHaveText(/^\d+(\.\d)? (km|m)$/);
    await page.keyboard.press('Backspace');
    await expect(tag).toHaveCount(0);
    await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(400);
    await page.keyboard.press('Space');
    await expect(tag).toHaveCount(1);
    await page.keyboard.press('Enter');
    await expect(map.locator('.fd-map-measure-hint')).toHaveCount(0);
  });

  test('in Arabic, right to left: the tools at the map’s start, the legend’s ranges still read from their least', async ({ page }) => {
    await openMap(page, `${ZONES}&locale=ar&dir=rtl`);
    await expect(legend(page)).toBeVisible();
    const first = legend(page).locator('li').first();
    await expect(first).toHaveText(/^1–\d+$/);
    // Drawn left to right: its 1 to the left of its last number, as a range of Latin digits is read.
    const order = await first.evaluate((li) => {
      const walker = document.createTreeWalker(li, NodeFilter.SHOW_TEXT);
      const text = walker.nextNode() as Text;
      const at = (i: number) => {
        const range = document.createRange();
        range.setStart(text, i);
        range.setEnd(text, i + 1);
        return range.getBoundingClientRect().x;
      };
      return { one: at(0), last: at(text.length - 1) };
    });
    expect(order.one).toBeLessThan(order.last);
    const map = (await theMap(page).boundingBox())!;
    const zoom = (await tool(page, 'تكبير').boundingBox().catch(() => null)) ?? (await theMap(page).locator('.fd-map-zoom').boundingBox())!;
    expect(zoom.x).toBeLessThan(map.x + map.width / 2);
    // A district's words over the map: in the page's direction, its name in its own, only ever as text.
    const spot = await spotOf(page, region(page, 'Zamalek'));
    await page.mouse.move(spot.x, spot.y);
    const tip = page.locator('.leaflet-tooltip.fd-map-tip > span');
    await expect(tip).toHaveAttribute('dir', 'rtl');
    await expect(tip.locator('bdi')).toHaveText('Zamalek');
    await expect(tip).toHaveText(/^Zamalek: \d+$/);
  });

  test('axe finds nothing with a district lit and the way measured', async ({ page }) => {
    await openMap(page, ZONES);
    const spot = await spotOf(page, region(page, 'Dokki'));
    await page.mouse.move(spot.x, spot.y);
    await expect(page.locator('.leaflet-tooltip.fd-map-tip')).toBeVisible();
    expect(await axeFindings(page, 'map-zones, a district lit')).toEqual([]);
  });
});

/**
 * On a phone (390 pixels): the legend folded to its title at first, a button that opens it — open, 0.35's covered most
 * of the map and two of the tools under the zoom, and could not fold, a tap on Zamalek landing on its title — and the
 * bar that says how to measure in a finger's words.
 */
test.describe('orders by district, on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  /** The tool's own button is what a press at its middle reaches: nothing over it. */
  async function reachable(page: Page, name: string) {
    const box = (await tool(page, name).boundingBox())!;
    const hit = await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.closest('button')?.getAttribute('aria-label'), { x: box.x + box.width / 2, y: box.y + box.height / 2 });
    expect(hit, `${name}: what a press at its middle reaches`).toBe(name);
  }

  test('the legend folded to its title, clear of the tools; a district tapped searches it; the title opens the legend and folds it', async ({ page }) => {
    await openMap(page, ZONES);
    const title = legend(page).getByRole('button', { name: 'Orders this week, by district' });
    await expect(title).toHaveAttribute('aria-expanded', 'false');
    await expect(legend(page).locator('ol')).toBeHidden();
    // Folded, a strip at the map's foot: a small part of the map.
    const map = (await theMap(page).boundingBox())!;
    const folded = (await legend(page).boundingBox())!;
    expect(folded.height).toBeLessThan(40);
    expect((folded.width * folded.height) / (map.width * map.height)).toBeLessThan(0.1);
    for (const name of ['Full screen', 'Measure a distance']) await reachable(page, name);
    await screen(page, 'map-zones-phone-folded', { viewport: true });
    // Zamalek tapped: its orders alone.
    const spot = await spotOf(page, region(page, 'Zamalek'));
    await page.touchscreen.tap(spot.x, spot.y);
    await expect(chips(page)).toHaveText(['In Zamalek']);
    // The title opens the legend: its steps and its bubble, and the tools still the tools'.
    await title.tap();
    await expect(title).toHaveAttribute('aria-expanded', 'true');
    await expect(legend(page).locator('li').first()).toBeVisible();
    await expect(legend(page).locator('li.fd-map-legend-bubble')).toBeVisible();
    for (const name of ['Full screen', 'Measure a distance']) await reachable(page, name);
    await screen(page, 'map-zones-phone-open', { viewport: true });
    // And folds it again.
    await title.tap();
    await expect(title).toHaveAttribute('aria-expanded', 'false');
    await expect(legend(page).locator('ol')).toBeHidden();
  });

  test('measuring a way says what a finger does: taps, a double-tap to finish', async ({ page }) => {
    await openMap(page, ZONES);
    await tool(page, 'Measure a distance').tap();
    await expect(theMap(page).locator('.fd-map-measure-hint')).toHaveText('Tap points along the way; double-tap to finish.');
  });
});

test.describe('orders as a heat map', () => {
  test('from afar a heat map, no pins, and said; close in at the streets, each order’s pin', async ({ page }) => {
    await openMap(page, HEAT);
    const map = theMap(page);
    await expect(map.locator('canvas.fd-map-heat')).toBeVisible();
    await expect(map.locator('.fd-map-mark')).toHaveCount(0);
    await expect(map.locator('.fd-map-list-note')).toHaveText('A heat map from afar: zoom in to the streets to see each one.');
    // It glows: some of its pixels are coloured.
    const lit = () => map.locator('canvas.fd-map-heat').evaluate((canvas: HTMLCanvasElement) => {
      const data = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data;
      let n = 0;
      for (let i = 3; i < data.length; i += 4) if (data[i] > 0) n++;
      return n;
    });
    expect(await lit()).toBeGreaterThan(1000);
    for (let i = 0; i < 5; i++) {
      await tool(page, 'Zoom in').click();
      await page.waitForTimeout(350);
    }
    await expect(map.locator('.fd-map-mark').first()).toBeVisible();
    await expect(map.locator('canvas.fd-map-heat')).toBeHidden();
    await expect(map.locator('.fd-map-list-note')).toBeHidden();
  });

  test('in Arabic, an order’s total on its pin keeps its symbol whole: “E£”, never “£E”', async ({ page }) => {
    await openMap(page, `${HEAT}&locale=ar&dir=rtl`);
    for (let i = 0; i < 5; i++) {
      await tool(page, 'تكبير').click();
      await page.waitForTimeout(350);
    }
    const said = theMap(page).locator('.fd-map-mark .fd-map-face-text').first();
    await expect(said).toBeVisible();
    await expect(said).toHaveAttribute('dir', 'auto');
    // Drawn: its "E" to the left of its "£", as the symbol is written.
    const drawn = await said.evaluate((face) => {
      const text = face.firstChild as Text;
      const range = document.createRange();
      const x = (i: number) => (range.setStart(text, i), range.setEnd(text, i + 1), range.getBoundingClientRect().x);
      const at = text.data.indexOf('E£');
      return { at, e: x(at), pound: x(at + 1) };
    });
    expect(drawn.at).toBeGreaterThan(-1);
    expect(drawn.e).toBeLessThan(drawn.pound);
  });

  test('a provider with no satellite images: no Satellite button; Full screen and back', async ({ page }) => {
    await openMap(page, HEAT);
    // OpenStreetMap has no satellite images: the button is not there at all.
    await expect(tool(page, 'Satellite')).toBeHidden();
    await tool(page, 'Full screen').click();
    await expect(theMap(page)).toHaveAttribute('data-full', '');
    await expect(tool(page, 'Leave full screen')).toHaveAttribute('aria-pressed', 'true');
    const size = (await theMap(page).boundingBox())!;
    expect(size.width).toBeGreaterThanOrEqual(1270);
    await tool(page, 'Leave full screen').click();
    await expect(theMap(page)).not.toHaveAttribute('data-full', '');
    await expect(tool(page, 'Full screen')).toHaveAttribute('aria-pressed', 'false');
  });
});

test.describe('a kitchen’s map', () => {
  type Demo = { fieldiaDemo: { handle: { form: { setValues(values: Record<string, unknown>): void } } } };
  const send = (page: Page, lat: number, lng: number) =>
    page.evaluate(([la, ln]) => (window as unknown as Demo).fieldiaDemo.handle.form.setValues({ courier_lat: la, courier_lng: ln }), [lat, lng] as const);

  test('the districts shaded by their fee from 11, the one chosen drawn strong, the area within fifteen minutes', async ({ page }) => {
    await openMap(page, KITCHEN);
    await expect(regions(page)).toHaveCount(14);
    await expect(legend(page).locator('.fd-map-legend-title')).toHaveText('Delivery fee, EGP');
    // Fees of 15 to 40: steps from 11, none empty, no None.
    await expect(legend(page).locator('li')).toHaveText(['11–20', '21–30', '31–40']);
    await expect(region(page, 'Zamalek')).toHaveAttribute('data-chosen', '');
    await expect(page.locator('path.fd-map-reach')).toHaveCount(1);
    // The drop-off zone the fence watches, drawn faintly.
    await expect(page.locator('path.fd-map-fence')).toHaveCount(1);
  });

  test('a district pressed is chosen into the field; by the keys too', async ({ page }) => {
    await openMap(page, KITCHEN);
    const spot = await spotOf(page, region(page, 'Mohandessin'));
    await page.mouse.click(spot.x, spot.y);
    await expect.poll(() => valueOf(page, 'offer_district')).toBe('mohandessin');
    await expect(region(page, 'Mohandessin')).toHaveAttribute('data-chosen', '');
    await expect(region(page, 'Zamalek')).not.toHaveAttribute('data-chosen', '');
    const offer = page.getByRole('combobox', { name: "Tonight's offer goes to" });
    await expect(offer.locator('option:checked')).toHaveText('Mohandessin');
    // The keys: from the chosen one, the next, and Enter.
    await region(page, 'Mohandessin').focus();
    await page.keyboard.press('ArrowRight');
    const next = (await page.locator('path.fd-map-region:focus').getAttribute('aria-label'))!.split(':')[0];
    await page.keyboard.press('Enter');
    await expect(offer.locator('option:checked')).toHaveText(next);
  });

  test('a fence: the steps run as the courier goes into the drop-off zone, and again as they leave it; not at first sight', async ({ page }) => {
    await openMap(page, KITCHEN);
    // At the kitchen, outside the zone: first seen there, nothing ran, though "comes out of" holds.
    await page.waitForTimeout(300);
    expect(await valueOf(page, 'arriving')).toBe(false);
    await expect(page.getByText('The courier has left the drop-off zone.')).toHaveCount(0);
    await send(page, 30.0525, 31.2318);
    await page.waitForTimeout(300);
    expect(await valueOf(page, 'arriving')).toBe(false);
    // Into the zone: its steps run.
    await send(page, 30.0601, 31.2201);
    await expect.poll(() => valueOf(page, 'arriving')).toBe(true);
    await expect(page.getByText('The courier is in the drop-off zone: tell the customer they are almost there.')).toBeVisible();
    // Moving inside it runs nothing again; out of it, the leaving fence's.
    await send(page, 30.0612, 31.2215);
    await send(page, 30.0525, 31.2318);
    await expect.poll(() => valueOf(page, 'arriving')).toBe(false);
    await expect(page.getByText('The courier has left the drop-off zone.')).toBeVisible();
  });

  test('axe finds nothing on the kitchen’s map, a district focused', async ({ page }) => {
    await openMap(page, KITCHEN);
    await region(page, 'Zamalek').focus();
    expect(await axeFindings(page, 'map-kitchen, a district focused')).toEqual([]);
  });
});

test.describe('live traffic', () => {
  const traffic = (page: Page) => tool(page, 'Traffic');
  const overlay = (page: Page) => theMap(page).locator('.fd-map-traffic');
  const trafficAsked = (asked: string[], tileset: string) => asked.filter((url) => url.includes('/map/tile?') && url.includes(`tilesetId=${tileset}&`));

  test('Azure Maps’ traffic: the button lays it over the map, under the pins, credits it while shown, and takes it off again', async ({ page }) => {
    const asked = await stubAzure(page);
    const { problems } = await open(page, 'plain', `${KITCHEN}&maps=azure`);
    await mapReady(theMap(page));
    await expect(traffic(page)).toBeVisible();
    await expect(traffic(page)).toHaveAttribute('aria-pressed', 'false');
    await expect(overlay(page)).toHaveCount(0);
    await traffic(page).click();
    await expect(traffic(page)).toHaveAttribute('aria-pressed', 'true');
    await expect(overlay(page).locator('img.leaflet-tile-loaded').first()).toBeVisible();
    expect(trafficAsked(asked, 'microsoft.traffic.relative.main').length).toBeGreaterThan(0);
    // Over the map images, under the areas, routes and pins.
    const order = await theMap(page).evaluate((map) => {
      const z = (selector: string) => Number(getComputedStyle(map.querySelector(selector)!).zIndex);
      return { traffic: z('.fd-map-traffic'), images: z('.leaflet-tile-pane > .leaflet-layer:not(.fd-map-traffic)'), pane: z('.leaflet-tile-pane'), pins: z('.leaflet-marker-pane') };
    });
    expect(order.traffic).toBeGreaterThan(order.images);
    expect(order.pins).toBeGreaterThan(order.pane);
    // Its credits asked for while it is shown.
    await expect.poll(() => asked.some((url) => url.includes('/map/attribution') && url.includes('tilesetId=microsoft.traffic.relative.main&'))).toBe(true);
    await screen(page, 'map-traffic');
    expect(await axeFindings(page, 'map-kitchen, traffic on')).toEqual([]);
    await traffic(page).click();
    await expect(traffic(page)).toHaveAttribute('aria-pressed', 'false');
    await expect(overlay(page)).toHaveCount(0);
    expect(problems).toEqual([]);
  });

  test('on a dark page, the traffic in Azure’s dark colours; drawn again as it goes out of date, the old kept until the new has come', async ({ page }) => {
    await page.clock.install();
    const asked = await stubAzure(page);
    await open(page, 'plain', `${KITCHEN}&maps=azure&scheme=dark`);
    await mapReady(theMap(page));
    await traffic(page).click();
    await expect(overlay(page).locator('img.leaflet-tile-loaded').first()).toBeVisible();
    expect(trafficAsked(asked, 'microsoft.traffic.relative.dark').length).toBeGreaterThan(0);
    expect(trafficAsked(asked, 'microsoft.traffic.relative.main')).toEqual([]);
    await screen(page, 'map-traffic-dark');
    const times = () => new Set(trafficAsked(asked, 'microsoft.traffic.relative.dark').map((url) => new URL(url).searchParams.get('t'))).size;
    expect(times()).toBe(1);
    // Four minutes on: Azure's images have gone out of date, and are asked for again.
    await page.clock.fastForward(241_000);
    await expect.poll(times).toBe(2);
    await expect(overlay(page)).toHaveCount(1);
    await expect(overlay(page).locator('img.leaflet-tile-loaded').first()).toBeVisible();
  });

  test('OpenStreetMap has no traffic: no Traffic button at all', async ({ page }) => {
    await openMap(page, KITCHEN);
    await expect(tool(page, 'Full screen')).toBeVisible();
    await expect(traffic(page)).toHaveCount(0);
  });
});
