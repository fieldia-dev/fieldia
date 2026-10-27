import type { DemoReplay } from '../hand';

/** The real-maintenance-request demo's how-to steps, replayed by hand (e2e/how-to.spec.ts). */
export const replay: DemoReplay = {
  steps: [
    {
      says: 'Click Repaired on the stages at the top: the request is done',
      async run({ page, press, see }) {
        const closed = page.locator('[data-node="f-close-date"]');
        await see(closed).toBeHidden();
        await press(page.getByRole('list', { name: 'Stage' }).getByRole('button', { name: 'Repaired' }));
        await see(page.locator('.fd-header .fd-statusbar [aria-current="step"]')).toHaveText('Repaired');
        await see(closed).toBeVisible();
        await see(closed).toContainText('Close Date');
        await see(closed).toContainText(/\d{1,2} [A-Z][a-z]{2} \d{4}/);
      },
    },
    {
      says: 'Click the stars to change the priority, and type a new duration',
      async run({ page, press, type, keys, see }) {
        const priority = page.getByRole('radiogroup', { name: 'Priority' });
        await see(priority.getByRole('radio', { name: 'High' })).toBeChecked();
        await press(priority.getByRole('radio', { name: 'Normal' }));
        await see(priority.getByRole('radio', { name: 'Normal' })).toBeChecked();
        await see(priority.getByRole('radio', { name: 'High' })).not.toBeChecked();
        const duration = page.getByRole('textbox', { name: /^Duration/ });
        await see(duration).toHaveValue('02:30');
        await type(duration, '3.75', { clear: true });
        await keys('Tab');
        await see(duration).toHaveValue('03:45');
      },
    },
    {
      says: 'Pick Preventive: Recurrent appears; tick it and the repeat rule',
      async run({ page, press, type, keys, see }) {
        const recurrent = page.getByRole('checkbox', { name: 'Recurrent' });
        await see(recurrent).toBeHidden();
        await press(page.getByRole('radio', { name: 'Preventive' }));
        await see(recurrent).toBeVisible();
        const every = page.getByRole('textbox', { name: /^Repeat Every/ });
        await see(every).toBeHidden();
        await press(recurrent);
        await see(every).toBeVisible();
        await see(page.getByRole('combobox', { name: /^Repeat Unit/ })).toBeVisible();
        const until = page.getByRole('combobox', { name: /^Until/ });
        await see(until).toBeVisible();
        const end = page.locator('[data-node="f-repeat-until"]');
        await see(end).toBeHidden();
        // A list the browser draws itself: the option chosen from it.
        await press(until);
        await until.selectOption({ label: 'Until' });
        await see(end).toBeVisible();
        const endDate = page.getByRole('textbox', { name: /^End Date/ });
        await type(endDate, '31/12/2027');
        await keys('Tab');
        await see(endDate).toHaveValue(/31 Dec 2027|31\/12\/2027/);
        await see(end.locator('.fd-error')).toBeHidden();
      },
    },
    {
      says: 'Pick another equipment: its category, team and technician come',
      async run({ page, press, type, see }) {
        const equipment = page.getByRole('combobox', { name: 'Equipment' });
        await type(equipment, 'Daikin', { clear: true });
        await press(page.getByRole('option', { name: 'Daikin split AC, treatment room 2' }));
        await see(equipment).toHaveValue('Daikin split AC, treatment room 2');
        await see(page.locator('[data-node="f-category"]')).toContainText('Air conditioning');
        await see(page.getByRole('combobox', { name: /^Team/ })).toHaveValue('Facilities');
        await see(page.getByRole('combobox', { name: 'Responsible' })).toHaveValue('Mahmoud Ezzat');
      },
    },
    {
      says: 'Open Instructions and the service manual; press Cancel',
      async run({ page, press, see }) {
        await press(page.getByRole('tab', { name: 'Instructions' }));
        const instructions = page.getByRole('tabpanel', { name: 'Instructions' });
        await see(instructions.locator('iframe')).toBeVisible();
        await press(instructions.getByRole('button', { name: /service manual, cooling\.pdf, \d+ bytes/ }));
        const manual = page.getByRole('dialog', { name: 'GentleMax Pro service manual, cooling.pdf' });
        await see(manual).toBeVisible();
        await see(manual.locator('iframe')).toBeVisible();
        await press(manual.getByRole('button', { name: 'Close' }));
        await see(manual).toBeHidden();
        await press(page.getByRole('button', { name: 'Cancel', exact: true }));
        await see(page.locator('.fd-badge')).toHaveText('Canceled');
        await see(page.getByRole('button', { name: 'Reopen Request' })).toBeVisible();
        await see(page.getByRole('button', { name: 'Cancel', exact: true })).toBeHidden();
        await see(page.getByRole('list', { name: 'Stage' })).toBeHidden();
      },
    },
  ],
};
