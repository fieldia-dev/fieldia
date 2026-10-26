import type { Page } from '@playwright/test';
import { expect } from '../../fixtures';
import type { DemoReplay, Hand } from '../hand';
import { theMap, pins, mapCard, listRows, listRange, facets, mapStill, zoomOf, whereOn, zoomBy, panMap, insideMap } from './support-more';

const bubbles = (page: Page) => page.locator('.fd-map-list .fd-map-bubble');
const listTotal = async (page: Page) => Number((await listRange(page).textContent())!.split('/ ')[1]);
const searchBox = (page: Page) => page.locator('.fd-search').getByRole('combobox');
/** How many homes the map shows: a pin one, a bubble its count. */
const onTheMap = (page: Page) =>
  page.evaluate(() => [...document.querySelectorAll('.fd-map-list .fd-map-mark:not(.fd-map-ghost)')].reduce((sum, mark) => sum + (mark.querySelector('.fd-map-bubble') ? Number(mark.querySelector('.fd-map-bubble')!.textContent) : 1), 0));
/** A pin inside the map: the map opens on bubbles alone, so a bubble is pressed, closer each time, until one shows. */
async function aPinInView(hand: Hand) {
  const { page, press } = hand;
  for (let i = 0; i < 6 && (await insideMap(page, pins(page))) < 0; i++) {
    const before = await zoomOf(theMap(page));
    await press(bubbles(page).nth(Math.max(0, await insideMap(page, bubbles(page)))));
    await expect.poll(() => zoomOf(theMap(page))).toBeGreaterThan(before);
    await mapStill(theMap(page));
  }
  const at = await insideMap(page, pins(page));
  expect(at, 'a pin inside the map').toBeGreaterThanOrEqual(0);
  return pins(page).nth(at);
}

