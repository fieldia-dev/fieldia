import type { DemoReplay } from '../hand';
import { choose, date } from './support';

/** “Time-off request” (template-leave-request): its how-to replayed by hand (e2e/how-to.spec.ts). */
export const replay: DemoReplay = {
  steps: [
    {
      says: 'Pick a first and a last day: Days counts them.',
      async run(hand) {
        const { page, press, keys, see } = hand;
        const days = page.getByRole('textbox', { name: 'Days' });
        await date(hand, page.getByRole('textbox', { name: 'From' }), '02/11/2026');
        await date(hand, page.getByRole('textbox', { name: 'To' }), '05/11/2026');
        await keys('Tab');
        await see(days).toHaveValue('4.0');
        await press(page.getByRole('switch', { name: 'Half a day' }));
        await see(days).toHaveValue('0.5');
      },
    },
    {
      says: 'Choose Sick leave: Medical certificate appears.',
      async run(hand) {
        const { page, see } = hand;
        const certificate = page.locator('.fd-form').getByText('Medical certificate', { exact: true });
        await see(certificate).toBeHidden();
        await choose(hand, page.getByRole('combobox', { name: 'Kind of leave' }), 'Sick leave');
        await see(certificate).toBeVisible();
      },
    },
  ],
};
