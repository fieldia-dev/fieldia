import { type Locator, type Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { axeFindings } from './a11y-support';
import { expectNoSidewaysScroll, screen } from './support';

/**
 * Save safety, in the two tabs demo (demos/save-safety): one lead open in
 * Sara's tab and Mona's, on one data source that keeps versions. Mona saves
 * first; Sara's save is refused as a conflict, and her form says who changed
 * the lead and when, what each changed, with Reload — her changes listed to
 * put back — and Keep mine. With `?role=viewer`, Omar may only read it: no
 * Edit, no Save, no Archive, Duplicate or Delete, and why, in words.
 */

const DEMO = '/save-safety/';
const yours = (page: Page) => page.locator('.ss-tab[data-who="you"] .fd-form');
const hers = (page: Page) => page.locator('.ss-tab[data-who="mona"] .fd-form');
const field = (form: Locator, name: string) => form.locator(`.fd-field[data-field="${name}"]`).first();
const banner = (form: Locator) => form.locator('.fd-conflict');

function watch(page: Page) {
  const problems: string[] = [];
  page.on('console', (message) => message.type() === 'error' && problems.push(`console: ${message.text()}`));
  page.on('pageerror', (error) => problems.push(`page error: ${error.message}`));
  return problems;
}

async function openDemo(page: Page, query = '') {
  const problems = watch(page);
  await page.goto(`${DEMO}${query}`);
  await expect(yours(page).locator('.fd-title input')).toHaveValue(/Villa|فيلا/);
  return problems;
}

/** Sara changes the phone (and the budget), Mona moves the lead on in her tab and saves, then Sara saves. */
async function conflictInYourTab(page: Page, { budget = false } = {}) {
  const form = yours(page);
  await field(form, 'phone').locator('input').fill('+20 100 999 8887');
  if (budget) await field(form, 'budget').locator('input').fill('4200000');
  await page.locator('.ss-button').click();
  await expect(page.locator('.ss-said')).toContainText(/Mona saved|حفظت منى/);
  await form.locator('.fd-header button[type="submit"]').click();
  await expect(banner(form)).toBeVisible();
  return form;
}

test('a save over Mona’s says who changed the lead and when, what she changed, and offers Reload and Keep mine', async ({ page }) => {
  const problems = await openDemo(page);
  const form = await conflictInYourTab(page, { budget: true });
  const box = banner(form);
  const words = box.getByRole('alert');
  await expect(words).toContainText(/Mona changed this record at \d\d:\d\d\./);
  await expect(words).toContainText('They changed: Stage, Budget.');
  await expect(words).toContainText('You both changed: Budget.');
  await expect(box.getByRole('button', { name: 'Reload' })).toBeVisible();
  await expect(box.getByRole('button', { name: 'Keep mine' })).toBeVisible();
  // Nothing of Sara's is lost meanwhile: her changes are still in her form.
  await expect(field(form, 'phone').locator('input')).toHaveValue('+20 100 999 8887');
  await expect(form.locator('.fd-status')).toHaveText('Not saved');
  await screen(page, 'save-safety-conflict');
  expect(await axeFindings(page, 'a conflict over the lead')).toEqual([]);
  expect(problems).toEqual([]);
});

test('Keep mine saves Sara’s phone over the lead as Mona left it: her stage and budget stay', async ({ page }) => {
  const problems = await openDemo(page);
  const form = await conflictInYourTab(page);
  await banner(form).getByRole('button', { name: 'Keep mine' }).click();
  await expect(form.locator('.fd-status')).toHaveText('Saved');
  await expect(banner(form)).toBeHidden();
  const stored = await page.evaluate(() => (window as any).fieldiaDemo.dataSource.records.lead[1]);
  expect(stored).toMatchObject({ phone: '+20 100 999 8887', stage: 'visit', budget: 4500000 });
  // The form shows the record as it now is: Mona's stage, nothing left to save.
  expect(await page.evaluate(() => (window as any).fieldiaDemo.handle.form.getState())).toMatchObject({ values: { stage: 'visit' }, dirty: [] });
  expect(problems).toEqual([]);
});

test('Reload shows Mona’s lead and lists Sara’s changes, each put back by its own button, the keyboard taken to them', async ({ page }) => {
  const problems = await openDemo(page);
  const form = await conflictInYourTab(page, { budget: true });
  await banner(form).getByRole('button', { name: 'Reload' }).click();
  const aside = form.locator('.fd-set-aside');
  await expect(aside).toBeVisible();
  await expect(banner(form)).toBeHidden();
  // The focus is on the list's words, so a screen reader says what was kept.
  await expect(aside.locator('.fd-set-aside-title')).toBeFocused();
  await expect(field(form, 'phone').locator('input')).toHaveValue('+20 100 123 4567');
  await expect(aside.locator('li')).toHaveCount(2);
  await expect(aside.locator('li').first()).toContainText('Phone');
  await expect(aside.locator('li').first()).toContainText('+20 100 999 8887');
  await screen(page, 'save-safety-reloaded');
  // Tab past Dismiss to the first Put back and press it: the phone is Sara's again, to save.
  await page.keyboard.press('Tab');
  await expect(aside.getByRole('button', { name: 'Dismiss' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(aside.getByRole('button', { name: 'Put back Phone' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(field(form, 'phone').locator('input')).toHaveValue('+20 100 999 8887');
  await expect(aside.locator('li')).toHaveCount(1);
  await form.locator('.fd-header button[type="submit"]').click();
  await expect(form.locator('.fd-status')).toHaveText('Saved');
  const stored = await page.evaluate(() => (window as any).fieldiaDemo.dataSource.records.lead[1]);
  expect(stored).toMatchObject({ phone: '+20 100 999 8887', budget: 4500000 });
  expect(problems).toEqual([]);
});

test('Mona’s tab, behind after Sara saved, is told in turn: a conflict either way', async ({ page }) => {
  const problems = await openDemo(page);
  const form = yours(page);
  await field(form, 'phone').locator('input').fill('+20 100 999 8887');
  await form.locator('.fd-header button[type="submit"]').click();
  await expect(form.locator('.fd-status')).toHaveText('Saved');
  await field(hers(page), 'email').locator('input').fill('karim@example.org');
  await hers(page).locator('.fd-header button[type="submit"]').click();
  await expect(banner(hers(page)).getByRole('alert')).toContainText(/Sara changed this record at \d\d:\d\d\./);
  await expect(banner(hers(page)).getByRole('alert')).toContainText('They changed: Phone.');
  expect(problems).toEqual([]);
});

test('an agent: the commission locked with its reason, Delete not in the gear, and the gear saying why', async ({ page }) => {
  const problems = await openDemo(page);
  const form = yours(page);
  const commission = field(form, 'commission');
  await expect(commission.locator('input')).toHaveAttribute('readonly', '');
  const lock = commission.locator('.fd-lock');
  await expect(lock).toBeVisible();
  await lock.hover();
  await expect(commission.locator('.fd-help-bubble')).toHaveText('Only a manager sets the commission or deletes a lead.');
  await form.locator('.fd-record-gear').click();
  const menu = form.getByRole('menu');
  await expect(menu.getByRole('menuitem')).toHaveText(['Brochure', 'Archive', 'Duplicate']);
  await expect(menu.locator('.fd-record-menu-note')).toHaveText('Only a manager sets the commission or deletes a lead.');
  await expect(form.locator('.fd-record-gear')).toHaveAttribute('aria-describedby', /note/);
  await screen(page, 'save-safety-agent-gear', { viewport: true });
  expect(problems).toEqual([]);
});

test('a viewer: no Save, no Archive, Duplicate or Delete, the commission not shown, and the reason over the lead', async ({ page }) => {
  const problems = await openDemo(page, '?role=viewer');
  const form = yours(page);
  const note = form.locator('.fd-read-only-note');
  await expect(note).toBeVisible();
  await expect(note).toHaveAttribute('role', 'status');
  await expect(note).toHaveText('Omar is a viewer: he can read leads, but not change them.');
  await expect(field(form, 'commission')).toBeHidden();
  await expect(field(form, 'phone').locator('input')).toHaveAttribute('readonly', '');
  // Typing, Ctrl+Enter: nothing changes, nothing is saved, no refusal pops up.
  await field(form, 'phone').locator('input').press('Control+Enter');
  await expect(form.locator('[role="alertdialog"]')).toHaveCount(0);
  await expect(form.locator('.fd-header button[type="submit"]')).toBeHidden();
  await form.locator('.fd-record-gear').click();
  await expect(form.getByRole('menu').getByRole('menuitem')).toHaveText(['Brochure']);
  await page.keyboard.press('Escape');
  const saves = await page.evaluate(() => (window as any).fieldiaDemo.dataSource.calls.filter((call: { method: string }) => call.method === 'save').length);
  expect(saves).toBe(0);
  await screen(page, 'save-safety-viewer');
  expect(await axeFindings(page, 'a lead only to read')).toEqual([]);
  expect(problems).toEqual([]);
});

test('right to left, in Arabic and dark: the conflict in the page’s words, its buttons at the inline end', async ({ page }) => {
  const problems = await openDemo(page, '?locale=ar&scheme=dark');
  const form = await conflictInYourTab(page);
  const box = banner(form);
  await expect(box.getByRole('alert')).toContainText(/عدّل منى هذا السجل في/);
  await expect(box.getByRole('alert')).toContainText('المرحلة');
  expect(await box.evaluate((el) => getComputedStyle(el).direction)).toBe('rtl');
  // Dark: the banner's ground is dark, its words light.
  const lightness = (colour: string) => {
    const [r, g, b] = (colour.match(/[\d.]+/g) ?? []).map(Number);
    return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  };
  const colours = await box.evaluate((el) => {
    const form = el.closest('.fd-form') as HTMLElement;
    return { text: getComputedStyle(el).color, ground: getComputedStyle(form).backgroundColor };
  });
  expect(lightness(colours.text)).toBeGreaterThan(0.6);
  expect(lightness(colours.ground)).toBeLessThan(0.2);
  // The buttons sit at the start of the words' side: right of the warning sign's column, as Arabic reads.
  const sign = (await box.locator('.fd-conflict-icon').boundingBox())!;
  const reload = (await box.getByRole('button', { name: 'إعادة التحميل' }).boundingBox())!;
  expect(reload.x + reload.width).toBeLessThan(sign.x);
  await screen(page, 'save-safety-conflict-ar-dark');
  expect(await axeFindings(page, 'a conflict, Arabic and dark')).toEqual([]);
  expect(problems).toEqual([]);
});

test('on a phone: the two tabs one over the other, the conflict whole, nothing scrolling sideways', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const problems = await openDemo(page);
  const form = await conflictInYourTab(page, { budget: true });
  const box = (await banner(form).boundingBox())!;
  const tab = (await page.locator('.ss-tab[data-who="you"]').boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(tab.x);
  expect(box.x + box.width).toBeLessThanOrEqual(tab.x + tab.width + 0.5);
  const buttons = banner(form).getByRole('button');
  for (const button of await buttons.all()) expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(24);
  await expectNoSidewaysScroll(page);
  await banner(form).scrollIntoViewIfNeeded();
  await screen(page, 'save-safety-conflict-phone', { viewport: true });
  expect(problems).toEqual([]);
});

test('on a phone, after Reload: each Put back on its change’s first line, at the row’s end, never wrapped under it', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const problems = await openDemo(page);
  const form = await conflictInYourTab(page, { budget: true });
  await banner(form).getByRole('button', { name: 'Reload' }).click();
  const rows = form.locator('.fd-set-aside li');
  await expect(rows).toHaveCount(2);
  for (const row of await rows.all()) {
    const label = (await row.locator('.fd-set-aside-label').boundingBox())!;
    const put = (await row.getByRole('button', { name: /^Put back / }).boundingBox())!;
    const line = (await row.boundingBox())!;
    // Beside the field's name, not on a line of its own under the change.
    expect(put.y).toBeLessThan(label.y + label.height);
    expect(Math.abs(put.x + put.width - (line.x + line.width))).toBeLessThanOrEqual(1);
  }
  await expectNoSidewaysScroll(page);
  await form.locator('.fd-set-aside').scrollIntoViewIfNeeded();
  await screen(page, 'save-safety-reloaded-phone', { viewport: true });
  expect(problems).toEqual([]);
});
