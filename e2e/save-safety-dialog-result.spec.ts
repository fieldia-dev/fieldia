import { type Locator, type Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { harness, zzHeld, zzHold, zzRelease, zzState } from './race-support';

/**
 * What a dialog hands back once a save in it went through and the person then let a later change go (Discard on
 * "Discard your changes?"): `saved: true`, so the opener takes its values — an `open` step's `into`, a link's name
 * after Create and edit, a line's values. Those must be the record as saved, never the change the person let go.
 */

const DEMO = '/save-safety/';
const yours = (page: Page) => page.locator('.ss-tab[data-who="you"] .fd-form');
const field = (scope: Locator, name: string) => scope.locator(`.fd-field[data-field="${name}"]`).first();
const stored = (page: Page, id = 1) => page.evaluate((at) => (window as any).fieldiaDemo.dataSource.records.lead[at], id);
const box = (page: Page) => page.locator('.fd-form-dialog');

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

test('a dialog that saved, then Discard on the change typed while it saved, hands back the lead as saved', async ({ page }) => {
  const problems = await openDemo(page);
  await page.evaluate(() => void (window as any).fieldiaDemo.openLead('dialog'));
  const phone = field(box(page), 'phone').locator('input');
  await expect(phone).toHaveValue('+20 100 123 4567');
  await phone.fill('+20 100 999 8887');
  const saves = await hold(page, 'save');
  await box(page).getByRole('button', { name: 'Save & Close' }).click();
  await saves.asked();
  await field(box(page), 'budget').locator('input').fill('4300000');
  await saves.release();
  const ask = page.getByRole('alertdialog');
  await expect(ask).toContainText('Discard your changes?');
  await ask.getByRole('button', { name: 'Discard' }).click();
  await expect(box(page)).toHaveCount(0);
  const [closed] = await page.evaluate(() => (window as any).fieldiaDemo.closed);
  expect(await stored(page)).toMatchObject({ phone: '+20 100 999 8887', budget: 4000000 });
  // Saved, it says so — with the values saved: the budget let go is no value of the record's for the opener to take.
  expect(closed).toMatchObject({ saved: true, recordId: 1, values: { phone: '+20 100 999 8887', budget: 4000000 } });
  expect(problems).toEqual([]);
});

test('a customer’s email changed in the dialog an order’s button opens, then let go: the order takes the email saved', async ({ page }) => {
  const problems = await harness(page, {
    options: `{ page: (() => {
      const p = JSON.parse(JSON.stringify(zz.base));
      p.layout.children[0].children.push({ type: 'button', id: 'b-customer', label: 'Customer’s email', steps: [{ do: 'open', page: 'partner', as: 'dialog', record: 'partner_id', into: { notes: 'email' } }] });
      return p;
    })() }`,
  });
  await page.locator('#app').getByRole('button', { name: 'Customer’s email' }).click();
  const dialog = page.locator('.fd-form-dialog');
  const email = dialog.locator('.fd-field[data-field="email"] input');
  await expect(email).toHaveValue('n@example.com');
  await email.fill('orders@nile.example');
  await zzHold(page, 'save');
  await dialog.getByRole('button', { name: 'Save & Close' }).click();
  await zzHeld(page, 'save');
  await email.fill('typo@nile.example');
  await zzRelease(page, 'save');
  const ask = page.getByRole('alertdialog');
  await expect(ask).toContainText('Discard your changes?');
  await ask.getByRole('button', { name: 'Discard' }).click();
  await expect(dialog).toHaveCount(0);
  expect(await page.evaluate(() => (window as any).zz.ds.records.partner[1])).toMatchObject({ email: 'orders@nile.example' });
  await expect(page.locator('#app .fd-field[data-field="notes"] input')).toHaveValue('orders@nile.example');
  expect((await zzState(page)).values.notes).toBe('orders@nile.example');
  expect(problems).toEqual([]);
});
