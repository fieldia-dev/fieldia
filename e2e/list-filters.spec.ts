import { type Page } from '@playwright/test';
import { axeFindings } from './a11y-support';
import { expect, test } from './fixtures';
import { expectNoSidewaysScroll, open, screen } from './support';

/**
 * Filters a buyer and a sales team expect, as they use them: the homes to buy (homes-search) — how many homes each
 * value finds beside it among the rest of the search, a price's and an area's range and bedrooms 2+ each one filter, a
 * phone's sheet whose Show says how many homes it will show — and a sales team's queue (leads-queue), its filters
 * counted ("Late 5"), a favourite's too, and a custom filter of a budget between two as one chip. What each count
 * should be is worked out here from the demo's own records, never written down from the screen.
 */

type Home = { name: string; kind: string; district: string; price: number; bedrooms: number; area_m2: number; offer: string; currency: string; amenities: { id: number; label: string }[] };
type Lead = { name: string; stage: string; agent: string | null; budget: number; next_on: string | null; came_on: string };

const HOMES = 'page=homes-search&skin=underline';
/** The homes the page keeps to, as its app asks: for sale, in pounds. */
const homesToBuy = async (page: Page) => (Object.values(await page.evaluate(() => (window as any).fieldiaDemo.dataSource.records.home)) as Home[]).filter((home) => home.offer === 'sale' && home.currency === 'EGP');
const NOW = 'now=2026-10-14T09:40';
const TODAY = '2026-10-14';
const LEADS = `page=leads-queue&skin=underline&${NOW}`;
const leads = async (page: Page) => Object.values(await page.evaluate(() => (window as any).fieldiaDemo.dataSource.records.lead)) as Lead[];

const rows = (page: Page) => page.locator('.fd-list-row');
const pick = (page: Page, field: string) => page.locator(`.fd-filter-pick[data-field="${field}"]`);
const menuOf = (page: Page, field: string) => page.locator(`.fd-filter-field[data-field="${field}"] .fd-filter-menu`);
/** A value's row in a filter's list: its words and its count. */
const option = (page: Page, field: string, words: string) => menuOf(page, field).getByRole('menuitemcheckbox', { name: new RegExp(`^${words},`) });
const count = (n: number) => String(n);

