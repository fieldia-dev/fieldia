import { type Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { axeFindings } from './a11y-support';
import { node, open, screen } from './support';

/**
 * One question at a time, as a buyer answers a home search: each question alone on the screen, Enter or OK going on,
 * a choice going on by itself once picked by the pointer or its letter, ↑ and ↓ going back and on, how far said, a
 * question an answer hides passed over, a required one refused where it stands — then the ending. Right to left in
 * Arabic, and on a phone.
 */

const HOME = 'page=find-a-home&skin=outlined';
const current = (page: Page) => page.locator('[data-fd-current]');
const count = (page: Page) => page.locator('.fd-flow-count');

test.describe('one question at a time', () => {
  test('asks each question alone; Enter, a pick and its letter go on; ↑ goes back; an answer hides what does not apply', async ({ page }) => {
    await open(page, 'plain', HOME);
    await expect(current(page)).toHaveAttribute('data-node', 'q-name');
    await expect(count(page)).toHaveText('Question 1 of 7');
    // Only this question, with the words before it.
    await expect(node(page, 'welcome')).toBeVisible();
    await expect(node(page, 'q-kind')).toBeHidden();
    await node(page, 'q-name').locator('input').focus();
    await screen(page, 'survey-flow-one-first');
    // Enter with nothing typed: refused where it stands.
    await page.keyboard.press('Enter');
    await expect(current(page)).toHaveAttribute('data-node', 'q-name');
    await expect(node(page, 'q-name').locator('[aria-invalid="true"]')).toHaveCount(1);
    await node(page, 'q-name').locator('input').fill('Mona');
    await page.keyboard.press('Enter');
    await expect(current(page)).toHaveAttribute('data-node', 'q-kind');
    await expect(node(page, 'q-kind')).toContainText('What are you looking for, Mona?');
    // A pick by the pointer goes on by itself.
    await node(page, 'q-kind').getByText('An office').click();
    // An office has no bedrooms: that question is passed, and the count follows.
    await expect(current(page)).toHaveAttribute('data-node', 'q-areas');
    await expect(count(page)).toHaveText('Question 3 of 6');
    // ↑ goes back, by its button and by its key where no box takes it.
    await page.getByRole('button', { name: 'Previous question' }).click();
    await expect(current(page)).toHaveAttribute('data-node', 'q-kind');
    // Back on it, its first option has the focus: a letter picks the option it stands beside, and goes on.
    await expect(node(page, 'q-kind').locator('input').first()).toBeFocused();
    await page.keyboard.press('KeyB');
    await expect(node(page, 'q-kind').getByLabel('A villa')).toBeChecked();
    await expect(current(page)).toHaveAttribute('data-node', 'q-bedrooms');
    await expect(count(page)).toHaveText('Question 3 of 7');
    await node(page, 'q-bedrooms').getByText('Three').click();
    // Several to pick: nothing goes on by itself; OK does.
    await expect(current(page)).toHaveAttribute('data-node', 'q-areas');
    await node(page, 'q-areas').getByText('New Cairo').click();
    await node(page, 'q-areas').getByText('Maadi').click();
    await expect(current(page)).toHaveAttribute('data-node', 'q-areas');
    await screen(page, 'survey-flow-one-several');
    expect(await axeFindings(page, 'one question at a time')).toEqual([]);
    await page.getByRole('button', { name: 'OK' }).click();
    await node(page, 'q-budget').getByText('EGP 5M to 10M').click();
    await node(page, 'q-phone').locator('input').fill('+20 100 123 4567');
    await page.keyboard.press('Enter');
    await expect(current(page)).toHaveAttribute('data-node', 'q-notes');
    await expect(page.getByRole('button', { name: 'Submit' })).toBeVisible();
    await page.getByRole('button', { name: 'Submit' }).click();
    await expect(page.locator('.fd-done-title')).toHaveText('Thank you, Mona');
  });

  test('reads right to left in Arabic, and fits a phone', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 780 });
    await open(page, 'plain', `${HOME}&locale=ar&dir=rtl`);
    await expect(count(page)).toHaveText('السؤال 1 من 7');
    await node(page, 'q-name').locator('input').fill('منى');
    await page.getByRole('button', { name: 'موافق' }).click();
    await expect(current(page)).toHaveAttribute('data-node', 'q-kind');
    const width = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(width).toBeLessThanOrEqual(390);
    await screen(page, 'survey-flow-one-arabic-phone');
  });
});
