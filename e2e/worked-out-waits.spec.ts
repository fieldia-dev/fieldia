import { type Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { node, open, screen } from './support';

/**
 * The owner's walk of 0.24: "abc" in the Office chair's Quantity, the Standing desk set to 7 — the line's Subtotal and
 * the table's Total showed "—", but Untaxed E£ 71,081.00 and Total E£ 80,393.94 counted the chair at its old 12.
 * Every value worked out from the lines waits as the table's own total does while a line holds text that does not
 * read — the app's, worked out by its onchange (the sales order's Untaxed, VAT and Total; a real order's tax totals)
 * as the page's own — a dash, said in words; put right, every amount is there again, worked out from what it shows.
 */

const grid = (page: Page, id: string) => node(page, id);
const cell = (page: Page, id: string, row: number, column: string) => grid(page, id).locator(`.ag-row[row-index="${row}"] .ag-cell[col-id="${column}"]`);
const editor = (page: Page, id: string) => grid(page, id).locator('.fd-grid-editor input').first();
/** A cell typed into as a person does: clicked, all of it chosen, the words typed, Enter. */
async function typeInto(page: Page, id: string, row: number, column: string, words: string) {
  await cell(page, id, row, column).click();
  await expect(editor(page, id)).toBeFocused();
  await page.keyboard.press('Control+A');
  await page.keyboard.type(words);
  await page.keyboard.press('Enter');
}
const waiting = (page: Page, id: string) => node(page, id).locator('.fd-value-waits');
/** A read-only amount's box: its number, the currency's sign beside it. */
const amount = (page: Page, id: string) => node(page, id).locator('input');

test.describe('values worked out from the lines wait for a line that does not read', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'the grid’s keys are Chromium’s here');

  test('a sales order: the totals under the lines wait through the app’s answer, and come back once it reads', async ({ page }) => {
    const { problems } = await open(page, 'plain', 'page=order&skin=underline');
    await expect(amount(page, 'f-untaxed')).toHaveValue(/64,656\.00/);
    await typeInto(page, 'f-lines', 1, 'qty', 'abc');
    await expect(cell(page, 'f-lines', 1, 'qty')).toHaveText('abc');
    // At once: no amount counting the chair at the 12 its box no longer shows.
    for (const [id, label] of [['f-untaxed', 'Untaxed amount'], ['f-tax', 'VAT'], ['f-total', 'Total']]) {
      await expect(waiting(page, id)).toBeVisible();
      await expect(waiting(page, id)).toHaveAttribute('title', `Fix line 1 of Order lines to see ${label}`);
      await expect(waiting(page, id).locator('[aria-hidden="true"]')).toHaveText('—');
    }
    await expect(amount(page, 'f-untaxed')).toBeHidden();
    // The desk set to 7: the app answers, the desk's Subtotal follows — and the totals still wait for line 1.
    await typeInto(page, 'f-lines', 2, 'qty', '7');
    await expect(cell(page, 'f-lines', 2, 'subtotal')).toHaveText('E£ 44,975.00');
    await expect(waiting(page, 'f-untaxed')).toBeVisible();
    // Laid underneath as the app answered — 71,081.00 and 80,393.94, counting the chair at 12 — and never shown.
    await expect(amount(page, 'f-untaxed')).toBeHidden();
    await expect(amount(page, 'f-total')).toBeHidden();
    await node(page, 'f-total').scrollIntoViewIfNeeded();
    await screen(page, 'worked-out-waits-order', { viewport: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await node(page, 'f-total').scrollIntoViewIfNeeded();
    await screen(page, 'worked-out-waits-order-phone', { viewport: true });
    await page.setViewportSize({ width: 1280, height: 720 });

    // Put right: 10 chairs. Every amount is there again, worked out from what the lines show.
    await typeInto(page, 'f-lines', 1, 'qty', '10');
    await expect(cell(page, 'f-lines', 1, 'subtotal')).toHaveText('E£ 17,955.00');
    await expect(waiting(page, 'f-untaxed')).toBeHidden();
    await expect(amount(page, 'f-untaxed')).toHaveValue(/67,490\.00/);
    await expect(amount(page, 'f-tax')).toHaveValue(/8,810\.20/);
    await expect(amount(page, 'f-total')).toHaveValue(/76,300\.20/);
    await expect(amount(page, 'f-total')).toBeVisible();
    expect(problems).toEqual([]);
  });

  test('a line opened in its dialog: its Subtotal waits for its Quantity, as its cell in the table does', async ({ page }) => {
    const { problems } = await open(page, 'plain', 'page=order&skin=underline');
    await cell(page, 'f-lines', 1, '__open').getByRole('button', { name: 'Open line' }).click();
    const dialog = page.getByRole('dialog', { name: 'Office chair, ergonomic' });
    await expect(dialog.locator('[data-node="values-subtotal"] input')).toHaveValue('21,546.00');
    await dialog.getByLabel('Quantity', { exact: true }).fill('abc');
    await dialog.getByLabel('Unit price', { exact: true }).focus();
    const subtotal = dialog.locator('[data-node="values-subtotal"] .fd-value-waits');
    await expect(subtotal).toBeVisible();
    await expect(subtotal).toHaveAttribute('title', 'Fix Quantity to see Subtotal');
    await expect(dialog.locator('[data-node="values-subtotal"] input')).toBeHidden();
    await screen(page, 'worked-out-waits-line-dialog', { viewport: true });
    await dialog.getByLabel('Quantity', { exact: true }).fill('10');
    await dialog.getByLabel('Unit price', { exact: true }).focus();
    await expect(subtotal).toBeHidden();
    await expect(dialog.locator('[data-node="values-subtotal"] input')).toHaveValue('17,955.00');
    expect(problems).toEqual([]);
  });

  test('an invoice whose page works its totals out from its lines: they wait for a quantity that does not read', async ({ page }) => {
    const { problems } = await open(page, 'plain', 'page=template-invoice&theme=odoo&record=new');
    await node(page, 'f-lines').getByRole('button', { name: /Add a line/ }).click();
    const line = node(page, 'f-lines').locator('tbody tr[data-line]').first();
    await line.getByLabel('Description', { exact: true }).pressSequentially('Consulting, May');
    await line.getByLabel('Quantity', { exact: true }).fill('10');
    await line.getByLabel('Unit price', { exact: true }).pressSequentially('150');
    await expect(amount(page, 'f-total')).toHaveValue('1,710.00');
    // Letters in the quantity: the page's own sums over the lines wait, as the line's Subtotal does.
    await line.getByLabel('Quantity', { exact: true }).fill('1x0');
    await line.getByLabel('Unit price', { exact: true }).focus();
    for (const id of ['f-untaxed', 'f-tax', 'f-total']) await expect(waiting(page, id)).toBeVisible();
    await expect(waiting(page, 'f-untaxed')).toHaveAttribute('title', 'Fix line 1 of Invoice lines to see Untaxed amount');
    await expect(amount(page, 'f-total')).toBeHidden();
    await screen(page, 'worked-out-waits-invoice', { viewport: true });
    await line.getByLabel('Quantity', { exact: true }).fill('12');
    await line.getByLabel('Unit price', { exact: true }).focus();
    await expect(waiting(page, 'f-total')).toBeHidden();
    await expect(amount(page, 'f-total')).toHaveValue('2,052.00');
    expect(problems).toEqual([]);
  });

  test('a real sales order: its tax totals wait for the line too', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const { problems } = await open(page, 'plain', 'page=real-sale-order&record=7101&skin=underline');
    await expect(node(page, 'f-tax-totals')).toContainText('40,523.00');
    await typeInto(page, 'f-order-line', 1, 'product_uom_qty', '4x');
    await expect(waiting(page, 'f-tax-totals')).toBeVisible();
    await expect(waiting(page, 'f-tax-totals')).toHaveAttribute('title', 'Fix line 1 of Order Lines to see Tax Totals');
    // No label names it on the page: its words are in sight.
    await expect(waiting(page, 'f-tax-totals').locator('.fd-value-waits-why')).toBeVisible();
    await expect(waiting(page, 'f-tax-totals')).toContainText('Fix line 1 of Order Lines to see Tax Totals');
    // The totals worked out before the line said "4x" are not shown.
    await expect(node(page, 'f-tax-totals').locator('.fd-tax-totals')).toBeHidden();
    await node(page, 'f-tax-totals').scrollIntoViewIfNeeded();
    await screen(page, 'worked-out-waits-real-order', { viewport: true });
    await typeInto(page, 'f-order-line', 1, 'product_uom_qty', '5');
    await expect(waiting(page, 'f-tax-totals')).toBeHidden();
    await expect(node(page, 'f-tax-totals').locator('.fd-tax-totals')).toBeVisible();
    await expect(node(page, 'f-tax-totals')).toContainText('VAT 14%');
    expect(problems).toEqual([]);
  });
});
