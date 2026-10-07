import { expect, test, type Page } from '@playwright/test';
import { expectNoSidewaysScroll, node, open, screen } from './support';
import { VARIANTS } from './variants';

/**
 * The operations lane's real pages — Sherkety ERP's project task, warehouse
 * receipt and manufacturing order, rebuilt in Fieldia — used by a person in
 * every framework's demo: time logged and a sub-task added on the task; the
 * receipt marked to do, received short and validated with a backorder; the
 * manufacturing order confirmed, its components' availability seen, and
 * produced. Each page opens without an error, at a desk's width and one at a
 * phone's.
 */

const WIDE = { width: 1400, height: 900 };
const PHONE = { width: 390, height: 844 };
const TASK = 'page=real-task&record=5201&skin=underline';
const TRANSFER = 'page=real-transfer&record=5301&skin=underline';
const PRODUCTION = 'page=real-manufacturing-order&record=5401&skin=underline';

const value = (page: Page, name: string) => page.evaluate((n) => (window as any).fieldiaDemo.handle.form.getState().values[n], name);
const lineValues = (page: Page, name: string) =>
  page.evaluate((n) => ((window as any).fieldiaDemo.handle.form.getState().values[n] as { values: Record<string, unknown> }[]).map((l) => l.values), name);
const saved = (page: Page, model: string, id: number) => page.evaluate(([m, i]) => (window as any).fieldiaDemo.dataSource.records[m as string][i as number], [model, id]);
const cell = (page: Page, grid: string, row: number, column: string) => node(page, grid).locator(`.ag-row[row-index="${row}"]:not(.fd-grid-totals) .ag-cell[col-id="${column}"]`);
const toast = (page: Page, words: string | RegExp) => page.locator('.fd-say', { hasText: words });
const stage = (page: Page, name: string) => page.locator('.fd-header .fd-statusbar').getByText(name, { exact: true });

/** Type into a grid cell as a person does: a click opens it, what is typed replaces it, Enter keeps it. */
async function typeIn(page: Page, grid: string, row: number, column: string, text: string, keep = 'Enter') {
  await cell(page, grid, row, column).click();
  await expect(node(page, grid).locator('.ag-cell-inline-editing, .ag-popup-editor').first()).toBeVisible();
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.type(text);
  if (keep) await page.keyboard.press(keep);
}

/** Wait for the header buttons' steps to finish: the record saved, nothing left to save. */
async function settled(page: Page) {
  await page.evaluate(() => (window as any).fieldiaDemo.handle.form.settled());
}

