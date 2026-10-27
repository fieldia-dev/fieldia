import type { DemoReplay } from '../hand';
import { node } from './support';

/** The business demo's how-to steps, replayed by hand (e2e/how-to.spec.ts). */
export const replay: DemoReplay = {
  steps: [
    {
      says: 'Click the third star by the title: the priority goes up',
      async run({ page, press, see }) {
        const stars = node(page, 'f-priority').getByRole('radio');
        await see(stars.nth(1)).toBeChecked();
        await press(stars.nth(2));
        await see(stars.nth(2)).toBeChecked();
        await see(stars.nth(2)).toHaveAccessibleName('Very high');
        await press(stars.nth(2));
        for (const star of await stars.all()) await see(star).not.toBeChecked();
      },
    },
    {
      says: 'Open the dot after the title and pick Blocked: it turns red.',
      async run({ page, press, see }) {
        const state = node(page, 'f-state');
        await press(state.getByRole('button', { name: 'Status: In progress' }));
        const menu = page.getByRole('menu', { name: 'Status' });
        await see(menu).toBeVisible();
        await press(menu.getByRole('menuitemradio', { name: 'Blocked' }));
        await see(menu).toBeHidden();
        const dot = state.getByRole('button', { name: 'Status: Blocked' });
        await see(dot).toBeVisible();
        await see(dot.locator('.fd-dot')).toHaveCSS('background-color', 'rgb(198, 40, 40)');
      },
    },
    {
      says: 'Press Start timer: the time logged starts running',
      async run({ page, press, see }) {
        const timer = node(page, 'f-duration').getByRole('timer');
        await see(timer).toHaveText('12:45:00');
        await press(page.getByRole('button', { name: 'Start timer' }));
        await see(timer).not.toHaveText('12:45:00');
        await see(timer).toHaveText(/^12:45:0[1-9]$/);
        await press(page.getByRole('button', { name: 'Stop timer and log' }));
        await see(page.getByText('1 min logged.')).toBeVisible();
        // The minute it ran, rounded up, added to the 12:45 logged before.
        await see(timer).toHaveText('12:46:00');
        await see(page.getByRole('button', { name: 'Start timer' })).toBeVisible();
      },
    },
    {
      says: 'Pick a range of dates on the calendar: the first day, then the last.',
      async run({ page, press, see }) {
        const range = node(page, 'f-dates');
        await press(range.getByRole('button', { name: 'Choose a date' }));
        const calendar = range.getByRole('dialog');
        await see(calendar).toBeVisible();
        await press(calendar.getByRole('button', { name: /14 October 2026/ }));
        await press(calendar.getByRole('button', { name: /20 October 2026/ }));
        await see(range.getByRole('textbox', { name: 'Starts' })).toHaveValue('14 Oct 2026');
        await see(range.getByRole('textbox', { name: 'Ends' })).toHaveValue('20 Oct 2026');
      },
    },
    {
      says: 'Change the project: its own properties take the task’s',
      async run({ page, press, type, see }) {
        const props = node(page, 'f-properties');
        await see(props.locator('.fd-property > label')).toHaveText(['Floor', 'Lift booked', 'Site contact', 'Handover']);
        await type(node(page, 'f-project').getByRole('combobox', { name: 'Project' }), 'clinic', { clear: true });
        // The list for all six letters, as a person reads it before picking: not one for fewer, still being redrawn.
        await see(node(page, 'f-project').getByRole('option')).toHaveText(['Amira Clinics, Zamalek', 'Create “clinic”']);
        await press(node(page, 'f-project').getByRole('option', { name: 'Amira Clinics, Zamalek' }));
        await see(props.locator('.fd-property > label')).toHaveText(['Treatment rooms', 'Medical gas lines']);
        await press(props.getByRole('button', { name: '+ Add a property' }));
        await type(props.getByRole('textbox', { name: 'Property name' }), 'Locker number');
        await press(props.getByRole('button', { name: 'Add', exact: true }));
        await see(props.locator('.fd-property > label')).toHaveText(['Treatment rooms', 'Medical gas lines', 'Locker number']);
        await see(props.getByRole('textbox', { name: 'Locker number' })).toBeFocused();
      },
    },
    {
      says: 'In Invoicing, type a share for an account, and correct a tax amount: the total follows.',
      async run({ page, phone, press, type, keys, see }) {
        await press(page.getByRole('tab', { name: 'Invoicing' }));
        const analytic = node(page, 'f-analytic');
        await see(analytic.locator('tfoot')).toContainText('100%');
        await type(analytic.getByRole('textbox', { name: 'Percentage' }).nth(1), '20', { clear: true });
        await see(analytic.locator('tfoot')).toContainText('90%');
        await see(analytic.locator('.fd-distribution-off')).toHaveText('The shares add up to 90%, not 100%');
        const totals = node(page, 'f-tax-totals');
        const total = totals.locator('.fd-tax-total td');
        await see(total).not.toHaveText('E£ 210,800.00');
        await type(totals.getByRole('textbox', { name: 'VAT 14%' }), '25000', { clear: true });
        // Corrected, and left: by Tab, or on a phone by a tap away from the box.
        if (phone) await press(total);
        else await keys('Tab');
        await see(total).toHaveText('E£ 210,800.00');
      },
    },
  ],
};
