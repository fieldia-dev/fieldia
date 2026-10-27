import { expect } from '../../fixtures';
import type { DemoReplay } from '../hand';
import { viewSource } from './support';

/** The csp demo's how-to steps, replayed by hand (e2e/how-to.spec.ts). */
export const replay: DemoReplay = {
  steps: [
    {
      says: 'Fill in the sign-up and send it: the note over the form still says the policy refused nothing.',
      async run({ page, press, type, see }) {
        const note = page.locator('p').filter({ hasText: 'Under a strict Content-Security-Policy:' });
        await see(note).toContainText('Refused by the policy so far: nothing.');
        await type(page.getByRole('textbox', { name: 'Full name' }), 'Sara Hassan');
        await type(page.getByRole('textbox', { name: 'Email' }), 'sara@example.com');
        // The browser's own list of a select: picked from it as the browser offers it.
        await page.getByRole('combobox', { name: 'Your role' }).selectOption({ label: 'Developer' });
        await press(page.getByRole('radio', { name: 'Some' }));
        await press(page.getByRole('button', { name: 'Submit' }));
        await see(page.getByText('Thank you. Your answers were sent.')).toBeVisible();
        await see(note).toContainText('Refused by the policy so far: nothing.');
      },
    },
    {
      says: 'See a customer, its conversation beside it, a sales order or every field under the same policy',
      async run(hand) {
        const { page, type, see, seePage } = hand;
        const note = page.locator('p').filter({ hasText: 'Under a strict Content-Security-Policy:' });
        await hand.follow('a customer');
        await seePage().toHaveURL(/\/csp\/\?page=customer$/);
        await see(page.locator('.fd-title textarea')).toHaveValue('Nile Traders');
        await see(page.getByRole('region', { name: 'Conversation' })).toBeVisible();
        await type(page.getByRole('textbox', { name: 'Website' }), 'niletraders.example');
        await see(note).toContainText('Refused by the policy so far: nothing.');
        await hand.follow('a sales order');
        await seePage().toHaveURL(/\/csp\/\?page=order$/);
        await see(page.locator('.fd-form').first()).toBeVisible();
        await see(page.getByRole('button', { name: '+ Add a line' })).toBeVisible();
        await see(page.getByRole('textbox', { name: 'Total', exact: true })).toHaveValue(/^\d{1,3}(,\d{3})*\.\d\d$/);
        await see(note).toContainText('Refused by the policy so far: nothing.');
        await hand.follow('every field');
        await seePage().toHaveURL(/\/csp\/\?page=fields$/);
        await see(page.getByRole('heading', { name: 'Every field' })).toBeVisible();
        await see(page.getByRole('toolbar', { name: 'Formatting' })).toBeVisible();
        await see(note).toContainText('Refused by the policy so far: nothing.');
      },
    },
    {
      says: 'Read the page’s source: each script and style tag carries the nonce.',
      notOnPhone: 'a phone’s browser has no View Source',
      async run({ page, see }) {
        const source = await viewSource(page);
        const lines = source.locator('body');
        await see(lines).toContainText('<script nonce="');
        await see(lines).toContainText('<style nonce="');
        const text = (await lines.textContent())!;
        const tags = text.match(/<(script|style)\b[^>]*>/g) ?? [];
        expect(tags.length).toBeGreaterThanOrEqual(4);
        const nonces = tags.map((tag) => /\snonce="([^"]+)"/.exec(tag)?.[1]);
        expect(nonces.filter((nonce) => !nonce), `every script and style tag carries the nonce: ${tags.join(' ')}`).toEqual([]);
        expect(new Set(nonces).size).toBe(1);
        await source.close();
      },
    },
  ],
};
