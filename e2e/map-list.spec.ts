import { expect, test, type Locator, type Page } from '@playwright/test';
import { axeFindings } from './a11y-support';
import { at, drag, mapReady, stubMaps, zoomOf } from './map-support';
import { expectNoSidewaysScroll, open, screen } from './support';

/**
 * A list's records on a map (@fieldia/map's `mapListViews`, `map` on a list):
 * the homes demo, its prices as pins beside the table, bubbles of pins that
 * crowd, a card for each, the same search and the same homes chosen as the
 * table; and the couriers demo, its pins drawn as icons by each record.
 * Every map image is a stand-in (map-support.ts).
 */

const HOMES = 'page=map-homes&skin=outlined';
const COURIERS = 'page=map-couriers&skin=outlined';

const theMap = (page: Page) => page.locator('.fd-map-list .fd-map-box');
/** The map's own marks: pins and bubbles, not a lit row's pin drawn over its bubble. */
const marks = (page: Page) => page.locator('.fd-map-list .fd-map-mark:not(.fd-map-ghost)');
const pins = (page: Page) => page.locator('.fd-map-list .fd-map-mark:not(.fd-map-ghost)[data-id]');
const bubbles = (page: Page) => page.locator('.fd-map-list .fd-map-bubble');
const card = (page: Page) => page.locator('.fd-map-list .fd-map-card');
const rows = (page: Page) => page.locator('.fd-list-row');
const range = (page: Page) => page.locator('.fd-pager-text');
const box = (page: Page) => page.locator('.fd-search').getByRole('combobox');
const chips = (page: Page) => page.locator('.fd-facet .fd-facet-text');
const view = (page: Page, name: string) => page.locator('.fd-list-views').getByRole('button', { name, exact: true });

async function openList(page: Page, variant = 'plain', query = HOMES) {
  await stubMaps(page);
  const opened = await open(page, variant, query);
  await mapReady(theMap(page));
  await expect(marks(page).first()).toBeAttached();
  return opened;
}

/** How many records the map shows: one a pin, a bubble its count. */
const onTheMap = (page: Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll('.fd-map-list .fd-map-mark:not(.fd-map-ghost)')].reduce((sum, mark) => {
      const bubble = mark.querySelector('.fd-map-bubble');
      return sum + (bubble ? Number(bubble.textContent) : 1);
    }, 0)
  );

/** Only Zamalek's six homes, by a search: close enough on the map to stand apart. */
async function zamalek(page: Page) {
  await box(page).pressSequentially('Zamalek');
  await box(page).press('Enter');
  await expect(rows(page)).toHaveCount(6);
  await expect.poll(() => onTheMap(page)).toBe(6);
}

/** A card, opened: once it has faded in and the map has moved to show it whole. */
async function cardShown(page: Page) {
  await expect(card(page)).toBeVisible();
  await expect(page.locator('.fd-map-list .leaflet-popup')).toHaveCSS('opacity', '1');
  await page.waitForTimeout(350);
}

/** A bubble the map shows, clicked: the map zooms in on its pins. */
async function openABubble(page: Page) {
  const map = (await theMap(page).boundingBox())!;
  const all = await bubbles(page).evaluateAll((list) => list.map((b) => b.getBoundingClientRect().toJSON() as DOMRect));
  const inView = all.findIndex((b) => b.x > map.x + 20 && b.x + b.width < map.x + map.width - 50 && b.y > map.y + 20 && b.y + b.height < map.y + map.height - 40);
  await bubbles(page).nth(Math.max(0, inView)).click();
  await page.waitForTimeout(500);
}

/** A record's row, by the record's id. */
const rowOf = (page: Page, id: string) => page.locator(`.fd-list-row[data-id="${id}"]`);

