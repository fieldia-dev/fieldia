import { type Locator, type Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { holdSaves } from './hold-support';

/**
 * Save safety where a person loses work without being told, in the two tabs
 * demo (demos/save-safety): Ctrl+Enter pressed twice while the first save is
 * on its way is never a conflict with herself; after Reload, the pager asks
 * before the changes set aside are left behind, the keyboard keeping its
 * place; and Keep mine, when the other person's version cannot be read over a
 * failing network, saves nothing over it and says so.
 */

const DEMO = '/save-safety/';
const yours = (page: Page) => page.locator('.ss-tab[data-who="you"] .fd-form');
const field = (form: Locator, name: string) => form.locator(`.fd-field[data-field="${name}"]`).first();
const banner = (form: Locator) => form.locator('.fd-conflict');
const state = (page: Page) => page.evaluate(() => (window as any).fieldiaDemo.handle.form.getState());
const stored = (page: Page, id = 1) => page.evaluate((at) => (window as any).fieldiaDemo.dataSource.records.lead[at], id);

async function openDemo(page: Page) {
  const problems: string[] = [];
  page.on('console', (message) => message.type() === 'error' && problems.push(`console: ${message.text()}`));
  page.on('pageerror', (error) => problems.push(`page error: ${error.message}`));
  await page.goto(DEMO);
  await expect(yours(page).locator('.fd-title textarea')).toHaveValue(/Villa/);
  return problems;
}

/** Sara changes the phone, Mona moves the lead on in her tab and saves, then Sara saves: the banner. */
async function conflictInYourTab(page: Page) {
  const form = yours(page);
  await field(form, 'phone').locator('input').fill('+20 100 999 8887');
  await page.locator('.ss-button').click();
  await expect(page.locator('.ss-said')).toContainText('Mona saved');
  await form.locator('.fd-header button[type="submit"]').click();
  await expect(banner(form)).toBeVisible();
  return form;
}

const saveCalls = (page: Page) => page.evaluate(() => (window as any).fieldiaDemo.dataSource.calls.filter((c: any) => c.method === 'save').length as number);

test('Ctrl+Enter pressed twice while the first save is on its way saves once — the same save: no conflict with herself', async ({ page }) => {
  const problems = await openDemo(page);
  const form = yours(page);
  const phone = field(form, 'phone').locator('input');
  await phone.fill('+20 100 999 8887');
  // The source's answer held: the second press is certainly made while the first is on its way.
  const saves = await holdSaves(page);
  await phone.press('Control+Enter');
  await saves.asked();
  await phone.press('Control+Enter');
  // The second waits for the first: nothing more is asked of the source.
  await expect.poll(saves.held).toBe(1);
  await saves.release();
  // Both answered, by the one save: nothing changed between the presses.
  await page.evaluate(() => (window as any).fieldiaDemo.handle.form.settled());
  expect(await saveCalls(page)).toBe(1);
  await expect(form.locator('.fd-status')).toHaveText('Saved');
  await expect(banner(form)).toBeHidden();
  expect(await state(page)).toMatchObject({ status: 'saved', conflict: null, saveProblem: null, dirty: [] });
  expect(await stored(page)).toMatchObject({ phone: '+20 100 999 8887' });
  // The focus stayed where she typed.
  await expect(phone).toBeFocused();
  expect(problems).toEqual([]);
});

test('Ctrl+Enter pressed again once the save answered, nothing changed since: no second save, its version as the save left it', async ({ page }) => {
  const problems = await openDemo(page);
  const form = yours(page);
  const phone = field(form, 'phone').locator('input');
  await phone.fill('+20 100 999 8887');
  await phone.press('Control+Enter');
  await page.evaluate(() => (window as any).fieldiaDemo.handle.form.settled());
  await expect(form.locator('.fd-status')).toHaveText('Saved');
  const saved = await state(page);
  await phone.press('Control+Enter');
  await page.evaluate(() => (window as any).fieldiaDemo.handle.form.settled());
  expect(await saveCalls(page)).toBe(1);
  await expect(form.locator('.fd-status')).toHaveText('Saved');
  // The record's version as the save left it: another tab sees no change of hers that is none.
  expect(await state(page)).toMatchObject({ status: 'saved', version: saved.version, dirty: [] });
  expect(await stored(page)).toMatchObject({ phone: '+20 100 999 8887' });
  await expect(phone).toBeFocused();
  expect(problems).toEqual([]);
});

test('after Reload, the pager asks before Sara’s changes set aside are left behind: Cancel keeps her place, Discard moves on', async ({ page }) => {
  const problems = await openDemo(page);
  const form = await conflictInYourTab(page);
  await banner(form).getByRole('button', { name: 'Reload' }).click();
  const aside = form.locator('.fd-set-aside');
  await expect(aside).toBeVisible();
  expect((await state(page)).dirty).toEqual([]);
  // To the pager by the keyboard, and Enter on Next record.
  const next = form.getByRole('button', { name: 'Next record' });
  await next.focus();
  await page.keyboard.press('Enter');
  const ask = page.getByRole('alertdialog');
  await expect(ask).toContainText('Discard your changes?');
  // The safe answer has the focus: Enter keeps them.
  await expect(ask.getByRole('button', { name: 'Cancel' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(ask).toBeHidden();
  await expect(next).toBeFocused();
  await expect(form.locator('.fd-record-pager-text')).toHaveText('1 / 2');
  await expect(aside.locator('li')).toHaveCount(1);
  await expect(aside.locator('li')).toContainText('+20 100 999 8887');
  // Escape on the question is Cancel too.
  await page.keyboard.press('Enter');
  await expect(ask).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(ask).toBeHidden();
  await expect(next).toBeFocused();
  await expect(form.locator('.fd-record-pager-text')).toHaveText('1 / 2');
  // Discard lets them go, and the pager moves on.
  await page.keyboard.press('Enter');
  await ask.getByRole('button', { name: 'Discard' }).click();
  await expect(form.locator('.fd-record-pager-text')).toHaveText('2 / 2');
  await expect(form.locator('.fd-title textarea')).toHaveValue('Flat in Maadi');
  await expect(aside).toBeHidden();
  expect(problems).toEqual([]);
});

test('Keep mine, when Mona’s version cannot be read over a failing network, saves nothing over it and says so; once it can, saves', async ({ page }) => {
  const problems = await openDemo(page);
  // A source whose conflict names who and when, but not the lead as Mona left it.
  await page.evaluate(() => {
    const source = (window as any).fieldiaDemo.dataSource;
    const save = source.save.bind(source);
    source.save = async (request: unknown) => {
      try {
        return await save(request);
      } catch (error: any) {
        if (error?.conflict) delete error.conflict.theirs;
        throw error;
      }
    };
  });
  const form = await conflictInYourTab(page);
  // The network fails as she presses Keep mine: the lead cannot be read again.
  await page.evaluate(() => {
    const source = (window as any).fieldiaDemo.dataSource;
    source.readLoad = source.load;
    source.load = () => Promise.reject(new TypeError('Failed to fetch'));
  });
  const keep = banner(form).getByRole('button', { name: 'Keep mine' });
  await keep.click();
  const words = banner(form).getByRole('alert');
  await expect(words).toContainText('Their version could not be read, so yours was not saved over it. Try Keep mine again, or Reload.');
  await expect(keep).toBeVisible();
  await expect(banner(form).getByRole('button', { name: 'Reload' })).toBeVisible();
  // Mona's lead stands; Sara's phone is still in her form, to save.
  expect(await stored(page)).toMatchObject({ phone: '+20 100 123 4567', stage: 'visit' });
  await expect(field(form, 'phone').locator('input')).toHaveValue('+20 100 999 8887');
  await expect(form.locator('.fd-status')).toHaveText('Not saved');
  // The network is back: Keep mine reads her lead, and saves Sara's phone over it.
  await page.evaluate(() => {
    const source = (window as any).fieldiaDemo.dataSource;
    source.load = source.readLoad;
  });
  await keep.click();
  await expect(form.locator('.fd-status')).toHaveText('Saved');
  await expect(banner(form)).toBeHidden();
  expect(await stored(page)).toMatchObject({ phone: '+20 100 999 8887', stage: 'visit', budget: 4500000 });
  expect(problems).toEqual([]);
});
