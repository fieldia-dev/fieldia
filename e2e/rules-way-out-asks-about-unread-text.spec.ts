import { type Locator, type Page } from '@playwright/test';
import { expect, test } from './fixtures';

/**
 * A way out of a record after its save (0.22's `form.leave()`) asks "Discard your changes?" about a change the save
 * did not send: "12" typed into the budget, say. Typed as "12a" — text that does not read, kept unread with why — the
 * same way out goes at once, unasked, and what was typed is gone. The input rules: never lose what was typed. In the
 * two tabs demo (demos/save-safety), after a save of Sara's: Duplicate from the gear, and the app opening the next lead.
 */

const yours = (page: Page) => page.locator('.ss-tab[data-who="you"] .fd-form');
const field = (scope: Locator, name: string) => scope.locator(`.fd-field[data-field="${name}"]`).first();
const state = (page: Page) => page.evaluate(() => (window as any).fieldiaDemo.handle.form.getState());

/** Sara's lead saved once (her phone), then "12a" typed into its budget and the box left: kept unread, with why. */
async function savedThenUnread(page: Page) {
  const problems: string[] = [];
  page.on('pageerror', (error) => problems.push(`page error: ${error.message}`));
  await page.goto('/save-safety/');
  const form = yours(page);
  await expect(form.locator('.fd-title textarea')).toHaveValue(/Villa/);
  const phone = field(form, 'phone').locator('input');
  await phone.fill('+20 100 123 4568');
  await phone.press('ControlOrMeta+Enter');
  await expect.poll(async () => (await state(page)).status).toBe('saved');
  const budget = field(form, 'budget').locator('input');
  await budget.click();
  await budget.press('Control+A');
  await page.keyboard.type('12a');
  await page.keyboard.press('Tab');
  await expect(budget).toHaveValue('12a');
  expect((await state(page)).unread).toMatchObject({ budget: { text: '12a' } });
  return { form, problems };
}

test('Duplicate from the gear over a budget typed "12a" after a save asks first, as it does over "12"', async ({ page }) => {
  const { form, problems } = await savedThenUnread(page);
  await form.getByRole('button', { name: 'Actions' }).click();
  await form.getByRole('menuitem', { name: 'Duplicate' }).click();
  await expect(page.getByRole('alertdialog')).toContainText('Discard your changes?');
  await page.getByRole('alertdialog').getByRole('button', { name: 'Cancel' }).click();
  // Kept: the lead, and what was typed in its budget.
  expect(await state(page)).toMatchObject({ recordId: 1, unread: { budget: { text: '12a' } } });
  expect(problems).toEqual([]);
});

test('the app opening the next lead over a budget typed "12a" after a save asks first; Cancel keeps what was typed', async ({ page }) => {
  const { problems } = await savedThenUnread(page);
  const went = page.evaluate(() => (window as any).fieldiaDemo.handle.form.openRecord(2) as Promise<boolean>);
  await expect(page.getByRole('alertdialog')).toContainText('Discard your changes?');
  await page.getByRole('alertdialog').getByRole('button', { name: 'Cancel' }).click();
  expect(await went).toBe(false);
  expect(await state(page)).toMatchObject({ recordId: 1, unread: { budget: { text: '12a' } } });
  expect(problems).toEqual([]);
});