test('the homes beside their map: each placed home a price or in a bubble, the two without a place said, nothing sideways', async ({ page }) => {
  const { problems } = await openList(page);
  await expect(view(page, 'List and map')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.fd-list-table')).toBeVisible();
  await expect(theMap(page)).toBeVisible();
  // Sixty-four homes, two with no place yet.
  await expect.poll(() => onTheMap(page)).toBe(62);
  await expect(page.locator('.fd-map-list-note')).toHaveText('2 without a place, not on the map');
  // The table on the start side, the map on the end, their tops in line.
  const table = (await page.locator('.fd-list-records').boundingBox())!;
  const map = (await theMap(page).boundingBox())!;
  expect(map.x).toBeGreaterThan(table.x + table.width - 1);
  expect(Math.abs(map.y - table.y)).toBeLessThan(2);
  // The map names itself and how its keys work.
  await expect(theMap(page)).toHaveAttribute('aria-label', 'Homes in Cairo, map');
  await expect(theMap(page)).toHaveAccessibleDescription(/Tab goes through the pins/);
  await expectNoSidewaysScroll(page);
  await screen(page, 'map-list-homes');
  expect(problems).toEqual([]);
});

test('List, Map, or both: each shows what it says, its button pressed', async ({ page }) => {
  await openList(page);
  await view(page, 'List').click();
  await expect(view(page, 'List')).toHaveAttribute('aria-pressed', 'true');
  await expect(view(page, 'List and map')).toHaveAttribute('aria-pressed', 'false');
  await expect(theMap(page)).toBeHidden();
  await expect(page.locator('.fd-list-table')).toBeVisible();
  await view(page, 'Map').click();
  await expect(theMap(page)).toBeVisible();
  await expect(page.locator('.fd-list-table')).toBeHidden();
  await expect(page.locator('.fd-pager')).toBeHidden();
  // The map alone takes the list's whole width.
  const list = (await page.locator('.fd-list').boundingBox())!;
  expect((await theMap(page).boundingBox())!.width).toBeGreaterThan(list.width - 2);
  await screen(page, 'map-list-map-alone');
  await view(page, 'List and map').click();
  await expect(page.locator('.fd-list-table')).toBeVisible();
  await expect(theMap(page)).toBeVisible();
  // The map grew and shrank, and the person moved nothing: no "Search this area".
  await page.waitForTimeout(300);
  await expect(page.getByRole('button', { name: 'Search this area' })).toBeHidden();
});

test('a row lights its home on the map, a pin in a bubble drawn over it; a pin lights its row', async ({ page }) => {
  await openList(page);
  const first = rows(page).first();
  const id = (await first.getAttribute('data-id'))!;
  await first.hover();
  // On the whole of Cairo the home is in a bubble: the bubble lights, and the home's own price over it.
  const lit = page.locator('.fd-map-list .fd-map-ghost .fd-map-face[data-hot]');
  await expect(lit).toHaveCount(1);
  await expect(page.locator('.fd-map-list .fd-map-bubble[data-hot]')).toHaveCount(1);
  await expect(lit).toBeVisible();
  await screen(page, 'map-list-row-lit');
  await page.mouse.move(5, 5);
  await expect(lit).toHaveCount(0);
  await expect(page.locator('.fd-map-list [data-hot]')).toHaveCount(0);

  await zamalek(page);
  const pin = pins(page).first();
  const pinId = (await pin.getAttribute('data-id'))!;
  await pin.hover();
  await expect(rowOf(page, pinId)).toHaveClass(/fd-list-hot/);
  await expect(page.locator('.fd-list-hot')).toHaveCount(1);
  await page.mouse.move(5, 5);
  await expect(page.locator('.fd-list-hot')).toHaveCount(0);
  // And the other way, a pin of its own: its face lit.
  await rowOf(page, pinId).hover();
  await expect(pin.locator('.fd-map-face')).toHaveAttribute('data-hot', '');
  expect(id).not.toBe('');
});

test('Enter on a bubble zooms in on its pins, as a click does', async ({ page }) => {
  await openList(page);
  const before = await zoomOf(theMap(page));
  await theMap(page).focus();
  await page.keyboard.press('Tab');
  await expect(page.locator(':focus')).toHaveAttribute('aria-label', /^\d+ here\. Zoom in to see them\.$/);
  await page.keyboard.press('Enter');
  await expect.poll(() => zoomOf(theMap(page))).toBeGreaterThan(before);
  // The focus stays on the map, its keys at hand.
  await expect(theMap(page)).toBeFocused();
});

test('a bubble opens into its pins: the map zooms in on them', async ({ page }) => {
  await openList(page);
  const before = await zoomOf(theMap(page));
  const count = Number(await bubbles(page).first().textContent());
  await bubbles(page).first().click();
  await expect.poll(() => zoomOf(theMap(page))).toBeGreaterThan(before);
  // The map shows the same homes; only fewer of them crowd.
  await expect.poll(() => onTheMap(page)).toBe(62);
  expect(count).toBeGreaterThan(1);
  // The person moved the map: the search may follow it.
  await expect(page.getByRole('button', { name: 'Search this area' })).toBeVisible();
});

test('a pin opens its card: picture, title, fields, a Choose shared with its row, and Open to its page', async ({ page }) => {
  await openList(page);
  await zamalek(page);
  const pin = pins(page).first();
  const id = (await pin.getAttribute('data-id'))!;
  await pin.click();
  await cardShown(page);
  const name = (await rowOf(page, id).locator('td').nth(1).textContent())!.trim();
  await expect(card(page).locator('.fd-map-card-title')).toHaveText(name);
  await expect(card(page)).toHaveAttribute('aria-label', name);
  await expect(card(page).locator('img.fd-map-card-image')).toBeVisible();
  await expect(card(page).locator('dt')).toHaveText(['Price', 'Bedrooms', 'Area, m²', 'District']);
  await expect(card(page).locator('dd').first()).toHaveText(/^E£\s[\d,]+$/);
  await expect(card(page).locator('dd').last()).toHaveText('Zamalek');
  // The whole card inside the map: it moved the map to fit.
  const map = (await theMap(page).boundingBox())!;
  const drawn = (await card(page).boundingBox())!;
  expect(drawn.y).toBeGreaterThanOrEqual(map.y);
  expect(drawn.x).toBeGreaterThanOrEqual(map.x);
  expect(drawn.x + drawn.width).toBeLessThanOrEqual(map.x + map.width);
  await screen(page, 'map-list-card');

  // Chosen on the card is chosen in the table, with the list's buttons for it; and back.
  await card(page).getByLabel('Choose').check();
  await expect(rowOf(page, id).locator('.fd-list-checkbox')).toBeChecked();
  await expect(page.getByRole('button', { name: 'Add to shortlist' })).toBeVisible();
  await expect(pin.locator('.fd-map-face')).toHaveAttribute('data-chosen', '');
  await rowOf(page, id).locator('.fd-list-checkbox').uncheck();
  await expect(card(page).getByLabel('Choose')).not.toBeChecked();
  await expect(pin.locator('.fd-map-face')).not.toHaveAttribute('data-chosen', '');

  await card(page).getByRole('button', { name: 'Open' }).click();
  await expect(page).toHaveURL(new RegExp(`page=map-home&.*record=${id}|record=${id}.*page=map-home`));
  await expect(page.locator('.fd-title input')).toHaveValue(name);
});

test('Ctrl-click (⌘-click) chooses a home on the map, a tick on its pin; the close button closes a card', async ({ page }) => {
  await openList(page);
  await zamalek(page);
  const pin = pins(page).nth(1);
  const id = (await pin.getAttribute('data-id'))!;
  await pin.click({ modifiers: ['ControlOrMeta'] });
  await expect(rowOf(page, id).locator('.fd-list-checkbox')).toBeChecked();
  await expect(pin.locator('.fd-map-face')).toHaveAttribute('data-chosen', '');
  await expect(card(page)).toHaveCount(0);
  await pin.click();
  await expect(card(page).getByLabel('Choose')).toBeChecked();
  await card(page).getByRole('button', { name: 'Close' }).click();
  await expect(card(page)).toHaveCount(0);
});

test('by the keyboard: Tab reaches each pin by its name, Enter opens its card at Open, Escape goes back to the pin', async ({ page }) => {
  await openList(page);
  await zamalek(page);
  await theMap(page).focus();
  // Tab on to the first pin of its own (a bubble says how many it holds).
  const focused = page.locator(':focus');
  for (let i = 0; i < 6; i++) {
    await page.keyboard.press('Tab');
    await expect(focused).toHaveClass(/leaflet-marker-icon/);
    if (await focused.getAttribute('data-id')) break;
    await expect(focused).toHaveAttribute('aria-label', /^\d+ here\. Zoom in to see them\.$/);
  }
  await expect(focused).toHaveAttribute('role', 'button');
  await expect(focused).toHaveAttribute('aria-label', /in Zamalek, E£\s[\d,]+$/);
  const id = (await focused.getAttribute('data-id'))!;
  // The focused pin lights its row too.
  await expect(rowOf(page, id)).toHaveClass(/fd-list-hot/);
  await page.keyboard.press('Enter');
  await cardShown(page);
  await expect(card(page).getByRole('button', { name: 'Open' })).toBeFocused();
  // The arrows stay with the card: the map does not move under it.
  const zoom = await zoomOf(theMap(page));
  const centre = await page.evaluate(() => document.querySelector('.fd-map-list .leaflet-map-pane')!.getAttribute('style'));
  await page.keyboard.press('ArrowLeft');
  await page.waitForTimeout(400);
  expect(await page.evaluate(() => document.querySelector('.fd-map-list .leaflet-map-pane')!.getAttribute('style'))).toBe(centre);
  await page.keyboard.press('Escape');
  await expect(card(page)).toHaveCount(0);
  const back = page.locator(`.fd-map-list .leaflet-marker-icon[data-id="${id}"]`);
  await expect(back).toBeFocused();
  expect(await zoomOf(theMap(page))).toBe(zoom);
  // Space presses it too, as any button; and the page does not scroll.
  const scrolled = await page.evaluate(() => scrollY);
  await page.keyboard.press(' ');
  await cardShown(page);
  expect(await page.evaluate(() => scrollY)).toBe(scrolled);
  // Ctrl and Enter chooses it, as Ctrl and a click does.
  await page.keyboard.press('Escape');
  await expect(back).toBeFocused();
  await page.keyboard.press('ControlOrMeta+Enter');
  await expect(rowOf(page, id).locator('.fd-list-checkbox')).toBeChecked();
});

test('Search this area: once the map is moved, it puts the area into the search bar; the table keeps the homes there and the map stays put', async ({ page }) => {
  await openList(page);
  const here = page.getByRole('button', { name: 'Search this area' });
  await expect(here).toBeHidden();
  await expect(range(page)).toHaveText('1–12 / 64');
  // Closer, over the middle of the city.
  await theMap(page).getByRole('button', { name: 'Zoom in', exact: true }).click();
  await theMap(page).getByRole('button', { name: 'Zoom in', exact: true }).click();
  await expect(here).toBeVisible();
  const zoom = await zoomOf(theMap(page));
  await here.click();
  await expect(here).toBeHidden();
  await expect(chips(page)).toHaveText(['In this area']);
  await expect.poll(async () => Number((await range(page).textContent())!.split('/ ')[1])).toBeLessThan(64);
  const kept = Number((await range(page).textContent())!.split('/ ')[1]);
  // The map shows what the table keeps (a home with no place is in no area), and stays where it was put.
  await expect.poll(() => onTheMap(page)).toBe(kept);
  await expect(page.locator('.fd-map-list-note')).toBeHidden();
  expect(await zoomOf(theMap(page))).toBe(zoom);
  await screen(page, 'map-list-this-area');
  // A drag moves the map again: the button is back.
  const from = await at(theMap(page), 0.5, 0.5);
  await drag(page, from, { x: from.x - 120, y: from.y + 40 });
  await expect(here).toBeVisible();
  // The area taken out of the search: every home again, and the map fits them all.
  await box(page).focus();
  await box(page).press('Backspace');
  await expect(chips(page)).toHaveCount(0);
  await expect(range(page)).toHaveText('1–12 / 64');
  await expect.poll(() => zoomOf(theMap(page))).toBeLessThan(zoom);
  await expect(here).toBeHidden();
});

test('the search menu narrows the map too: For rent keeps the rentals, each in the tone the page gives them', async ({ page }) => {
  await openList(page);
  await page.getByRole('button', { name: 'Search options' }).click();
  await page.locator('.fd-search-panel').getByRole('button', { name: 'For rent' }).click();
  await expect(range(page)).toHaveText('1–12 / 20');
  await page.keyboard.press('Escape');
  await expect.poll(() => onTheMap(page)).toBe(20);
  await expect(page.locator('.fd-map-list-note')).toBeHidden();
  // Close enough to see each rental's own pin: blue, as `tones` says.
  for (let i = 0; i < 5 && !(await pins(page).count()); i++) await openABubble(page);
  const face = pins(page).first().locator('.fd-map-face');
  await expect(face).toHaveAttribute('data-tone', 'info');
  const colours = await face.evaluate((element) => {
    const style = getComputedStyle(element);
    const probe = document.createElement('span');
    probe.style.color = 'var(--fd-info)';
    element.append(probe);
    const info = getComputedStyle(probe).color;
    probe.remove();
    return { border: style.borderTopColor, info };
  });
  expect(colours.border).toBe(colours.info);
});

test('couriers drawn by their records: each one’s vehicle, a car turned the way it goes, a pointer for the others, a colour for each status', async ({ page }) => {
  const { problems } = await openList(page, 'plain', COURIERS);
  await expect(view(page, 'Map')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.fd-list-table')).toBeHidden();
  // Not gathered into bubbles: the page says so.
  await expect(bubbles(page)).toHaveCount(0);
  await expect(pins(page)).toHaveCount(18);
  const faces = page.locator('.fd-map-list .fd-map-face[data-look="icon"]');
  await expect(faces).toHaveCount(18);
  const drawn = await faces.evaluateAll((all) =>
    all.map((face) => ({
      icon: face.querySelector('svg')?.getAttribute('data-icon'),
      tone: face.getAttribute('data-tone'),
      turned: (face.querySelector('.fd-map-face-icon') as HTMLElement).style.transform,
      pointer: (face.querySelector('.fd-map-face-turn') as HTMLElement | null)?.style.transform ?? null,
      background: getComputedStyle(face).backgroundColor,
    }))
  );
  expect(new Set(drawn.map((d) => d.icon))).toEqual(new Set(['car', 'scooter', 'bike']));
  expect(new Set(drawn.map((d) => d.tone))).toEqual(new Set(['success', 'warning', 'muted']));
  for (const d of drawn) {
    if (d.icon === 'car') {
      expect(d.turned).toMatch(/^rotate\(\d+deg\)$/);
      expect(d.pointer).toBeNull();
    } else {
      expect(d.turned).toBe('');
      expect(d.pointer).toMatch(/^rotate\(\d+deg\)$/);
    }
  }
  // Free, delivering and on a break: three colours.
  const byTone = new Map(drawn.map((d) => [d.tone, d.background]));
  expect(new Set(byTone.values()).size).toBe(3);
  // Each named for a screen reader: their name, nothing else, as the pin says no words.
  await expect(pins(page).first()).toHaveAttribute('aria-label', /^[A-Z][a-z]+ [A-Z][a-z]+$/);
  await screen(page, 'map-list-couriers');
  // The card: their photo and their fields.
  await pins(page).first().click();
  await expect(card(page).locator('img.fd-map-card-image')).toBeVisible();
  await expect(card(page).locator('dt')).toHaveText(['Status', 'Vehicle', 'Orders today', 'Phone']);
  await view(page, 'List').click();
  await expect(rows(page)).toHaveCount(18);
  expect(problems).toEqual([]);
});

test('at a phone’s width: the map over the table, shorter, and nothing sideways', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openList(page);
  const map = (await theMap(page).boundingBox())!;
  const table = (await page.locator('.fd-list-records').boundingBox())!;
  expect(map.y + map.height).toBeLessThanOrEqual(table.y);
  expect(map.height).toBeLessThanOrEqual(420);
  await expectNoSidewaysScroll(page);
  await screen(page, 'map-list-phone');
});

test('in Arabic, right to left: the map’s words, a card written right to left, and axe finds nothing', async ({ page }) => {
  await openList(page, 'plain', `${HOMES}&locale=ar&dir=rtl`);
  await expect(view(page, 'قائمة وخريطة')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.fd-map-list-note')).toHaveText('2 بلا مكان، ليست على الخريطة');
  // The map at the start of a right-to-left page is on the left.
  const table = (await page.locator('.fd-list-records').boundingBox())!;
  expect((await theMap(page).boundingBox())!.x).toBeLessThan(table.x);
  await zamalek(page);
  await pins(page).first().click();
  await cardShown(page);
  await expect(card(page)).toHaveAttribute('dir', 'rtl');
  await expect(card(page).getByRole('button', { name: 'فتح' })).toBeVisible();
  await expect(card(page).getByLabel('اختيار')).toBeVisible();
  await expect(card(page).getByRole('button', { name: 'إغلاق' })).toBeVisible();
  await screen(page, 'map-list-arabic');
  expect(await axeFindings(page, 'list map, Arabic')).toEqual([]);
});

test('axe finds nothing on the homes, their map and an open card', async ({ page }) => {
  await openList(page);
  expect(await axeFindings(page, 'list map')).toEqual([]);
  await zamalek(page);
  await pins(page).first().click();
  await cardShown(page);
  expect(await axeFindings(page, 'list map, a card open')).toEqual([]);
});

const tools = (page: Page) => page.getByRole('group', { name: 'Draw an area to search in' });
const drawnArea = (page: Page) => page.locator('.fd-map-list path.fd-map-searched');
const total = async (page: Page) => Number((await range(page).textContent())!.split('/ ')[1]);

test('an area drawn on the map is a search of its own: the homes inside it, the area shown until its search goes', async ({ page }) => {
  const { problems } = await openList(page);
  await tools(page).getByRole('button', { name: 'Box' }).click();
  await expect(tools(page).getByRole('button', { name: 'Box' })).toHaveAttribute('aria-pressed', 'true');
  await expect(theMap(page)).toHaveAttribute('data-drawing', 'box');
  // The middle of the city, dragged across: the ground holds still while it is drawn.
  await drag(page, await at(theMap(page), 0.42, 0.42), await at(theMap(page), 0.62, 0.6));
  await expect(chips(page)).toHaveText(['In the area drawn']);
  await expect(theMap(page)).not.toHaveAttribute('data-drawing', /./);
  await expect.poll(() => total(page)).toBeLessThan(64);
  const kept = await total(page);
  expect(kept).toBeGreaterThan(0);
  // The map shows what the table keeps, the area drawn over them; the view stays.
  await expect.poll(() => onTheMap(page)).toBe(kept);
  await expect(drawnArea(page)).toHaveCount(1);
  await screen(page, 'map-list-area-drawn');
  // Its search taken out: every home again, and the area off the map.
  await box(page).focus();
  await box(page).press('Backspace');
  await expect(range(page)).toHaveText('1–12 / 64');
  await expect(drawnArea(page)).toHaveCount(0);
  expect(problems).toEqual([]);
});

test('a polygon drawn by the keys, the pins letting every press through while it is drawn', async ({ page }) => {
  await openList(page);
  const polygon = tools(page).getByRole('button', { name: 'Polygon' });
  await polygon.click();
  await expect(page.locator('.fd-map-list .fd-map-hint')).toContainText('Click to add points');
  // A press on a pin is a point of the polygon, not the pin's card.
  await bubbles(page).first().click({ force: true });
  await expect(card(page)).toHaveCount(0);
  await expect(page.locator('.fd-map-list .fd-map-hint')).toContainText('1 points');
  // By the keys: Space puts a point at the cross, the arrows move the map under it, Enter finishes.
  await theMap(page).focus();
  for (const key of ['ArrowLeft', 'ArrowDown']) {
    await page.keyboard.press(key);
    await page.keyboard.press(key);
    await page.waitForTimeout(300);
    await page.keyboard.press(' ');
  }
  await expect(page.locator('.fd-map-list .fd-map-hint')).toContainText('3 points');
  await page.keyboard.press('Enter');
  await expect(chips(page)).toHaveText(['In the area drawn']);
  await expect(drawnArea(page)).toHaveCount(1);
  // Escape puts a tool down, back on its button.
  await polygon.click();
  await theMap(page).focus();
  await page.keyboard.press('Escape');
  await expect(polygon).toHaveAttribute('aria-pressed', 'false');
  await expect(polygon).toBeFocused();
});

test('a circle drawn on the couriers’ map keeps those within it, their place one GeoJSON point', async ({ page }) => {
  await openList(page, 'plain', COURIERS);
  await tools(page).getByRole('button', { name: 'Circle' }).click();
  const centre = await at(theMap(page), 0.5, 0.45);
  await drag(page, centre, { x: centre.x + 160, y: centre.y });
  await expect(chips(page)).toHaveText(['In the area drawn']);
  await expect.poll(() => pins(page).count()).toBeLessThan(18);
  expect(await pins(page).count()).toBeGreaterThan(0);
  await expect(page.locator('.fd-map-list circle, .fd-map-list path.fd-map-searched')).not.toHaveCount(0);
});

for (const variant of ['react', 'vue', 'angular']) {
  test(`${variant}: the list’s map is there, a pin opens its card, and Choose ticks its row`, async ({ page }) => {
    const { problems } = await openList(page, variant);
    await expect.poll(() => onTheMap(page)).toBe(62);
    await zamalek(page);
    const pin: Locator = pins(page).first();
    const id = (await pin.getAttribute('data-id'))!;
    await pin.click();
    await card(page).getByLabel('Choose').check();
    await expect(rowOf(page, id).locator('.fd-list-checkbox')).toBeChecked();
    expect(problems).toEqual([]);
  });
}
