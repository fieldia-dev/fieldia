import { expect, test, type Locator, type Page } from '@playwright/test';
import { axeFindings } from './a11y-support';
import { expectNoSidewaysScroll, node, open, screen } from './support';
import { VARIANTS } from './variants';

/**
 * “Order by phone”: a page whose buttons and moments are steps, the viewer
 * their host, in every framework's demo — done by a person with the mouse and
 * the keyboard. A new customer made in a side panel and set on the order; the
 * stock checked by the app as a product is picked, and an out-of-stock one
 * stopped with words; the check and the question before it is sent, and the
 * words after; a customer's record opened in the order's place, and Back;
 * in Arabic right to left, at a phone's width, in the dark, swept by axe.
 */

const WIDE = { width: 1280, height: 800 };
const QUERY = 'page=quick-order&skin=outlined';
const value = (page: Page, name: string) => page.evaluate((n) => (window as any).fieldiaDemo.handle.form.getState().values[n], name);
const combo = (page: Page, id: string) => node(page, id).getByRole('combobox');
const toast = (page: Page, words: string) => page.locator('.fd-say', { hasText: words });
const sent = (page: Page) =>
  page.evaluate(() => (window as any).fieldiaDemo.dataSource.calls.filter((c: { method: string }) => c.method === 'submit').map((c: { request: { values: unknown } }) => c.request.values));
/** Wait for a panel to finish sliding in, so what is measured is where it settles. */
const slidIn = (panel: Locator) => panel.evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)).then(() => undefined));

/** Type into a link's box and pick the option named, with the keys. */
async function pick(page: Page, id: string, typed: string, option: string) {
  const box = combo(page, id);
  await box.click();
  await box.fill(typed);
  await expect(node(page, id).getByRole('option', { name: option, exact: true })).toBeVisible();
  while ((await box.getAttribute('aria-activedescendant')) === null || !(await page.locator(`#${await box.getAttribute('aria-activedescendant')}`).textContent())?.includes(option)) {
    await box.press('ArrowDown');
  }
  await box.press('Enter');
  await expect(box).toHaveValue(option);
}

/** Make a new customer from the caller's name, in the side panel, by the keys: saved with Ctrl+Enter. */
async function newCustomer(page: Page, name: string, phone: string, panelName = 'New customer') {
  await node(page, 'f-caller').locator('input').fill(name);
  await page.getByRole('button', { name: panelName }).click();
  const panel = page.getByRole('dialog', { name: panelName });
  await expect(panel).toBeVisible();
  await slidIn(panel);
  const nameBox = panel.locator('[data-node="c-name"] input');
  await expect(nameBox).toHaveValue(name);
  await expect(nameBox).toBeFocused();
  await page.keyboard.press('Tab');
  await page.keyboard.type(phone);
  return panel;
}

