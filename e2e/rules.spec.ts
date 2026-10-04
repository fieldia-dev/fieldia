import { expect, test, type Locator, type Page } from '@playwright/test';
import { node, open, screen } from './support';
import { VARIANTS } from './variants';

/**
 * The rules demo, typed in the way a person would: subtotals, the total and
 * the amount to pay follow each keystroke, a discount sets itself past EGP
 * 1,000 and stays as the person changes it, a warning shows under its field
 * once they leave it and never stops the form, and errors stop it, each
 * under its field.
 */

const lines = (page: Page) => node(page, 'f-lines').locator('tbody tr[data-line]');
const cell = (row: Locator, label: string) => row.getByLabel(label, { exact: true });
const box = (page: Page, id: string) => node(page, id).locator('input').first();

/** The colour of an element, as the browser draws it. */
const colour = (el: Locator, property: 'color' | 'backgroundColor') => el.evaluate((e, p) => getComputedStyle(e)[p], property);

for (const variant of VARIANTS) {
  test.describe(`${variant} · totals and answer rules`, () => {
    test('totals follow the typing, the discount sets itself, a warning waits and never blocks, errors do', async ({ page }) => {
      const { problems, demo } = await open(page, variant, 'page=rules&skin=outlined');

      // What the order starts with: one line, its subtotal and the sums worked out, none of them typed in.
      await expect(cell(lines(page).first(), 'Subtotal')).toHaveValue('480.00');
      await expect(box(page, 'f-total')).toHaveValue('480.00');
      await expect(box(page, 'f-to-pay')).toHaveValue('480.00');
      await expect(box(page, 'f-discount')).toHaveValue('0');
      for (const id of ['f-total', 'f-to-pay']) await expect(box(page, id)).not.toBeEditable();
      await expect(cell(lines(page).first(), 'Subtotal')).not.toBeEditable();

      // A quantity typed: the line's subtotal and the total follow.
      const qty = cell(lines(page).first(), 'Quantity');
      await qty.click();
      await qty.press('ControlOrMeta+a');
      await qty.pressSequentially('3');
      await expect(cell(lines(page).first(), 'Subtotal')).toHaveValue('720.00');
      await expect(box(page, 'f-total')).toHaveValue('720.00');

      // A second line takes the total past EGP 1,000: the discount sets itself.
      await node(page, 'f-lines').getByRole('button', { name: /Add a line/ }).click();
      await expect(lines(page)).toHaveCount(2);
      const chair = lines(page).nth(1);
      await cell(chair, 'Item').pressSequentially('Desk chair');
      await cell(chair, 'Quantity').pressSequentially('1');
      await expect(box(page, 'f-discount')).toHaveValue('0');
      await cell(chair, 'Unit price').pressSequentially('1890');
      await expect(cell(chair, 'Subtotal')).toHaveValue('1,890.00');
      await expect(box(page, 'f-total')).toHaveValue('2,610.00');
      await expect(box(page, 'f-discount')).toHaveValue('10');
      await expect(box(page, 'f-to-pay')).toHaveValue('2,349.00');
      if (variant === 'plain') await screen(page, 'rules-totals');

      // The person may change the discount: it stays, and what is left to pay follows.
      await box(page, 'f-discount').fill('15');
      await expect(box(page, 'f-to-pay')).toHaveValue('2,218.50');
      await cell(lines(page).first(), 'Quantity').fill('4');
      await expect(box(page, 'f-discount')).toHaveValue('15');
      await expect(box(page, 'f-total')).toHaveValue('2,850.00');

      // Back under EGP 1,000, the discount goes back to nothing.
      await lines(page).nth(1).getByRole('button', { name: 'Delete line' }).click();
      await expect(lines(page)).toHaveCount(1);
      await expect(box(page, 'f-total')).toHaveValue('960.00');
      await expect(box(page, 'f-discount')).toHaveValue('0');
      await expect(box(page, 'f-to-pay')).toHaveValue('960.00');

      // A personal address: no advice mid-word, a warning once the person moves on.
      const email = node(page, 'f-email');
      const warning = email.locator('.fd-warning');
      await email.locator('input').pressSequentially('sara@gmail.com');
      await expect(warning).toBeHidden();
      await email.locator('input').press('Tab');
      await expect(warning).toBeVisible();
      await expect(warning).toHaveText('Use your @niletraders.example address if you can: those orders are approved the same day.');
      await expect(warning).toHaveAttribute('role', 'status');
      await expect(email.locator('input')).toHaveAttribute('aria-invalid', 'false');
      if (variant === 'plain') await screen(page, 'rules-warning', { viewport: true });

      // A postcode of four digits and one day ticked: sending stops, with each message under its field.
      await box(page, 'f-postcode').pressSequentially('1151');
      await node(page, 'f-days').getByLabel('Sunday').check();
      await page.getByRole('button', { name: 'Submit' }).click();
      const postcodeError = node(page, 'f-postcode').locator('.fd-error');
      const daysError = node(page, 'f-days').locator('.fd-error');
      await expect(postcodeError).toHaveText('A postcode has five digits, such as 11511.');
      await expect(daysError).toHaveText('Choose at least 2 for Delivery days');
      await expect(box(page, 'f-postcode')).toHaveAttribute('aria-invalid', 'true');
      await expect(warning).toBeVisible();
      expect(await demo<unknown[]>('dataSource.responses')).toHaveLength(0);
      // A warning is drawn apart from an error.
      expect(await colour(warning, 'color')).not.toBe(await colour(postcodeError, 'color'));
      expect(await colour(warning, 'backgroundColor')).not.toBe('rgba(0, 0, 0, 0)');
      if (variant === 'plain') await screen(page, 'rules-errors');

      // Put right, the answers go, the warning notwithstanding.
      await box(page, 'f-postcode').fill('11511');
      await node(page, 'f-days').getByLabel('Tuesday').check();
      await expect(postcodeError).toBeHidden();
      await expect(daysError).toBeHidden();
      await page.getByRole('button', { name: 'Submit' }).click();
      await expect(page.locator('.fd-done')).toBeVisible();
      const sent = await demo<{ values: Record<string, unknown> }[]>('dataSource.responses');
      expect(sent).toHaveLength(1);
      expect(sent[0].values).toMatchObject({ email: 'sara@gmail.com', postcode: '11511', days: ['sun', 'tue'], total: 960, discount: 0, to_pay: 960 });
      expect(problems).toEqual([]);
    });
  });
}

