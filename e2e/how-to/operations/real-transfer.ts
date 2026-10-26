import type { DemoReplay } from '../hand';

/** The real-transfer demo's how-to steps, replayed by hand (e2e/how-to.spec.ts). */
export const replay: DemoReplay = {
  steps: [
    {
      says: 'Add a product in the grid: its unit and the stock on hand come',
      async run({ page, press, keys, see, phone }) {
        const moves = page.locator('[data-node="f-moves"]');
        await press(moves.getByRole('button', { name: '+ Add a Product' }));
        if (phone) {
          // A phone's line is a card: a new one is written in its own dialog.
          const line = page.getByRole('dialog', { name: 'Operations' });
          await press(line.getByRole('combobox', { name: /^Product/ }));
          await page.keyboard.type('screws', { delay: 15 });
          await press(page.getByRole('option', { name: /^Wood screws/ }).first());
          await see(line.getByRole('combobox', { name: /^Unit/ })).toHaveValue('Units');
          await press(line.getByRole('button', { name: 'Save & Close' }));
          await see(line).toBeHidden();
          const card = moves.locator('.fd-line-card').last();
          await see(card.locator('.fd-line-card-title')).toHaveText(/^Wood screws/);
          await see(card.locator('dt:text-is("Unit") + dd')).toHaveText('Units');
          await see(card.locator('dt:text-is("On-Hand Now") + dd')).toHaveText('30.00');
        } else {
          const line = moves.locator('.ag-row[row-index="4"]:not(.fd-grid-totals)');
          await press(line.locator('.ag-cell[col-id="product_id"]'));
          const box = moves.locator('.ag-cell-inline-editing input[role="combobox"], .ag-popup-editor input[role="combobox"]').first();
          await see(box, 'the new line’s Product, open to choose one').toBeFocused();
          await page.keyboard.type('screws', { delay: 15 });
          await press(page.getByRole('option', { name: /^Wood screws/ }).first());
          // Kept by a press outside the grid (Enter or Tab past the line's last cell would start another).
          await press(page.getByRole('tab', { name: 'Operations' }));
          await see(line.locator('.ag-cell[col-id="product_id"]')).toContainText('Wood screws');
          await see(line.locator('.ag-cell[col-id="product_uom"]')).toHaveText('Units');
          await see(line.locator('.ag-cell[col-id="qty_on_hand_now"]')).toHaveText('30.00');
          // One Forecast Report on the new line, as on the others.
          await see(line.getByRole('button', { name: 'Forecast Report' })).toHaveCount(1);
          await keys('Escape');
        }
      },
    },
    {
      says: 'Click Operation Type: opened from Receipts, it offers only incoming',
      async run({ page, press, keys, see, phone }) {
        const type = page.locator('[data-node="f-picking-type"]');
        await press(type.getByRole('combobox'));
        const options = type.getByRole('option');
        await see(options.filter({ hasText: 'Sherkety Furniture: Receipts' })).toHaveCount(1);
        await see(options.filter({ hasText: 'Delivery Orders' })).toHaveCount(0);
        await see(options.filter({ hasText: /Internal/ })).toHaveCount(0);
        // Closed again as it was (a phone's list closes as the next tap lands).
        if (!phone) await keys('Escape');
      },
    },
    {
      says: 'Press Mark as ready: the receipt moves from Draft to Ready',
      async run({ page, press, see, phone }) {
        const at = page.locator('.fd-header .fd-statusbar [aria-current="step"]');
        await see(at).toHaveText('Draft');
        await press(page.getByRole('button', { name: 'Mark as ready' }));
        await see(page.locator('.fd-say', { hasText: 'WH/IN/00042: ready to receive.' })).toBeVisible();
        await see(at).toHaveText('Ready');
        await see(page.getByRole('button', { name: 'Mark as ready' })).toBeHidden();
        // Every line's Quantity, its Demand: the four ordered and the one added.
        const moves = page.locator('[data-node="f-moves"]');
        for (const [row, demand] of ['60.00', '25.00', '16.00', '6.00', '1.00'].entries()) {
          if (phone) {
            const card = moves.locator('.fd-line-card').nth(row);
            await see(card.locator('dt:text-is("Demand") + dd')).toHaveText(demand);
            await see(card.locator('dt:text-is("Quantity") + dd')).toHaveText(demand);
          } else {
            const line = moves.locator(`.ag-row[row-index="${row}"]:not(.fd-grid-totals)`);
            await see(line.locator('.ag-cell[col-id="product_uom_qty"]')).toHaveText(demand);
            await see(line.locator('.ag-cell[col-id="quantity"]')).toHaveText(demand);
          }
        }
      },
    },
    {
      says: 'Set the table legs’ Quantity to 12 of 16, then press Validate',
      async run({ page, press, type, keys, see, phone }) {
        const moves = page.locator('[data-node="f-moves"]');
        if (phone) {
          await press(moves.getByRole('button', { name: 'Table leg, beech, 72 cm', exact: true }));
          const line = page.getByRole('dialog', { name: 'Operations' });
          await see(line.getByRole('textbox', { name: 'Quantity' })).toHaveValue('16.00');
          await type(line.getByRole('textbox', { name: 'Quantity' }), '12', { clear: true });
          await see(line.getByRole('textbox', { name: 'Quantity' })).toHaveValue('12');
          await press(line.getByRole('button', { name: 'Save & Close' }));
          await see(line).toBeHidden();
          await see(moves.locator('.fd-line-card').nth(2).locator('dt:text-is("Quantity") + dd')).toHaveText('12.00');
        } else {
          const quantity = moves.locator('.ag-row[row-index="2"]:not(.fd-grid-totals) .ag-cell[col-id="quantity"]');
          await press(quantity);
          await see(moves.locator('.ag-cell-inline-editing, .ag-popup-editor').first()).toBeVisible();
          await keys('ControlOrMeta+a');
          await page.keyboard.type('12', { delay: 15 });
          await keys('Enter');
          await see(quantity).toHaveText('12.00');
        }
        await press(page.getByRole('button', { name: 'Validate', exact: true }).first());
        await see(page.getByRole('dialog', { name: 'Create Backorder?' })).toBeVisible();
      },
    },
    {
      says: 'Create Backorder? asks what to do with the rest: press Create',
      async run({ page, press, see }) {
        const dialog = page.getByRole('dialog', { name: 'Create Backorder?' });
        await see(dialog.getByText('You have processed less products than the initial demand.')).toBeVisible();
        await press(dialog.getByRole('button', { name: 'Create Backorder' }));
        await see(dialog).toBeHidden();
        await see(page.locator('.fd-say', { hasText: 'Backorder WH/IN/00043 created for the rest of Table leg, beech, 72 cm.' })).toBeVisible();
        await see(page.locator('.fd-header .fd-statusbar [aria-current="step"]')).toHaveText('Done');
      },
    },
  ],
};
