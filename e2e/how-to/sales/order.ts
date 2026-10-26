import type { Page } from '@playwright/test';
import type { DemoReplay } from '../hand';
import { box } from './support';

/** The order's lines grid, and a cell of it by its row (as the grid numbers them, from 0) and its column's id. */
const lines = (page: Page) => page.locator('[data-node="f-lines"]');
const cell = (page: Page, row: number, col: string) => lines(page).locator(`.ag-row[row-index="${row}"] .ag-cell[col-id="${col}"]`);
/** The lines' rows, the totals row pinned under them left out. */
const lineRows = (page: Page) => lines(page).locator('.ag-row:not(.fd-grid-totals)');
/** A line's row by where it is in the grid, counted from 0. */
const lineRow = (page: Page, row: number) => lines(page).locator(`.ag-row[row-index="${row}"]:not(.fd-grid-totals)`);
/** The box a grid cell is edited in, while it is. */
const cellEditor = (page: Page) => lines(page).locator('.ag-cell-inline-editing input, .ag-popup-editor input').first();

/** The sample order's rows: a section, two items, a section and a note, and one more item. */
const CHAIR = 1, DESK = 2, LAMP = 5;

/** The order demo's how-to steps, replayed by hand (e2e/how-to.spec.ts). */
export const replay: DemoReplay = {
  steps: [
    {
      says: 'Click a Quantity cell and type: the subtotal and the totals under the grid follow as you type',
      async run({ page, phone, press, type, keys, see }) {
        if (phone) {
          // On a phone the lines are cards: a card opens its line in a dialog, where Quantity is a box of its own —
          // emptied, then typed in, as a person types a new number.
          await press(lines(page).getByRole('button', { name: 'Desk lamp, LED', exact: true }));
          const dialog = page.getByRole('dialog', { name: 'Order lines' });
          await type(box(dialog, 'Quantity'), '20', { clear: true });
          await see(box(dialog, 'Quantity')).toHaveValue('20');
          await see(box(dialog, 'Subtotal')).toHaveValue('7,600.00');
          await press(dialog.getByRole('button', { name: 'Save & Close' }));
          await see(dialog).toBeHidden();
          await see(lines(page).getByText('Quantity: 38.00 · Subtotal: E£ 67,696.00')).toBeVisible();
        } else {
          // The cell's 12.00, taken out, then 20 typed in its place: the box keeps what is typed while the totals follow.
          await press(cell(page, LAMP, 'qty'));
          await see(cellEditor(page)).toBeFocused();
          await keys('Backspace');
          await see(cellEditor(page)).toHaveValue('');
          await page.keyboard.type('20', { delay: 15 });
          await see(cellEditor(page)).toHaveValue('20');
          // The line, the grid's totals row and the totals under the grid, while the cell is still being typed in.
          await see(cell(page, LAMP, 'subtotal')).toHaveText('E£ 7,600.00');
          const totals = lines(page).locator('.ag-grid-pinned-bottom-rows .ag-row');
          await see(totals.locator('.ag-cell[col-id="qty"]')).toHaveText('38.00');
          await see(totals.locator('.ag-cell[col-id="subtotal"]')).toHaveText('E£ 67,696.00');
          await see(cellEditor(page)).toBeFocused();
        }
        // The lamp is not taxed: the VAT stays, the untaxed amount and the total take its E£ 3,040.00.
        await see(box(page, 'Untaxed amount')).toHaveValue('67,696.00');
        await see(box(page, 'VAT')).toHaveValue('8,413.44');
        await see(box(page, 'Total')).toHaveValue('76,109.44');
      },
    },
    {
      says: 'Press Enter to go down, Tab to go across; Tab past the last cell adds a line',
      notOnPhone: 'a phone has no Enter or Tab to move about the grid with: its lines are cards, each opened in a dialog',
      async run({ page, press, keys, see }) {
        await press(cell(page, CHAIR, 'qty'));
        await see(cellEditor(page)).toBeFocused();
        await keys('Enter');
        await see(cell(page, DESK, 'qty')).toHaveClass(/ag-cell-focus/);
        await keys('Enter');
        await see(cell(page, DESK, 'qty').locator('input')).toBeFocused();
        await keys('Tab');
        await see(cell(page, DESK, 'price').locator('input')).toBeFocused();
        await keys('Escape');
        // The lamp's last cell a person types in is its discount: Tab past it adds a line, its product to pick.
        await press(cell(page, LAMP, 'discount'));
        await see(cell(page, LAMP, 'discount').locator('input')).toBeFocused();
        await see(lineRows(page)).toHaveCount(6);
        await keys('Tab');
        await see(lineRows(page)).toHaveCount(7);
        await see(lineRow(page, 6)).toBeVisible();
        await see(lines(page).locator('.fd-grid-editor input[role="combobox"]')).toBeFocused();
        // Escape, twice: the product's list closed, then the line only just added taken away again.
        await keys('Escape', 'Escape');
        await see(lineRows(page)).toHaveCount(6);
      },
    },
    {
      says: 'Drag a line by its handle to put it elsewhere, sections and notes too',
      notOnPhone: 'a drag: Playwright’s WebKit has no touch drag, and a phone’s cards have no handle',
      async run({ page, drag, see }) {
        /** The lines as they stand on the screen, top to bottom: the grid places its rows, it does not reorder them. */
        const order = async (names: (string | RegExp)[]) => {
          for (const [i, name] of names.entries()) await see(cell(page, i, 'product_id')).toHaveText(name);
        };
        const handle = (row: number) => cell(page, row, '__handle').locator('.ag-drag-handle');
        await order(['Workstations', 'Office chair, ergonomic', 'Standing desk 160 × 80', 'Lighting', /^Warm white only/, 'Desk lamp, LED']);
        // The lamp, by its handle, onto the desk's row.
        await drag(handle(LAMP), lineRow(page, DESK));
        await order(['Workstations', 'Office chair, ergonomic', 'Desk lamp, LED', 'Standing desk 160 × 80', 'Lighting', /^Warm white only/]);
        // The Lighting section, then the note, each by its handle, to the top.
        await drag(handle(4), lineRow(page, 0));
        await order(['Lighting', 'Workstations', 'Office chair, ergonomic', 'Desk lamp, LED', 'Standing desk 160 × 80', /^Warm white only/]);
        await drag(handle(5), lineRow(page, 1));
        await order(['Lighting', /^Warm white only/, 'Workstations', 'Office chair, ergonomic', 'Desk lamp, LED', 'Standing desk 160 × 80']);
      },
    },
    {
      says: 'Open the columns menu at the end of the header row to show or hide columns; the choice is remembered',
      notOnPhone: 'a phone shows the lines as cards, every field on each: there is no header row and no columns menu',
      async run({ page, press, see }) {
        const header = (col: string) => lines(page).locator(`.ag-header-cell[col-id="${col}"]`);
        await see(header('discount')).toBeVisible();
        await see(header('lead_days')).toHaveCount(0);
        await press(lines(page).getByRole('button', { name: 'Choose columns' }));
        const chooser = lines(page).getByRole('group', { name: 'Choose columns' });
        await see(chooser).toBeVisible();
        await see(chooser.getByLabel('Disc. %')).toBeChecked();
        await press(chooser.getByLabel('Disc. %'));
        await press(chooser.getByLabel('Lead time (days)'));
        await see(header('discount')).toHaveCount(0);
        await see(header('lead_days')).toBeVisible();
        // The chair, fourth since the lines were dragged: its lead time in the column shown.
        await see(cell(page, 3, 'product_id')).toHaveText('Office chair, ergonomic');
        await see(cell(page, 3, 'lead_days')).toHaveText('14');
        // Remembered: the demo opened again, its columns as they were left.
        await page.reload();
        await see(cell(page, LAMP, 'subtotal')).toHaveText('E£ 4,560.00');
        await see(header('discount')).toHaveCount(0);
        await see(header('lead_days')).toBeVisible();
      },
    },
    {
      says: 'Open a line in its dialog with the arrow at its end, to see all of its fields at once',
      async run({ page, phone, press, see }) {
        if (phone) await press(lines(page).getByRole('button', { name: 'Office chair, ergonomic', exact: true }));
        else await press(cell(page, CHAIR, '__open').getByRole('button', { name: 'Open line' }));
        const dialog = page.getByRole('dialog', { name: 'Order lines' });
        await see(dialog).toBeVisible();
        await see(dialog.getByRole('combobox', { name: 'Product' })).toHaveValue('Office chair, ergonomic');
        await see(box(dialog, 'Description')).toHaveValue('Black mesh back');
        await see(box(dialog, 'Quantity')).toHaveValue('12.00');
        await see(box(dialog, 'Unit price')).toHaveValue('1,890.00');
        await see(box(dialog, 'Disc. %')).toHaveValue('5.0');
        await see(dialog.getByRole('checkbox', { name: 'VAT 14%' })).toBeChecked();
        await see(box(dialog, 'Lead time (days)')).toHaveValue('14');
        await see(box(dialog, 'Subtotal')).toHaveValue('21,546.00');
        await press(dialog.getByRole('button', { name: 'Discard' }));
        await see(dialog).toBeHidden();
      },
    },
  ],
};
