import { expect } from '../../fixtures';
import type { DemoReplay } from '../hand';

/** The training-check demo’s how-to steps, replayed by hand (e2e/how-to.spec.ts). */
export const replay: DemoReplay = {
  steps: [
    {
      says: 'Press Start: you have 10 minutes, counted down',
      async run({ page, press, type, see }) {
        await see(page.getByText('You have 10 minutes to answer, from when you press Start.')).toBeVisible();
        await press(page.getByRole('button', { name: 'Start' }));
        const clock = page.getByRole('timer');
        await see(clock).toContainText(/Time left: (10:00|9:5\d)/);
        await type(page.getByRole('textbox', { name: '*Your name' }), 'Nadia Samir');
        await press(page.getByRole('radio', { name: 'Nurse' }));
        await press(page.getByRole('button', { name: 'Next', exact: true }));
        await see(page.getByRole('region', { name: 'Fillers' })).toBeVisible();
        await press(page.getByRole('radio', { name: 'Calcium hydroxylapatite' }));
        await type(page.getByRole('textbox', { name: '*Which enzyme dissolves it?' }), 'hyaluronidase');
        await press(page.getByRole('checkbox', { name: 'Blanching of the skin' }));
        await press(page.getByRole('checkbox', { name: 'Severe pain at the site' }));
        await see(page.getByRole('radio', { name: 'Calcium hydroxylapatite' })).toBeChecked();
        await see(page.getByRole('checkbox', { name: 'Severe pain at the site' })).toBeChecked();
        // Counted down as the questions are answered.
        await see(clock).toContainText(/Time left: 9:\d\d/);
      },
    },
    {
      says: 'On Care and consent type 45 minutes',
      async run({ page, press, type, see }) {
        await press(page.getByRole('button', { name: 'Next', exact: true }));
        const care = page.getByRole('region', { name: 'Care and consent' });
        await see(care).toBeVisible();
        await type(care.getByRole('textbox').first(), '45');
        await press(care.getByRole('radio', { name: /^Before the treatment/ }));
        await see(care.getByRole('radio', { name: /^Before the treatment/ })).toBeChecked();
        await press(page.getByRole('button', { name: 'Next', exact: true }));
        const bank = page.locator('[data-node="step-bank"]');
        await see(bank).toBeVisible();
        await see(bank.locator('[data-node^="q-bank-"]:visible')).toHaveCount(2);
      },
    },
    {
      says: 'Press Review your answers: every answer shows by step',
      async run({ page, press, see }) {
        await press(page.getByRole('button', { name: 'Review your answers' }));
        const review = page.locator('.fd-review');
        await see(review.getByRole('heading', { name: 'Check your answers' })).toBeVisible();
        await see(review.locator('.fd-review-group-title')).toHaveText(['About you', 'Fillers', 'Care and consent', 'From the question bank']);
        await see(review.locator('.fd-review-row[data-field="enzyme"] .fd-review-answer')).toHaveText('hyaluronidase');
        await see(review.locator('.fd-review-row[data-field="reversible"] .fd-review-answer')).toHaveText('Calcium hydroxylapatite');
        const rows = review.locator('.fd-review-row');
        const count = await rows.count();
        expect(count).toBeGreaterThanOrEqual(8);
        await see(review.getByRole('button', { name: /^Edit / })).toHaveCount(count);
      },
    },
    {
      says: 'Press Edit beside the enzyme: its step opens at that question',
      async run({ page, press, see }) {
        const review = page.locator('.fd-review');
        await press(review.getByRole('button', { name: 'Edit Which enzyme dissolves it?' }));
        await see(review).toBeHidden();
        await see(page.getByRole('region', { name: 'Fillers' })).toBeVisible();
        await see(page.getByRole('textbox', { name: '*Which enzyme dissolves it?' })).toBeFocused();
        await press(page.getByRole('button', { name: 'Back to review' }));
        await see(review).toBeVisible();
        await press(page.getByRole('button', { name: 'Send my answers' }));
        await see(page.locator('.fd-done')).toBeVisible();
      },
    },
    {
      says: 'Your results show under the thanks: “You scored 4 of 10 (40%)”',
      async run({ page, see }) {
        const results = page.locator('.fd-quiz');
        const item = (field: string) => results.locator(`.fd-quiz-item[data-field="${field}"]`);
        await see(results.locator('.fd-quiz-score')).toHaveText('You scored 4 of 10 (40%)');
        await see(item('reversible').locator('.fd-quiz-verdict')).toHaveText('Wrong');
        await see(item('reversible').locator('.fd-quiz-right-answer')).toHaveText('Right answer: Hyaluronic acid');
        await see(item('reversible').locator('.fd-quiz-feedback')).toHaveText('Only hyaluronic acid can be dissolved: hyaluronidase breaks it down.');
        await see(item('enzyme')).toHaveAttribute('data-mark', 'right');
        await see(item('enzyme').locator('.fd-quiz-verdict')).toHaveText('Right');
        await see(item('wait_minutes')).toHaveAttribute('data-mark', 'wrong');
        await see(item('wait_minutes').locator('.fd-quiz-right-answer')).toHaveText('Right answer: 30');
      },
    },
    {
      says: '“How sure are you about handling a blocked vessel?” has points',
      async run({ page, see }) {
        const items = page.locator('.fd-quiz .fd-quiz-item');
        // The question of points alone: How sure are you…, its points shown, no verdict and no right answer.
        const points = items.filter({ hasText: 'How sure are you about handling a blocked vessel?' });
        await see(points).toHaveAttribute('data-mark', 'points');
        await see(points.locator('.fd-quiz-points')).toHaveText('0 of 2');
        await see(points.locator('.fd-quiz-verdict')).toHaveCount(0);
        await see(points.locator('.fd-quiz-right-answer')).toHaveCount(0);
      },
    },
  ],
};
