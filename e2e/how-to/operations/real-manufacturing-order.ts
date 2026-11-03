import type { Locator, Page } from '@playwright/test';
import type { DemoReplay } from '../hand';

/**
 * A line's value as a person reads it: the grid's cell on a desktop (by its column), the card's line on the phone (by
 * the column's label), the `row`-th line of the table `grid` (its data-node).
 */
function lineValue(page: Page, phone: boolean, grid: string, row: number, column: string, label: string): Locator {
  const table = page.locator(`[data-node="${grid}"]`);
  return phone
    ? table.locator('.fd-line-card').nth(row).locator(`dt:text-is("${label}") + dd`)
    : table.locator(`.ag-row[row-index="${row}"]:not(.fd-grid-totals) .ag-cell[col-id="${column}"]`);
}

/** The real-manufacturing-order demo's how-to steps, replayed by hand (e2e/how-to.spec.ts). */
export const replay: DemoReplay = {
  timeout: 90_000,
  steps: [
    {
      says: 'Change To Produce to 6: the components, the offcuts and the work',
      async run({ page, press, type, keys, see, phone }) {
        const consume = (row: number) => lineValue(page, phone, 'f-components', row, 'product_uom_qty', 'To Consume');
        await see(consume(3)).toHaveText('16.00');
        await type(page.getByRole('textbox', { name: /^To Produce/ }), '6', { clear: true });
        await keys('Tab');
        await see(page.getByRole('textbox', { name: /^To Produce/ })).toHaveValue('6.00');
        // The components: the legs, 4 a table; the planks, 6.
        await see(consume(3)).toHaveText('24.00');
        await see(consume(1)).toHaveText('36.00');
        // The offcuts, 1.5 kg a table.
        await press(page.getByRole('tab', { name: 'By-Products' }));
        await see(lineValue(page, phone, 'f-byproducts', 0, 'product_uom_qty', 'To Produce')).toHaveText('9.00');
        // The work orders' minutes.
        await press(page.getByRole('tab', { name: 'Work Orders' }));
        for (const [row, minutes] of ['270:00', '540:00', '360:00'].entries()) {
          await see(lineValue(page, phone, 'f-workorders', row, 'duration_expected', 'Expected Duration')).toHaveText(minutes);
        }
      },
    },
    {
      says: 'The glue, consumed by hand, leads the components; each has its ×',
      async run({ page, press, see, phone }) {
        await press(page.getByRole('tab', { name: 'Components' }));
        const components = page.locator('[data-node="f-components"]');
        const first = phone ? components.locator('.fd-line-card').first().locator('.fd-line-card-title') : lineValue(page, phone, 'f-components', 0, 'product_id', 'Product');
        await see(first).toHaveText('Wood glue PVA, 5 L');
        await see(components.getByRole('button', { name: 'Delete line' }).filter({ visible: true })).toHaveCount(5);
      },
    },
    {
      says: 'Press Confirm: the components are reserved, and the badge says',
      async run({ page, press, see, phone }) {
        const components = page.locator('[data-node="f-components"]');
        await press(page.getByRole('button', { name: 'Confirm', exact: true }));
        await see(page.locator('.fd-say', { hasText: 'some components are not available yet' })).toBeVisible();
        await see(page.locator('.fd-header .fd-statusbar [aria-current="step"]')).toHaveText('Confirmed');
        await see(page.locator('[data-node="b-components-missing"]')).toHaveText(/Components not available/);
        // Confirmed, no component can go: no × on any.
        await see(components.getByRole('button', { name: 'Delete line' }).filter({ visible: true })).toHaveCount(0);
        // Reserved: what WH/Stock holds of each, the legs 12 of the 24 the six tables need.
        await see(lineValue(page, phone, 'f-components', 3, 'quantity', 'Quantity')).toHaveText('12.00');
        await see(lineValue(page, phone, 'f-components', 3, 'product_uom_qty', 'To Consume')).toHaveText('24.00');
      },
    },
    {
      says: 'Open Work Orders and press Plan: each operation gets its start',
      async run({ page, press, keys, see, phone }) {
        await press(page.getByRole('tab', { name: 'Work Orders' }));
        await press(page.getByRole('button', { name: 'Plan', exact: true }));
        await see(page.locator('.fd-say', { hasText: 'planned: 3 work orders' })).toBeVisible();
        await see(page.getByRole('button', { name: 'Unplan' })).toBeVisible();
        const orders = page.locator('[data-node="f-workorders"]');
        if (phone) {
          // A card holds a line's chosen columns: each opened, its Start and End.
          for (const name of ['Cutting', 'Assembly', 'Finishing']) {
            await press(orders.getByRole('button', { name, exact: true }));
            const order = page.getByRole('dialog', { name });
            await see(order.getByRole('textbox', { name: /^Start/ })).toHaveValue(/\d{4}, \d{2}:\d{2}/);
            await see(order.getByRole('textbox', { name: /^End/ })).toHaveValue(/\d{4}, \d{2}:\d{2}/);
            await press(order.getByRole('button', { name: 'Close' }).first());
            await see(order).toBeHidden();
          }
        } else {
          // Start and End, columns a person chooses to see.
          await press(orders.getByRole('button', { name: 'Choose columns' }));
          await press(page.getByRole('checkbox', { name: 'Start', exact: true }));
          await press(page.getByRole('checkbox', { name: 'End', exact: true }));
          await keys('Escape');
          for (const row of [0, 1, 2]) {
            await see(lineValue(page, phone, 'f-workorders', row, 'date_start', 'Start')).toHaveText(/\d{4}, \d{2}:\d{2}/);
            await see(lineValue(page, phone, 'f-workorders', row, 'date_finished', 'End')).toHaveText(/\d{4}, \d{2}:\d{2}/);
          }
        }
      },
    },
    {
      says: 'Press Produce All: the tables are made, the components consumed',
      async run({ page, press, see, phone }) {
        await press(page.getByRole('button', { name: 'Produce All' }));
        await see(page.locator('.fd-say', { hasText: /× Dining table, beech, 6 seats produced\./ })).toBeVisible();
        await see(page.locator('.fd-header .fd-statusbar [aria-current="step"]')).toHaveText('Done');
        await see(page.locator('[data-node="b-locked"]')).toBeVisible();
        await see(page.getByRole('button', { name: 'Unlock' })).toBeVisible();
        await press(page.getByRole('tab', { name: 'Components' }));
        for (const row of [0, 1, 2, 3, 4]) {
          const asked = await lineValue(page, phone, 'f-components', row, 'product_uom_qty', 'To Consume').innerText();
          await see(lineValue(page, phone, 'f-components', row, 'quantity', 'Quantity')).toHaveText(asked);
        }
      },
    },
  ],
};
