import { expect } from '../../fixtures';
import type { DemoReplay } from '../hand';
import { node } from './support';

/** The signup-keys demo's how-to steps, replayed by hand (e2e/how-to.spec.ts). */
export const replay: DemoReplay = {
  steps: [
    {
      says: 'Type your name and press Enter: the cursor goes to the next field.',
      async run({ page, type, keys, see }) {
        const name = page.getByRole('textbox', { name: 'Full name' });
        await type(name, 'Sara Hassan');
        await keys('Enter');
        await see(page.getByRole('textbox', { name: 'Email' })).toBeFocused();
        await see(name).toHaveValue('Sara Hassan');
      },
    },
    {
      says: 'Fill in an email correctly: a ✓ appears by its label.',
      async run({ page, see }) {
        const email = node(page, 'f-email');
        await see(email.locator('.fd-valid-mark')).toBeHidden();
        await page.keyboard.type('sara@', { delay: 15 });
        await see(email.locator('.fd-valid-mark')).toBeHidden();
        await page.keyboard.type('example.com', { delay: 15 });
        await see(email.locator('.fd-valid-mark')).toBeVisible();
        // By its label.
        const [mark, label] = [(await email.locator('.fd-valid-mark').boundingBox())!, (await email.locator('.fd-label').boundingBox())!];
        expect(Math.abs(mark.y + mark.height / 2 - (label.y + label.height / 2))).toBeLessThan(label.height);
      },
    },
    {
      says: 'Press Ctrl+Enter (⌘+Enter on a Mac) to send from anywhere.',
      notOnPhone: 'a phone has no Ctrl key: its Submit button sends there',
      async run({ page, press, keys, mod, see, demo }) {
        // From the email box, with Your role not yet chosen: sent to be checked, and what is missing said.
        await keys(`${mod}+Enter`);
        await see(page.locator('.fd-announce')).toContainText('Your role');
        await see(node(page, 'f-role').locator('.fd-error')).toBeVisible();
        // A role chosen in the browser's own list, then Ctrl+Enter from the company's box: sent.
        await node(page, 'f-role').getByRole('combobox').selectOption({ label: 'Developer' });
        await press(page.getByRole('textbox', { name: 'Company' }));
        await keys(`${mod}+Enter`);
        await see(page.getByText('Thank you. Your answers were sent.')).toBeVisible();
        expect((await demo<{ values: Record<string, unknown> }[]>('dataSource.responses'))[0].values).toMatchObject({ full_name: 'Sara Hassan', email: 'sara@example.com', role: 'developer' });
      },
    },
  ],
};