for (const variant of VARIANTS) {
  test.describe(variant, () => {
    test('the order taken: a new customer from the panel, the stock checked, the check and the question, then sent', async ({ page }) => {
      await page.setViewportSize(WIDE);
      const { problems } = await open(page, variant, QUERY);

      // Sent at once, it stops at its check: the empty required fields say so, and nothing is asked.
      await page.getByRole('button', { name: 'Submit' }).click();
      await expect(node(page, 'f-customer').locator('.fd-error')).toHaveText('Customer is required');
      await expect(node(page, 'f-product').locator('.fd-error')).toHaveText('Product is required');
      await expect(combo(page, 'f-customer')).toBeFocused();
      await expect(page.getByRole('alertdialog')).toHaveCount(0);
      expect(await sent(page)).toEqual([]);

      // New customer: the panel starts with the caller's name; saved, the customer is set here, and said so.
      const panel = await newCustomer(page, 'Nadia Farouk', '+20 2 2735 1100');
      // The button is busy while its steps wait on the panel.
      await expect(page.locator('button[data-node="new-customer"]')).toHaveAttribute('aria-busy', 'true');
      if (variant === 'plain') await screen(page, 'actions-new-customer-panel', { viewport: true });
      await page.keyboard.press('ControlOrMeta+Enter');
      await expect(panel).toBeHidden();
      await expect(combo(page, 'f-customer')).toHaveValue('Nadia Farouk');
      await expect(node(page, 'f-customer').locator('.fd-error')).toBeHidden();
      await expect(toast(page, 'Customer added')).toBeVisible();
      await expect(toast(page, 'Customer added')).toHaveAttribute('data-tone', 'success');
      await expect(page.locator('button[data-node="new-customer"]')).not.toHaveAttribute('aria-busy', 'true');
      const customer = (await value(page, 'customer_id')) as { id: number; label: string };
      expect(await page.evaluate((id) => (window as any).fieldiaDemo.dataSource.records.partner[id], customer.id)).toEqual(
        expect.objectContaining({ name: 'Nadia Farouk', phone: '+20 2 2735 1100' })
      );
      if (variant === 'plain') await screen(page, 'actions-customer-added', { viewport: true });

      // A product picked: the app checks the stock, gives the price and says how many are left.
      await pick(page, 'f-product', 'lamp', 'Desk lamp, LED');
      await expect(toast(page, 'In stock: 40')).toBeVisible();
      await expect.poll(() => value(page, 'price')).toBe(380);
      // Out of stock: the app stops with words, and the price goes.
      await pick(page, 'f-product', 'standing', 'Standing desk 160 × 80');
      await expect(toast(page, 'Standing desk 160 × 80 is out of stock until November.')).toHaveAttribute('data-tone', 'warning');
      await expect.poll(() => value(page, 'price')).toBeNull();
      if (variant === 'plain') await screen(page, 'actions-out-of-stock', { viewport: true });
      await pick(page, 'f-product', 'chair', 'Office chair, ergonomic');
      await expect.poll(() => value(page, 'price')).toBe(1890);
      await node(page, 'f-quantity').locator('input').fill('3');
      await expect.poll(() => value(page, 'total')).toBe(5670);

      // Sent: the question first. Cancel keeps it here, unsent; OK sends it, and says so.
      await page.getByRole('button', { name: 'Submit' }).click();
      const question = page.getByRole('alertdialog');
      await expect(question).toContainText('Send the order?');
      await expect(question.getByRole('button', { name: 'OK' })).toBeFocused();
      if (variant === 'plain') await screen(page, 'actions-send-question', { viewport: true });
      await question.getByRole('button', { name: 'Cancel' }).click();
      await expect(question).toBeHidden();
      expect(await sent(page)).toEqual([]);
      await page.getByRole('button', { name: 'Submit' }).click();
      await expect(question).toBeVisible();
      await page.keyboard.press('Enter');
      await expect(toast(page, 'Order sent')).toBeVisible();
      await expect(page.locator('.fd-done-title')).toBeVisible();
      expect(await sent(page)).toEqual([expect.objectContaining({ customer_id: customer, product: { id: 1, label: 'Office chair, ergonomic' }, quantity: 3, price: 1890, total: 5670 })]);
      await screen(page, `actions-order-sent-${variant}`, { viewport: true });
      expect(problems).toEqual([]);
    });

    test('a customer’s record opened in the order’s place: Back brings the order back as it was; saved, it comes back named anew', async ({ page }) => {
      await page.setViewportSize(WIDE);
      const { problems } = await open(page, variant, QUERY);
      await expect(page.getByRole('button', { name: 'Customer’s page' })).toBeHidden();
      await node(page, 'f-notes').locator('textarea').fill('Leave it at the door.');
      await pick(page, 'f-customer', 'nile', 'Nile Traders');
      const opener = page.getByRole('button', { name: 'Customer’s page' });
      await opener.click();
      const back = page.getByRole('button', { name: 'Back' });
      await expect(back).toBeVisible();
      const order = page.locator('form.fd-form').first();
      await expect(order).toBeHidden();
      const title = page.locator('[data-node="#title"] input');
      await expect(title).toHaveValue('Nile Traders');
      if (variant === 'plain') await screen(page, 'actions-customer-in-place');
      await back.click();
      await expect(order).toBeVisible();
      await expect(back).toHaveCount(0);
      await expect(node(page, 'f-notes').locator('textarea')).toHaveValue('Leave it at the door.');
      await expect(opener).toBeFocused();
      // Again, and saved: the order's link takes the record's new name.
      await page.keyboard.press('Enter');
      await expect(title).toBeVisible();
      await title.fill('Nile Traders Co.');
      await page.keyboard.press('ControlOrMeta+Enter');
      await expect(order).toBeVisible();
      await expect(combo(page, 'f-customer')).toHaveValue('Nile Traders Co.');
      await expect(node(page, 'f-notes').locator('textarea')).toHaveValue('Leave it at the door.');
      expect(problems).toEqual([]);
    });

    test('in Arabic, right to left: the panel from the left, the words in Arabic, the app’s too', async ({ page }) => {
      await page.setViewportSize(WIDE);
      await open(page, variant, `${QUERY}&locale=ar&dir=rtl`);
      await expect(page.locator('.fd-page-title')).toHaveText('طلب بالهاتف');
      const panel = await newCustomer(page, 'نادية فاروق', '0100 123 4567', 'عميل جديد');
      expect(Math.round((await panel.boundingBox())!.x)).toBe(0);
      await page.keyboard.press('ControlOrMeta+Enter');
      await expect(panel).toBeHidden();
      await expect(toast(page, 'أُضيف العميل')).toBeVisible();
      expect(await toast(page, 'أُضيف العميل').evaluate((el) => getComputedStyle(el).direction)).toBe('rtl');
      await pick(page, 'f-product', 'lamp', 'Desk lamp, LED');
      await expect(toast(page, 'في المخزون: 40')).toBeVisible();
      await page.getByRole('button', { name: 'إرسال' }).click();
      await expect(page.getByRole('alertdialog')).toContainText('إرسال الطلب؟');
      if (variant === 'plain') await screen(page, 'actions-arabic-question', { viewport: true });
      await page.keyboard.press('Enter');
      await expect(toast(page, 'أُرسل الطلب')).toBeVisible();
      if (variant === 'plain') await screen(page, 'actions-arabic-sent', { viewport: true });
    });

    test('at a phone’s width: nothing scrolls sideways, the panel fills the screen, the toast fits', async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await open(page, variant, QUERY);
      await expectNoSidewaysScroll(page);
      const panel = await newCustomer(page, 'Nadia Farouk', '+20 2 2735 1100');
      const box = (await panel.boundingBox())!;
      expect([Math.round(box.x), Math.round(box.width)]).toEqual([0, 390]);
      await page.keyboard.press('ControlOrMeta+Enter');
      await expect(panel).toBeHidden();
      const said = toast(page, 'Customer added');
      await expect(said).toBeVisible();
      const where = (await said.boundingBox())!;
      expect(where.x).toBeGreaterThanOrEqual(16);
      expect(where.x + where.width).toBeLessThanOrEqual(390 - 16);
      expect(where.y + where.height).toBeLessThanOrEqual(844);
      await expectNoSidewaysScroll(page);
      if (variant === 'plain') await screen(page, 'actions-phone', { viewport: true });
    });

    test('in the dark: the question stands out with an edge, the toasts read, and axe finds nothing', async ({ page }) => {
      await page.setViewportSize(WIDE);
      await open(page, variant, `${QUERY}&scheme=dark`);
      expect(await axeFindings(page, `${variant} dark order`)).toEqual([]);
      await pick(page, 'f-product', 'lamp', 'Desk lamp, LED');
      await expect(toast(page, 'In stock: 40')).toBeVisible();
      expect(await axeFindings(page, `${variant} dark toast`)).toEqual([]);
      await page.getByRole('button', { name: 'Submit' }).click();
      await expect(combo(page, 'f-customer')).toBeFocused();
      await pick(page, 'f-customer', 'nile', 'Nile Traders');
      await page.getByRole('button', { name: 'Submit' }).click();
      const question = page.getByRole('alertdialog');
      await expect(question).toBeVisible();
      const edge = await question.evaluate((el) => getComputedStyle(el).borderTopColor);
      expect(edge).toBe('rgb(89, 97, 108)');
      expect(await axeFindings(page, `${variant} dark question`)).toEqual([]);
      if (variant === 'plain') await screen(page, 'actions-dark-question', { viewport: true });
      await page.keyboard.press('Escape');
      await expect(question).toBeHidden();
      await expect(page.locator('.fd-done-title')).toBeHidden();
    });
  });
}

test('axe finds nothing on the order, its panel, its toasts and its question, in the light', async ({ page }) => {
  await page.setViewportSize(WIDE);
  await open(page, 'plain', QUERY);
  expect(await axeFindings(page, 'order')).toEqual([]);
  const panel = await newCustomer(page, 'Nadia Farouk', '+20 2 2735 1100');
  expect(await axeFindings(page, 'panel')).toEqual([]);
  await page.keyboard.press('ControlOrMeta+Enter');
  await expect(panel).toBeHidden();
  await expect(toast(page, 'Customer added')).toBeVisible();
  // The toast's × by the keys: it goes, and the toasts' region stays for the next words.
  expect(await axeFindings(page, 'toast')).toEqual([]);
  await toast(page, 'Customer added').getByRole('button', { name: 'Dismiss' }).click();
  await expect(toast(page, 'Customer added')).toHaveCount(0);
  await pick(page, 'f-product', 'lamp', 'Desk lamp, LED');
  await page.getByRole('button', { name: 'Submit' }).click();
  await expect(page.getByRole('alertdialog')).toBeVisible();
  expect(await axeFindings(page, 'question')).toEqual([]);
});
