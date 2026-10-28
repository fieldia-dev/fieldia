import type { DemoReplay } from '../hand';
import { node, date } from './support';

/** “Time off, to approve” (real-time-off): its how-to replayed by hand (e2e/how-to.spec.ts). */
export const replay: DemoReplay = {
  steps: [
    {
      says: 'Change the end date: the duration in days follows, counting Sunday to Thursday.',
      async run(hand) {
        const { page, see } = hand;
        const end = page.getByRole('textbox', { name: 'Request End Date' });
        await see(node(page, 'f-duration-days')).toContainText('3.00 Days');
        // The request starts on the Sunday at least five days from today (demos/shared/real/people.ts), Sunday to Tuesday:
        // to the Sunday a week on, Sunday to Thursday, then the Sunday — six days. Read from the page, never written here:
        // a day written here ran out on the day after it was (28 Oct, "1.00 Days").
        // The box writes its day as people read it ("8 Nov 2026"); it is typed as the page orders a date's parts (dmy).
        const weekOn = new Date(Date.parse(await page.getByRole('textbox', { name: 'Request Start Date' }).inputValue()));
        weekOn.setDate(weekOn.getDate() + 7);
        const two = (n: number) => String(n).padStart(2, '0');
        await see(end, 'the end date can be changed').toBeEditable();
        await date(hand, end, `${two(weekOn.getDate())}/${two(weekOn.getMonth() + 1)}/${weekOn.getFullYear()}`);
        await hand.keys('Tab');
        await see(node(page, 'f-duration-days')).toContainText('6.00 Days');
      },
    },
    {
      says: 'Press Approve: Paid Time Off needs two approvals',
      async run({ page, press, see }) {
        const current = page.locator('.fd-header .fd-statusbar [aria-current="step"]');
        await see(current).toHaveText('To Approve');
        await press(page.getByRole('button', { name: 'Approve', exact: true }));
        await see(current).toHaveText('Second Approval');
        await see(page.getByRole('button', { name: 'Approve', exact: true })).toBeHidden();
        await press(page.getByRole('button', { name: 'Validate' }));
        await see(current).toHaveText('Approved');
        await see(page.locator('.fd-say', { hasText: 'Approved: Salma Adel, Paid Time Off.' })).toBeVisible();
      },
    },
    {
      says: 'Open Omar Said’s request (Compensatory Days, in hours) and tick Half Day',
      async run(hand) {
        const { page, press, follow, see } = hand;
        await follow('Open Omar Said’s request');
        await see(node(page, 'f-display-name')).toContainText('Omar Said on Compensatory Days');
        await see(node(page, 'f-dates-from')).toBeVisible();
        await see(node(page, 'f-duration-hours-beside')).toContainText('16 Hours');
        await press(page.getByRole('checkbox', { name: 'Half Day' }));
        await see(node(page, 'f-dates-from')).toBeHidden();
        await see(node(page, 'f-duration-days')).toBeHidden();
        await see(page.getByRole('textbox', { name: 'Date', exact: true })).toBeVisible();
        const half = page.getByRole('combobox', { name: 'Date Period Start' });
        await see(half).toBeVisible();
        await see(half.getByRole('option')).toHaveText(['Morning', 'Afternoon']);
        await see(node(page, 'f-duration-hours')).toContainText('4 Hours');
      },
    },
    {
      says: 'Tick Custom Hours instead and pick From and To: the hours follow.',
      async run({ page, press, see }) {
        await press(page.getByRole('checkbox', { name: 'Custom Hours' }));
        await see(page.getByRole('checkbox', { name: 'Half Day' })).not.toBeChecked();
        for (const [id, time] of [['f-hour-from', '9:00 AM'], ['f-hour-to', '1:30 PM']] as const) {
          await press(node(page, id).getByRole('combobox'));
          await page.keyboard.type(time.slice(0, 4), { delay: 15 });
          await press(page.getByRole('option', { name: time, exact: true }));
          await see(node(page, id).getByRole('combobox')).toHaveValue(time);
        }
        await see(node(page, 'f-duration-hours')).toContainText('4.5 Hours');
      },
    },
    {
      says: 'Pick Sick Time Off: Supporting Document appears',
      async run({ page, press, see }) {
        const document = page.locator('.fd-form').getByText('Supporting Document', { exact: true });
        await see(document).toBeHidden();
        const type = node(page, 'f-type').getByRole('combobox');
        await press(type);
        await page.keyboard.press('ControlOrMeta+a');
        await page.keyboard.type('Sick', { delay: 15 });
        await press(page.getByRole('option', { name: /^Sick Time Off/ }));
        await see(type).toHaveValue(/^Sick Time Off/);
        await see(document).toBeVisible();
      },
    },
  ],
};
