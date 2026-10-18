import { type Locator, type Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { node, open, screen } from './support';

/**
 * Rows copied from a spreadsheet and pasted on a table of lines, as the owner's walk of 0.25 pasted them (findings 3
 * and 4): on the sales order's grid and the purchase order's plain table alike. Each row goes on its own line: a
 * product named exactly as the shop names it is read through the source's search, as typing it reads it; a row whose
 * product reads as none is not pasted at all — never its description and price laid on another product's line — and
 * the note says why. A block pasted in a cell a click opened for typing spreads as on a chosen cell; one value stays
 * in the box.
 */

// The clipboard is the browser's, one for every page a worker has open: these tests take turns with it.
test.describe.configure({ mode: 'default' });

type Values = Record<string, unknown>;
type Line = { key: string; values: Values };
const linesOf = (page: Page, field: string) => page.evaluate((name) => (window as any).fieldiaDemo.handle.form.getState().values[name] as Line[], field);
const productOf = (line: Line | undefined) => (line?.values['product_id'] as { label: string } | null)?.label ?? null;

/** Text put on the clipboard, then pasted with Ctrl+V where the focus is. */
async function paste(page: Page, text: string) {
  await page.evaluate((t) => navigator.clipboard.writeText(t), text);
  await page.keyboard.press('Control+V');
}

test.beforeEach(async ({ context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
});

test.describe('the sales order’s grid', () => {
  const grid = (page: Page) => node(page, 'f-lines');
  const cell = (page: Page, row: number, column: string) => grid(page).locator(`.ag-row[row-index="${row}"] .ag-cell[col-id="${column}"]`);
  const note = (page: Page) => grid(page).locator('.fd-grid-paste-note');
  /** A cell chosen, not edited: clicked (which opens its editor), then Escape. */
  async function choose(page: Page, row: number, column: string) {
    await cell(page, row, column).click();
    await expect(grid(page).locator('.fd-grid-editor')).toHaveCount(1);
    await page.keyboard.press('Escape');
    await expect(grid(page).locator('.fd-grid-editor')).toHaveCount(0);
    await expect(cell(page, row, column)).toBeFocused();
  }

  test('two rows pasted on the desk lamp’s Product: each product on its own line, named as the shop names it', async ({ page }) => {
    const { problems } = await open(page, 'plain', 'page=order&skin=outlined');
    const before = await linesOf(page, 'line_ids');
    expect(productOf(before[5])).toBe('Desk lamp, LED');
    await choose(page, 5, 'product_id');
    await paste(page, 'Monitor arm, dual\tTwo screens\t3\t1200\nCable tray, 120 cm\tUnder the desks\t6\t250\n');
    await expect(note(page)).toHaveText('Pasted into 8 cells. 1 line added.');
    const after = await linesOf(page, 'line_ids');
    expect(after).toHaveLength(before.length + 1);
    expect([productOf(after[5]), after[5].values['name'], after[5].values['qty'], after[5].values['price']]).toEqual(['Monitor arm, dual', 'Two screens', 3, 1200]);
    expect([productOf(after[6]), after[6].values['name'], after[6].values['qty'], after[6].values['price']]).toEqual(['Cable tray, 120 cm', 'Under the desks', 6, 250]);
    await expect(cell(page, 5, 'product_id')).toContainText('Monitor arm, dual');
    await screen(page, 'paste-rows-grid-products', { viewport: true });
    expect(problems).toEqual([]);
  });

  test('a row whose product reads as none is not pasted at all, and the note says why; the others go in', async ({ page }) => {
    const { problems } = await open(page, 'plain', 'page=order&skin=outlined');
    const before = await linesOf(page, 'line_ids');
    await choose(page, 5, 'product_id');
    await paste(page, 'Laser printer\tTwo screens\t3\t1200\nCable tray, 120 cm\tUnder the desks\t6\t250');
    await expect(note(page)).toHaveText(
      'Pasted into 4 cells. 1 line added. Not pasted: the row starting “⁨Laser printer⁩”, none of it (Product: nothing is called “⁨Laser printer⁩”)'
    );
    const after = await linesOf(page, 'line_ids');
    // The desk lamp's line as it was: none of the refused row on it.
    expect(after[5].values).toEqual(before[5].values);
    expect(productOf(after[6])).toBe('Cable tray, 120 cm');
    await screen(page, 'paste-rows-grid-refused', { viewport: true });
    expect(problems).toEqual([]);
  });

  test('a block pasted in a cell a click opened for typing spreads across and down; one value stays in the box', async ({ page }) => {
    const { problems } = await open(page, 'plain', 'page=order&skin=outlined');
    const before = await linesOf(page, 'line_ids');
    await cell(page, 5, 'name').click();
    const editor = grid(page).locator('.fd-grid-editor input').first();
    await expect(editor).toBeFocused();
    await paste(page, 'Warm white, dimmable\t10\t420\nUnder the desks\t6\t250');
    await expect(grid(page).locator('.fd-grid-editor')).toHaveCount(0);
    await expect(note(page)).toHaveText('Pasted into 6 cells. 1 line added.');
    const after = await linesOf(page, 'line_ids');
    expect([productOf(after[5]), after[5].values['name'], after[5].values['qty'], after[5].values['price']]).toEqual(['Desk lamp, LED', 'Warm white, dimmable', 10, 420]);
    expect(after).toHaveLength(before.length + 1);
    expect([after[6].values['name'], after[6].values['qty'], after[6].values['price']]).toEqual(['Under the desks', 6, 250]);
    await expect(cell(page, 5, 'name')).toBeFocused();
    await screen(page, 'paste-rows-grid-open-cell', { viewport: true });
    // One value pasted in an open cell is the box's, as typing it is.
    await cell(page, 5, 'name').click();
    await expect(editor).toBeFocused();
    await editor.press('Control+A');
    await paste(page, 'Brass, dimmable');
    await expect(editor).toHaveValue('Brass, dimmable');
    await page.keyboard.press('Enter');
    await expect.poll(async () => (await linesOf(page, 'line_ids'))[5].values['name']).toBe('Brass, dimmable');
    expect(problems).toEqual([]);
  });
});

test.describe('the purchase order’s plain table', () => {
  const table = (page: Page) => node(page, 'f-lines');
  const box = (page: Page, row: number, column: string): Locator => table(page).locator(`tbody tr[data-line]`).nth(row).locator(`td[data-column="${column}"] input`).first();
  const note = (page: Page) => table(page).locator('.fd-lines-paste-note');

  test('rows pasted in a product’s box: each its own line, exact names read; a name of none refuses its row whole', async ({ page }) => {
    const { problems } = await open(page, 'plain', 'page=template-purchase-order&theme=ant&record=new');
    await table(page).locator('.fd-lines-add').first().click();
    await box(page, 0, 'product_id').click();
    await paste(page, 'Office chair, ergonomic\tBlack mesh\t2\t180\nSomething else\tNo such product\t1\t1\nDesk lamp, LED\tWarm white\t4\t25');
    await expect(note(page)).toHaveText(
      'Pasted into 8 cells. 1 line added. Not pasted: the row starting “⁨Something else⁩”, none of it (Product: nothing is called “⁨Something else⁩”)'
    );
    const lines = await linesOf(page, 'line_ids');
    // The second row adds no line: the third goes on the next one.
    expect(lines.map((line) => [productOf(line), line.values['name'] ?? null, line.values['quantity'], line.values['price_unit'] ?? null])).toEqual([
      ['Office chair, ergonomic', 'Black mesh', 2, 180],
      ['Desk lamp, LED', 'Warm white', 4, 25],
    ]);
    await expect(box(page, 0, 'product_id')).toHaveValue('Office chair, ergonomic');
    await screen(page, 'paste-rows-plain-products', { viewport: true });
    expect(problems).toEqual([]);
  });
});