test('totals and answer rules, right to left in Arabic', async ({ page }) => {
  const { problems } = await open(page, 'plain', 'page=rules&skin=outlined&locale=ar&dir=rtl');
  await expect(page.locator('.fd-form').first()).toHaveAttribute('dir', 'rtl');
  await expect(node(page, 'f-total').locator('.fd-label')).toHaveText('الإجمالي');

  const chairQty = cell(lines(page).first(), 'الكمية');
  await chairQty.fill('5');
  await expect(box(page, 'f-total')).toHaveValue('1,200.00');
  await expect(box(page, 'f-discount')).toHaveValue('10');
  await expect(box(page, 'f-to-pay')).toHaveValue('1,080.00');

  const email = node(page, 'f-email');
  await email.locator('input').pressSequentially('sara@gmail.com');
  await email.locator('input').press('Tab');
  await expect(email.locator('.fd-warning')).toHaveText('استخدم عنوانك على niletraders.example إن أمكن: تُعتمد هذه الطلبات في اليوم نفسه.');

  await box(page, 'f-postcode').pressSequentially('12');
  await node(page, 'f-days').getByLabel('الأحد').check();
  await page.getByRole('button', { name: 'إرسال' }).click();
  await expect(node(page, 'f-postcode').locator('.fd-error')).toHaveText('الرمز البريدي خمسة أرقام، مثل 11511.');
  await expect(node(page, 'f-days').locator('.fd-error')).toHaveText('اختر 2 على الأقل في أيام التوصيل');

  // The message sits under its field, on the side the page starts from: the right.
  const field = (await node(page, 'f-postcode').boundingBox())!;
  const message = (await node(page, 'f-postcode').locator('.fd-error').boundingBox())!;
  expect(message.y).toBeGreaterThan(field.y);
  expect(Math.abs(message.x + message.width - (field.x + field.width))).toBeLessThan(4);
  await screen(page, 'rules-arabic');
  expect(problems).toEqual([]);
});
