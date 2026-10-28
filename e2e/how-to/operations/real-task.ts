import type { DemoReplay } from '../hand';

/** The real-task demo's how-to steps, replayed by hand (e2e/how-to.spec.ts). */
export const replay: DemoReplay = {
  steps: [
    {
      says: 'Open Timesheets and add a line: type the hours, and Hours Spent',
      async run({ page, press, keys, see, phone }) {
        await press(page.getByRole('tab', { name: 'Timesheets' }));
        const sheet = page.getByRole('tabpanel', { name: 'Timesheets' });
        const spent = page.locator('[data-node="f-effective"]');
        await see(spent).toContainText('17:30');
        await see(page.locator('[data-node="f-total-hours"]')).toContainText('28:00');
        await see(page.locator('[data-node="f-remaining"]')).toContainText('12:00');
        await press(sheet.getByRole('button', { name: '+ Add a line' }));
        if (phone) {
          // A phone's line is a card: a new one is written in its own dialog, titled as its card is, by its place.
          const line = page.getByRole('dialog', { name: 'Line 4' });
          await see(line).toBeVisible();
          await press(line.getByRole('textbox', { name: 'Hours Spent' }));
          await page.keyboard.type('2.5', { delay: 15 });
          await press(line.getByRole('button', { name: 'Save & Close' }));
          await see(line).toBeHidden();
        } else {
          const hours = sheet.locator('.ag-row[row-index="3"]:not(.fd-grid-totals) .ag-cell[col-id="unit_amount"]');
          await see(hours).toBeVisible();
          await press(hours);
          await see(sheet.locator('.ag-cell-inline-editing, .ag-popup-editor').first()).toBeVisible();
          await keys('ControlOrMeta+a');
          await page.keyboard.type('2.5', { delay: 15 });
          // Enter or Tab past the last cell would start another line: a press outside the grid keeps this one.
          await press(page.getByRole('tab', { name: 'Timesheets' }));
          await see(hours).toHaveText('02:30');
        }
        await see(spent).toContainText('20:00');
        await see(page.locator('[data-node="f-total-hours"]')).toContainText('30:30');
        await see(page.locator('[data-node="f-remaining"]')).toContainText('09:30');
      },
    },
    {
      says: 'Open Sub-tasks and add one: it takes the task’s project and customer',
      async run({ page, press, keys, see, phone }) {
        const counter = page.locator('button[data-node="subtasks"] .fd-stat-value').first();
        await see(counter).toHaveText('3');
        await press(page.getByRole('tab', { name: 'Sub-tasks' }));
        const subtasks = page.getByRole('tabpanel', { name: 'Sub-tasks' });
        await press(subtasks.getByRole('button', { name: 'Add a sub-task' }));
        // A new one by its place, as its card is headed; one with its title by its title — never the table's plural.
        let task = page.getByRole('dialog', { name: 'Line 4' });
        if (phone) {
          await see(task).toBeVisible();
          await press(task.getByRole('textbox', { name: /^Title/ }));
          await page.keyboard.type('Snag walk, both rooms', { delay: 15 });
        } else {
          const title = subtasks.locator('.ag-row[row-index="3"]:not(.fd-grid-totals) .ag-cell[col-id="name"]');
          await press(title);
          await see(subtasks.locator('.ag-cell-inline-editing, .ag-popup-editor').first()).toBeVisible();
          await keys('ControlOrMeta+a');
          await page.keyboard.type('Snag walk, both rooms', { delay: 15 });
          await press(page.getByRole('tab', { name: 'Sub-tasks' }));
          await see(title).toHaveText('Snag walk, both rooms');
          // The new sub-task opened from its line: its project and customer, the task's.
          await press(subtasks.locator('.ag-row[row-index="3"]:not(.fd-grid-totals)').getByRole('button', { name: 'Open line' }).first());
          task = page.getByRole('dialog', { name: 'Snag walk, both rooms' });
        }
        await see(task.getByRole('textbox', { name: /^Title/ })).toHaveValue('Snag walk, both rooms');
        await see(task.getByRole('combobox', { name: 'Project' })).toHaveValue('Nile Towers 12th floor fit-out');
        await see(task.getByRole('combobox', { name: 'Customer' })).toHaveValue('Nile Towers Management');
        await press(task.getByRole('button', { name: 'Save & Close' }));
        await see(task).toBeHidden();
        await see(counter).toHaveText('4');
        await see(subtasks).toContainText('Snag walk, both rooms');
      },
    },
    {
      says: 'Press Mark Done / Send for Approval: the app answers, Approve',
      async run({ page, press, see }) {
        await see(page.getByRole('button', { name: 'Approve', exact: true })).toBeHidden();
        await press(page.getByRole('button', { name: 'Mark Done / Send for Approval' }));
        await see(page.locator('.fd-say', { hasText: 'Submitted for approval to Salma Nabil.' })).toBeVisible();
        await see(page.getByRole('button', { name: 'Approve', exact: true })).toBeVisible();
        await see(page.getByRole('button', { name: 'Request Changes' })).toBeVisible();
        await see(page.locator('[data-node="b-approval-waiting"]')).toBeVisible();
        await see(page.locator('[data-node="b-approval-waiting"]')).toContainText('Waiting Approval');
      },
    },
    {
      says: 'Change Work Item Type to Bug: the Task Details tab gives way',
      async run({ page, press, see }) {
        await see(page.getByRole('tab', { name: 'Task Details' })).toBeVisible();
        await see(page.getByRole('tab', { name: 'Bug Details' })).toBeHidden();
        const kind = page.getByRole('combobox', { name: /^Work Item Type/ });
        // A list the browser draws itself: the option chosen from it.
        await press(kind);
        await kind.selectOption({ label: 'Bug' });
        await see(kind).toHaveValue(/./);
        await see(page.getByRole('tab', { name: 'Bug Details' })).toBeVisible();
        await see(page.getByRole('tab', { name: 'Task Details' })).toBeHidden();
      },
    },
    {
      says: 'Click Client Review on the stages along the top to move the task',
      async run({ page, press, see }) {
        const at = page.locator('.fd-header .fd-statusbar [aria-current="step"]');
        await see(at).toContainText('In Progress');
        await press(page.getByRole('list', { name: 'Stage' }).getByRole('button', { name: /^Client Review/ }));
        await see(at).toContainText('Client Review');
      },
    },
  ],
};
