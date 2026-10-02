import { expect, test, type Page } from '@playwright/test';
import { open, screen } from './support';
import { VARIANTS } from './variants';

/**
 * The lines grid (@fieldia/grid) on the sales order, driven by a real
 * keyboard and mouse in every framework: the React grid's scenarios, kept.
 */

const grid = (page: Page) => page.locator('[data-node="f-lines"]');
const cell = (page: Page, row: number, col: string) => grid(page).locator(`.ag-row[row-index="${row}"] .ag-cell[col-id="${col}"]`);
const editor = (page: Page) => grid(page).locator('.ag-cell-inline-editing input, .ag-popup-editor input').first();
/** Where the grid is editing, as [row, column], or null: an editor in its cell, or a popup editor over the focused cell. */
const editing = (page: Page) =>
  page.evaluate(() => {
    const root = document.querySelector('[data-node="f-lines"]');
    const c = root?.querySelector('.ag-cell-inline-editing') ?? (root?.querySelector('.ag-popup-editor') ? root.querySelector('.ag-cell-focus') : null);
    return c ? [Number(c.closest('.ag-row')?.getAttribute('row-index')), c.getAttribute('col-id')] : null;
  });
const lines = (page: Page) =>
  page.evaluate(() => ((window as any).fieldiaDemo.handle.form.getState().values['line_ids'] as { values: Record<string, unknown> }[]).map((l) => l.values));