/** The map-homes demo’s how-to steps, replayed by hand (e2e/how-to.spec.ts). */
export const replay: DemoReplay = {
  timeout: 120_000,
  steps: [
    {
      says: 'Point at a row: its pin lights up on the map',
      notOnPhone: 'pointing is a mouse’s: a phone has no pointer to rest on a row or a pin',
      async run(hand) {
        const { page, hover, see } = hand;
        await mapStill(theMap(page));
        // A row: its home lit on the map — inside a bubble at the city's zoom, its pin drawn over the bubble.
        await hover(listRows(page).first());
        const lit = page.locator('.fd-map-list .fd-map-face[data-hot]');
        await see(lit).toHaveCount(1);
        await see(lit).toBeVisible();
        await hover(page.locator('.dh-title'));
        await see(lit).toHaveCount(0);
        // A pin: the map opens on bubbles alone, so closer first, until a pin of its own shows; its row lights up.
        const pin = await aPinInView(hand);
        const id = (await pin.getAttribute('data-id'))!;
        await hover(pin);
        await see(page.locator(`.fd-list-row[data-id="${id}"]`)).toHaveClass(/fd-list-hot/);
        await see(page.locator('.fd-list-hot')).toHaveCount(1);
      },
    },
    {
      says: 'Click a pin: its card opens with the picture, the price in bold',
      async run(hand) {
        const { page, press, see } = hand;
        const pin = await aPinInView(hand);
        const id = (await pin.getAttribute('data-id'))!;
        await press(pin);
        const card = mapCard(page);
        await see(card).toBeVisible();
        await see(card.locator('img.fd-map-card-image')).toBeVisible();
        await see(card.locator('dd').first()).toHaveText(/^[\d,]+\s(EGP|USD)(\/month)?$/);
        expect(Number(await card.locator('dd').first().evaluate((dd) => getComputedStyle(dd).fontWeight))).toBeGreaterThanOrEqual(600);
        await see(card.locator('dd').last()).toHaveText(/^[\w ]+\s·\s\d\sbedrooms?\s·\s\d+\sm²$/);
        // Choose on the card: its row chosen too, and the list's Add to shortlist.
        await press(card.getByText('Choose'));
        await see(card.getByLabel('Choose')).toBeChecked();
        await see(page.locator(`.fd-list-row[data-id="${id}"] .fd-list-checkbox`)).toBeChecked();
        await see(page.locator('.fd-list-selection').getByRole('button', { name: 'Add to shortlist' })).toBeVisible();
      },
    },
    {
      says: 'The home’s name on its card is a link to its page',
      async run({ page, press, phone, see }) {
        const card = mapCard(page);
        const link = card.locator('.fd-map-card-title a');
        const name = (await link.textContent())!;
        await see(link).toHaveAttribute('href', /^\?page=map-home&skin=outlined&record=\d+$/);
        if (phone) return; // a new tab, or the link copied, is a long press's menu on a phone, which Playwright's WebKit does not open
        // Opened in a new tab, as Ctrl and a click opens a link: the home's own page there, this one as it was.
        const opened = page.context().waitForEvent('page');
        await press(link, { modifiers: ['Control'] });
        const tab = await opened;
        await tab.waitForLoadState();
        await see(tab.locator('.fd-title textarea')).toHaveValue(name);
        await see(card).toBeVisible();
        await tab.close();
      },
    },
    {
      says: 'Search Zamalek, and click the bubble where its homes crowd',
      async run(hand) {
        const { page, press, type, keys, see } = hand;
        const card = mapCard(page);
        if (await card.isVisible()) await press(card.getByRole('button', { name: 'Close' }));
        await type(searchBox(page), 'Zamalek');
        await keys('Enter');
        await see(listRows(page)).toHaveCount(6);
        await expect.poll(() => onTheMap(page)).toBe(6);
        await mapStill(theMap(page));
        // Its six homes fitted, some crowding in a bubble: clicked, the map zooms in until its pins part.
        const map = theMap(page);
        await see(bubbles(page)).toHaveCount(1);
        const before = await zoomOf(map);
        await press(bubbles(page).first());
        await expect.poll(() => zoomOf(map)).toBeGreaterThan(before);
        await mapStill(map);
        await see(pins(page)).toHaveCount(6);
        await see(bubbles(page)).toHaveCount(0);
        // The two prices, each on its own pin; the dollars' one a villa, as its row says.
        const priceOf = (words: RegExp) => page.locator('.fd-map-list .fd-map-mark[data-id] .fd-map-face-text').filter({ hasText: words });
        await see(priceOf(/^\$\s4\.6K\/month$/)).toBeVisible();
        await see(priceOf(/^10\.8M$/)).toBeVisible();
        const dollars = await page.locator('.fd-map-list .fd-map-mark[data-id]').filter({ has: page.locator('.fd-map-face-text', { hasText: /^\$\s4\.6K\/month$/ }) }).getAttribute('data-id');
        await see(page.locator(`.fd-list-row[data-id="${dollars}"]`)).toContainText('villa in Zamalek');
      },
    },
    {
      says: 'Take Zamalek out of the search, move the map over Maadi',
      notOnPhone: 'moving the list’s map is a drag — two fingers on a phone — and Playwright’s WebKit has no touch drag',
      async run(hand) {
        const { page, press, see } = hand;
        const map = theMap(page);
        // Zamalek out of the search: every home again, the map fitted to them.
        await press(page.getByRole('button', { name: 'Remove Home: Zamalek' }));
        await see(facets(page)).toHaveCount(0);
        await see(listRange(page)).toHaveText('1–12 / 64');
        // Out, until Maadi is in the map; dragged to its middle; then in, until the view is Maadi's streets.
        const maadi = { lat: 29.9602, lng: 31.2569 };
        const inMap = async () => {
          const box = (await map.boundingBox())!;
          const at = await whereOn(map, maadi.lat, maadi.lng);
          return at.x > box.x + 60 && at.x < box.x + box.width - 60 && at.y > box.y + 60 && at.y < box.y + box.height - 60;
        };
        await mapStill(map);
        for (let i = 0; i < 8 && !(await inMap()); i++) await zoomBy(hand, -1);
        const box = (await map.boundingBox())!;
        const from = await whereOn(map, maadi.lat, maadi.lng);
        await panMap(page, { x: box.x + box.width / 2 - from.x, y: box.y + box.height / 2 - from.y });
        const zoom = await zoomOf(map);
        if (zoom < 13) await zoomBy(hand, 13 - zoom);
        const here = page.getByRole('button', { name: 'Search this area' });
        await see(here).toBeVisible();
        await press(here);
        await see(facets(page)).toHaveText(['In this area']);
        // The homes there alone: some, each in Maadi.
        await expect.poll(() => listTotal(page)).toBeGreaterThan(0);
        const names = await listRows(page).locator('td:nth-child(2)').allTextContents();
        expect(names.length).toBeGreaterThan(0);
        for (const name of names) expect(name).toMatch(/ in Maadi$/);
        // Its chip taken away: every home again.
        await press(page.getByRole('button', { name: 'Remove In this area' }));
        await see(facets(page)).toHaveCount(0);
        await see(listRange(page)).toHaveText('1–12 / 64');
      },
    },
    {
      says: 'Press the box at the map’s corner and drag across the middle of the city',
      notOnPhone: 'drawing the box is a drag, and Playwright’s WebKit has no touch drag',
      async run(hand) {
        const { page, press, see } = hand;
        const map = theMap(page);
        // The middle of the city in sight: out, until Tahrir Square is well inside the map.
        const tahrir = { lat: 30.0444, lng: 31.2357 };
        const inMap = async () => {
          const box = (await map.boundingBox())!;
          const at = await whereOn(map, tahrir.lat, tahrir.lng);
          return at.x > box.x + box.width * 0.25 && at.x < box.x + box.width * 0.75 && at.y > box.y + box.height * 0.25 && at.y < box.y + box.height * 0.75;
        };
        await mapStill(map);
        for (let i = 0; i < 8 && !(await inMap()); i++) await zoomBy(hand, -1);
        const tools = page.getByRole('group', { name: 'Draw an area to search in' });
        await press(tools.getByRole('button', { name: 'Box' }));
        await see(tools.getByRole('button', { name: 'Box' })).toHaveAttribute('aria-pressed', 'true');
        // Across it, from a little above and left of the square to a little below and right.
        const box = (await map.boundingBox())!;
        const middle = await whereOn(map, tahrir.lat, tahrir.lng);
        const corner = { x: middle.x - box.width * 0.18, y: middle.y - box.height * 0.18 };
        await page.mouse.move(corner.x, corner.y);
        await page.mouse.down();
        await page.mouse.move(middle.x + box.width * 0.18, middle.y + box.height * 0.18, { steps: 16 });
        await page.mouse.up();
        // The area drawn in the area searched's place: the homes inside it, some of the city's.
        await see(facets(page)).toHaveText(['In the area drawn']);
        await see(page.locator('.fd-map-list path.fd-map-searched')).toHaveCount(1);
        await expect.poll(() => listTotal(page)).toBeGreaterThan(0);
        const kept = await listTotal(page);
        expect(kept).toBeLessThan(64);
        await expect.poll(() => onTheMap(page)).toBe(kept);
        // Its chip taken away: the area goes from the map too.
        await press(page.getByRole('button', { name: 'Remove In the area drawn' }));
        await see(facets(page)).not.toContainText(['In the area drawn']);
        await see(page.locator('.fd-map-list path.fd-map-searched')).toHaveCount(0);
      },
    },
    {
      says: 'Pick For rent from the search menu: the map keeps only the rentals',
      async run({ page, press, keys, see }) {
        await press(page.getByRole('button', { name: 'Search options' }));
        await press(page.locator('.fd-search-panel').getByRole('button', { name: 'For rent' }));
        await keys('Escape');
        await see(facets(page)).toContainText(['For rent']);
        const kept = await listTotal(page);
        await expect.poll(() => onTheMap(page)).toBe(kept);
        // Each row a rental (a card's words on the phone, a row's on a desktop).
        const offers = await listRows(page).allTextContents();
        expect(offers.length).toBe(Math.min(kept, 12));
        for (const row of offers) expect(row).toContain('For rent');
      },
    },
    {
      says: 'Press Map or List over the records to see one alone',
      async run({ page, press, see }) {
        const views = page.getByRole('group', { name: 'Show as' });
        await press(views.getByRole('button', { name: 'Map', exact: true }));
        await see(theMap(page)).toBeVisible();
        await see(page.locator('.fd-list-table')).toBeHidden();
        await press(views.getByRole('button', { name: 'List', exact: true }));
        await see(theMap(page)).toBeHidden();
        await see(page.locator('.fd-list-table')).toBeVisible();
        await see(views.getByRole('button', { name: 'List', exact: true })).toHaveAttribute('aria-pressed', 'true');
      },
    },
  ],
};
