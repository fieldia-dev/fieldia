import type { DemoReplay } from '../hand';
import { ending } from './support';

/** The template-newsletter demo's how-to steps, replayed by hand (e2e/how-to.spec.ts). */
export const replay: DemoReplay = {
  steps: [
    {
      says: 'Type an email without an @ and leave the box: it says the email is not valid.',
      async run({ page, press, type, see }) {
        const email = page.getByRole('textbox', { name: 'Email' });
        await type(email, 'you.example.com');
        await press(page.getByRole('textbox', { name: 'First name' }));
        await see(email).toHaveAttribute('aria-invalid', 'true');
        await see(page.getByText('Enter an email address, like name@example.com')).toBeVisible();
      },
    },
    {
      says: 'Tick two topics and pick how often: the smallest form, done in seconds.',
      async run({ page, press, type, see }) {
        await press(page.getByRole('checkbox', { name: 'Guides and tips' }));
        await press(page.getByRole('checkbox', { name: 'Events near you' }));
        await press(page.getByRole('radio', { name: 'Every week' }));
        await see(page.getByRole('checkbox', { name: 'Guides and tips' })).toBeChecked();
        await see(page.getByRole('checkbox', { name: 'Events near you' })).toBeChecked();
        await see(page.getByRole('radio', { name: 'Every week' })).toBeChecked();
        // Done: the email put right, and sent.
        await type(page.getByRole('textbox', { name: 'Email' }), 'you@example.com', { clear: true });
        await press(page.getByRole('button', { name: 'Submit' }));
        await see(ending(page)).toBeVisible();
      },
    },
  ],
};