test.describe('the homes to buy', () => {
  test('say beside each value how many homes it finds, among the rest of the search', async ({ page }) => {
    const { problems } = await open(page, 'plain', HOMES);
    const homes = await homesToBuy(page);
    await expect(rows(page)).toHaveCount(homes.length);
    await pick(page, 'kind').click();
    for (const [value, words] of [['flat', 'Flat'], ['duplex', 'Duplex'], ['penthouse', 'Penthouse'], ['villa', 'Villa']]) {
      await expect(option(page, 'kind', words).locator('.fd-filter-count')).toHaveText(count(homes.filter((home) => home.kind === value).length));
    }
    // A screen reader hears the count in words, in the page's own word for its homes.
    await expect(option(page, 'kind', 'Villa')).toHaveAccessibleName(`Villa, ${homes.filter((home) => home.kind === 'villa').length} homes`);
    await screen(page, 'list-filters-counts', { viewport: true });
    expect(await axeFindings(page, 'a filter bar’s counted values open')).toEqual([]);
    // Villas ticked: the amenities count among the villas now.
    await option(page, 'kind', 'Villa').click();
    const villas = homes.filter((home) => home.kind === 'villa');
    await expect(rows(page)).toHaveCount(villas.length);
    await pick(page, 'amenities').click();
    for (const amenity of ['Garden', 'Pool', 'Parking', 'Nile view', 'Security']) {
      await expect(option(page, 'amenities', amenity).locator('.fd-filter-count')).toHaveText(count(villas.filter((home) => home.amenities.some((a) => a.label === amenity)).length));
    }
    // Its own ticks never change a field's counts.
    await pick(page, 'kind').click();
    await expect(option(page, 'kind', 'Flat').locator('.fd-filter-count')).toHaveText(count(homes.filter((home) => home.kind === 'flat').length));
    await expect(pick(page, 'kind')).toHaveText('Type: Villa');
    expect(problems).toEqual([]);
  });

  test('say beside the search how many homes the filters leave, in the list and its gallery, on a desktop', async ({ page }) => {
    // The owner's walk of 0.27: on a desktop the homes to buy never said how many homes its filters left.
    await page.setViewportSize({ width: 1440, height: 900 });
    const { problems } = await open(page, 'plain', HOMES);
    const homes = await homesToBuy(page);
    const found = page.locator('.fd-list-bar .fd-list-found');
    await expect(found).toHaveText(`${homes.length} homes`);
    await expect(found).toBeVisible();
    await page.locator('.fd-list-views').getByRole('button', { name: 'Gallery' }).click();
    await expect(found).toHaveText(`${homes.length} homes`);
    await pick(page, 'kind').click();
    await option(page, 'kind', 'Villa').click();
    const villas = homes.filter((home) => home.kind === 'villa').length;
    await expect(found).toHaveText(`${villas} ${villas === 1 ? 'home' : 'homes'}`);
    await page.keyboard.press('Escape');
    await screen(page, 'list-filters-count-gallery', { viewport: true });
    // A price nothing is listed at: the list says no homes match, and the count says nothing more.
    await pick(page, 'price').click();
    const from = page.getByRole('textbox', { name: 'Price: From' });
    await expect(from).toBeFocused();
    await from.fill('900,000,000');
    await from.press('Enter');
    await expect(page.getByText('No homes match.')).toBeVisible();
    await expect(found).toBeHidden();
    expect(problems).toEqual([]);
  });

  test('take bedrooms 2+ and a price from and to, each as one filter, and say what cannot be one', async ({ page }) => {
    const { problems } = await open(page, 'plain', HOMES);
    const homes = await homesToBuy(page);
    await pick(page, 'bedrooms').click();
    const presses = menuOf(page, 'bedrooms').locator('.fd-filter-range-press');
    await expect(presses).toHaveText(['Any', '1+', '2+', '3+', '4+', '5+']);
    await presses.filter({ hasText: '2+' }).click();
    await expect(presses.filter({ hasText: '2+' })).toHaveAttribute('aria-pressed', 'true');
    await expect(pick(page, 'bedrooms')).toHaveText('Bedrooms: 2+');
    const twoPlus = homes.filter((home) => home.bedrooms >= 2);
    await expect(rows(page)).toHaveCount(twoPlus.length);
    await screen(page, 'list-filters-bedrooms', { viewport: true });
    expect(await axeFindings(page, 'a range’s presses and boxes open', '.fd-filter-field[data-field="bedrooms"]')).toEqual([]);
    // A price from and to, typed as a buyer types them and taken at Enter.
    await pick(page, 'price').click();
    const from = page.getByRole('textbox', { name: 'Price: From' });
    await expect(from).toBeFocused();
    await from.fill('5,000,000');
    await page.getByRole('textbox', { name: 'Price: To' }).fill('15000000');
    await page.getByRole('textbox', { name: 'Price: To' }).press('Enter');
    const found = twoPlus.filter((home) => home.price >= 5_000_000 && home.price <= 15_000_000);
    await expect(rows(page)).toHaveCount(found.length);
    await expect(pick(page, 'price')).toHaveText(/^Price: E£\s5M – E£\s15M$/);
    await screen(page, 'list-filters-range', { viewport: true });
    await page.keyboard.press('Escape');
    await expect(pick(page, 'price')).toBeFocused();
    // From read as it is left; then a To under it: said, kept as typed, and the area kept to From alone.
    await pick(page, 'area_m2').click();
    await page.getByRole('textbox', { name: 'Area: From' }).fill('300');
    await page.getByRole('textbox', { name: 'Area: To' }).fill('100');
    await page.getByRole('textbox', { name: 'Area: To' }).press('Enter');
    await expect(menuOf(page, 'area_m2').locator('.fd-refusal-hint:not([hidden])')).toHaveText('From is more than To');
    await expect(page.getByRole('textbox', { name: 'Area: To' })).toHaveValue('100');
    await expect(pick(page, 'area_m2')).toHaveText('Area: 300+');
    await expect(rows(page)).toHaveCount(found.filter((home) => home.area_m2 >= 300).length);
    await screen(page, 'list-filters-range-refused', { viewport: true });
    // × at the bar's end clears every filter, the boxes with them.
    await page.getByRole('button', { name: 'Clear filters' }).click();
    await expect(rows(page)).toHaveCount(homes.length);
    await expect(pick(page, 'price')).toHaveText('Price');
    expect(problems).toEqual([]);
  });

  test('on a phone, put every filter in a sheet whose Show says how many homes it will show', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const { problems } = await open(page, 'plain', HOMES);
    const homes = await homesToBuy(page);
    const filters = page.locator('.fd-filter-sheet-open');
    await expect(filters).toBeVisible();
    await expect(pick(page, 'kind')).toBeHidden();
    await expectNoSidewaysScroll(page);
    await screen(page, 'list-filters-phone-bar', { viewport: true });
    await filters.click();
    const sheet = page.getByRole('dialog', { name: 'Filters' });
    await expect(sheet).toBeVisible();
    const show = sheet.locator('.fd-filter-sheet-show');
    await expect(show).toHaveText(`Show ${homes.length} homes`);
    const typeField = sheet.locator('.fd-filter-sheet-field[data-field="kind"]');
    await expect(typeField.getByRole('checkbox', { name: /^Villa,/ })).toBeVisible();
    await typeField.getByRole('checkbox', { name: /^Villa,/ }).check();
    const villas = homes.filter((home) => home.kind === 'villa');
    await expect(show).toHaveText(`Show ${villas.length} homes`);
    // The other fields count among the villas; the list stays as it was until Show.
    await expect(sheet.locator('.fd-filter-sheet-field[data-field="amenities"] label').filter({ hasText: 'Pool' }).locator('.fd-filter-count')).toHaveText(count(villas.filter((home) => home.amenities.some((a) => a.label === 'Pool')).length));
    await expect(rows(page)).toHaveCount(homes.length);
    await screen(page, 'list-filters-sheet', { viewport: true });
    expect(await axeFindings(page, 'a phone’s sheet of filters open')).toEqual([]);
    await show.click();
    await expect(sheet).toBeHidden();
    await expect(rows(page)).toHaveCount(villas.length);
    await expect(filters).toBeFocused();
    await expect(filters).toHaveAccessibleName('Filters, 1 on');
    await screen(page, 'list-filters-phone-shown', { viewport: true });
    // × lets what was changed go.
    await filters.click();
    await expect(sheet.locator('.fd-filter-sheet-field[data-field="bedrooms"] .fd-filter-range-press').first()).toBeVisible();
    await sheet.locator('.fd-filter-sheet-field[data-field="bedrooms"] .fd-filter-range-press', { hasText: '5+' }).click();
    await expect(show).toHaveText(`Show ${villas.filter((home) => home.bedrooms >= 5).length} homes`);
    await sheet.getByRole('button', { name: 'Close' }).click();
    await expect(sheet).toBeHidden();
    await expect(rows(page)).toHaveCount(villas.length);
    await expectNoSidewaysScroll(page);
    expect(problems).toEqual([]);
  });
});

