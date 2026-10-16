import { type Locator, type Page } from '@playwright/test';
import { expect, test } from './fixtures';

/**
 * A conflict waiting — Sara saved, Mona had saved first, and the page shows who changed what with Reload and Keep
 * mine — is the person's work at its most at risk: they asked for it to be saved, and it was not. A way out taken now
 * (a plain dialog's Escape, the app opening another lead) lets it go unasked, as for a change never sent, because the
 * record has had no save that went through. In the two tabs demo (demos/save-safety).
 */

const DEMO = '/save-safety/';
const yours = (page: Page) => page.locator('.ss-tab[data-who="you"] .fd-form');
const field = (scope: Locator, name: string) => scope.locator(`.fd-field[data-field="${name}"]`).first();
const state = (page: Page) => page.evaluate(() => (window as any).fieldiaDemo.handle.form.getState());
const box = (page: Page) => page.locator('.fd-form-dialog');

async function openDemo(page: Page) {
  const problems: string[] = [];
  page.on('console', (message) => message.type() === 'error' && problems.push(`console: ${message.text()}`));
  page.on('pageerror', (error) => problems.push(`page error: ${error.message}`));
  await page.goto(DEMO);
  await expect(yours(page).locator('.fd-title input')).toHaveValue(/Villa/);
  return problems;
}

test('a conflict waiting in a dialog: Escape asks before Sara’s change goes, and Enter keeps it', async ({ page }) => {
  const problems = await openDemo(page);
  await page.evaluate(() => void (window as any).fieldiaDemo.openLead('dialog'));
  const phone = field(box(page), 'phone').locator('input');
  await expect(phone).toHaveValue('+20 100 123 4567');
  await phone.fill('+20 100 999 8887');
  await page.evaluate(() => (window as any).fieldiaDemo.dataSource.changeElsewhere('lead', 1, { stage: 'visit' }, { by: 'Mona' }));
  await phone.press('ControlOrMeta+Enter');
  await expect(box(page).locator('.fd-conflict')).toContainText('Mona');
  await phone.focus();
  await page.keyboard.press('Escape');
  const ask = page.getByRole('alertdialog');
  await expect(ask).toContainText('Discard your changes?');
  await expect(ask.getByRole('button', { name: 'Cancel' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(box(page)).toBeVisible();
  await expect(phone).toHaveValue('+20 100 999 8887');
  expect(await page.evaluate(() => (window as any).fieldiaDemo.closed)).toEqual([]);
  expect(problems).toEqual([]);
});

test('a conflict waiting in Sara’s tab: the app opening lead 2 asks before her change goes, and Enter keeps it', async ({ page }) => {
  const problems = await openDemo(page);
  const form = yours(page);
  const phone = field(form, 'phone').locator('input');
  await phone.fill('+20 100 999 8887');
  await page.evaluate(() => (window as any).fieldiaDemo.dataSource.changeElsewhere('lead', 1, { stage: 'visit' }, { by: 'Mona' }));
  await phone.press('ControlOrMeta+Enter');
  await expect(form.locator('.fd-conflict')).toContainText('Mona');
  const going = page.evaluate(() => (window as any).fieldiaDemo.handle.form.openRecord(2));
  const ask = page.getByRole('alertdialog');
  await expect(ask).toContainText('Discard your changes?');
  await page.keyboard.press('Enter');
  expect(await going).toBe(false);
  expect(await state(page)).toMatchObject({ recordId: 1, values: { phone: '+20 100 999 8887' } });
  await expect(form.locator('.fd-conflict')).toBeVisible();
  expect(problems).toEqual([]);
});
