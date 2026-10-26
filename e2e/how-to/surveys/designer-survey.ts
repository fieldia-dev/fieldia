import type { Page } from '@playwright/test';
import { expect } from '../../fixtures';
import type { DemoReplay, Hand } from '../hand';

/** The survey designer's cards; the one picked, open; a card's question words, open or closed. */
const cards = (page: Page) => page.locator('.fd-q');
const picked = (page: Page) => page.locator('.fd-q-selected');
const cardOf = (page: Page, words: string) => cards(page).filter({ has: page.locator('.fd-q-text', { hasText: words }) });
/** A button of the designer's bar: on a phone the bar is one row, the rest of it under More. */
async function inBar({ page, phone, press }: Hand, name: string) {
  const bar = page.locator('.fd-designer-bar');
  if (phone) {
    const more = bar.getByRole('button', { name: 'More', exact: true });
    if ((await more.getAttribute('aria-expanded')) !== 'true') await press(more);
  }
  await press(bar.getByRole('button', { name, exact: true }));
}

/** The designer-survey demo's how-to steps, replayed by hand (e2e/how-to.spec.ts). */
export const replay: DemoReplay = {
  steps: [
    {
      says: 'Press the question “How would you rate it?”: its card opens',
      async run({ page, press, type, see }) {
        await press(cardOf(page, 'How would you rate it?').locator('.fd-q-text'));
        const words = picked(page).getByRole('textbox', { name: 'Question' });
        await see(words).toHaveValue('How would you rate it?');
        await see(words).toBeFocused();
        await type(words, 'How would you rate the product?', { clear: true });
        await see(words).toHaveValue('How would you rate the product?');
        // Its kind, from the menu beside its words.
        const kind = picked(page).getByRole('button', { name: /^Kind of question:/ });
        await see(kind).toHaveAccessibleName('Kind of question: Rating');
        await press(kind);
        await press(page.getByRole('menu', { name: 'Kind of question' }).getByRole('menuitemradio', { name: 'Linear scale' }));
        await see(picked(page).getByRole('button', { name: /^Kind of question:/ })).toHaveAccessibleName('Kind of question: Linear scale');
        await see(picked(page).getByRole('textbox', { name: 'Question' })).toHaveValue('How would you rate the product?');
      },
    },
    {
      says: 'Press Dropdown in the toolbox: a question of that kind is added under the one picked',
      async run({ page, phone, press, see }) {
        const before = await cards(page).count();
        if (phone) {
          // The phone's toolbox, behind the + at the foot.
          await press(page.locator('.fd-q-rail').getByRole('button', { name: 'Open the toolbox' }));
          const sheet = page.getByRole('dialog', { name: 'Add, outline and data' });
          await see(sheet).toBeVisible();
          await press(sheet.getByRole('button', { name: /^Dropdown/ }));
          await see(sheet).toBeHidden();
        } else {
          await press(page.getByRole('complementary', { name: 'Add a field' }).getByRole('button', { name: 'Dropdown', exact: true }));
        }
        await see(cards(page)).toHaveCount(before + 1);
        await see(picked(page).getByRole('button', { name: /^Kind of question:/ })).toHaveAccessibleName('Kind of question: Dropdown');
        // Under the one picked: right after it.
        await see(cardOf(page, 'How would you rate the product?').locator('xpath=following-sibling::*[1]')).toHaveClass(/fd-q-selected/);
        const words = picked(page).getByRole('textbox', { name: 'Question' });
        await see(words).toBeFocused();
        await page.keyboard.type('Which plan are you on?', { delay: 15 });
        await see(words).toHaveValue('Which plan are you on?');
      },
    },
    {
      says: 'Drag a question by the handle at its top to another place, or onto another page.',
      notOnPhone: 'a card is carried by a finger’s drag, which Playwright’s WebKit has none of',
      async run({ page, drag, hover, see }) {
        const card = picked(page);
        const rated = cardOf(page, 'How would you rate the product?');
        await rated.scrollIntoViewIfNeeded();
        // The six dots across its top, where the pointer is.
        await hover(card);
        const grip = card.getByRole('button', { name: 'Drag to move' });
        await see(grip).toHaveCSS('opacity', '1');
        const above = (await rated.boundingBox())!;
        const from = (await grip.boundingBox())!;
        await drag(grip, { x: from.x + from.width / 2, y: above.y + above.height * 0.25 });
        const page3 = page.locator('.fd-design-step').nth(2).locator('.fd-q');
        await see(page3.nth(0).getByRole('textbox', { name: 'Question' })).toHaveValue('Which plan are you on?');
        await see(page3.nth(1).locator('.fd-q-text')).toContainText('How would you rate the product?');
      },
    },
    {
      says: 'Press Try it: the survey works as people will answer it',
      async run(hand) {
        const { page, press, type, see } = hand;
        await inBar(hand, 'Try it');
        const tried = page.getByRole('region', { name: 'Try the page' });
        await see(tried).toBeVisible();
        await type(tried.getByRole('textbox', { name: 'Your name' }), 'Omar');
        await press(tried.getByRole('button', { name: 'Next' }));
        // Each answer leading where it says: No leads to "Why not".
        await press(tried.getByRole('radio', { name: 'No' }));
        await see(tried.getByRole('navigation', { name: 'Steps' }).getByRole('button').locator('bdi')).toHaveText(['About you', 'Using the product', 'Why not', 'Last thing']);
        await press(tried.getByRole('button', { name: 'Next' }));
        await see(tried.getByRole('heading', { name: 'Why not', level: 2 })).toBeVisible();
        await inBar(hand, 'Design');
        await see(tried).toBeHidden();
        await see(cardOf(page, 'How would you rate the product?')).toBeVisible();
      },
    },
    {
      says: 'Press Publish: what changed since the last version is said',
      async run({ page, press, type, see }) {
        const status = page.locator('.fd-designer-status');
        await press(page.getByRole('button', { name: 'Publish', exact: true }));
        const first = page.getByRole('dialog', { name: 'Publish version 1?' });
        await see(first.locator('.fd-publish-changes li')).toHaveText([/^The first version: \d+ questions on 5 pages$/]);
        await press(first.getByRole('button', { name: 'Publish version 1' }));
        await see(status).toHaveText('Published · version 1');
        // A change since, and Publish says it.
        await press(cardOf(page, 'Your name').locator('.fd-q-text'));
        await type(picked(page).getByRole('textbox', { name: 'Question' }), 'Your full name', { clear: true });
        await press(page.getByRole('button', { name: 'Publish', exact: true }));
        const second = page.getByRole('dialog', { name: 'Publish version 2?' });
        await see(second.locator('.fd-publish-changes li')).toHaveText(['Renamed “Your name” to “Your full name”']);
        await press(second.getByRole('button', { name: 'Publish version 2' }));
        await see(status).toHaveText('Published · version 2');
      },
    },
    {
      says: 'On a phone, the toolbox waits behind the + at the foot of the screen.',
      async run({ page, phone, press, see }) {
        // The window narrowed to a phone's width (on the phone, already so).
        if (!phone) {
          await page.setViewportSize({ width: 390, height: 844 });
          // The demos' menu, never left over the page once the window is narrowed.
          await see(page.getByRole('complementary', { name: 'All demos' })).not.toBeInViewport();
        }
        await see(page.getByRole('complementary', { name: 'Add a field' })).toBeHidden();
        const plus = page.locator('.fd-q-rail').getByRole('button', { name: 'Open the toolbox' });
        await see(plus).toBeInViewport();
        const height = page.viewportSize()!.height;
        expect((await plus.boundingBox())!.y, 'the + at the foot of the screen').toBeGreaterThan(height * 0.7);
        await press(plus);
        const sheet = page.getByRole('dialog', { name: 'Add, outline and data' });
        await see(sheet).toBeVisible();
        await see(sheet.getByRole('button', { name: /^Dropdown/ })).toBeVisible();
      },
    },
  ],
};
