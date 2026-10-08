import { expect, test, type Page } from '@playwright/test';
import { expectNoSidewaysScroll, open, screen } from './support';
import { VARIANTS } from './variants';

/** The customers as a list, in every framework: twelve of them, eight to a page. */
const list = (page: Page) => page.locator('.fd-list');
const names = (page: Page) => page.locator('.fd-list-row td:nth-child(2)');
const range = (page: Page) => page.locator('.fd-pager-text');
const box = (page: Page) => page.getByRole('combobox', { name: 'Search' });
const menu = (page: Page) => page.locator('.fd-search-panel');
const chips = (page: Page) => page.locator('.fd-facet .fd-facet-text');
const group = (page: Page, name: string) => page.locator('.fd-group-toggle', { has: page.locator('.fd-group-label', { hasText: new RegExp(`^${name}$`) }) });

for (const variant of VARIANTS) {
  test.describe(`${variant} · lists`, () => {
    test('shows a page of records, lined up, with the pager and nothing sideways', async ({ page }) => {
      const { problems } = await open(page, variant, 'page=customers');
      await expect(names(page)).toHaveCount(8);
      await expect(names(page).first()).toHaveText('Amira Clinics');
      await expect(range(page)).toHaveText('1–8 / 12');
      await expect(page.locator('.fd-list-table th[aria-sort="ascending"]')).toHaveText('Name');
      // The headers share one line, and a number sits on the end of its column, as its header does.
      const heads = page.locator('.fd-list-table thead th');
      const nameTop = (await heads.nth(1).locator('button').boundingBox())!.y;
      const creditHead = (await heads.nth(6).locator('button').boundingBox())!;
      expect(Math.abs(creditHead.y - nameTop), 'the headers do not share a line').toBeLessThan(1.5);
      const credit = (await page.locator('.fd-list-row').first().locator('td').nth(6).locator('bdi').boundingBox())!;
      expect(Math.abs(credit.x + credit.width - (creditHead.x + creditHead.width)), 'the amount is not on the end').toBeLessThan(2);
      await expect(page.locator('.fd-list-row').first().locator('td').nth(6)).toHaveText('E£ 50,000.00');
      await expect(page.locator('.fd-list-row').nth(1).locator('td').nth(6)).toHaveText('JOD 18,000.00');
      await expectNoSidewaysScroll(page);
      await screen(page, `${variant}-list`, { viewport: true });
      expect(problems).toEqual([]);
    });

    test('searches what is typed in the field chosen with the keys, and narrows by the menu’s filters', async ({ page }) => {
      await open(page, variant, 'page=customers');
      await box(page).pressSequentially('egy');
      const offered = page.getByRole('listbox', { name: 'Search' }).getByRole('option');
      await expect(offered).toHaveText(['Search Name for: egy', 'Search Email for: egy', 'Search Phone for: egy', 'Search Country for: egy']);
      for (let i = 0; i < 3; i++) await box(page).press('ArrowDown');
      await expect(offered.nth(3)).toHaveAttribute('aria-selected', 'true');
      await box(page).press('Enter');
      await expect(chips(page)).toHaveText(['Country: egy']);
      await expect(range(page)).toHaveText('1–8 / 10');
      await page.getByRole('button', { name: 'Search options' }).click();
      await menu(page).getByRole('button', { name: 'Active' }).click();
      await expect(menu(page).getByRole('button', { name: 'Active' })).toHaveAttribute('aria-pressed', 'true');
      await expect(chips(page)).toHaveText(['Country: egy', 'Active']);
      await expect(range(page)).toHaveText('1–6 / 6');
      // The menu sits over the list, under the box, in its three columns.
      const field = (await page.locator('.fd-search-field').boundingBox())!;
      const panel = (await menu(page).boundingBox())!;
      expect(panel.y, 'the menu is not under the box').toBeGreaterThanOrEqual(field.y + field.height);
      const columns = await menu(page).locator('.fd-search-group').evaluateAll((groups) => groups.map((g) => Math.round(g.getBoundingClientRect().top)));
      expect(new Set(columns).size, 'the menu’s groups are not side by side').toBe(1);
      await screen(page, `${variant}-list-search`, { viewport: true });
      await box(page).focus();
      await box(page).press('Backspace');
      await expect(chips(page)).toHaveText(['Country: egy']);
      await expect(range(page)).toHaveText('1–8 / 10');
    });

    test('puts the records in a header’s order, either way, and pages through them', async ({ page }) => {
      await open(page, variant, 'page=customers');
      const credit = page.locator('.fd-list-table th', { hasText: 'Credit limit' });
      await credit.getByRole('button').click();
      await expect(credit).toHaveAttribute('aria-sort', 'ascending');
      await expect(names(page).first()).toHaveText('Tahrir Books');
      await credit.getByRole('button').click();
      await expect(credit).toHaveAttribute('aria-sort', 'descending');
      await expect(names(page).first()).toHaveText('Delta Foods');
      await page.getByRole('button', { name: 'Next page' }).click();
      await expect(range(page)).toHaveText('9–12 / 12');
      await expect(page.getByRole('button', { name: 'Next page' })).toBeDisabled();
      // Empty amounts come last, whichever way.
      await expect(names(page).last()).toHaveText('Maadi Labs');
    });

    test('groups by country and then status, each group opening into the next', async ({ page }) => {
      await open(page, variant, 'page=customers');
      await page.getByRole('button', { name: 'Search options' }).click();
      const grouping = menu(page).locator('[data-group-kind="groupBy"]');
      await grouping.getByRole('button', { name: 'Country' }).click();
      await grouping.getByRole('button', { name: 'Status' }).click();
      await page.keyboard.press('Escape');
      await expect(chips(page)).toHaveText(['Country > Status']);
      await expect(page.locator('.fd-list-group')).toHaveText(['Egypt (10)', 'Jordan (1)', 'Saudi Arabia (1)']);
      await expect(page.locator('.fd-pager')).toBeHidden();
      await group(page, 'Egypt').click();
      await expect(page.locator('.fd-list-group[data-level="1"]')).toHaveText(['Active (6)', 'Blocked (2)', 'Draft (2)']);
      await group(page, 'Draft').click();
      await expect(names(page)).toHaveText(['Cairo Coworking', 'Maadi Labs']);
      // A group inside another starts further in.
      const outer = (await group(page, 'Egypt').locator('.fd-group-label').boundingBox())!;
      const inner = (await group(page, 'Draft').locator('.fd-group-label').boundingBox())!;
      expect(inner.x - outer.x, 'the inner group is not set in').toBeGreaterThan(15);
      await screen(page, `${variant}-list-groups`, { viewport: true });
      await group(page, 'Egypt').click();
      await expect(page.locator('.fd-list-group')).toHaveCount(3);
      await expect(names(page)).toHaveCount(0);
    });

    test('hands the app the chosen records with the list’s button, after asking, and opens a record from its row', async ({ page }) => {
      const { demo } = await open(page, variant, 'page=customers');
      await page.getByRole('checkbox', { name: 'Select Delta Foods' }).check();
      await page.getByRole('checkbox', { name: 'Select Giza Plaza' }).check();
      const bar = page.locator('.fd-list-selection');
      await expect(bar.locator('.fd-list-count')).toHaveText('2 selected');
      await expect(page.locator('.fd-list-row[aria-selected="true"]')).toHaveCount(2);
      await screen(page, `${variant}-list-chosen`, { viewport: true });
      await bar.getByRole('button', { name: 'Archive' }).click();
      await expect(page.getByRole('alertdialog')).toContainText('Archive the chosen customers?');
      await page.getByRole('alertdialog').getByRole('button', { name: 'OK' }).click();
      await expect.poll(() => demo<{ action: string; recordIds?: number[] }[]>('requests')).toEqual([expect.objectContaining({ action: 'archive', recordIds: [23, 24] })]);
      await names(page).filter({ hasText: 'Delta Foods' }).click();
      await expect(page).toHaveURL(/page=customer&record=23/);
      await expect(page.locator('[data-node="#title"] input')).toHaveValue('Delta Foods');
    });

    test('keeps a search as the default, and starts with it next time', async ({ page }) => {
      await open(page, variant, 'page=customers');
      await page.getByRole('button', { name: 'Search options' }).click();
      await menu(page).getByRole('button', { name: 'Blocked' }).click();
      await menu(page).getByRole('button', { name: 'Save current search' }).click();
      await menu(page).getByRole('textbox', { name: 'Name of the search' }).fill('On hold');
      await menu(page).getByLabel('Use by default').check();
      await menu(page).locator('.fd-favourite-form').getByRole('button', { name: 'Save' }).click();
      await expect(menu(page).locator('.fd-favourite')).toHaveText(['On hold×']);
      await page.reload();
      await expect(chips(page)).toHaveText(['Blocked']);
      await expect(names(page)).toHaveText(['Giza Plaza', 'Tahrir Books']);
    });

    test('reads right to left in Arabic, a phone number still left to right', async ({ page }) => {
      await open(page, variant, 'page=customers&locale=ar&dir=rtl');
      await expect(range(page)).toHaveText('1–8 من 12');
      const phone = page.locator('.fd-list-row').first().locator('td').nth(3).locator('bdi');
      await expect(phone).toHaveText('+20 2 2735 1100');
      expect(await phone.evaluate((el) => getComputedStyle(el).direction)).toBe('ltr');
      // The search box starts on the right.
      const field = (await page.locator('.fd-search-field').boundingBox())!;
      const table = (await page.locator('.fd-list-scroll').boundingBox())!;
      expect(Math.abs(field.x + field.width - (table.x + table.width)), 'the box is not on the right').toBeLessThan(2);
      await page.getByRole('button', { name: 'خيارات البحث' }).click();
      await screen(page, `${variant}-list-rtl`, { viewport: true });
    });

    test('fits a phone: the table scrolls in its own box, the menu stacks', async ({ page }) => {
      await page.setViewportSize({ width: 400, height: 860 });
      await open(page, variant, 'page=customers');
      await expect(names(page)).toHaveCount(8);
      await expectNoSidewaysScroll(page);
      const scroller = page.locator('.fd-list-scroll');
      expect(await scroller.evaluate((el) => el.scrollWidth > el.clientWidth), 'the table does not scroll in its box').toBe(true);
      await page.getByRole('button', { name: 'Search options' }).click();
      const groups = await menu(page).locator('.fd-search-group').evaluateAll((all) => all.map((g) => Math.round(g.getBoundingClientRect().left)));
      expect(new Set(groups).size, 'the menu’s groups are not stacked').toBe(1);
      const panel = (await menu(page).boundingBox())!;
      expect(panel.x + panel.width, 'the menu runs off the screen').toBeLessThanOrEqual(400);
      await screen(page, `${variant}-list-phone`, { viewport: true });
    });
  });
}
