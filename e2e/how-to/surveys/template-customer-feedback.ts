import type { DemoReplay } from '../hand';
import { ending, node } from './support';

/** The template-customer-feedback demo's how-to steps, replayed by hand (e2e/how-to.spec.ts). */
export const replay: DemoReplay = {
  steps: [
    {
      says: 'Before a branch is picked, the next question asks how your visit to us was.',
      async run({ page, press, see }) {
        const rating = node(page, 'f-overall');
        await see(rating.locator('.fd-label')).toHaveText('How was your visit to us?');
        await press(node(page, 'f-branch').getByRole('radio', { name: 'Riverside' }));
        await see(rating.locator('.fd-label')).toHaveText('How was your visit to Riverside?');
        await press(node(page, 'f-branch').getByRole('radio', { name: 'Downtown' }));
        await see(rating.locator('.fd-label')).toHaveText('How was your visit to Downtown?');
      },
    },
    {
      says: 'Give it four stars and pick a number on the scale.',
      async run({ page, press, see }) {
        await press(node(page, 'f-overall').getByRole('radio', { name: '4 of 5' }));
        await see(node(page, 'f-overall').getByRole('radio', { name: '4 of 5' })).toBeChecked();
        await press(node(page, 'f-recommend').getByRole('radio', { name: '8', exact: true }));
        await see(node(page, 'f-recommend').getByRole('radio', { name: '8', exact: true })).toBeChecked();
      },
    },
    {
      says: 'Turn on You may contact me: Email appears, and is now required.',
      async run({ page, press, see }) {
        const email = node(page, 'f-email').getByRole('textbox');
        await see(email).toBeHidden();
        await press(node(page, 'f-follow').getByRole('switch'));
        await see(email).toBeVisible();
        await see(email).toHaveAttribute('aria-required', 'true');
      },
    },
    {
      says: 'Give it one star, fill in your email and send: the page says sorry',
      async run({ page, press, type, see }) {
        await press(node(page, 'f-overall').getByRole('radio', { name: '1 of 5' }));
        await type(node(page, 'f-email').getByRole('textbox'), 'mona@example.com');
        await press(page.getByRole('button', { name: 'Submit' }));
        await see(ending(page).locator('.fd-done-title')).toHaveText('We are sorry, and thank you for telling us');
        await see(ending(page).locator('.fd-done-words')).toHaveText('The manager at Downtown reads every answer, and will write to you at mona@example.com within a day.');
        await see(ending(page).getByRole('button')).toHaveCount(0);
      },
    },
  ],
};
