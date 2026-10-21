import { type Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { axeFindings } from './a11y-support';
import { node, open, screen } from './support';

/**
 * A review before sending, as a member of staff goes through it on the clinic's check: the last step's button reviews
 * the answers, every answer shows by step with Edit, Edit goes to the question in its step, Back to review shows them
 * again with the change, and Send sends — then the results. By keyboard alone too.
 */

const CHECK = 'page=training-check&skin=outlined';
const box = (page: Page, id: string) => node(page, id).locator('input, select, textarea').first();
const review = (page: Page) => page.locator('.fd-review');
const row = (page: Page, field: string) => review(page).locator(`.fd-review-row[data-field="${field}"]`);

async function answer(page: Page) {
  // Ten minutes, from Start.
  await page.getByRole('button', { name: 'Start' }).click();
  await box(page, 'q-name').fill('Mona Adel');
  await node(page, 'q-role').getByLabel('Nurse').check();
  await page.getByRole('button', { name: 'Next' }).click();
  await node(page, 'q-reversible').getByLabel('Hyaluronic acid').check();
  await box(page, 'q-enzyme').fill('collagenase');
  await node(page, 'q-signs').getByLabel('Blanching of the skin').check();
  await page.getByRole('button', { name: 'Next' }).click();
  await box(page, 'q-wait').fill('30');
  await node(page, 'q-consent').getByLabel('Before the treatment, after the risks are explained').check();
  await page.getByRole('button', { name: 'Next' }).click();
}

test.describe('a review before sending', () => {
  test('shows every answer by step with Edit; Edit goes to the question, Back to review shows the change, Send sends', async ({ page }) => {
    await open(page, 'plain', CHECK);
    await answer(page);
    await expect(page.getByRole('button', { name: 'Send my answers' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Review your answers' }).click();
    await expect(review(page)).toBeVisible();
    await expect(review(page).getByRole('heading', { name: 'Check your answers' })).toBeFocused();
    await expect(review(page).locator('.fd-review-group-title')).toHaveText(['About you', 'Fillers', 'Care and consent', 'From the question bank']);
    await expect(row(page, 'enzyme').locator('.fd-review-answer')).toHaveText('collagenase');
    await expect(row(page, 'signs').locator('.fd-review-answer')).toHaveText('Blanching of the skin');
    await expect(row(page, 'confidence').locator('.fd-review-answer')).toHaveText('Not answered');
    await screen(page, 'survey-review');
    expect(await axeFindings(page, 'a review before sending')).toEqual([]);
    // Edit: the question in its step.
    await row(page, 'enzyme').getByRole('button', { name: 'Edit Which enzyme dissolves it?' }).click();
    await expect(review(page)).toBeHidden();
    await expect(box(page, 'q-enzyme')).toBeFocused();
    await box(page, 'q-enzyme').fill('Hyaluronidase');
    await page.getByRole('button', { name: 'Back to review' }).click();
    await expect(row(page, 'enzyme').locator('.fd-review-answer')).toHaveText('Hyaluronidase');
    await page.getByRole('button', { name: 'Send my answers' }).click();
    await expect(page.locator('.fd-quiz')).toBeVisible();
    await expect(page.locator('.fd-quiz-item[data-field="enzyme"]')).toHaveAttribute('data-mark', 'right');
  });

  test('is reached and left by keyboard alone', async ({ page }) => {
    await open(page, 'plain', CHECK);
    await answer(page);
    // Ctrl+Enter on the last step reviews, as its button does.
    await node(page, 'step-bank').locator('input:visible').first().focus();
    await page.keyboard.press('Control+Enter');
    await expect(review(page)).toBeVisible();
    await page.keyboard.press('Tab');
    await expect(row(page, 'name').getByRole('button')).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(box(page, 'q-name')).toBeFocused();
  });
});
