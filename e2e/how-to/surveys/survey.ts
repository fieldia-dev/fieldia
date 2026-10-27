import type { Page } from '@playwright/test';
import { expect } from '../../fixtures';
import type { DemoReplay } from '../hand';
import { ending } from './support';

/** A survey's steps, as their list over the questions names them. */
const stepsList = (page: Page) => page.getByRole('navigation', { name: 'Steps' }).getByRole('button');
/** Each step's words in the list, those shown (its ✓ or – drawn before them: fd-step-done, fd-step-skipped). */
const stepNames = (page: Page) => stepsList(page).locator('bdi');

/** The survey demo's how-to steps, replayed by hand (e2e/how-to.spec.ts). */
export const replay: DemoReplay = {
  steps: [
    {
      says: 'Answer that you use the product: "Your experience" comes next',
      async run({ page, press, type, see }) {
        await type(page.getByRole('textbox', { name: 'Your name' }), 'Omar');
        await press(page.getByRole('button', { name: 'Next' }));
        await see(page.getByRole('heading', { name: 'Using the product', level: 2 })).toBeVisible();
        await press(page.getByRole('radio', { name: 'Yes' }));
        await see(stepNames(page)).toHaveText(['About you', 'Using the product', 'Your experience', 'Last thing']);
        await see(stepsList(page).first(), 'About you ticked as done').toHaveClass(/fd-step-done/);
        await press(page.getByRole('button', { name: 'Next' }));
        await see(page.getByRole('heading', { name: 'Your experience', level: 2 })).toBeVisible();
        // Back, and the other answer: "Why not" in its place.
        await press(page.getByRole('button', { name: 'Back' }));
        await press(page.getByRole('radio', { name: 'No' }));
        await see(stepNames(page)).toHaveText(['About you', 'Using the product', 'Why not', 'Last thing']);
        await press(page.getByRole('button', { name: 'Next' }));
        await see(page.getByRole('heading', { name: 'Why not', level: 2 })).toBeVisible();
        await see(page.getByRole('textbox', { name: 'What stops you from using it?' })).toBeVisible();
      },
    },
    {
      says: 'Click a step in the list to go back to it.',
      async run({ page, press, see }) {
        await press(stepsList(page).filter({ hasText: 'About you' }));
        await see(page.getByRole('heading', { name: 'About you', level: 2 })).toBeVisible();
        await see(page.getByRole('textbox', { name: 'Your name' })).toHaveValue('Omar');
        await see(page.locator('.fd-progress-text')).toHaveText('Step 1 of 4');
      },
    },
    {
      says: 'Press Skip on the optional step: its answers are left out.',
      async run({ page, press, see }) {
        // The optional step is the users' one: back to the question, and Yes.
        await press(stepsList(page).filter({ hasText: 'Using the product' }));
        await press(page.getByRole('radio', { name: 'Yes' }));
        await press(page.getByRole('button', { name: 'Next' }));
        await see(page.getByRole('heading', { name: 'Your experience', level: 2 })).toBeVisible();
        // An answer given, then skipped: the step said skipped in the list, and the next one shown.
        await press(page.getByRole('radio', { name: '4 of 5' }));
        await press(page.getByRole('button', { name: 'Skip' }));
        await see(page.getByRole('heading', { name: 'Last thing', level: 2 })).toBeVisible();
        await see(stepNames(page)).toHaveText(['About you', 'Using the product', 'Your experience', 'Last thing']);
        await see(stepsList(page).nth(1), 'Using the product ticked as done').toHaveClass(/fd-step-done/);
        await see(stepsList(page).nth(2), 'Your experience marked skipped (–)').toHaveClass(/fd-step-skipped/);
      },
    },
    {
      says: 'Send the answers on the last step.',
      async run({ page, press, see, demo }) {
        await press(page.getByRole('button', { name: 'Send my answers' }));
        await see(ending(page)).toContainText('Thank you. Your answers were sent.');
        const sent = await demo<{ values: Record<string, unknown> }[]>('dataSource.responses');
        expect(sent).toHaveLength(1);
        expect(sent[0].values).toMatchObject({ name: 'Omar', uses_product: 'yes' });
        // The skipped step's answer left out, and the other path's.
        expect(sent[0].values).not.toHaveProperty('rating');
        expect(sent[0].values).not.toHaveProperty('reason_not');
      },
    },
  ],
};