for (const variant of VARIANTS) {
  test.describe(`${variant} · lines grid`, () => {
    test.beforeEach(async ({ page }) => {
      await open(page, variant, 'page=order&skin=underline');
      await expect(cell(page, 2, 'subtotal')).toHaveText('EGP 4,560.00');
    });

    test('a number cell selects its value, typing replaces it, and the subtotal follows while still editing', async ({ page }) => {
      await cell(page, 2, 'qty').click();
      await expect(editor(page)).toBeFocused();
      await page.keyboard.type('20');
      await expect(editor(page)).toHaveValue('20');
      await expect(cell(page, 2, 'subtotal')).toHaveText('EGP 7,600.00');
      await expect.poll(() => editing(page)).toEqual([2, 'qty']);
      await screen(page, `${variant}-grid-editing`);
    });

    test('typed text sits where the shown value was, for words and for numbers', async ({ page }) => {
      /** Where the text of a cell (or of the input inside it) starts and ends on screen. */
      const textEdges = (row: number, col: string) =>
        cell(page, row, col).evaluate((el) => {
          const input = el.querySelector('input');
          if (input) {
            const r = input.getBoundingClientRect();
            const measure = document.createElement('span');
            measure.textContent = input.value;
            measure.style.cssText = `position:absolute;visibility:hidden;white-space:pre;font:${getComputedStyle(input).font}`;
            document.body.append(measure);
            const width = measure.getBoundingClientRect().width;
            measure.remove();
            return getComputedStyle(input).textAlign === 'end' || getComputedStyle(input).textAlign === 'right' ? [r.right - width, r.right] : [r.left, r.left + width];
          }
          const range = document.createRange();
          range.selectNodeContents(el);
          const r = range.getBoundingClientRect();
          return [r.left, r.right];
        });
      for (const col of ['name', 'qty']) {
        const [shownStart, shownEnd] = await textEdges(1, col);
        await cell(page, 1, col).click();
        await expect.poll(() => editing(page)).toEqual([1, col]);
        const [typedStart, typedEnd] = await textEdges(1, col);
        // The cell's own frame marks it as edited; the skin's underline would be a second line inside it.
        expect(await editor(page).evaluate((el) => getComputedStyle(el).boxShadow)).toBe('none');
        if (col === 'name') expect(Math.abs(typedStart - shownStart), `${col}: text moved sideways`).toBeLessThanOrEqual(1.5);
        else expect(Math.abs(typedEnd - shownEnd), `${col}: number moved sideways`).toBeLessThanOrEqual(1.5);
        await page.keyboard.press('Escape');
        await expect.poll(() => editing(page)).toBeNull();
      }
    });

    test('Enter moves down a row; Tab moves across, skipping cells that cannot be edited; Shift+Tab goes back', async ({ page }) => {
      await cell(page, 0, 'qty').click();
      await page.keyboard.press('Enter');
      await expect.poll(() => editing(page)).toBeNull();
      await expect(cell(page, 1, 'qty')).toHaveClass(/ag-cell-focus/);
      await page.keyboard.press('Enter');
      await expect.poll(() => editing(page)).toEqual([1, 'qty']);
      await page.keyboard.press('Tab');
      await expect.poll(() => editing(page)).toEqual([1, 'price']);
      await page.keyboard.press('Tab');
      await expect.poll(() => editing(page)).toEqual([1, 'discount']);
      await page.keyboard.press('Tab'); // past VAT, Subtotal and the delete button
      await expect.poll(() => editing(page)).toEqual([2, 'product_id']);
      await page.keyboard.press('Shift+Tab');
      await expect.poll(() => editing(page)).toEqual([1, 'discount']);
    });

    test('Tab on the last cell adds a line and carries on typing into it', async ({ page }) => {
      await cell(page, 2, 'discount').click();
      await page.keyboard.press('Tab');
      await expect(grid(page).locator('.ag-row')).toHaveCount(4);
      await expect.poll(() => editing(page)).toEqual([3, 'product_id']);
      expect((await lines(page)).length).toBe(4);
      // The product search opens its list on arrival: the first Escape closes it,
      // the second takes the line that was only just added away again.
      await expect(grid(page).getByRole('listbox')).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(grid(page).getByRole('listbox')).toBeHidden();
      await expect(grid(page).locator('.ag-row')).toHaveCount(4);
      await page.keyboard.press('Escape');
      await expect(grid(page).locator('.ag-row')).toHaveCount(3);
      expect((await lines(page)).length).toBe(3);
    });

    test('Enter on the last row adds a line', async ({ page }) => {
      await cell(page, 2, 'name').click();
      await page.keyboard.press('Enter');
      await expect(grid(page).locator('.ag-row')).toHaveCount(4);
      await expect.poll(() => editing(page)).toEqual([3, 'product_id']);
    });

    test('Escape puts the cell back as it was', async ({ page }) => {
      await cell(page, 1, 'name').click();
      await page.keyboard.type('Walnut top');
      await expect(editor(page)).toHaveValue('Walnut top');
      await page.keyboard.press('Escape');
      await expect.poll(() => editing(page)).toBeNull();
      await expect(cell(page, 1, 'name')).toHaveText('Oak top, black frame');
      expect((await lines(page))[1]['name']).toBe('Oak top, black frame');
    });

    test('a product is searched inside its cell and picked with the keyboard; its price comes with it', async ({ page }) => {
      await grid(page).getByRole('button', { name: '+ Add a line' }).click();
      await expect.poll(() => editing(page)).toEqual([3, 'product_id']);
      await expect(editor(page)).toBeFocused();
      // The search box covers its cell exactly, so the value underneath never shows through.
      const box = (await grid(page).locator('.ag-popup-editor .fd-grid-editor').boundingBox())!;
      const under = (await cell(page, 3, 'product_id').boundingBox())!;
      for (const side of ['x', 'y', 'width', 'height'] as const) expect(Math.abs(box[side] - under[side]), `search box ${side}`).toBeLessThanOrEqual(1);
      expect(await editor(page).evaluate((el) => getComputedStyle(el).boxShadow)).toBe('none');
      await page.keyboard.type('monitor');
      await expect(grid(page).getByRole('option', { name: 'Monitor arm, dual' })).toBeVisible();
      await screen(page, `${variant}-grid-search`);
      // The first Escape only closes the list (and clears the search); the cell is still being edited.
      await page.keyboard.press('Escape');
      await expect(grid(page).getByRole('listbox')).toBeHidden();
      await expect.poll(() => editing(page)).toEqual([3, 'product_id']);
      await expect(editor(page)).toHaveValue('');
      await page.keyboard.type('monitor');
      await expect(grid(page).getByRole('option', { name: 'Monitor arm, dual' })).toBeVisible();
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('Enter');
      await expect(editor(page)).toHaveValue('Monitor arm, dual');
      await expect(cell(page, 3, 'price')).toHaveText('EGP 749.00');
      await expect(cell(page, 3, 'subtotal')).toHaveText('EGP 749.00');
      // Enter picked the product and nothing else: the cell is still the one being edited.
      await expect.poll(() => editing(page)).toEqual([3, 'product_id']);
      await page.keyboard.press('Tab');
      await expect.poll(() => editing(page)).toEqual([3, 'name']);
      await expect(cell(page, 3, 'product_id')).toHaveText('Monitor arm, dual');
    });

    test('the last line’s product list opens in full below the table, and its bottom choice can be clicked', async ({ page }) => {
      await cell(page, 2, 'product_id').click();
      const last = grid(page).getByRole('option', { name: 'Cable tray, 120 cm' });
      await expect(last).toBeVisible();
      // Nothing clips it: the choice itself is what sits under its middle and just above its bottom edge.
      const onTop = await last.evaluate((el) => {
        const r = el.getBoundingClientRect();
        return [r.top + r.height / 2, r.bottom - 2].every((y) => {
          const at = document.elementFromPoint(r.left + r.width / 2, y);
          return !!at && (at === el || el.contains(at));
        });
      });
      expect(onTop, 'the list is cut off by the table or the card').toBe(true);
      await screen(page, `${variant}-grid-last-line-list`);
      await last.click();
      await expect(editor(page)).toHaveValue('Cable tray, 120 cm');
      await page.keyboard.press('Tab');
      await expect(cell(page, 2, 'product_id')).toHaveText('Cable tray, 120 cm');
    });

    test('yes or no is ticked by a click, or by Space on the focused cell', async ({ page }) => {
      await cell(page, 2, 'taxed').locator('input').click();
      expect((await lines(page))[2]['taxed']).toBe(true);
      await cell(page, 2, 'taxed').click({ position: { x: 4, y: 4 } });
      await page.keyboard.press('Space');
      expect((await lines(page))[2]['taxed']).toBe(false);
    });

    test('the delete button removes a line, and Discard brings it back', async ({ page }) => {
      await cell(page, 0, '__delete').getByRole('button', { name: 'Delete line' }).click();
      await expect(grid(page).locator('.ag-row')).toHaveCount(2);
      await page.getByRole('button', { name: 'Discard' }).click();
      await expect(grid(page).locator('.ag-row')).toHaveCount(3);
      await expect(cell(page, 0, 'product_id')).toHaveText('Office chair, ergonomic');
    });

    test('the delete button is reached with the arrow keys and pressed with Enter', async ({ page }) => {
      await cell(page, 0, 'taxed').click({ position: { x: 4, y: 4 } });
      await page.keyboard.press('ArrowRight');
      await page.keyboard.press('ArrowRight');
      await expect(cell(page, 0, '__delete')).toHaveClass(/ag-cell-focus/);
      await page.keyboard.press('Enter');
      await expect(grid(page).locator('.ag-row')).toHaveCount(2);
      expect((await lines(page)).map((l) => l['name'])).toEqual(['Oak top, black frame', 'Warm white']);
    });
  });
}
