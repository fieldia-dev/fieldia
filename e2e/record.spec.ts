import { type Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { expectNoSidewaysScroll, open, screen } from './support';
import { VARIANTS } from './variants';

/**
 * What sits around a record, in every framework: the vendor bill's
 * breadcrumbs, gear menu and pager, its PDF beside the sheet, and its
 * conversation beside it — on a desktop, in Arabic and on a phone.
 */
const bar = (page: Page) => page.locator('.fd-record-bar');
const pagerText = (page: Page) => bar(page).locator('.fd-record-pager-text');
const gear = (page: Page) => bar(page).locator('.fd-record-gear');
const title = (page: Page) => page.locator('.fd-title [data-field="name"] textarea');

for (const variant of VARIANTS) {
  test.describe(`${variant} · around a record`, () => {
    test('moves through the bills with the pager and Alt+N, the PDF and the trail following', async ({ page }) => {
      await open(page, variant, 'page=vendor-bill&record=3&skin=underline');
      await expect(pagerText(page)).toHaveText('3 / 4');
      await expect(bar(page).locator('nav [aria-current="page"]')).toHaveText('BILL/2026/10/0003');
      await expect(page.locator('.fd-attachment-preview .fd-attachment-name')).toHaveText('NT-8907.pdf');
      await bar(page).getByRole('button', { name: 'Next record' }).click();
      await expect(pagerText(page)).toHaveText('4 / 4');
      await expect(title(page)).toHaveValue('BILL/2026/10/0004');
      await expect(page.locator('.fd-attachment-name')).toHaveText('DOS-1187.pdf');
      await page.keyboard.press('Alt+KeyN');
      await expect(pagerText(page)).toHaveText('1 / 4');
      await bar(page).getByRole('button', { name: 'Next record' }).click();
      // The second bill has no PDF yet: nothing beside it.
      await expect(pagerText(page)).toHaveText('2 / 4');
      await expect(page.locator('.fd-attachment-preview')).toBeHidden();
      await screen(page, `${variant}-record-pager`, { viewport: true });
    });

    test('opens the gear menu with the keyboard and runs Debit Note, posted in the conversation', async ({ page }) => {
      await open(page, variant, 'page=vendor-bill&record=3&skin=underline');
      await gear(page).focus();
      await page.keyboard.press('ArrowDown');
      const menu = page.getByRole('menu');
      await expect(menu).toBeVisible();
      await expect(menu.getByRole('menuitem')).toHaveText(['Vendor bill', 'Debit Note', 'Archive', 'Duplicate']);
      await expect(menu.getByRole('menuitem', { name: 'Vendor bill' })).toBeFocused();
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('Enter');
      await expect(menu).toBeHidden();
      await expect(page.locator('.fd-slot[data-slot="chatter"] .fd-message-body').first()).toHaveText('Debit note DN/2026/10/0001 made for BILL/2026/10/0003');
      await screen(page, `${variant}-record-debit-note`, { viewport: true });
    });

    test('duplicates a bill, the pager counting the copy, and archives one, its ribbon showing', async ({ page }) => {
      await open(page, variant, 'page=vendor-bill&record=2&skin=underline');
      await gear(page).click();
      await page.getByRole('menuitem', { name: 'Duplicate' }).click();
      await expect(title(page)).toHaveValue('BILL/2026/10/0002 (copy)');
      await expect(pagerText(page)).toHaveText('3 / 5');
      await gear(page).click();
      await page.getByRole('menuitem', { name: 'Archive' }).click();
      await page.getByRole('alertdialog').getByRole('button', { name: 'Archive' }).click();
      await expect(page.locator('.fd-ribbon:visible')).toHaveText('Archived');
      await gear(page).click();
      await expect(page.getByRole('menuitem', { name: 'Unarchive' })).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(gear(page)).toBeFocused();
    });

    test('duplicates a posted bill as a draft: its copy says Draft, offers Confirm and Delete, and its fields open', async ({ page }) => {
      await open(page, variant, 'page=vendor-bill&record=1&skin=underline');
      await expect(page.locator('.fd-statusbar [aria-current="step"]')).toHaveText('Posted');
      await gear(page).click();
      await page.getByRole('menuitem', { name: 'Duplicate' }).click();
      await expect(title(page)).toHaveValue('BILL/2026/10/0001 (copy)');
      // A posted bill's status is the books', never copied: the copy starts as a draft, as an accounting server's copy does.
      await expect(page.locator('.fd-statusbar [aria-current="step"]')).toHaveText('Draft');
      await expect(page.getByRole('button', { name: 'Confirm' })).toBeVisible();
      await expect(page.locator('[data-node="f-partner"] input')).toBeEditable();
      await gear(page).click();
      await expect(page.getByRole('menuitem', { name: 'Delete' })).toBeVisible();
      await page.keyboard.press('Escape');
      const copy = await page.evaluate(() => Object.values((window as any).fieldiaDemo.dataSource.records['account.move'] as Record<string, { name: string; state: string }>).find((bill) => bill.name === 'BILL/2026/10/0001 (copy)'));
      expect(copy?.state).toBe('draft');
    });

    test('reads right to left in Arabic, and folds onto a phone without scrolling sideways', async ({ page }) => {
      await open(page, variant, 'page=vendor-bill&record=3&skin=underline&locale=ar&dir=rtl');
      await expect(gear(page)).toContainText('إجراءات');
      await expect(pagerText(page)).toHaveText('3 / 4');
      // The pager sits at the end of the line: the left, right to left.
      const pager = (await bar(page).locator('.fd-record-pager').boundingBox())!;
      const crumbs = (await bar(page).locator('nav').boundingBox())!;
      expect(pager.x).toBeLessThan(crumbs.x);
      await screen(page, `${variant}-record-arabic`, { viewport: true });
      await page.setViewportSize({ width: 390, height: 844 });
      await open(page, variant, 'page=vendor-bill&record=3&skin=underline');
      await expect(gear(page).locator('.fd-record-gear-words')).toHaveCSS('position', 'absolute');
      await gear(page).click();
      const menu = (await page.getByRole('menu').boundingBox())!;
      expect(menu.x).toBeGreaterThanOrEqual(0);
      expect(menu.x + menu.width).toBeLessThanOrEqual(390);
      await expectNoSidewaysScroll(page);
      await screen(page, `${variant}-record-phone`, { viewport: true });
    });
  });
}
