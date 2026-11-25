import { type Locator, type Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { node, open, screen } from './support';

/**
 * The owner's walk of 0.24: the sales order's line dialog opened with the Product list dropped down over Description,
 * Quantity and Unit price; Confirm on an empty invoice opened the customer list over "Customer is required". A box the
 * program takes the focus into — a dialog's first field, a refused save going to the field to fix — keeps its list
 * closed, whatever its kind; a person's click, a word typed, or Alt+Down opens it.
 */

/** Whether the point at a box's middle is the box itself: nothing laid over it. */
async function uncovered(page: Page, box: Locator): Promise<boolean> {
  const at = (await box.boundingBox())!;
  return box.evaluate((el, [x, y]) => {
    const top = el.ownerDocument.elementFromPoint(x, y);
    return !!top && (top === el || el.contains(top));
  }, [at.x + at.width / 2, at.y + at.height / 2] as const);
}

/**
 * A list that stays closed: still closed for as long as a search takes to answer (the demos' lists answer after a
 * moment, as a server's do) — an absence is only seen over time, so it is watched for a while, every tenth of a second.
 */
async function staysClosed(page: Page, list: Locator, box: Locator) {
  for (let i = 0; i < 15; i++) {
    await expect(list).toBeHidden();
    await expect(box).toHaveAttribute('aria-expanded', 'false');
    await page.waitForTimeout(100);
  }
}

test.describe('a box focused by the program keeps its list closed', () => {
  test('a line’s dialog opens on its Product, its list closed over nothing; a click on it opens it', async ({ page }) => {
    const { problems } = await open(page, 'plain', 'page=order&skin=underline');
    const grid = node(page, 'f-lines');
    await grid.locator('.ag-row[row-index="1"] .ag-cell[col-id="__open"]').getByRole('button', { name: 'Open line' }).click();
    const dialog = page.getByRole('dialog', { name: 'Office chair, ergonomic' });
    const product = dialog.locator('[data-node="values-product_id"] input[role="combobox"]');
    await expect(product).toBeFocused();
    await staysClosed(page, dialog.getByRole('listbox'), product);
    // Description, Quantity and Unit price in sight, nothing over them.
    for (const label of ['Description', 'Quantity', 'Unit price']) expect(await uncovered(page, dialog.getByLabel(label, { exact: true })), `${label} is covered`).toBe(true);
    await screen(page, 'focus-lists-closed-line-dialog', { viewport: true });
    // The person's own click opens it.
    await product.click();
    await expect(dialog.getByRole('listbox')).toBeVisible();
    await expect(dialog.getByRole('option', { name: 'Desk lamp, LED' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog.getByRole('listbox')).toBeHidden();
    // Alt+Down, the keys' way.
    await page.keyboard.press('Alt+ArrowDown');
    await expect(dialog.getByRole('listbox')).toBeVisible();
    expect(problems).toEqual([]);
  });

  test('Confirm on an empty invoice: to the customer, said required, its list closed', async ({ page }) => {
    const { problems } = await open(page, 'plain', 'page=template-invoice&theme=odoo&record=new');
    await page.getByRole('button', { name: 'Confirm' }).click();
    const customer = node(page, 'f-partner');
    await expect(customer.locator('.fd-error')).toHaveText('Customer is required');
    const box = customer.locator('input[role="combobox"]');
    await expect(box).toBeFocused();
    await staysClosed(page, customer.getByRole('listbox'), box);
    expect(await uncovered(page, customer.locator('.fd-error'))).toBe(true);
    await screen(page, 'focus-lists-closed-invoice-confirm', { viewport: true });
    // Typed into, it offers what matches.
    await page.keyboard.type('Nile');
    await expect(page.getByRole('option', { name: 'Nile Traders' })).toBeVisible();
    expect(problems).toEqual([]);
  });

  test('Tab into a link, a choice of several or tags: no list drops until asked', async ({ page }) => {
    const { problems } = await open(page, 'plain', 'page=order&skin=underline');
    const partner = node(page, 'f-partner').locator('input[role="combobox"]');
    await partner.focus();
    await expect(partner).toBeFocused();
    await staysClosed(page, node(page, 'f-partner').getByRole('listbox'), partner);
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Tab');
    await expect(partner).toBeFocused();
    await staysClosed(page, node(page, 'f-partner').getByRole('listbox'), partner);
    await page.keyboard.press('ArrowDown');
    await expect(node(page, 'f-partner').getByRole('listbox')).toBeVisible();
    expect(problems).toEqual([]);
  });
});
