import { type Dialog, type Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { node, open } from './support';

/**
 * Two ways out that dropped what was typed without a word, found on the live site (0.23.0): Escape in a line's own
 * dialog — a sales order's line, its quantity changed — which nothing else saves; and the browser's own Back and
 * Reload, which an app asks the viewer to guard (`warnOnLeave`, on in the demos). A page with nothing changed is let
 * go at once, as before.
 */

const ORDER = 'page=real-sale-order&record=7101&skin=underline';
const lines = (page: Page) => (page.evaluate(() => (window as any).fieldiaDemo.handle.form.getState().values['order_line']) as Promise<{ values: Record<string, unknown> }[]>);

test('a sales order line’s quantity changed in its dialog: Escape asks, Enter keeps it, and Discard lets it go', async ({ page }) => {
  const { problems } = await open(page, 'plain', ORDER);
  const before = (await lines(page))[0].values['product_uom_qty'];
  await node(page, 'f-order-line').locator('.fd-line-open').first().click();
  const dialog = page.locator('.fd-form-dialog');
  const qty = dialog.locator('.fd-field[data-field="product_uom_qty"] input');
  await expect(qty).toBeVisible();
  await qty.fill('5');
  await qty.press('Escape');
  const ask = page.getByRole('alertdialog');
  await expect(ask).toContainText('Discard your changes?');
  await expect(ask.getByRole('button', { name: 'Cancel' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(ask).toHaveCount(0);
  await expect(dialog).toBeVisible();
  await expect(qty).toHaveValue(/^5(\.00)?$/);
  await qty.press('Escape');
  await ask.getByRole('button', { name: 'Discard' }).click();
  await expect(dialog).toHaveCount(0);
  expect((await lines(page))[0].values['product_uom_qty']).toBe(before);
  expect(problems).toEqual([]);
});

test('a sales order line opened and left as it was: Escape closes it at once', async ({ page }) => {
  const { problems } = await open(page, 'plain', ORDER);
  await node(page, 'f-order-line').locator('.fd-line-open').first().click();
  const dialog = page.locator('.fd-form-dialog');
  await expect(dialog.locator('.fd-field[data-field="product_uom_qty"] input')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('alertdialog')).toHaveCount(0);
  expect(problems).toEqual([]);
});

/** The customer, its website typed by the keys (the browser asks only on a page a person has used). */
async function typedWebsite(page: Page) {
  const { problems } = await open(page, 'plain', 'page=customer&skin=underline');
  const website = node(page, 'f-website').locator('input');
  await website.click();
  await website.pressSequentially('niletraders.example');
  await website.press('Tab');
  expect(await page.evaluate(() => (window as any).fieldiaDemo.handle.form.getState().dirty)).toContain('website');
  return problems;
}

test('the browser’s Reload with a website typed and not saved: the browser asks first', async ({ page, browserName }) => {
  // Playwright's Firefox reloads past the page's beforeunload (closing its tab, below, asks there as the others do).
  test.skip(browserName === 'firefox', 'Playwright reloads Firefox without its beforeunload');
  const problems = await typedWebsite(page);
  const asked = new Promise<Dialog>((resolve) => page.once('dialog', resolve));
  const reloading = page.reload();
  const dialog = await asked;
  expect(dialog.type()).toBe('beforeunload');
  await dialog.accept();
  await reloading;
  await expect(node(page, 'f-website').locator('input')).toHaveValue('');
  expect(problems).toEqual([]);
});

test('the tab closed with a website typed and not saved: the browser asks first', async ({ page }) => {
  const problems = await typedWebsite(page);
  const asked: string[] = [];
  page.on('dialog', (dialog) => {
    asked.push(dialog.type());
    void dialog.accept();
  });
  await page.close({ runBeforeUnload: true });
  await expect.poll(() => asked).toEqual(['beforeunload']);
  expect(problems).toEqual([]);
});

test('the browser’s Reload with nothing changed, or once saved: nothing asks', async ({ page }) => {
  const { problems } = await open(page, 'plain', 'page=customer&skin=underline');
  const dialogs: string[] = [];
  page.on('dialog', (dialog) => {
    dialogs.push(dialog.type());
    void dialog.accept();
  });
  await node(page, 'f-website').locator('input').click();
  await page.reload();
  await expect(page.locator('.fd-form')).toBeVisible();
  // Typed, then saved: nothing is left to lose.
  const website = node(page, 'f-website').locator('input');
  await website.click();
  await website.pressSequentially('niletraders.example');
  await website.press('ControlOrMeta+Enter');
  await expect.poll(() => page.evaluate(() => (window as any).fieldiaDemo.handle.form.getState().dirty)).toEqual([]);
  await page.reload();
  await expect(page.locator('.fd-form')).toBeVisible();
  expect(dialogs).toEqual([]);
  expect(problems).toEqual([]);
});

test('a page whose app keeps the browser’s ways out to itself (`warnOnLeave=0`): Reload asks nothing, as in 0.20', async ({ page }) => {
  const { problems } = await open(page, 'plain', 'page=customer&skin=underline&warnOnLeave=0');
  const dialogs: string[] = [];
  page.on('dialog', (dialog) => {
    dialogs.push(dialog.type());
    void dialog.accept();
  });
  const website = node(page, 'f-website').locator('input');
  await website.click();
  await website.pressSequentially('niletraders.example');
  await website.press('Tab');
  await page.reload();
  await expect(page.locator('.fd-form')).toBeVisible();
  expect(dialogs).toEqual([]);
  expect(problems).toEqual([]);
});
