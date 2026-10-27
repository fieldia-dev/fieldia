import type { DemoReplay } from '../hand';
import { node, choose, date } from './support';

/** “Employee onboarding” (template-employee-onboarding): its how-to replayed by hand (e2e/how-to.spec.ts). */
export const replay: DemoReplay = {
  steps: [
    {
      says: 'Choose Fixed term on The job: Contract ends appears, required.',
      async run({ page, press, type, see }) {
        // The person first: The job is the step after it.
        await type(page.getByRole('textbox', { name: 'Full name' }), 'Laila Hassan');
        await type(page.getByRole('textbox', { name: 'Personal email' }), 'laila.hassan@example.com');
        await press(page.getByRole('button', { name: 'Next' }));
        await see(page.getByRole('region', { name: 'The job' })).toBeVisible();
        const ends = page.getByRole('textbox', { name: 'Contract ends' });
        await see(ends).toBeHidden();
        await press(page.getByRole('radio', { name: 'Fixed term' }));
        await see(ends).toBeVisible();
        // Required: marked so, and asked for when the step is left without it.
        await see(node(page, 'f-contract-end')).toHaveClass(/fd-required/);
        await press(page.getByRole('button', { name: 'Next' }));
        await see(node(page, 'f-contract-end')).toContainText('Contract ends is required');
        await see(page.getByRole('region', { name: 'The job' })).toBeVisible();
      },
    },
    {
      says: 'Pay is optional: skip it and go on to Day one.',
      async run(hand) {
        const { page, press, type, keys, see } = hand;
        // The job finished, to come to Pay.
        await type(page.getByRole('textbox', { name: 'Job title' }), 'Product designer');
        await choose(hand, page.getByRole('combobox', { name: 'Department' }), 'Engineering');
        await date(hand, page.getByRole('textbox', { name: 'First day' }), '01/11/2026');
        await keys('Tab');
        await date(hand, page.getByRole('textbox', { name: 'Contract ends' }), '31/10/2027');
        await keys('Tab');
        await press(page.getByRole('button', { name: 'Next' }));
        await see(page.getByRole('region', { name: 'Pay' })).toBeVisible();
        await see(page.getByText('Step 3 of 4')).toBeVisible();
        await press(page.getByRole('button', { name: 'Skip' }));
        await see(page.getByRole('region', { name: 'Day one' })).toBeVisible();
        await see(page.getByText('Step 4 of 4')).toBeVisible();
      },
    },
  ],
};
