import type { Page } from '@playwright/test';
import { expect } from '../../fixtures';
import type { DemoReplay } from '../hand';
import { homes } from './support';

type Home = { kind: string; district: string; price: number; bedrooms: number; area_m2: number; offer: string; currency: string; amenities: { label: string }[] };
/** The homes the search keeps to, as its app asks: for sale, in pounds — what each count is worked out from. */
const homesToBuy = async (demo: <T>(path: string) => Promise<T>) => Object.values(await demo<Record<string, Home>>('dataSource.records.home')).filter((home) => home.offer === 'sale' && home.currency === 'EGP');
/** A filter's button on the bar (a desktop's), by its field. */
const filterPick = (page: Page, field: string) => page.getByRole('search').locator(`.fd-filter-pick[data-field="${field}"]`);
/** A filter's own menu, dropped open under its button. */
const filterMenu = (page: Page, field: string) => page.locator(`.fd-filter-field[data-field="${field}"] .fd-filter-menu`);
/** A phone's sheet of every filter. */
const filterSheet = (page: Page) => page.getByRole('dialog', { name: 'Filters' });
const TYPES = [['flat', 'Flat'], ['duplex', 'Duplex'], ['penthouse', 'Penthouse'], ['villa', 'Villa']];
const AMENITIES = ['Garden', 'Pool', 'Parking', 'Nile view', 'Security'];