test.describe('a sales team’s queue', () => {
  const openMenu = async (page: Page) => {
    const panel = page.locator('.fd-search-panel');
    if (await panel.isHidden()) await page.getByRole('button', { name: 'Search options' }).click();
  };
  const filter = (page: Page, words: string) => page.locator('.fd-search-option[data-filter]').filter({ hasText: new RegExp(`^${words}`) });

  test('says how many each filter finds — Late 5 — with the rest of the search, and a favourite’s too', async ({ page }) => {
    const { problems } = await open(page, 'plain', LEADS);
    const all = await leads(page);
    const late = (of: Lead[]) => of.filter((lead) => lead.next_on !== null && lead.next_on < TODAY && lead.stage !== 'won');
    const today = (of: Lead[]) => of.filter((lead) => lead.next_on === TODAY);
    await openMenu(page);
    await expect(filter(page, 'Late').locator('.fd-filter-count')).toHaveText(count(late(all).length));
    expect(late(all)).toHaveLength(5);
    await expect(filter(page, 'Today').locator('.fd-filter-count')).toHaveText(count(today(all).length));
    await expect(filter(page, 'No agent yet').locator('.fd-filter-count')).toHaveText(count(all.filter((lead) => !lead.agent).length));
    await expect(filter(page, 'Late')).toHaveAccessibleName('Late, 5 leads');
    await screen(page, 'list-filters-queue', { viewport: true });
    expect(await axeFindings(page, 'a queue’s counted filters open')).toEqual([]);
    await filter(page, 'Late').click();
    await expect(rows(page)).toHaveCount(5);
    // A search typed counts every filter among Mona's leads alone: the menu closed, the suggestions in sight.
    await page.getByRole('button', { name: 'Search options' }).click();
    const box = page.getByRole('combobox', { name: 'Search' });
    await box.fill('Mona');
    await page.getByRole('option', { name: 'Search Agent for: Mona' }).click();
    const mona = all.filter((lead) => lead.agent === 'Mona Adel');
    await openMenu(page);
    await expect(filter(page, 'Late').locator('.fd-filter-count')).toHaveText(count(late(mona).length));
    await expect(filter(page, 'Today').locator('.fd-filter-count')).toHaveText(count(today(mona).length));
    // Kept as a favourite, it says how many it finds.
    await page.getByRole('button', { name: 'Save current search' }).click();
    await page.getByRole('textbox', { name: 'Name of the search' }).fill('Mona’s late ones');
    await page.locator('.fd-favourite-form .fd-button-primary').click();
    await expect(page.locator('.fd-favourite .fd-search-option', { hasText: 'Mona’s late ones' }).locator('.fd-filter-count')).toHaveText(count(late(mona).length));
    expect(problems).toEqual([]);
  });

  test('takes a custom filter of a budget between two as one chip', async ({ page }) => {
    const { problems } = await open(page, 'plain', LEADS);
    const all = await leads(page);
    await openMenu(page);
    await page.getByRole('button', { name: 'Add a custom filter' }).click();
    const form = page.locator('.fd-custom-filter');
    await form.getByRole('combobox', { name: 'Field' }).selectOption({ label: 'Budget' });
    await form.getByRole('combobox', { name: 'Condition' }).selectOption({ label: 'is between' });
    await form.getByRole('textbox', { name: 'Budget: From' }).fill('5,000,000');
    await form.getByRole('textbox', { name: 'Budget: To' }).fill('15,000,000');
    await form.getByRole('button', { name: 'Apply' }).click();
    await expect(page.locator('.fd-facet .fd-facet-text')).toHaveText([/^Budget: E£\s5,000,000 – E£\s15,000,000$/]);
    await expect(rows(page)).toHaveCount(all.filter((lead) => lead.budget >= 5_000_000 && lead.budget <= 15_000_000).length);
    await screen(page, 'list-filters-between', { viewport: true });
    expect(problems).toEqual([]);
  });
});
