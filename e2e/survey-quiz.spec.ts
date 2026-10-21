import { type Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { axeFindings } from './a11y-support';
import { node, open, screen } from './support';

/**
 * A quiz's results, as a member of staff meets them: a clinic's injectables check answered — a choice wrong, a word
 * typed in another case, several ticked, a number typed — and sent; the score, each question marked right or wrong in
 * words, the right answer to one missed and the trainer's feedback under the thanks, read out first.
 */

const CHECK = 'page=training-check&skin=outlined';
const box = (page: Page, id: string) => node(page, id).locator('input, select, textarea').first();
const results = (page: Page) => page.locator('.fd-quiz');
const item = (page: Page, field: string) => results(page).locator(`.fd-quiz-item[data-field="${field}"]`);

/** The check answered as a nurse who misses the filler and the minutes, and leaves the last question unanswered. */
async function answer(page: Page) {
  await box(page, 'q-name').fill('Mona Adel');
  await node(page, 'q-role').getByLabel('Nurse').check();
  await page.getByRole('button', { name: 'Next' }).click();
  await node(page, 'q-reversible').getByLabel('Calcium hydroxylapatite').check();
  await box(page, 'q-enzyme').fill('  HYALURONIDASE ');
  await node(page, 'q-signs').getByLabel('Blanching of the skin').check();
  await node(page, 'q-signs').getByLabel('Severe pain at the site').check();
  await page.getByRole('button', { name: 'Next' }).click();
  await box(page, 'q-wait').fill('45');
  await node(page, 'q-consent').getByLabel('Before the treatment, after the risks are explained').check();
  // Two of the bank's questions drawn: left unanswered.
  await page.getByRole('button', { name: 'Next' }).click();
  // Every answer shown first, then sent.
  await page.getByRole('button', { name: 'Review your answers' }).click();
  await page.getByRole('button', { name: 'Send my answers' }).click();
}

test.describe('a quiz’s results under the thanks', () => {
  test('says the score, each answer right or wrong, the right answer to one missed and the feedback — read out first', async ({ page }) => {
    await open(page, 'plain', CHECK);
    await answer(page);
    await expect(results(page)).toBeVisible();
    await expect(results(page).locator('.fd-quiz-title')).toBeFocused();
    await expect(results(page).locator('.fd-quiz-score')).toHaveText('You scored 4 of 10 (40%)');
    await expect(item(page, 'reversible')).toHaveAttribute('data-mark', 'wrong');
    await expect(item(page, 'reversible').locator('.fd-quiz-verdict')).toHaveText('Wrong');
    await expect(item(page, 'reversible').locator('.fd-quiz-answer')).toHaveText('Your answer: Calcium hydroxylapatite');
    await expect(item(page, 'reversible').locator('.fd-quiz-right-answer')).toHaveText('Right answer: Hyaluronic acid');
    await expect(item(page, 'reversible').locator('.fd-quiz-feedback')).toHaveText('Only hyaluronic acid can be dissolved: hyaluronidase breaks it down.');
    // A word is right whatever its case and the spaces round it; no right answer shown for one answered rightly.
    await expect(item(page, 'enzyme')).toHaveAttribute('data-mark', 'right');
    await expect(item(page, 'enzyme').locator('.fd-quiz-right-answer')).toHaveCount(0);
    await expect(item(page, 'signs').locator('.fd-quiz-points')).toHaveText('2 of 2');
    await expect(item(page, 'signs').locator('.fd-quiz-feedback')).toHaveText('Right: blanching and severe pain come first. Stop injecting at once.');
    await expect(item(page, 'wait_minutes').locator('.fd-quiz-right-answer')).toHaveText('Right answer: 30');
    // A question of points alone is marked neither right nor wrong; one not answered says so by its points.
    await expect(item(page, 'confidence')).toHaveAttribute('data-mark', 'points');
    await expect(item(page, 'confidence').locator('.fd-quiz-verdict')).toHaveCount(0);
    await expect(item(page, 'confidence').locator('.fd-quiz-points')).toHaveText('0 of 2');
    // Questions that ask nothing to mark — a name, a role — are not listed; of the bank's four, the two drawn.
    await expect(results(page).locator('.fd-quiz-item')).toHaveCount(8);
    await expect(results(page).locator('.fd-quiz-item[data-field^="bank_"]')).toHaveCount(2);
    await screen(page, 'survey-quiz-results');
    expect(await axeFindings(page, 'a quiz’s results')).toEqual([]);
    // Another response starts with none in sight.
    await page.getByRole('button', { name: 'Submit another response' }).click();
    await expect(results(page)).toBeHidden();
    await expect(box(page, 'q-name')).toHaveValue('');
  });
});
