import { type Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { node, open } from './support';

/**
 * A link typed by name in a grid cell, then the cell left with the grid's own keys (Tab, Enter) or a click on another
 * line. The input rules (§2, Link): "Left with words that name nothing: what it held comes back, and it says so"
 * (relations.ts `readWords`). In the grid the editor closes as the cell is left, and its "nothing is called …" is
 * shown under the box of an editor that is gone: the line keeps its old product, the words typed vanish, and nothing
 * on the page says so. The person goes on believing the line names what they typed.
 */

const lines = (page: Page) => page.evaluate(() => (window as any).fieldiaDemo.handle.form.getState().values['line_ids'].map((l: any) => l.values.product_id?.label ?? null));

for (const [how, leave] of [
  ['Tab', async (page: Page) => page.keyboard.press('Tab')],
  ['a click on another line', async (page: Page) => node(page, 'f-lines').locator('.ag-row[row-index="5"] .ag-cell[col-id="name"]').click()],
] as const) {
  test(`a product typed that names nothing, the cell left by ${how}: the grid says so, the words are not dropped unsaid`, async ({ page }) => {
    const { problems } = await open(page, 'plain', 'page=order&skin=outlined');
    const grid = node(page, 'f-lines');
    await grid.locator('.ag-row[row-index="1"] .ag-cell[col-id="product_id"]').dblclick();
    const box = grid.locator('.fd-grid-editor input[role="combobox"]');
    await expect(box).toBeFocused();
    await box.press('Control+A');
    await box.pressSequentially('Narnia');
    await leave(page);
    // The product's editor closed (the grid opens the next cell's, as a spreadsheet does).
    await expect(grid.locator('.fd-grid-editor input[role="combobox"]')).toHaveCount(0);
    // The line keeps its product (leaving puts back what it held) …
    await expect.poll(async () => (await lines(page))[1]).toBe('Office chair, ergonomic');
    // … and says so where the person is: the words they typed, named on the page.
    await expect(page.locator('.fd-form'), 'the words typed are said somewhere on the page').toContainText('Narnia', { timeout: 3000 });
    expect(problems).toEqual([]);
  });
}
