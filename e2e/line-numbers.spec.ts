import { type Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { node, open, screen } from './support';

/**
 * A line is named as people count lines: the products, never the headings
 * and notes between them. Letters typed in the Office chair's Quantity —
 * the first product, under the "Workstations" heading — are line 1's
 * problem. And while that quantity does not read, nothing worked out from it
 * shows as though it did: the line's Subtotal waits, as the totals do, a
 * dash that says in words which cell to fix; put right, every number is
 * there again.
 */

const grid = (page: Page) => node(page, 'f-lines');
const cell = (page: Page, row: number, column: string) => grid(page).locator(`.ag-row[row-index="${row}"] .ag-cell[col-id="${column}"]`);
const totals = (page: Page) => grid(page).locator('.ag-grid-pinned-bottom-rows .ag-row');
const editor = (page: Page) => grid(page).locator('.fd-grid-editor input').first();
/** The Office chair, the first product: its row is 1, under the Workstations heading at 0. */
const CHAIR = 1;
const LAMP = 5;

test.describe('a sales order’s lines', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'the grid’s keys are Chromium’s here');

  test('letters in the first product’s Quantity: line 1, and its Subtotal and the totals wait in words', async ({ page }) => {
    const { problems } = await open(page, 'plain', 'page=order&skin=underline');
    await expect(cell(page, CHAIR, 'subtotal')).toHaveText('E£ 21,546.00');
    await cell(page, CHAIR, 'qty').click();
    await expect(editor(page)).toBeFocused();
    await page.keyboard.press('Control+A');
    await page.keyboard.type('abc');
    await page.keyboard.press('Enter');
    await expect(cell(page, CHAIR, 'qty')).toHaveText('abc');
    await expect(cell(page, CHAIR, 'qty')).toHaveClass(/fd-grid-invalid/);
    // Named as people count lines: the Workstations heading above it is no line.
    await expect(grid(page).locator('.fd-grid-problems')).toHaveText(/^Line 1: Quantity: “\u2068?abc\u2069?” is not a number$/);
    // Its Subtotal is not the amount for a quantity it no longer shows: it waits, and says why.
    const worked = cell(page, CHAIR, 'subtotal').locator('.fd-grid-worked');
    await expect(worked.locator('[aria-hidden="true"]')).toHaveText('—');
    await expect(worked).toHaveAttribute('title', 'Fix Quantity to see this line’s Subtotal');
    await expect(cell(page, CHAIR, 'subtotal')).not.toContainText('21,546');
    // So do the totals that add it, in the same words they use for the Quantity.
    await expect(totals(page).locator('.ag-cell[col-id="subtotal"] .fd-grid-total')).toHaveAttribute('title', 'Fix line 1 to see this total');
    await expect(totals(page).locator('.ag-cell[col-id="qty"] .fd-grid-total')).toHaveAttribute('title', 'Fix line 1 to see this total');
    // Other lines keep theirs.
    await expect(cell(page, LAMP, 'subtotal')).toHaveText('E£ 4,560.00');
    await expect(grid(page)).not.toContainText('NaN');
    await screen(page, 'line-numbers-letters-in-quantity', { viewport: true });

    // Put right, every number is there again.
    await cell(page, CHAIR, 'qty').click();
    await expect(editor(page)).toBeFocused();
    await page.keyboard.press('Control+A');
    await page.keyboard.type('20');
    await page.keyboard.press('Enter');
    await expect(grid(page).locator('.fd-grid-problems')).toBeHidden();
    await expect(cell(page, CHAIR, 'subtotal')).toHaveText('E£ 35,910.00');
    await expect(totals(page).locator('.ag-cell[col-id="subtotal"]')).toHaveText('E£ 79,020.00');
    expect(problems).toEqual([]);
  });
});
