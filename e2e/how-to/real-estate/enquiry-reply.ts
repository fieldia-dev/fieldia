import type { Locator, Page } from '@playwright/test';
import type { DemoReplay } from '../hand';
import { followLink, part } from './support';

/** A proposal of AI help under its field: what is proposed, struck through what was there. */
const proposalOf = (page: Page, id: string) => part(page, id).locator('.fd-proposal');
/**
 * A press on a box's last line, past its last word (clear of its resize grip in the corner): the caret at the end, as a
 * finger or the mouse puts it — the box grows with its words, so its last line is its bottom.
 */
const atTheEnd = async (box: Locator) => {
  const size = (await box.boundingBox())!;
  return { x: size.width - 40, y: size.height - 10 };
};

export const replay: DemoReplay = {
  steps: [
    {
      says: 'Press Fill from their message: Villa, New Cairo, a budget of 15,000,000 and 4 bedrooms are proposed',
      async run({ page, press, see }) {
        await press(page.getByRole('button', { name: 'Fill from their message' }));
        const review = page.locator('.fd-assist-review');
        await see(review).toContainText('4 values proposed');
        await see(proposalOf(page, 'f-kind').locator('ins')).toHaveText('Villa');
        await see(proposalOf(page, 'f-district').locator('ins')).toHaveText('New Cairo');
        await see(proposalOf(page, 'f-budget').locator('ins')).toContainText('15,000,000');
        await see(proposalOf(page, 'f-bedrooms').locator('ins')).toHaveText('4');
        // Nothing written until accepted.
        await see(page.getByRole('textbox', { name: 'Budget' })).toHaveValue('');
        await press(review.getByRole('button', { name: 'Accept all' }));
        await see(page.locator('.fd-proposal')).toHaveCount(0);
        await see(page.getByRole('combobox', { name: 'Type' }).locator('option:checked')).toHaveText('Villa');
        await see(page.getByRole('combobox', { name: 'District' }).locator('option:checked')).toHaveText('New Cairo');
        await see(page.getByRole('textbox', { name: 'Budget' })).toHaveValue('15,000,000');
        await see(page.getByRole('textbox', { name: 'Bedrooms' })).toHaveValue('4');
      },
    },
    {
      says: 'Press Draft under Your reply: a reply to Hana for a villa in New Cairo is proposed under the box',
      async run({ page, press, keys, see }) {
        const reply = part(page, 'f-reply');
        const box = reply.getByRole('textbox', { name: 'Your reply' });
        await press(reply.getByRole('button', { name: 'Draft' }));
        const proposed = proposalOf(page, 'f-reply');
        await see(proposed).toContainText('Proposed text');
        await see(proposed.locator('.fd-proposal-text')).toContainText('Dear Hana,');
        await see(proposed.locator('.fd-proposal-text')).toContainText('Thank you for your enquiry about a villa in New Cairo with 4 bedrooms, up to EGP 15,000,000.');
        await see(proposed).toContainText('Stand-in AI, no model: written from this record’s fields by a template.');
        await see(box).toHaveValue('');
        await press(proposed.getByRole('button', { name: 'Accept' }));
        await see(box).toHaveValue(/^Dear Hana,\n\nThank you for your enquiry about a villa in New Cairo/);
        await see(box).toHaveValue(/Riverside Realty$/);
        // A word changed: the agency's last word put as the agent writes it.
        await press(box, { position: await atTheEnd(box) });
        await keys(...Array<string>('Realty'.length).fill('Backspace'));
        await page.keyboard.type('Homes', { delay: 15 });
        await see(box).toHaveValue(/Riverside Homes$/);
        await see(proposed).toHaveCount(0);
      },
    },
    {
      says: 'Open Omar’s enquiry: his reply was typed in a hurry',
      async run(hand) {
        const { page, press, see } = hand;
        await followLink(hand, 'Open Omar’s enquiry');
        const reply = part(page, 'f-reply');
        const box = reply.getByRole('textbox', { name: 'Your reply' });
        await see(box).toHaveValue(/^hi omar\n\nthx for ur msg/);
        await press(reply.getByRole('button', { name: 'Polish' }));
        const proposed = proposalOf(page, 'f-reply');
        await see(proposed.locator('.fd-proposal-text')).toHaveText('Hi Omar,\n\nThanks for your message. We have 2 flats in Zamalek that fit your budget, one with a Nile view. Can you come on Thursday at 5pm? Please let me know as soon as possible.\n\nRegards,\nMona');
        // Shown before it is kept: the box still holds what was typed.
        await see(box).toHaveValue(/^hi omar/);
        await press(proposed.getByRole('button', { name: 'Accept' }));
        await see(box).toHaveValue(/^Hi Omar,\n\nThanks for your message\./);
      },
    },
    {
      says: 'Press Draft and type in the reply before it comes',
      async run({ page, press, see }) {
        const reply = part(page, 'f-reply');
        const box = reply.getByRole('textbox', { name: 'Your reply' });
        await press(reply.getByRole('button', { name: 'Draft' }));
        // Before it comes: the draft still being written as the typing starts.
        await see(reply.getByRole('button', { name: 'Writing…' }), 'the draft still to come as the reply is typed in').toBeVisible();
        await press(box, { position: await atTheEnd(box) });
        await page.keyboard.type(' See you then.', { delay: 15 });
        await see(box).toHaveValue(/Mona See you then\.$/);
        await see(reply.getByRole('button', { name: 'Draft' })).toBeVisible();
        await see(proposalOf(page, 'f-reply')).toHaveCount(0);
      },
    },
  ],
};
