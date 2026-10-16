import { type Locator, type Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { harness, zzHeld, zzHold, zzRelease, zzState } from './race-support';

/**
 * Answers the source gives late, after the record they were asked for has gone: the record a change works out
 * (`onchange`), and the record a customer's typed name names (`search`). Each is asked for on one record and answers
 * once another is shown — the pager moved on, or the app opened another or loaded it again. Neither may be laid on
 * the record shown by then, nor saved into it. A source's `onchange` and `search` are as old as 0.20.
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
  await expect(yours(page).locator('.fd-title textarea')).toHaveValue(/Villa/);
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


test('the answer to lead 1’s change, come after the pager moved on, is never laid on lead 2, nor saved into it', async ({ page }) => {
  const problems = await openDemo(page);
  const form = yours(page);
  // The source works out the notes from the lead the change was made on, as a server's onchange does.
  const onchange = await hold(page, 'onchange', "return { values: { notes: 'Call ' + request.values.name + ' back' } }");
  const email = field(form, 'email').locator('input');
  await email.fill('karim@example.com');
  await email.press('Tab');
  await onchange.asked();
  await form.getByRole('button', { name: 'Next record' }).click();
  await expect(form.locator('.fd-title textarea')).toHaveValue('Flat in Maadi');
  await onchange.release();
  await expect.poll(() => page.evaluate(() => (window as any).fieldiaDemo.dataSource.calls.filter((c: { method: string }) => c.method === 'load').length)).toBeGreaterThan(1);
  await page.waitForTimeout(300);
  expect(await state(page)).toMatchObject({ recordId: 2, dirty: [] });
  await expect(field(form, 'notes').locator('textarea, input').first()).toHaveValue('');
  // Back to lead 1: the pager saves what changed first — lead 1's notes must not be written into lead 2.
  await form.getByRole('button', { name: 'Previous record' }).click();
  await expect(form.locator('.fd-title textarea')).toHaveValue('Villa in Sheikh Zayed');
  expect(await stored(page, 2)).toMatchObject({ name: 'Flat in Maadi', notes: '' });
  expect(problems).toEqual([]);
});

const order = (page: Page, name: string) => page.locator(`#app .fd-field[data-field="${name}"]`).first();

for (const how of ['openRecord', 'reload'] as const) {
  test(`a customer’s name typed on order 1, found after the app ${how === 'openRecord' ? 'opened order 2' : 'loaded order 1 again'}, is not taken by the order shown`, async ({ page }) => {
    const problems = await harness(page);
    await zzHold(page, 'search');
    const customer = order(page, 'partner_id').getByRole('combobox');
    await customer.click();
    await customer.fill('Delta Foods');
    await zzHeld(page, 'search');
    // Left: the name is looked up, as leaving the box does.
    await page.keyboard.press('Tab');
    await page.evaluate((h) => (h === 'openRecord' ? (window as any).zz.handle.form.openRecord(2) : (window as any).zz.handle.reload()), how);
    await expect(page.locator('#app .fd-title textarea')).toHaveValue(how === 'openRecord' ? 'Order two' : 'Order one');
    await zzRelease(page, 'search');
    await page.waitForTimeout(300);
    await zzRelease(page, 'search');
    await page.waitForTimeout(300);
    const now = await zzState(page);
    expect(now).toMatchObject({ recordId: how === 'openRecord' ? 2 : 1, dirty: [] });
    expect(now.values.partner_id).toEqual(how === 'openRecord' ? null : { id: 1, label: 'Nile Traders' });
    expect(problems).toEqual([]);
  });
}
