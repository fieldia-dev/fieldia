import { type Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { node, open, screen } from './support';

/**
 * Save and resume on another device, as a patient meets it on the clinic's long intake (its page's `continueLater`):
 * Continue later keeps the answers on the clinic's server — the demo's memory source, kept in this browser so another
 * tab finds them — and shows the link to carry on from; the link opens the form at the step reached, the answers in
 * place, and text typed that did not read still as typed, its words said. A link to answers sent already says so.
 */

const WIDE = { width: 1280, height: 900 };
const shownStep = (page: Page) => page.locator('.fd-step:not([hidden]) .fd-step-title');

let problems: string[] = [];
test.afterEach(() => expect(problems).toEqual([]));

test.describe('a long intake, continued from its link', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(WIDE);
    ({ problems } = await open(page, 'plain', 'page=clinic-intake&skin=outlined'));
  });

  test('Continue later keeps the answers and the step, and its link opens them in another tab', async ({ page, context }) => {
    await node(page, 'f-name').locator('input').fill('Karim Fathy');
    const birth = node(page, 'f-birth').locator('input');
    await birth.fill('03/02/1990');
    await birth.press('Tab');
    await node(page, 'f-phone').locator('input').fill('01001234567');
    await page.getByRole('button', { name: 'Next', exact: true }).click();
    await expect(shownStep(page)).toHaveText('Your visit');
    await node(page, 'f-reason').locator('textarea').fill('A cough that will not go.');
    // Text that does not read as a height: kept as typed, said, never a number made of part of it.
    const height = node(page, 'f-height').locator('input');
    await height.fill('1.8');
    await height.press('Tab');
    await expect(node(page, 'f-height')).toContainText('Height must be a whole number');
    await page.getByRole('button', { name: 'Continue later' }).click();
    await expect(page.locator('.fd-later-title')).toHaveText('Your answers are saved');
    await expect(page.locator('.fd-later-words')).toHaveText('To continue, open this link on this device or another:');
    const link = await page.locator('.fd-later-link').inputValue();
    expect(link).toMatch(/[?&]resume=draft-\d+/);
    await expect(page.getByRole('button', { name: 'Copy link' })).toBeVisible();
    await screen(page, 'resume-kept');

    // Another tab, as another device would open it: the step reached, the answers in place.
    const other = await context.newPage();
    await other.setViewportSize(WIDE);
    const errors: string[] = [];
    other.on('pageerror', (error) => errors.push(error.message));
    await other.goto(link);
    await expect(shownStep(other)).toHaveText('Your visit');
    await expect(node(other, 'f-reason').locator('textarea')).toHaveValue('A cough that will not go.');
    await expect(node(other, 'f-height').locator('input')).toHaveValue('1.8');
    await expect(node(other, 'f-height')).toContainText('Height must be a whole number');
    await other.getByRole('button', { name: 'Back', exact: true }).click();
    await expect(node(other, 'f-name').locator('input')).toHaveValue('Karim Fathy');
    await screen(other, 'resume-opened');
    expect(errors).toEqual([]);
  });

  test('a saved intake opens at its step; a link to answers sent already says so', async ({ page }) => {
    await page.goto('/plain/?page=clinic-intake&skin=outlined&resume=mona-adel');
    await expect(shownStep(page)).toHaveText('Medical history');
    await page.getByRole('button', { name: 'Back', exact: true }).click();
    await expect(node(page, 'f-reason').locator('textarea')).toHaveValue(/A check-up before starting/);
    await page.goto('/plain/?page=clinic-intake&skin=outlined&resume=sent-long-ago');
    await expect(page.locator('.fd-resume-missing')).toHaveText('These saved answers could not be found: they may have been sent already. The form starts empty.');
    await expect(shownStep(page)).toHaveText('About you');
    await expect(node(page, 'f-name').locator('input')).toHaveValue('');
    await screen(page, 'resume-missing');
  });
});
