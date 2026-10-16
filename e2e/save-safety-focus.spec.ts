import { type Locator, type Page } from '@playwright/test';
import { expect, test } from './fixtures';

/**
 * After every button in the conflict banner and in the list of changes set
 * aside, the keyboard lands somewhere a person can go on from — the field put
 * back, the first field that changed — and never on the page's body, in the
 * two tabs demo (demos/save-safety), by the keys alone. And the list's ×
 * lets the changes go only once asked, as every other discard is. Run in
 * Chromium, Firefox and WebKit: each moves the focus its own way when the
 * button that had it hides.
 */

const DEMO = '/save-safety/';
const yours = (page: Page) => page.locator('.ss-tab[data-who="you"] .fd-form');
const field = (form: Locator, name: string) => form.locator(`.fd-field[data-field="${name}"]`).first();
const banner = (form: Locator) => form.locator('.fd-conflict');
const aside = (form: Locator) => form.locator('.fd-set-aside');
const state = (page: Page) => page.evaluate(() => (window as any).fieldiaDemo.handle.form.getState());
/** Where the focus is: the field it is in, or what it is when it is in none; "body" when it went nowhere. */
const focusedAt = (page: Page) =>
  page.evaluate(() => {
    const active = document.activeElement;
    if (!active || active === document.body) return 'body';
    return active.closest('.fd-field')?.getAttribute('data-field') ?? active.getAttribute('aria-label') ?? active.textContent?.trim() ?? active.tagName;
  });

async function openDemo(page: Page) {
  const problems: string[] = [];
  page.on('console', (message) => message.type() === 'error' && problems.push(`console: ${message.text()}`));
  page.on('pageerror', (error) => problems.push(`page error: ${error.message}`));
  await page.goto(DEMO);
  await expect(yours(page).locator('.fd-title textarea')).toHaveValue(/Villa/);
  return problems;
}

/** Sara's changes typed in, Mona saves in her tab, then Sara's Ctrl+Enter: the banner. */
async function conflict(page: Page, changes: Record<string, string>) {
  const form = yours(page);
  for (const [name, value] of Object.entries(changes)) await field(form, name).locator('input').fill(value);
  await page.locator('.ss-button').click();
  await expect(page.locator('.ss-said')).toContainText('Mona saved');
  await field(form, Object.keys(changes)[0]).locator('input').focus();
  await page.keyboard.press('ControlOrMeta+Enter');
  await expect(banner(form)).toBeVisible();
  return form;
}

/** A button reached by the keyboard and pressed with Enter. */
async function pressWithKeys(page: Page, button: Locator) {
  await button.focus();
  await expect(button).toBeFocused();
  await page.keyboard.press('Enter');
}

test('Keep mine: once saved and the banner gone, the focus is on the first field Sara changed', async ({ page }) => {
  const problems = await openDemo(page);
  const form = await conflict(page, { phone: '+20 100 999 8887' });
  await pressWithKeys(page, banner(form).getByRole('button', { name: 'Keep mine' }));
  await expect(form.locator('.fd-status')).toHaveText('Saved');
  await expect(banner(form)).toBeHidden();
  await expect(field(form, 'phone').locator('input')).toBeFocused();
  expect(problems).toEqual([]);
});

test('Reload with nothing to set aside: the focus is on the first field that changed, and it says it reloaded', async ({ page }) => {
  const problems = await openDemo(page);
  // The same budget Mona sets: nothing of Sara's differs from hers.
  const form = await conflict(page, { budget: '4500000' });
  await pressWithKeys(page, banner(form).getByRole('button', { name: 'Reload' }));
  await expect(banner(form)).toBeHidden();
  await expect(aside(form)).toBeHidden();
  expect((await state(page)).setAside).toBeNull();
  await expect(form.locator('.fd-announce')).toHaveText('Reloaded: this is the record as it is now.');
  expect(await focusedAt(page)).toBe('budget');
  expect(problems).toEqual([]);
});

test('Put all back: the changes are Sara’s again, and the focus is on the first of them', async ({ page }) => {
  const problems = await openDemo(page);
  const form = await conflict(page, { phone: '+20 100 999 8887', email: 'karim@example.org' });
  await pressWithKeys(page, banner(form).getByRole('button', { name: 'Reload' }));
  await expect(aside(form).locator('li')).toHaveCount(2);
  await pressWithKeys(page, aside(form).getByRole('button', { name: 'Put all back' }));
  await expect(aside(form)).toBeHidden();
  await expect(field(form, 'phone').locator('input')).toHaveValue('+20 100 999 8887');
  await expect(field(form, 'phone').locator('input')).toBeFocused();
  expect(problems).toEqual([]);
});

test('the list’s × asks before letting the changes go: Cancel keeps them and the focus on ×; Discard, the focus on the field', async ({ page }) => {
  const problems = await openDemo(page);
  const form = await conflict(page, { phone: '+20 100 999 8887' });
  await pressWithKeys(page, banner(form).getByRole('button', { name: 'Reload' }));
  await expect(aside(form)).toBeVisible();
  const dismiss = aside(form).getByRole('button', { name: 'Dismiss' });
  await pressWithKeys(page, dismiss);
  const ask = page.getByRole('alertdialog');
  await expect(ask).toContainText('Discard your changes?');
  // The safe answer has the focus: Enter keeps them.
  await expect(ask.getByRole('button', { name: 'Cancel' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(ask).toBeHidden();
  await expect(aside(form).locator('li')).toHaveCount(1);
  await expect(dismiss).toBeFocused();
  // Again, and Discard: they go, and the focus goes to the field they were in.
  await page.keyboard.press('Enter');
  await expect(ask.getByRole('button', { name: 'Cancel' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(ask.getByRole('button', { name: 'Discard' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(aside(form)).toBeHidden();
  expect((await state(page)).setAside).toBeNull();
  await expect(field(form, 'phone').locator('input')).toBeFocused();
  expect(problems).toEqual([]);
});