export const replay: DemoReplay = {
  steps: [
    {
      says: 'Open Type: each type says how many homes it finds',
      async run({ page, phone, press, see, demo }) {
        const all = await homesToBuy(demo);
        const villas = all.filter((home) => home.kind === 'villa');
        // A desktop's Type drops its menu open from the bar; a phone's Filters opens every filter in its sheet.
        if (phone) await press(page.getByRole('button', { name: 'Filters' }));
        else await press(filterPick(page, 'kind'));
        const typeOf = phone ? filterSheet(page).getByRole('group', { name: 'Type' }) : filterMenu(page, 'kind');
        const box = phone ? 'checkbox' : 'menuitemcheckbox';
        for (const [value, words] of TYPES) await see(typeOf.getByRole(box, { name: new RegExp(`^${words},`) })).toHaveAccessibleName(`${words}, ${homes(all.filter((home) => home.kind === value).length)}`);
        await press(typeOf.getByRole(box, { name: /^Villa,/ }));
        await see(typeOf.getByRole(box, { name: /^Villa,/ })).toBeChecked();
        if (!phone) {
          await see(filterPick(page, 'kind')).toHaveText('Type: Villa');
          await see(page.locator('.fd-list-row')).toHaveCount(villas.length);
          await press(filterPick(page, 'amenities'));
        }
        const amenitiesOf = phone ? filterSheet(page).getByRole('group', { name: 'Amenities' }) : filterMenu(page, 'amenities');
        for (const amenity of AMENITIES) await see(amenitiesOf.getByRole(box, { name: new RegExp(`^${amenity},`) })).toHaveAccessibleName(`${amenity}, ${homes(villas.filter((home) => home.amenities.some((a) => a.label === amenity)).length)}`);
      },
    },
    {
      says: 'Open Bedrooms and press 2+: the button says “Bedrooms: 2+”',
      async run({ page, phone, press, see, demo }) {
        const left = (await homesToBuy(demo)).filter((home) => home.kind === 'villa' && home.bedrooms >= 2);
        const bedrooms = phone ? filterSheet(page).getByRole('group', { name: 'Bedrooms' }) : filterMenu(page, 'bedrooms');
        if (!phone) await press(filterPick(page, 'bedrooms'));
        await press(bedrooms.getByRole('button', { name: '2+', exact: true }));
        await see(bedrooms.getByRole('button', { name: '2+', exact: true })).toHaveAttribute('aria-pressed', 'true');
        if (phone) {
          // The sheet says what Show will show; Show shows it, the Filters button counting what is on.
          const show = filterSheet(page).locator('.fd-filter-sheet-show');
          await see(show).toHaveText(`Show ${homes(left.length)}`);
          await press(show);
          await see(filterSheet(page)).toBeHidden();
          await see(page.getByRole('button', { name: 'Filters, 2 on' })).toBeVisible();
        } else await see(filterPick(page, 'bedrooms')).toHaveText('Bedrooms: 2+');
        const rows = page.locator('.fd-list-row');
        await see(rows).toHaveCount(left.length);
        const counts = (await rows.locator('[data-part="bedrooms"] dd').allTextContents()).map((words) => parseInt(words, 10));
        expect(counts).toHaveLength(left.length);
        for (const count of counts) expect(count).toBeGreaterThanOrEqual(2);
      },
    },
    {
      says: 'Open Price and type 5,000,000 in From and 15,000,000 in To, then press Enter',
      async run({ page, phone, press, keys, see }) {
        if (phone) await press(page.getByRole('button', { name: 'Filters, 2 on' }));
        else await press(filterPick(page, 'price'));
        const scope = phone ? filterSheet(page) : page;
        const from = scope.getByRole('textbox', { name: 'Price: From' });
        if (phone) await press(from);
        await see(from).toBeFocused();
        await page.keyboard.type('5,000,000', { delay: 15 });
        await press(scope.getByRole('textbox', { name: 'Price: To' }));
        await page.keyboard.type('15,000,000', { delay: 15 });
        await keys('Enter');
        if (phone) {
          // Shown, the price is one filter more: three on, never four.
          await press(filterSheet(page).locator('.fd-filter-sheet-show'));
          await see(page.getByRole('button', { name: 'Filters, 3 on' })).toBeVisible();
        } else {
          await see(filterPick(page, 'price')).toHaveText(/^Price: E£\s5M – E£\s15M$/);
          await see(page.getByRole('search').getByRole('button', { name: /^Price/ })).toHaveCount(1);
        }
        // No villa is priced between the two: said as a search that finds none is.
        await see(page.getByText('No homes match.')).toBeVisible();
      },
    },
    {
      says: 'Type 300 in Area’s From and 100 in its To: it says “From is more than To”',
      async run({ page, phone, press, keys, see }) {
        if (phone) await press(page.getByRole('button', { name: 'Filters, 3 on' }));
        else await press(filterPick(page, 'area_m2'));
        const scope = phone ? filterSheet(page) : page;
        const from = scope.getByRole('textbox', { name: 'Area: From' });
        const to = scope.getByRole('textbox', { name: 'Area: To' });
        if (phone) await press(from);
        await see(from).toBeFocused();
        await page.keyboard.type('300', { delay: 15 });
        await press(to);
        await page.keyboard.type('100', { delay: 15 });
        await keys('Enter');
        const field = phone ? page.locator('.fd-filter-sheet-field[data-field="area_m2"]') : page.locator('.fd-filter-field[data-field="area_m2"]');
        await see(field.locator('.fd-refusal-hint:not([hidden])')).toHaveText('From is more than To');
        await see(from).toHaveValue('300');
        await see(to).toHaveValue('100');
        if (phone) {
          // Nothing filtered by it: Show refuses while it is so, the sheet open and its words said; × lets it go.
          await press(filterSheet(page).locator('.fd-filter-sheet-show'));
          await see(filterSheet(page)).toBeVisible();
          await see(field.locator('.fd-refusal-hint:not([hidden])')).toHaveText('From is more than To');
          await press(filterSheet(page).getByRole('button', { name: 'Close' }));
          await see(page.getByRole('button', { name: 'Filters, 3 on' })).toBeVisible();
        } else {
          // The To refused is no filter: the area kept to From alone, never 300 to 100.
          await see(filterPick(page, 'area_m2')).toHaveText('Area: 300+');
          await keys('Escape');
        }
      },
    },
    {
      says: 'Press × at the bar’s end: every filter is cleared',
      async run({ page, phone, press, see, demo }) {
        const all = await homesToBuy(demo);
        await press(page.getByRole('search').getByRole('button', { name: 'Clear filters' }));
        await see(page.locator('.fd-list-row')).toHaveCount(all.length);
        await see(page.locator('.fd-list-found')).toHaveText(homes(all.length));
        if (phone) await see(page.locator('.fd-filter-sheet-open')).toHaveAccessibleName('Filters');
        else for (const [field, words] of [['kind', 'Type'], ['price', 'Price'], ['bedrooms', 'Bedrooms'], ['area_m2', 'Area']]) await see(filterPick(page, field)).toHaveText(words);
        await see(page.getByRole('search').getByRole('button', { name: 'Clear filters' })).toBeHidden();
      },
    },
    {
      says: 'Narrow the window, or open the page on a phone: one Filters button opens every filter in a sheet',
      async run({ page, phone, press, see }) {
        if (!phone) await page.setViewportSize({ width: 390, height: 844 });
        const button = page.locator('.fd-filter-sheet-open');
        await see(button).toBeVisible();
        await see(filterPick(page, 'kind')).toBeHidden();
        const rows = page.locator('.fd-list-row');
        const before = await rows.count();
        await press(button);
        const sheet = filterSheet(page);
        await see(sheet).toBeVisible();
        await see(sheet.locator('.fd-filter-sheet-field legend')).toHaveText(['Type', 'District', 'Price', 'Bedrooms', 'Area', 'Amenities', 'Listed on']);
        const villa = sheet.getByRole('group', { name: 'Type' }).getByRole('checkbox', { name: /^Villa,/ });
        await see(villa).not.toBeChecked();
        const show = sheet.locator('.fd-filter-sheet-show');
        await see(show).toHaveText(`Show ${homes(before)}`);
        await press(villa);
        await see(show).toHaveText('Show 5 homes');
        // Only Show filters the list: it is as it was until then.
        await see(rows).toHaveCount(before);
        // × lets what was ticked go: the list as it was, and the sheet, opened again, too.
        await press(sheet.getByRole('button', { name: 'Close' }));
        await see(sheet).toBeHidden();
        await see(rows).toHaveCount(before);
        await press(button);
        await see(villa).not.toBeChecked();
        await see(show).toHaveText(`Show ${homes(before)}`);
        await press(sheet.getByRole('button', { name: 'Close' }));
        await see(sheet).toBeHidden();
        // Widened again, as a desktop's window is: the bar's filters back.
        if (!phone) {
          await page.setViewportSize({ width: 1280, height: 720 });
          await see(filterPick(page, 'kind')).toBeVisible();
        }
      },
    },
    {
      says: 'Type “villas in Heliopolis under 25M” in the keyword box and press ✦ Read as filters',
      async run({ page, phone, press, type, see }) {
        const keyword = page.getByRole('searchbox', { name: 'Filter by keyword' });
        await type(keyword, 'villas in Heliopolis under 25M');
        await press(page.getByRole('button', { name: 'Turn these words into filters' }));
        const read = page.locator('.fd-assist-read');
        await see(read).toContainText('Read as filters: Type: Villa · District: Heliopolis · Price: up to E£');
        await see(read).toContainText('25M');
        await see(read).toContainText('Stand-in AI, no model');
        await see(page.locator('.fd-list-found')).toHaveText('2 homes');
        await see(page.locator('.fd-list-row')).toHaveCount(2);
        const picked = page.locator('.fd-filter-field button[data-picked]');
        if (phone) {
          // Each a filter to change, in the sheet the Filters button opens.
          const button = page.locator('.fd-filter-sheet-open');
          await see(button).toHaveAccessibleName('Filters, 3 on');
          await press(button);
          const sheet = filterSheet(page);
          await see(sheet.getByRole('group', { name: 'Type' }).getByRole('checkbox', { name: /^Villa,/ })).toBeChecked();
          await see(sheet.getByRole('group', { name: 'District' }).getByRole('checkbox', { name: /^Heliopolis,/ })).toBeChecked();
          await see(sheet.getByRole('textbox', { name: 'Price: To' })).toHaveValue('25,000,000');
          await press(sheet.getByRole('button', { name: 'Close' }));
          await see(sheet).toBeHidden();
        } else await see(picked).toHaveText([/^Type: ?Villa$/, /^District: ?Heliopolis$/, /^Price: up to E£\s?25M$/]);
        await see(keyword).toHaveValue('');
        await press(read.getByRole('button', { name: 'Undo' }));
        await see(keyword).toHaveValue('villas in Heliopolis under 25M');
        await see(picked).toHaveCount(0);
      },
    },
  ],
};
