import { type Locator, type Page } from '@playwright/test';
import { expect, test } from './fixtures';

/**
 * Someone else saved the lead (0.22): Sara's save is refused, and Reload loads theirs, setting her changes aside to put
 * back. A budget she typed as "12" after the refusal is set aside with them. Typed as "12a" — text that does not read,
 * kept unread with why — Reload drops it: nothing set aside, nothing said, the box showing Mona's budget. The input
 * rules: never lose what was typed. In the two tabs demo (demos/save-safety).
 */

const yours = (page: Page) => page.locator('.ss-tab[data-who="you"] .fd-form');
const field = (scope: Locator, name: string) => scope.locator(`.fd-field[data-field="${name}"]`).first();
const state = (page: Page) => page.evaluate(() => (window as any).fieldiaDemo.handle.form.getState());

/** Mona saves in her tab; Sara's Ctrl+Enter is refused; then Sara types `typed` into the budget and leaves it. */
async function refusedThenTyped(page: Page, typed: string) {
  const problems: string[] = [];
  page.on('pageerror', (error) => problems.push(`page error: ${error.message}`));
  await page.goto('/save-safety/');
  const form = yours(page);
  await expect(form.locator('.fd-title textarea')).toHaveValue(/Villa/);
  await field(form, 'phone').locator('input').fill('+20 100 999 8887');
  await page.locator('.ss-button').click();
  await expect(page.locator('.ss-said')).toContainText('Mona saved');
  await field(form, 'phone').locator('input').press('ControlOrMeta+Enter');
  const reload = form.locator('.fd-conflict').getByRole('button', { name: 'Reload' });
  await expect(reload).toBeVisible();
  const budget = field(form, 'budget').locator('input');
  await budget.click();
  await budget.press('Control+A');
  await page.keyboard.type(typed);
  await page.keyboard.press('Tab');
  await reload.click();
  await expect(form.locator('.fd-conflict')).toBeHidden();
  return { form, budget, problems };
}

test('Reload after a refused save sets a budget typed "12" aside, to put back', async ({ page }) => {
  const { problems } = await refusedThenTyped(page, '12');
  expect((await state(page)).setAside).toMatchObject({ budget: 12 });
  expect(problems).toEqual([]);
});

test('Reload after a refused save keeps a budget typed "12a": set aside or still in its box, never dropped unsaid', async ({ page }) => {
  const { budget, problems } = await refusedThenTyped(page, '12a');
  const after = await state(page);
  const kept = after.unread?.budget?.text === '12a' || JSON.stringify(after.setAside ?? {}).includes('12a') || (await budget.inputValue()) === '12a';
  expect(kept, `budget shows ${await budget.inputValue()}; set aside ${JSON.stringify(after.setAside)}; unread ${JSON.stringify(after.unread)}`).toBe(true);
  expect(problems).toEqual([]);
});
