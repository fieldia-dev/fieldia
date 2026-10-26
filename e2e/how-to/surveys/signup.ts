import { expect } from '../../fixtures';
import type { DemoReplay } from '../hand';
import { choose, ending, node } from './support';

/** The signup demo's how-to steps, replayed by hand (e2e/how-to.spec.ts). */
export const replay: DemoReplay = {
  steps: [
    {
      says: 'Choose "Something else" as your role: a question appears',
      async run(hand) {
        const { page, see } = hand;
        await see(node(page, 'f-other-role')).toBeHidden();
        await choose(hand, page.getByRole('combobox', { name: 'Your role' }), 'Something else');
        await see(page.getByRole('textbox', { name: 'Which role?' })).toBeVisible();
      },
    },
    {
      says: 'Choose Manager: a question about your team appears instead.',
      async run(hand) {
        const { page, see } = hand;
        await choose(hand, page.getByRole('combobox', { name: 'Your role' }), 'Manager');
        await see(page.getByRole('textbox', { name: 'People in your team' })).toBeVisible();
        await see(page.getByRole('textbox', { name: 'Which role?' })).toBeHidden();
      },
    },
    {
      says: 'Turn on “Joining the dinner”: a question about what you eat appears.',
      async run({ page, press, see }) {
        await see(page.getByRole('textbox', { name: 'Dietary needs' })).toBeHidden();
        await press(page.getByRole('switch', { name: 'Joining the dinner' }));
        await see(page.getByRole('switch', { name: 'Joining the dinner' })).toBeChecked();
        await see(page.getByRole('textbox', { name: 'Dietary needs' })).toBeVisible();
      },
    },
    {
      says: 'Type an email without an @ and leave the field: it says what is wrong.',
      async run({ page, press, type, see }) {
        const email = page.getByRole('textbox', { name: 'Email' });
        await type(email, 'sara.example.com');
        // Left for the next box, as a finger or the mouse leaves it.
        await press(page.getByRole('textbox', { name: 'Company' }));
        await see(node(page, 'f-email')).toContainText('Enter an email address, like name@example.com');
        await see(email).toHaveAttribute('aria-invalid', 'true');
      },
    },
    {
      says: 'Click in Full name and pick one of your browser’s saved addresses',
      async run({ page, press, see }) {
        const name = page.getByRole('textbox', { name: 'Full name' });
        await press(name);
        // Each box says what it holds, which is how the browser knows what of the address goes in it.
        await see(name).toHaveAttribute('autocomplete', 'name');
        await see(page.getByRole('textbox', { name: 'Email' })).toHaveAttribute('autocomplete', 'email');
        await see(page.getByRole('textbox', { name: 'Company' })).toHaveAttribute('autocomplete', 'organization');
        await see(page.getByRole('textbox', { name: 'Mobile phone' })).toHaveAttribute('autocomplete', 'mobile tel');
        // The saved address picked: the browser's own list, which no Playwright browser draws (Chromium's DevTools
        // fill only cards), so the browser's fill is done as Chrome and Safari do it (e2e/autofill.spec.ts): each
        // box written whole, with no key, then input and change.
        await page.evaluate((fills) => {
          for (const [id, text] of Object.entries(fills)) {
            const box = (document.querySelector(`[data-node="${id}"] .fd-phone-input`) ?? document.querySelector(`[data-node="${id}"] input`)) as HTMLInputElement;
            box.value = text;
            box.dispatchEvent(new InputEvent('input', { bubbles: true }));
            box.dispatchEvent(new Event('change', { bubbles: true }));
          }
        }, { 'f-name': 'Sara Hassan', 'f-email': 'sara@example.com', 'f-company': 'Nile Trading', 'f-phone': '+20 100 123 4567' });
        await see(name).toHaveValue('Sara Hassan');
        await see(page.getByRole('textbox', { name: 'Email' })).toHaveValue('sara@example.com');
        await see(page.getByRole('textbox', { name: 'Email' })).toHaveAttribute('aria-invalid', 'false');
        await see(page.getByRole('textbox', { name: 'Company' })).toHaveValue('Nile Trading');
        await see(page.getByRole('textbox', { name: 'Mobile phone' })).toHaveValue('+20 10 0123 4567');
      },
    },
    {
      says: 'Submit with a required question empty: the form takes you to it.',
      async run({ page, press, type, see }) {
        const name = page.getByRole('textbox', { name: 'Full name' });
        await type(name, '', { clear: true });
        await press(page.getByRole('button', { name: 'Submit' }));
        await see(name).toBeFocused();
        await see(node(page, 'f-name')).toContainText('Full name is required');
        await see(ending(page)).toBeHidden();
      },
    },
    {
      says: 'Send it within three seconds, or without ticking “I am a person”',
      async run({ page, press, see, demo }) {
        // The name typed again, and sent without the captcha's tick.
        await page.keyboard.type('Sara Hassan', { delay: 15 });
        await see(page.getByRole('checkbox', { name: 'I am a person' })).not.toBeChecked();
        await press(page.getByRole('button', { name: 'Submit' }));
        await see(ending(page)).toContainText('Thank you. Your answers were sent.');
        const told = page.locator('.demo-bot-log li');
        await see(told).toHaveCount(1);
        await see(told.locator('> p')).toHaveText(/the captcha was not ticked\.$/);
        const sent = await demo<{ values: Record<string, unknown>; bot: Record<string, unknown> }[]>('dataSource.responses');
        expect(sent).toHaveLength(1);
        expect(sent[0].values).toMatchObject({ full_name: 'Sara Hassan', role: 'manager', attends_dinner: true });
        expect(sent[0].bot).toMatchObject({ captcha: null });
      },
    },
  ],
};
