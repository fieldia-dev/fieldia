import { expect, test, type Page } from '@playwright/test';
import { expectNoSidewaysScroll, node, open, screen } from './support';
import { VARIANTS } from './variants';

/**
 * How a dense record sheet reads, as Flectra draws one — in every framework:
 * read-only values as words, stat buttons that format what they show, a link
 * with its address and picture, coloured tags, parts on one line, alerts with
 * a field's value and a button inside, a statusbar with time per step, keys
 * on buttons, parts for editing only, and ribbons by condition.
 */
const READING = 'page=reading&skin=underline&editSwitch=1';
const words = (page: Page, id: string) => node(page, id).locator('.fd-read-text');

for (const variant of VARIANTS) {
  test.describe(`${variant} · how a sheet reads`, () => {
    test('read-only values are words, stat buttons format theirs, and ribbons, alerts and links say what the record holds', async ({ page }) => {
      const { problems } = await open(page, variant, READING);
      // A read-only choice is its label, an amount has its currency: no box, no arrow.
      await expect(words(page, 'f-payment')).toHaveText('Paid');
      await expect(node(page, 'f-payment').locator('select')).toBeHidden();
      await expect(words(page, 'f-total')).toHaveText(/73,069\.44/);
      await expect(node(page, 'f-risk').locator('.fd-badge')).toHaveText('High');
      // Stat buttons: money with its currency, hours with a unit, a date with words from a field, two values.
      await expect(node(page, 's-paid').locator('.fd-stat-value')).toHaveText(/25,000\.00/);
      await expect(node(page, 's-hours').locator('.fd-stat-value')).toHaveText('24.80 h');
      await expect(node(page, 's-meeting')).toContainText('Next Meeting');
      await expect(node(page, 's-time-off').locator('.fd-stat-value')).toHaveText('12.5 / 21 Days');
      await expect(node(page, 's-moves').locator('.fd-stat-row')).toHaveText(['In3', 'Out5']);
      // One ribbon in the corner, the first whose condition holds.
      await expect(page.locator('.fd-ribbon:visible')).toHaveText(['Paid']);
      // Alerts hold a field's value, and a button inside.
      await expect(node(page, 'a-lock')).toContainText('Entries dated before 30 Sept 2026 cannot be posted');
      await expect(node(page, 'a-credit')).toContainText('Nile Traders owes 48,069.44 EGP');
      await expect(node(page, 'a-duplicate').getByRole('button', { name: 'See the other invoice' })).toBeVisible();
      // The customer's address under it, the salesperson's picture, tags in their colours.
      await expect(node(page, 'f-partner').locator('.fd-link-details div')).toHaveText(['12 Nile St, Garden City', 'Cairo, Egypt', 'Tax ID 123-456-789']);
      await expect(node(page, 'f-user').locator('.fd-link-avatar img')).toBeVisible();
      await expect(node(page, 'f-tags').locator('.fd-chip[data-color]')).toHaveCount(3);
      // The statusbar's time per step.
      await expect(page.locator('.fd-header .fd-statusbar .fd-step-time')).toHaveText(['3d', '5h']);
      // Parts on one line: a pricelist with its button beside it.
      const pricelist = await node(page, 'f-pricelist').boundingBox();
      const update = await node(page, 'b-update-prices').boundingBox();
      expect(Math.abs(pricelist!.y + pricelist!.height / 2 - (update!.y + update!.height / 2))).toBeLessThan(8);
      await screen(page, `${variant}-reading`);
      expect(problems).toEqual([]);
    });

    test('Done locks the record: every value reads as words, and the parts for editing only go', async ({ page }) => {
      const { problems } = await open(page, variant, READING);
      await expect(node(page, 'b-credit')).toBeVisible();
      await expect(node(page, 't-edit-only')).toBeVisible();
      await page.getByRole('button', { name: 'Done' }).click();
      await expect(node(page, 'b-credit')).toBeHidden();
      await expect(node(page, 't-edit-only')).toBeHidden();
      await expect(words(page, 'f-partner')).toContainText('Nile Traders');
      await expect(words(page, 'f-partner').locator('.fd-link-details')).toBeVisible();
      await expect(words(page, 'f-date')).toHaveText('2 Oct 2026');
      await page.getByRole('button', { name: 'Edit' }).click();
      await expect(node(page, 'b-credit')).toBeVisible();
      expect(problems).toEqual([]);
    });

    test('a key on a button presses it with Alt, and shows while Alt is held', async ({ page }) => {
      const { problems, demo } = await open(page, variant, READING);
      await page.locator('[data-node="f-narration"] textarea').focus();
      await page.keyboard.down('Alt');
      await expect(node(page, 'b-draft').locator('.fd-hotkey')).toBeVisible();
      await page.keyboard.up('Alt');
      await expect(node(page, 'b-draft').locator('.fd-hotkey')).toBeHidden();
      await expect(node(page, 'b-draft')).toHaveAttribute('aria-keyshortcuts', 'Alt+Shift+G');
      await page.keyboard.press('Alt+Shift+KeyG');
      await expect.poll(() => demo<string[]>('actions')).toEqual(['button_draft']);
      // A key no button has is the page's own.
      await page.keyboard.press('Alt+KeyK');
      await expect.poll(() => demo<string[]>('actions')).toEqual(['button_draft']);
      expect(problems).toEqual([]);
    });

    test('right to left, on a phone, it mirrors and never scrolls sideways', async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      const { problems } = await open(page, variant, `${READING}&locale=ar&dir=rtl`);
      await expect(words(page, 'f-payment')).toHaveText('Paid');
      const label = await node(page, 'f-total').locator('.fd-label').boundingBox();
      const value = await words(page, 'f-total').boundingBox();
      // Mirrored: the label at the right, its value to its left.
      expect(label!.x).toBeGreaterThan(value!.x + value!.width - 1);
      // A line of parts keeps within the row: the pricelist's box is not cut at the screen's side.
      const row = await node(page, 'l-pricelist').locator('.fd-oneline-row').boundingBox();
      const box = await node(page, 'f-pricelist').boundingBox();
      expect(box!.x).toBeGreaterThanOrEqual(row!.x - 1);
      await expectNoSidewaysScroll(page);
      await screen(page, `${variant}-reading-rtl-phone`);
      expect(problems).toEqual([]);
    });
  });
}