for (const variant of VARIANTS) {
  test.describe(`${variant} · real operations`, () => {
    test('project task: time logged in the timesheets grid adds up, and a new sub-task takes the task’s project', async ({ page }) => {
      await page.setViewportSize(WIDE);
      const { problems } = await open(page, variant, TASK);
      await expect.poll(() => value(page, 'name')).toBe('Fit acoustic ceiling panels, meeting rooms A and B');
      await expect(stage(page, 'In Progress').locator('xpath=ancestor-or-self::*[@aria-current="step"]')).toHaveCount(1);
      // The stages are the task's project's (its project_ids contain it), searched once its record has loaded;
      // Done and Cancelled are folded under ⋯, and each step says how long the task stood in it.
      await expect(page.locator('.fd-header .fd-statusbar')).toContainText('Client Review');
      await expect(stage(page, 'Done')).toBeHidden();
      await expect(page.locator('.fd-header .fd-statusbar')).toContainText(/In Progress\s*3d/);
      // Stat buttons as Flectra shows them: the sub-tasks counted, no Parent Task on a task without a parent.
      await expect(page.locator('button[data-node="subtasks"] .fd-stat-value').first()).toHaveText('3');
      await expect(page.locator('button[data-node="action_open_parent_task"]')).toBeHidden();
      // The priority star toggles, as Flectra's: a second click takes it away, and no "Clear selection" shows.
      const star = node(page, 'f-priority').getByRole('radio');
      const priority = await value(page, 'priority');
      await star.click();
      expect(await value(page, 'priority')).toBe(priority === '1' ? '0' : '1');
      await expect(node(page, 'f-priority').locator('.fd-choice-clear')).toBeHidden();
      await star.click();
      expect(await value(page, 'priority')).toBe(priority);
      if (variant === 'plain') await screen(page, 'real-task');

      // Timesheets: 17.5 hours logged; another 2.5 makes 20, and the hours under the grid follow.
      await page.getByRole('tab', { name: 'Timesheets' }).click();
      // Hours as Flectra's float_time.
      await expect(node(page, 'f-effective')).toContainText('17:30');
      await node(page, 'f-timesheets').getByRole('button', { name: /Add a line/ }).click();
      await expect(node(page, 'f-timesheets').locator('.ag-row[row-index="3"]')).toBeVisible();
      // Enter or Tab past the last cell would start another line: a click outside the grid keeps this one.
      await typeIn(page, 'f-timesheets', 3, 'name', 'Fit the edge trims, room A', 'Tab');
      await typeIn(page, 'f-timesheets', 3, 'unit_amount', '2.5', '');
      await page.getByRole('tab', { name: 'Timesheets' }).click();
      await expect(node(page, 'f-effective')).toContainText('20:00');
      await expect(node(page, 'f-total-hours')).toContainText('30:30');
      await expect(node(page, 'f-remaining')).toContainText('09:30');
      // The app's onchange gave the line its employee: the first assignee.
      await expect.poll(async () => (await lineValues(page, 'timesheet_ids'))[3]?.['employee_id']).toMatchObject({ label: 'Karim Fathy' });
      if (variant === 'plain') await screen(page, 'real-task-timesheets');

      // Sub-tasks: a fourth one, which takes the task's project and customer.
      await page.getByRole('tab', { name: 'Sub-tasks' }).click();
      await node(page, 'f-subtasks').getByRole('button', { name: 'Add a sub-task' }).click();
      await expect(node(page, 'f-subtasks').locator('.ag-row[row-index="3"]')).toBeVisible();
      // A whole line is edited at once here: a click outside the grid keeps it.
      await typeIn(page, 'f-subtasks', 3, 'name', 'Snag walk, both rooms', '');
      await page.getByRole('tab', { name: 'Sub-tasks' }).click();
      await expect.poll(async () => (await lineValues(page, 'child_ids'))[3]).toMatchObject({ name: 'Snag walk, both rooms', project_id: { label: 'Nile Towers 12th floor fit-out' }, state: '01_in_progress' });
      await expect(page.locator('button[data-node="subtasks"] .fd-stat-value').first()).toHaveText('4');

      // Saved: both new lines reach the data source.
      await page.keyboard.press('ControlOrMeta+Enter');
      await expect.poll(async () => ((await saved(page, 'project.task', 5201)) as { child_ids: unknown[] }).child_ids.length).toBe(4);
      expect(((await saved(page, 'project.task', 5201)) as { timesheet_ids: unknown[] }).timesheet_ids).toHaveLength(4);

      // Sent for approval: the app answers, the approver's buttons and the badge appear.
      await page.getByRole('button', { name: 'Mark Done / Send for Approval' }).click();
      await expect(toast(page, 'Submitted for approval to Salma Nabil.')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Approve', exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Request Changes' })).toBeVisible();
      await expect(page.locator('[data-node="b-approval-waiting"]')).toBeVisible();
      await settled(page);
      expect(await value(page, 'approval_status')).toBe('to_approve');
      expect(problems).toEqual([]);
    });

    test('project task: Flectra’s decorations, groups and lists', async ({ page }) => {
      await page.setViewportSize(WIDE);
      let { problems } = await open(page, variant, TASK);
      await expect.poll(() => value(page, 'name')).toBe('Fit acoustic ceiling panels, meeting rooms A and B');
      // Sub-tasks with the closed ones under them, as Flectra's two counts; the tags in their colours, the assignees with faces.
      await expect(page.locator('button[data-node="subtasks"]')).toContainText('Closed');
      await expect(node(page, 'f-tags').locator('[data-color]')).toHaveCount(2);
      await expect(node(page, 'f-users').locator('.fd-link-avatar')).toHaveCount(2);
      // Allocated time on one line: 40:00 (incl. 28:00 on Sub-tasks).
      await expect(node(page, 'f-allocated').locator('input')).toHaveValue('40:00');
      await expect(node(page, 'allocated-row')).toContainText('28:00');
      // Developer-mode Extra Info is not this person's (base.group_no_one).
      await expect(page.getByRole('tab', { name: 'Extra Info' })).toHaveCount(0);

      // Timesheets: more than 24 hours in a line is red, as Flectra's decoration.
      await page.getByRole('tab', { name: 'Timesheets' }).click();
      await typeIn(page, 'f-timesheets', 0, 'unit_amount', '25', '');
      await page.getByRole('tab', { name: 'Timesheets' }).click();
      await expect(cell(page, 'f-timesheets', 0, 'unit_amount')).toHaveClass(/fd-tone-danger/);
      await expect(cell(page, 'f-timesheets', 0, 'unit_amount')).toHaveText('25:00');

      // Sub-tasks: a closed one is muted; Blocked By lists the linked tasks in columns.
      await page.getByRole('tab', { name: 'Sub-tasks' }).click();
      await expect(node(page, 'f-subtasks').locator('.ag-row[row-index="0"]:not(.fd-grid-totals)').first()).toHaveClass(/fd-tone-muted/);
      await page.getByRole('tab', { name: 'Blocked By' }).click();
      await expect(node(page, 'f-depend-on')).toContainText('Electrical first fix, meeting rooms');
      await expect(node(page, 'f-depend-on')).toContainText('Done');
      expect(problems).toEqual([]);

      // Delete, as project_task_form's: a task with sub-tasks warns that they go too; No keeps it.
      await page.locator('.fd-record-bar .fd-record-gear').click();
      await page.getByRole('menuitem', { name: 'Delete' }).click();
      const question = page.getByRole('alertdialog');
      await expect(question).toContainText('Deleting a task will also delete its associated sub-tasks.');
      await question.getByRole('button', { name: 'Cancel' }).click();
      await expect.poll(() => value(page, 'name')).toBe('Fit acoustic ceiling panels, meeting rooms A and B');

      // The Sub-tasks button lists them, in the task's place.
      ({ problems } = await open(page, variant, TASK));
      await expect.poll(() => value(page, 'name')).toBe('Fit acoustic ceiling panels, meeting rooms A and B');
      await page.locator('button[data-node="subtasks"]').click();
      await expect(page.locator('.fd-list-row')).toHaveCount(3);
      expect(problems).toEqual([]);

      // Someone without the project manager's group sends for approval, but cannot approve.
      ({ problems } = await open(page, variant, `${TASK}&roles=base.group_user`));
      await expect.poll(() => value(page, 'name')).toBe('Fit acoustic ceiling panels, meeting rooms A and B');
      await page.getByRole('button', { name: 'Mark Done / Send for Approval' }).click();
      await expect(toast(page, 'Submitted for approval to Salma Nabil.')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Approve', exact: true })).toBeHidden();
      await expect(page.getByRole('tab', { name: 'Timesheets' })).toHaveCount(0);
      expect(problems).toEqual([]);
    });

    test('warehouse receipt: marked to do, received short, validated with a backorder', async ({ page }) => {
      await page.setViewportSize(WIDE);
      const { problems } = await open(page, variant, TRANSFER);
      await expect.poll(() => value(page, 'name')).toBe('WH/IN/00042');
      // A receipt: its partner is "Receive From", and it has no source location to show.
      await expect(node(page, 'f-partner-incoming')).toContainText('Receive From');
      await expect(node(page, 'f-partner-outgoing')).toBeHidden();
      await expect(node(page, 'f-location')).toBeHidden();
      await expect(cell(page, 'f-moves', 2, 'product_uom_qty')).toHaveText('16.00');
      // The grid's add button in the page's words, as Flectra's.
      await expect(node(page, 'f-moves').locator('.fd-lines-add')).toHaveText(['+ Add a Product']);
      if (variant === 'plain') await screen(page, 'real-transfer');

      await page.getByRole('button', { name: 'Mark as Todo' }).click();
      await expect(toast(page, 'WH/IN/00042: marked as to do.')).toBeVisible();
      await expect(page.locator('.fd-header .fd-statusbar [aria-current="step"]')).toHaveText('Ready');
      await expect(page.getByRole('button', { name: 'Mark as Todo' })).toBeHidden();
      await expect(cell(page, 'f-moves', 2, 'quantity')).toHaveText('16.00');
      await settled(page);

      // Only 12 table legs of 16 arrive.
      await typeIn(page, 'f-moves', 2, 'quantity', '12');
      await expect.poll(async () => (await lineValues(page, 'move_ids_without_package'))[2]?.['quantity']).toBe(12);
      await page.getByRole('button', { name: 'Validate', exact: true }).first().click();
      const dialog = page.getByRole('dialog', { name: 'Create Backorder?' });
      await expect(dialog).toBeVisible();
      await expect(dialog.getByText('You have processed less products than the initial demand.')).toBeVisible();
      // The wizard's own buttons, as Flectra's footer: Create Backorder, No Backorder, Discard.
      await expect(dialog.getByRole('button', { name: 'No Backorder' })).toBeVisible();
      await expect(dialog.getByRole('button', { name: 'Discard' })).toBeVisible();
      if (variant === 'plain') await screen(page, 'real-transfer-backorder', { viewport: true });
      await dialog.getByRole('button', { name: 'Create Backorder' }).click();
      await expect(dialog).toBeHidden();
      await expect(toast(page, 'Backorder WH/IN/00043 created for the rest of Table leg, beech, 72 cm.')).toBeVisible();
      await expect(page.locator('.fd-header .fd-statusbar [aria-current="step"]')).toHaveText('Done');
      await expect(node(page, 'f-date-done')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Return' })).toBeVisible();
      await settled(page);
      const record = (await saved(page, 'stock.picking', 5301)) as { state: string; move_ids_without_package: { values: Record<string, unknown> }[] };
      expect(record.state).toBe('done');
      expect(record.move_ids_without_package[2].values).toMatchObject({ quantity: 12, product_uom_qty: 12, state: 'done' });
      if (variant === 'plain') await screen(page, 'real-transfer-done');
      expect(problems).toEqual([]);
    });

    test('warehouse receipt: Flectra’s columns, tones, row buttons and groups', async ({ page }) => {
      await page.setViewportSize(WIDE);
      let { problems } = await open(page, variant, TRANSFER);
      await expect.poll(() => value(page, 'name')).toBe('WH/IN/00042');
      // The reference reads as the title beside its star.
      await expect(page.locator('.fd-title .fd-read-text').first()).toHaveCSS('font-size', '24px');
      // Draft: no Quantity column yet (column_invisible parent.state == 'draft'); on hand below the demand in red.
      await expect(node(page, 'f-moves').locator('.ag-header-cell[col-id="quantity"]')).toHaveCount(0);
      await expect(cell(page, 'f-moves', 1, 'qty_on_hand_at_date')).toHaveClass(/fd-tone-danger/);
      await expect(cell(page, 'f-moves', 0, 'qty_on_hand_at_date')).not.toHaveClass(/fd-tone-danger/);
      // Each line's Forecast Report, the red one while nothing is forecast.
      await expect(node(page, 'f-moves').locator('.ag-row:not(.fd-grid-totals)').first().getByRole('button', { name: 'Forecast Report' })).toHaveCount(1);
      // The gear: its Print group, Duplicate and Delete.
      await page.locator('.fd-record-bar .fd-record-gear').click();
      await expect(page.getByRole('menu')).toContainText('Picking Operations');
      await expect(page.getByRole('menu')).toContainText('Delivery Slip');
      await page.keyboard.press('Escape');

      // Ready: the Quantity column shows; more than the demand is red.
      await page.getByRole('button', { name: 'Mark as Todo' }).click();
      await expect(page.locator('.fd-header .fd-statusbar [aria-current="step"]')).toHaveText('Ready');
      await settled(page);
      await typeIn(page, 'f-moves', 2, 'quantity', '20');
      await expect(cell(page, 'f-moves', 2, 'quantity')).toHaveClass(/fd-tone-danger/);
      expect(problems).toEqual([]);

      // Without the stock user's group: no Validate, and no Mark as Todo without the internal user's.
      ({ problems } = await open(page, variant, `${TRANSFER}&roles=base.group_user`));
      await expect.poll(() => value(page, 'name')).toBe('WH/IN/00042');
      await expect(page.getByRole('button', { name: 'Mark as Todo' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Validate', exact: true })).toHaveCount(0);
      expect(problems).toEqual([]);
    });

    test('manufacturing order: confirmed, its components’ availability shown, then produced', async ({ page }) => {
      await page.setViewportSize(WIDE);
      const { problems } = await open(page, variant, PRODUCTION);
      await expect.poll(() => value(page, 'name')).toBe('WH/MO/00031');
      await expect(page.getByRole('button', { name: 'Produce All' })).toBeHidden();
      // Draft: change how many to make, and the components follow the bill of materials.
      const toProduce = node(page, 'f-product-qty').locator('input');
      await toProduce.fill('6');
      await toProduce.press('Tab');
      await expect(cell(page, 'f-components', 2, 'product_uom_qty')).toHaveText('24.00');
      await toProduce.fill('4');
      await toProduce.press('Tab');
      await expect(cell(page, 'f-components', 2, 'product_uom_qty')).toHaveText('16.00');
      if (variant === 'plain') await screen(page, 'real-manufacturing-order');

      await page.getByRole('button', { name: 'Confirm', exact: true }).click();
      await expect(toast(page, 'some components are not available yet')).toBeVisible();
      await expect(page.locator('.fd-header .fd-statusbar [aria-current="step"]')).toHaveText('Confirmed');
      // 12 table legs of 16 reserved: the order is not ready, and says so.
      await expect(page.locator('[data-node="b-components-missing"]')).toBeVisible();
      expect(await value(page, 'components_availability')).toBe('Not Available');
      await expect(cell(page, 'f-components', 2, 'quantity')).toHaveText('12.00');
      await expect(page.getByRole('button', { name: 'Check availability' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Produce All' })).toBeVisible();
      await settled(page);
      if (variant === 'plain') await screen(page, 'real-manufacturing-order-confirmed');

      // Planned: each work order gets its start and end.
      await page.getByRole('button', { name: 'Plan', exact: true }).click();
      await expect(page.getByRole('button', { name: 'Unplan' })).toBeVisible();
      await settled(page);
      expect((await lineValues(page, 'workorder_ids')).map((w) => w['date_start'])).toEqual(['2026-10-08T08:00', '2026-10-08T11:00', '2026-10-08T17:00']);

      await page.getByRole('button', { name: 'Produce All' }).click();
      await expect(toast(page, '4 × Dining table, beech, 6 seats produced.')).toBeVisible();
      await expect(page.locator('.fd-header .fd-statusbar [aria-current="step"]')).toHaveText('Done');
      await expect(page.locator('[data-node="b-locked"]')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Unbuild' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Unlock' })).toBeVisible();
      await settled(page);
      const components = await lineValues(page, 'move_raw_ids');
      expect(components.map((c) => [c['quantity'], c['picked']])).toEqual([[24, true], [2, true], [16, true], [1, true], [2, true]]);
      expect((await saved(page, 'mrp.production', 5401)) as Record<string, unknown>).toMatchObject({ state: 'done', qty_produced: 4 });
      if (variant === 'plain') await screen(page, 'real-manufacturing-order-done');
      expect(problems).toEqual([]);
    });

    test('manufacturing order: work orders started and finished from their lines, as Flectra’s list', async ({ page }) => {
      await page.setViewportSize(WIDE);
      let { problems } = await open(page, variant, PRODUCTION);
      await expect.poll(() => value(page, 'name')).toBe('WH/MO/00031');
      // "MO Reference" over the title; the quantity on one line, its unit and "To Produce" beside it.
      await expect(page.locator('.fd-title')).toContainText('MO Reference');
      await expect(node(page, 'quantity-row')).toContainText('To Produce');
      // Draft: no Quantity column in the components yet.
      await expect(node(page, 'f-components').locator('.ag-header-cell[col-id="quantity"]')).toHaveCount(0);
      await page.getByRole('button', { name: 'Confirm', exact: true }).click();
      await expect(page.locator('.fd-header .fd-statusbar [aria-current="step"]')).toHaveText('Confirmed');
      await settled(page);
      // Reserved as much as it should consume: green, as Flectra's decoration.
      await expect(cell(page, 'f-components', 0, 'quantity')).toHaveClass(/fd-tone-success/);

      // Work Orders: Start on the first line; its status turns In Progress and Pause takes Start's place.
      await page.getByRole('tab', { name: 'Work Orders' }).click();
      const first = node(page, 'f-workorders').locator('.ag-row[row-index="0"]:not(.fd-grid-totals)').first();
      await first.getByRole('button', { name: 'Start' }).click();
      await expect(toast(page, 'Cutting: started.')).toBeVisible();
      await expect(first.getByRole('button', { name: 'Pause' })).toBeVisible();
      await expect(first.getByRole('button', { name: 'Start' })).toHaveCount(0);
      await expect(cell(page, 'f-workorders', 0, 'state').locator('[data-tone]')).toHaveAttribute('data-tone', 'warning');
      // Expected minutes with float_time, as Flectra writes them: 180 minutes read 180:00.
      await expect(cell(page, 'f-workorders', 0, 'duration_expected')).toHaveText('180:00');

      // The two others chosen, Done for both at once (Flectra's list header buttons).
      const rows = node(page, 'f-workorders');
      await rows.locator('.ag-row[row-index="1"]:not(.fd-grid-totals) [role="checkbox"], .ag-row[row-index="1"]:not(.fd-grid-totals) input[type="checkbox"]').first().click();
      await rows.locator('.ag-row[row-index="2"]:not(.fd-grid-totals) [role="checkbox"], .ag-row[row-index="2"]:not(.fd-grid-totals) input[type="checkbox"]').first().click();
      await rows.getByRole('button', { name: 'Done', exact: true }).first().click();
      await expect(toast(page, 'Assembly, Finishing: done.')).toBeVisible();
      await expect.poll(async () => (await lineValues(page, 'workorder_ids')).map((w) => w['state'])).toEqual(['progress', 'done', 'done']);
      expect(problems).toEqual([]);

      // Without the routings group, no Work Orders tab.
      ({ problems } = await open(page, variant, `${PRODUCTION}&roles=base.group_user`));
      await expect.poll(() => value(page, 'name')).toBe('WH/MO/00031');
      await expect(page.getByRole('tab', { name: 'Work Orders' })).toHaveCount(0);
      expect(problems).toEqual([]);
    });
  });
}

test('the receipt at a phone’s width: nothing scrolls sideways, and the buttons still work', async ({ page }) => {
  await page.setViewportSize(PHONE);
  const { problems } = await open(page, 'plain', TRANSFER);
  await expect.poll(() => value(page, 'name')).toBe('WH/IN/00042');
  await expectNoSidewaysScroll(page);
  await page.getByRole('button', { name: 'Mark as Todo' }).click();
  await expect(page.locator('.fd-header .fd-statusbar [aria-current="step"]')).toHaveText('Ready');
  await expectNoSidewaysScroll(page);
  await screen(page, 'real-transfer-phone');
  expect(problems).toEqual([]);
});
