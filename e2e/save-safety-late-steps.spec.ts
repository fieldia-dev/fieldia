import { type Locator, type Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { harness, zzHeld, zzHold, zzRelease, zzState } from './race-support';

/**
 * A record's own steps — Archive, Duplicate, Delete — whose call to the source answers once the person has moved on
 * to another record (the pager, by Alt+N) and typed in it. What follows the call — the record loaded again once
 * archived, the copy shown, the pager moving on from the one deleted — is for the record the step ran on: it must not
 * load, replace or move off the record shown by then, nor drop what was typed in it unasked.
 */

const DEMO = '/save-safety/';
const yours = (page: Page) => page.locator('.ss-tab[data-who="you"] .fd-form');
const field = (scope: Locator, name: string) => scope.locator(`.fd-field[data-field="${name}"]`).first();
const state = (page: Page) => page.evaluate(() => (window as any).fieldiaDemo.handle.form.getState());
const stored = (page: Page, id = 1) => page.evaluate((at) => (window as any).fieldiaDemo.dataSource.records.lead[at], id);

async function openDemo(page: Page) {
  const problems: string[] = [];
  page.on('console', (message) => message.type() === 'error' && problems.push(`console: ${message.text()}`));
  page.on('pageerror', (error) => problems.push(`page error: ${error.message}`));
  await page.goto(DEMO);
  await expect(yours(page).locator('.fd-title input')).toHaveValue(/Villa/);
  return problems;
}

/** The source's `method` held until `release()`; `answer`, when given, is what it answers instead (a function of the request). */
async function hold(page: Page, method: string, answer?: string) {
  await page.evaluate(
    ({ name, answer }) => {
      const demo = (window as any).fieldiaDemo;
      const source = demo.dataSource;
      const real = source[name].bind(source);
      demo.held ??= {};
      demo.held[name] = [];
      source[name] = async (request: unknown, ...rest: unknown[]) => {
        await new Promise<void>((go) => demo.held[name].push(go));
        return answer ? new Function('request', answer)(request) : real(request, ...rest);
      };
    },
    { name: method, answer }
  );
  return {
    asked: () => expect.poll(() => page.evaluate((name) => (window as any).fieldiaDemo.held[name].length, method)).toBeGreaterThan(0),
    release: () => page.evaluate((name) => (window as any).fieldiaDemo.held[name].splice(0).forEach((go: () => void) => go()), method),
  };
}

/** Sara on lead 2 by Alt+N, its budget typed, while lead 1's call is held. */
async function onLead2Typing(page: Page) {
  const form = yours(page);
  await page.keyboard.press('Alt+n');
  await expect(form.locator('.fd-title input')).toHaveValue('Flat in Maadi');
  const budget = field(form, 'budget').locator('input');
  await budget.fill('2600000');
  await budget.press('Tab');
  expect(await state(page)).toMatchObject({ recordId: 2, dirty: ['budget'] });
}

test('Archive answering after the pager moved on leaves lead 2, and the budget Sara typed in it, where they are', async ({ page }) => {
  const problems = await openDemo(page);
  const form = yours(page);
  const archive = await hold(page, 'archive');
  await form.getByRole('button', { name: 'Actions' }).click();
  await form.getByRole('menuitem', { name: 'Archive' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'OK' }).click();
  await archive.asked();
  await onLead2Typing(page);
  await archive.release();
  await expect.poll(() => stored(page)).toMatchObject({ active: false });
  await page.waitForTimeout(400);
  // Lead 1 is archived; lead 2 is not loaded again over what Sara typed, unasked.
  expect(await state(page)).toMatchObject({ recordId: 2, dirty: ['budget'] });
  await expect(field(form, 'budget').locator('input')).toHaveValue(/2,?600,?000/);
  expect(problems).toEqual([]);
});

test('Duplicate answering after the pager moved on leaves Sara on lead 2 with the budget she typed', async ({ page }) => {
  const problems = await openDemo(page);
  const form = yours(page);
  const copy = await hold(page, 'copy');
  await form.getByRole('button', { name: 'Actions' }).click();
  await form.getByRole('menuitem', { name: 'Duplicate' }).click();
  await copy.asked();
  await onLead2Typing(page);
  await copy.release();
  await expect.poll(() => stored(page, 3)).toMatchObject({ name: /copy/ });
  await page.waitForTimeout(400);
  // The copy is made; the form is not taken from lead 2 to it, and what Sara typed in lead 2 is not dropped unasked.
  expect(await state(page)).toMatchObject({ recordId: 2, dirty: ['budget'] });
  await expect(form.locator('.fd-title input')).toHaveValue('Flat in Maadi');
  await expect(field(form, 'budget').locator('input')).toHaveValue(/2,?600,?000/);
  expect(problems).toEqual([]);
});

test('Delete answering after the pager moved on leaves order 2, and the phone typed in it, where they are', async ({ page }) => {
  const problems = await harness(page);
  await zzHold(page, 'delete');
  await page.locator('#app').getByRole('button', { name: 'Actions' }).click();
  await page.locator('#app').getByRole('menuitem', { name: 'Delete' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'OK' }).click();
  await zzHeld(page, 'delete');
  await page.keyboard.press('Alt+n');
  await expect(page.locator('#app .fd-title input')).toHaveValue('Order two');
  const phone = page.locator('#app .fd-field[data-field="phone"] input');
  await phone.fill('+2 typed');
  await phone.press('Tab');
  await zzRelease(page, 'delete');
  await expect.poll(() => page.evaluate(() => Object.keys((window as any).zz.ds.records.order))).toEqual(['2', '3']);
  await page.waitForTimeout(400);
  // Order 1 is gone, and the pager counts one fewer; order 2 is not loaded again over what was typed, unasked.
  await expect(page.locator('#app .fd-record-pager-text')).toHaveText('1 / 2');
  expect(await zzState(page)).toMatchObject({ recordId: 2, dirty: ['phone'] });
  await expect(phone).toHaveValue('+2 typed');
  expect(problems).toEqual([]);
});
