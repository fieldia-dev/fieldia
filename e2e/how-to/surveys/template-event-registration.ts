import type { DemoReplay } from '../hand';
import { choose, ending } from './support';

/** The template-event-registration demo's how-to steps, replayed by hand (e2e/how-to.spec.ts). */
export const replay: DemoReplay = {
  steps: [
    {
      says: 'Choose VIP: the price changes to $250. Choose Student',
      async run({ page, press, see }) {
        const price = page.getByRole('textbox', { name: 'Price' });
        await see(price).toHaveValue('120.00');
        await press(page.getByRole('radio', { name: 'VIP, with the dinner' }));
        await see(price).toHaveValue('250.00');
        const card = page.getByRole('textbox', { name: 'Student card number' });
        await see(card).toBeHidden();
        await press(page.getByRole('radio', { name: 'Student' }));
        await see(card).toBeVisible();
        await see(card).toHaveAttribute('aria-required', 'true');
      },
    },
    {
      says: 'Tick two workshops, then pick a food need.',
      async run(hand) {
        const { page, press, see } = hand;
        await press(page.getByRole('checkbox', { name: 'Data you can trust' }));
        await press(page.getByRole('checkbox', { name: 'Growing a small team' }));
        await see(page.getByRole('checkbox', { name: 'Data you can trust' })).toBeChecked();
        await see(page.getByRole('checkbox', { name: 'Growing a small team' })).toBeChecked();
        const food = page.getByRole('combobox', { name: 'Food' });
        await choose(hand, food, 'Vegetarian');
        await see(food.locator('option:checked')).toHaveText('Vegetarian');
      },
    },
    {
      says: 'Fill in your name, email and student card number and press Submit',
      async run({ page, press, type, see }) {
        await type(page.getByRole('textbox', { name: 'Full name' }), 'Sara Hassan');
        await type(page.getByRole('textbox', { name: 'Email' }), 'sara@example.com');
        await type(page.getByRole('textbox', { name: 'Student card number' }), 'STU-2026-118');
        await press(page.getByRole('button', { name: 'Submit' }));
        await see(ending(page).locator('.fd-done-title')).toHaveText('You are registered, Sara Hassan');
        await see(ending(page).locator('.fd-done-words')).toHaveText([
          /^Your ticket: Student, \$\s40\.00\.$/,
          'Your workshops: Data you can trust, Growing a small team.',
          'Your ticket goes to sara@example.com, with how to get there. See you in Cairo on 14 November.',
        ]);
      },
    },
  ],
};
