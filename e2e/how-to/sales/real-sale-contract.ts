import type { DemoReplay } from '../hand';
import { toast, chooseFrom } from './support';

/** The real-sale-contract demo's how-to steps, replayed by hand (e2e/how-to.spec.ts). */
export const replay: DemoReplay = {
  steps: [
    {
      says: 'Change Contract Type to Service Level Agreement: the Price Escalation tab gives way to SLA Performance',
      async run(hand) {
        const { page, see } = hand;
        await see(page.getByRole('tab', { name: 'Price Escalation', exact: true })).toBeVisible();
        await see(page.getByRole('tab', { name: 'SLA Performance', exact: true })).toBeHidden();
        const type = page.getByRole('combobox', { name: /^Contract Type/ });
        await chooseFrom(hand, type, 'Service Level Agreement');
        await see(type.locator('option:checked')).toHaveText('Service Level Agreement');
        await see(page.getByRole('tab', { name: 'Price Escalation', exact: true })).toBeHidden();
        await see(page.getByRole('tab', { name: 'SLA Performance', exact: true })).toBeVisible();
      },
    },
    {
      says: 'In Milestones, press Complete on the first milestone, in progress: the completion bar moves to 25%',
      async run({ page, press, see }) {
        await press(page.getByRole('tab', { name: 'Milestones', exact: true }));
        const bar = page.getByRole('progressbar', { name: 'Milestone Completion %' });
        await see(bar).toHaveText('0%');
        const first = page.locator('[data-node="f-milestones"] tbody tr').first();
        await see(first).toContainText('In Progress');
        await see(first.getByRole('button', { name: 'Invoice', exact: true })).toBeHidden();
        await press(first.getByRole('button', { name: 'Complete', exact: true }));
        await see(toast(page, /Milestone .* completed/)).toBeVisible();
        await see(bar).toHaveText('25%');
        await see(first.getByRole('button', { name: 'Invoice', exact: true })).toBeVisible();
        await see(first.getByRole('button', { name: 'Complete', exact: true })).toBeHidden();
      },
    },
    {
      says: 'Press Activate: the contract is active, and Terminate and Renew appear',
      async run({ page, press, see }) {
        await see(page.getByRole('button', { name: 'Terminate', exact: true })).toBeHidden();
        await press(page.getByRole('button', { name: 'Activate', exact: true }));
        await see(toast(page, /Contract active/)).toBeVisible();
        await see(page.getByRole('list', { name: 'Status' }).locator('[aria-current="step"]')).toHaveText('Active');
        await see(page.getByRole('button', { name: 'Terminate', exact: true })).toBeVisible();
        await see(page.getByRole('button', { name: 'Renew', exact: true })).toBeVisible();
      },
    },
    {
      says: 'Press Terminate, give a reason and press Terminate Contract: the contract is terminated',
      async run({ page, press, type, see }) {
        await press(page.getByRole('button', { name: 'Terminate', exact: true }));
        const dialog = page.getByRole('dialog', { name: 'Terminate Contract' });
        await see(dialog).toBeVisible();
        const reason = 'The hospital moved its ICU to a new building with its own supplier.';
        await type(dialog.locator('[data-node="f-termination-reason"]').getByRole('textbox'), reason);
        await press(dialog.getByRole('button', { name: 'Terminate Contract' }));
        await see(dialog).toBeHidden();
        await see(toast(page, 'Contract terminated')).toBeVisible();
        await see(page.getByRole('button', { name: 'Terminate', exact: true })).toBeHidden();
        // Under the terms: the Terms & Conditions tab, its Termination Details with the reason given.
        await see(page.getByRole('tab', { name: 'Terms & Conditions', exact: true })).toHaveAttribute('aria-selected', 'true');
        const details = page.getByRole('tabpanel', { name: 'Terms & Conditions' });
        await see(details).toContainText('Termination Details');
        await see(details.locator('[data-node="f-termination-reason"]').getByRole('textbox')).toHaveValue(reason);
      },
    },
  ],
};
