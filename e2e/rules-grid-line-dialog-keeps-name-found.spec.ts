import { type Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { node, open } from './support';

/**
 * A grid line's product typed by name, then the line opened (↗) before the name is found — a server that takes a
 * moment to answer, as any does. Leaving the cell reads the name (input rules §2, Grid cells: "the kind's box in the
 * cell's editor"; Link: W), and the record it names is taken into the line once found. The line's dialog was drawn
 * from the line as it stood before that answer came (lines.ts `openLineDialog`: `values: line.values`), so its
 * Save & Close writes the OLD product back over the one the person typed and the lookup found: the line changes back
 * without a word. The product the person typed, and the lookup found, must stay (or the dialog must show it).
 */

const productOf = (page: Page, row: number) => page.evaluate((r) => (window as any).fieldiaDemo.handle.form.getState().values['line_ids'][r].values.product_id?.label ?? null, row);

test('a product typed, the line opened while it is looked up, Save & Close: the product found is kept', async ({ page }) => {
  const { problems } = await open(page, 'plain', 'page=order&skin=outlined');
  // A server that answers a search in 700 ms.
  await page.evaluate(() => {
    const source = (window as any).fieldiaDemo.dataSource;
    const search = source.search.bind(source);
    source.search = async (request: unknown) => {
      await new Promise((done) => setTimeout(done, 700));
      return search(request);
    };
  });
  const grid = node(page, 'f-lines');
  await grid.locator('.ag-row[row-index="1"] .ag-cell[col-id="product_id"]').dblclick();
  const box = grid.locator('.fd-grid-editor input[role="combobox"]');
  await expect(box).toBeFocused();
  await box.press('Control+A');
  await box.pressSequentially('Cable tray, 120 cm');
  // The line opened at once, its product still being looked up.
  await grid.locator('.ag-row[row-index="1"] .fd-line-open').first().click();
  const dialog = page.locator('.fd-form-dialog');
  await expect(dialog).toBeVisible();
  // The lookup answers meanwhile: the line takes the product typed.
  await expect.poll(() => productOf(page, 1), { timeout: 5000 }).toBe('Cable tray, 120 cm');
  await dialog.getByRole('button', { name: /Save & Close/ }).click();
  await expect(dialog).toBeHidden();
  expect(await productOf(page, 1), 'the product typed and found, never the old one written back unsaid').toBe('Cable tray, 120 cm');
  expect(problems).toEqual([]);
});
