import { type Locator, type Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { node, open } from './support';

/**
 * Every way out of a record that acts on a save that went through asks before
 * it leaves the person's work behind — a change made while the save was on its
 * way, changes Reload set aside — "Discard your changes?", the focus on
 * Cancel, so Enter keeps them where they are: the pager, Duplicate, Save &
 * Close in a dialog and a panel, a page's own button that saves then closes,
 * a page opened in the record's place, Done, and a page of answers sent. A
 * plain dialog's Escape asks about changes set aside. Done by the keys, over
 * a slow network, in the two tabs demo (demos/save-safety) and the plain demo.
 */

const DEMO = '/save-safety/';
const yours = (page: Page) => page.locator('.ss-tab[data-who="you"] .fd-form');
const field = (scope: Locator, name: string) => scope.locator(`.fd-field[data-field="${name}"]`).first();
const banner = (scope: Locator) => scope.locator('.fd-conflict');
const state = (page: Page) => page.evaluate(() => (window as any).fieldiaDemo.handle.form.getState());
const stored = (page: Page, id = 1) => page.evaluate((at) => (window as any).fieldiaDemo.dataSource.records.lead[at], id);
const closed = (page: Page) => page.evaluate(() => (window as any).fieldiaDemo.closed);
const box = (page: Page) => page.locator('.fd-form-dialog');

async function openDemo(page: Page, path = DEMO) {
  const problems: string[] = [];
  page.on('console', (message) => message.type() === 'error' && problems.push(`console: ${message.text()}`));
  page.on('pageerror', (error) => problems.push(`page error: ${error.message}`));
  await page.goto(path);
  await expect(yours(page).locator('.fd-title input')).toHaveValue(/Villa/);
  return problems;
}

/**
 * The source's saves held until the test lets them go, so a change can be made while one is on its way: resolves
 * once a save is asked for. `release()` lets every held one answer.
 */
async function holdSaves(page: Page, method: 'save' | 'submit' = 'save') {
  await page.evaluate((name) => {
    const demo = (window as any).fieldiaDemo;
    const source = demo.dataSource;
    const real = source[name].bind(source);
    demo.held = [];
    demo.release = () => demo.held.splice(0).forEach((go: () => void) => go());
    source[name] = async (request: unknown) => {
      await new Promise<void>((go) => demo.held.push(go));
      return real(request);
    };
  }, method);
  return {
    asked: () => expect.poll(() => page.evaluate(() => (window as any).fieldiaDemo.held.length)).toBeGreaterThan(0),
    release: () => page.evaluate(() => (window as any).fieldiaDemo.release()),
  };
}

/** A button reached by the keyboard and pressed with Enter. */
async function pressWithKeys(page: Page, button: Locator) {
  await button.focus();
  await expect(button).toBeFocused();
  await page.keyboard.press('Enter');
}

/** Asked "Discard your changes?", the safe answer focused. */
async function asked(page: Page) {
  const ask = page.getByRole('alertdialog');
  await expect(ask).toContainText('Discard your changes?');
  await expect(ask.getByRole('button', { name: 'Cancel' })).toBeFocused();
  return ask;
}

/** Discard, by the keys: Tab from Cancel, Enter. */
async function discard(page: Page) {
  await page.keyboard.press('Tab');
  await expect(page.getByRole('alertdialog').getByRole('button', { name: 'Discard' })).toBeFocused();
  await page.keyboard.press('Enter');
}

/** In Sara's tab: her phone changed, Mona saves in hers, Sara's save refused, then Reload: the phone set aside. */
async function reloadedInYourTab(page: Page) {
  const form = yours(page);
  await field(form, 'phone').locator('input').fill('+20 100 999 8887');
  await page.locator('.ss-button').click();
  await expect(page.locator('.ss-said')).toContainText('Mona saved');
  await field(form, 'phone').locator('input').press('ControlOrMeta+Enter');
  await pressWithKeys(page, banner(form).getByRole('button', { name: 'Reload' }));
  await expect(form.locator('.fd-set-aside')).toBeVisible();
  expect(await state(page)).toMatchObject({ dirty: [], setAside: { phone: '+20 100 999 8887' } });
  return form;
}

/** The lead in a panel or a dialog over Sara's tab; its phone changed, Mona saves, its save refused, Reload. */
async function reloadedIn(page: Page, as: 'panel' | 'dialog') {
  await page.evaluate((how) => void (window as any).fieldiaDemo.openLead(how), as);
  const phone = field(box(page), 'phone').locator('input');
  await expect(phone).toHaveValue('+20 100 123 4567');
  await phone.fill('+20 100 999 8887');
  await page.evaluate(() => (window as any).fieldiaDemo.dataSource.changeElsewhere('lead', 1, { stage: 'visit' }, { by: 'Mona' }));
  await pressWithKeys(page, box(page).getByRole('button', { name: 'Save & Close' }));
  await pressWithKeys(page, banner(box(page)).getByRole('button', { name: 'Reload' }));
  await expect(box(page).locator('.fd-set-aside li')).toContainText('+20 100 999 8887');
}

test('the pager, Sara typing while its save is on its way: asked; Enter keeps her on the lead with the change', async ({ page }) => {
  const problems = await openDemo(page);
  const form = yours(page);
  await field(form, 'phone').locator('input').fill('+20 100 999 8887');
  const saves = await holdSaves(page);
  const next = form.getByRole('button', { name: 'Next record' });
  await pressWithKeys(page, next);
  await saves.asked();
  await field(form, 'budget').locator('input').fill('4300000');
  await saves.release();
  await asked(page);
  await page.keyboard.press('Enter');
  await expect(page.getByRole('alertdialog')).toBeHidden();
  // Back where she was typing.
  await expect(field(form, 'budget').locator('input')).toBeFocused();
  await expect(form.locator('.fd-record-pager-text')).toHaveText('1 / 2');
  expect(await state(page)).toMatchObject({ recordId: 1, dirty: ['budget'] });
  expect(await stored(page)).toMatchObject({ phone: '+20 100 999 8887', budget: 4000000 });
  await expect(form.locator('.fd-status')).toHaveText('Saved, but not all your changes.');
  expect(problems).toEqual([]);
});

test('Duplicate from the gear after Reload: asked; Enter keeps the changes set aside, Discard opens the copy', async ({ page }) => {
  const problems = await openDemo(page);
  const form = await reloadedInYourTab(page);
  const gear = form.getByRole('button', { name: 'Actions' });
  const duplicate = async () => {
    await pressWithKeys(page, gear);
    const item = form.getByRole('menuitem', { name: 'Duplicate' });
    for (let i = 0; i < 5 && !(await item.evaluate((el) => el === document.activeElement)); i++) await page.keyboard.press('ArrowDown');
    await expect(item).toBeFocused();
    await page.keyboard.press('Enter');
  };
  await duplicate();
  await asked(page);
  await page.keyboard.press('Enter');
  await expect(page.getByRole('alertdialog')).toBeHidden();
  expect(await state(page)).toMatchObject({ recordId: 1, setAside: { phone: '+20 100 999 8887' } });
  await expect(form.locator('.fd-set-aside')).toBeVisible();
  expect(await page.evaluate(() => (window as any).fieldiaDemo.dataSource.calls.filter((c: { method: string }) => c.method === 'copy').length)).toBe(0);
  await duplicate();
  await asked(page);
  await discard(page);
  await expect(form.locator('.fd-title input')).toHaveValue(/\(copy\)/);
  expect((await state(page)).setAside).toBeNull();
  expect(problems).toEqual([]);
});

test('Save & Close in a panel after Reload: asked; Enter keeps the panel open with the changes set aside, Discard closes it', async ({ page }) => {
  const problems = await openDemo(page);
  await reloadedIn(page, 'panel');
  const saveClose = box(page).getByRole('button', { name: 'Save & Close' });
  await pressWithKeys(page, saveClose);
  await asked(page);
  await page.keyboard.press('Enter');
  await expect(page.getByRole('alertdialog')).toBeHidden();
  await expect(box(page)).toBeVisible();
  await expect(saveClose).toBeFocused();
  await expect(box(page).locator('.fd-set-aside li')).toContainText('+20 100 999 8887');
  expect(await closed(page)).toEqual([]);
  await page.keyboard.press('Enter');
  await asked(page);
  await discard(page);
  await expect(box(page)).toHaveCount(0);
  expect(await closed(page)).toMatchObject([{ saved: true }]);
  expect(problems).toEqual([]);
});

test('Save & Close in a dialog, Sara typing while it saves: asked; Enter keeps the dialog with the change, then it saves and closes', async ({ page }) => {
  const problems = await openDemo(page);
  await page.evaluate(() => void (window as any).fieldiaDemo.openLead('dialog'));
  await expect(field(box(page), 'phone').locator('input')).toHaveValue('+20 100 123 4567');
  await field(box(page), 'phone').locator('input').fill('+20 100 999 8887');
  const saves = await holdSaves(page);
  const saveClose = box(page).getByRole('button', { name: 'Save & Close' });
  await pressWithKeys(page, saveClose);
  await saves.asked();
  await field(box(page), 'budget').locator('input').fill('4300000');
  await saves.release();
  await asked(page);
  await page.keyboard.press('Enter');
  await expect(page.getByRole('alertdialog')).toBeHidden();
  await expect(box(page)).toBeVisible();
  expect(await stored(page)).toMatchObject({ phone: '+20 100 999 8887', budget: 4000000 });
  await expect(field(box(page), 'budget').locator('input')).toHaveValue(/4,?300,?000/);
  expect(await closed(page)).toEqual([]);
  // Pressed again, the rest is saved, and it closes.
  await pressWithKeys(page, saveClose);
  await saves.asked();
  await saves.release();
  await expect(box(page)).toHaveCount(0);
  expect(await closed(page)).toMatchObject([{ saved: true }]);
  expect(await stored(page)).toMatchObject({ budget: 4300000 });
  expect(problems).toEqual([]);
});

test('a dialog that saved, Cancel on the question, then Escape and Discard: it closes saved, by the keys', async ({ page }) => {
  const problems = await openDemo(page);
  await page.evaluate(() => void (window as any).fieldiaDemo.openLead('dialog'));
  await expect(field(box(page), 'phone').locator('input')).toHaveValue('+20 100 123 4567');
  await field(box(page), 'phone').locator('input').fill('+20 100 999 8887');
  const saves = await holdSaves(page);
  await pressWithKeys(page, box(page).getByRole('button', { name: 'Save & Close' }));
  await saves.asked();
  await field(box(page), 'budget').locator('input').fill('4300000');
  await saves.release();
  await asked(page);
  await page.keyboard.press('Enter');
  await expect(page.getByRole('alertdialog')).toBeHidden();
  await field(box(page), 'budget').locator('input').focus();
  await page.keyboard.press('Escape');
  await asked(page);
  await discard(page);
  await expect(box(page)).toHaveCount(0);
  // The save went through: the dialog says so however it closed after it.
  expect(await closed(page)).toMatchObject([{ saved: true, recordId: 1 }]);
  expect(await stored(page)).toMatchObject({ phone: '+20 100 999 8887', budget: 4000000 });
  expect(problems).toEqual([]);
});

test('a dialog’s own button that saves, then closes, Sara typing while it saves: asked once; Enter keeps the dialog', async ({ page }) => {
  const problems = await openDemo(page);
  await page.evaluate(() => void (window as any).fieldiaDemo.openLead('dialog', { footer: true }));
  await expect(field(box(page), 'phone').locator('input')).toHaveValue('+20 100 123 4567');
  await field(box(page), 'phone').locator('input').fill('+20 100 999 8887');
  const saves = await holdSaves(page);
  await pressWithKeys(page, box(page).getByRole('button', { name: 'Save and close' }));
  await saves.asked();
  await field(box(page), 'budget').locator('input').fill('4300000');
  await saves.release();
  await asked(page);
  await expect(page.getByRole('alertdialog')).toHaveCount(1);
  await page.keyboard.press('Enter');
  await expect(page.getByRole('alertdialog')).toBeHidden();
  await expect(box(page)).toBeVisible();
  expect(await closed(page)).toEqual([]);
  expect(await stored(page)).toMatchObject({ phone: '+20 100 999 8887', budget: 4000000 });
  expect(problems).toEqual([]);
});

test('a plain dialog’s Escape after Reload asks about the changes set aside; Enter keeps them', async ({ page }) => {
  const problems = await openDemo(page);
  await reloadedIn(page, 'dialog');
  await field(box(page), 'email').locator('input').focus();
  await page.keyboard.press('Escape');
  await asked(page);
  await page.keyboard.press('Enter');
  await expect(page.getByRole('alertdialog')).toBeHidden();
  await expect(box(page)).toBeVisible();
  await expect(box(page).locator('.fd-set-aside li')).toContainText('+20 100 999 8887');
  expect(await closed(page)).toEqual([]);
  expect(problems).toEqual([]);
});

test('a customer’s page opened in the order’s place gives way back on its save only once nothing typed in it is left unsaved', async ({ page }) => {
  const { problems } = await open(page, 'plain', 'page=quick-order&skin=outlined');
  const customer = node(page, 'f-customer').getByRole('combobox');
  await customer.click();
  await customer.fill('nile');
  await node(page, 'f-customer').getByRole('option', { name: 'Nile Traders', exact: true }).click();
  await pressWithKeys(page, page.getByRole('button', { name: 'Customer’s page' }));
  const title = page.locator('[data-node="#title"] input');
  await expect(title).toHaveValue('Nile Traders');
  const order = page.locator('form.fd-form').first();
  await title.fill('Nile Traders Co.');
  const saves = await holdSaves(page);
  await page.keyboard.press('ControlOrMeta+Enter');
  await saves.asked();
  await node(page, 'f-phone').locator('input').fill('+20 2 2345 0000');
  await saves.release();
  await asked(page);
  await page.keyboard.press('Enter');
  await expect(page.getByRole('alertdialog')).toBeHidden();
  // Still on the customer's page, the phone kept, the order still behind it.
  await expect(order).toBeHidden();
  await expect(title).toBeVisible();
  await expect(node(page, 'f-phone').locator('input')).toHaveValue('+20 2 2345 0000');
  expect(problems).toEqual([]);
});

test('Done, typing while it saves: the customer stays open to edit, and says what was not saved', async ({ page }) => {
  const { problems } = await open(page, 'plain', 'page=customer&record=1&editSwitch=1&skin=outlined');
  await node(page, 'f-phone').locator('input').fill('+20 100 999 8887');
  const saves = await holdSaves(page);
  await pressWithKeys(page, page.getByRole('button', { name: 'Done', exact: true }));
  await saves.asked();
  await node(page, 'f-email').locator('input').fill('orders@nile.example');
  await saves.release();
  await expect(page.locator('.fd-announce')).toHaveText('Saved, but not all your changes.');
  await expect(page.locator('form.fd-form').first()).not.toHaveAttribute('data-readonly', '');
  await expect(node(page, 'f-email').locator('input')).toHaveValue('orders@nile.example');
  await expect(page.locator('.fd-status')).toHaveText('Saved, but not all your changes.');
  expect(problems).toEqual([]);
});

test('answers changed while they are sent: no “Thank you”, the form stays with the change, and says it was not sent', async ({ page }) => {
  const { problems } = await open(page, 'plain', 'page=signup&skin=outlined');
  const box = (name: string) => page.locator(`.fd-field[data-field="${name}"]`).first();
  await box('full_name').locator('input').fill('Sara Hassan');
  await box('email').locator('input').fill('sara@example.com');
  await box('role').locator('select').selectOption({ label: 'Developer' });
  const sends = await holdSaves(page, 'submit');
  await pressWithKeys(page, page.getByRole('button', { name: 'Submit' }));
  await sends.asked();
  await box('company').locator('input').fill('Nile Traders');
  await sends.release();
  await expect(page.locator('.fd-announce')).toHaveText('Sent, but not your latest changes.');
  await expect(page.locator('.fd-done')).toBeHidden();
  await expect(box('company').locator('input')).toHaveValue('Nile Traders');
  await expect(page.locator('.fd-status')).toHaveText('Sent, but not your latest changes.');
  const sent = await page.evaluate(() => (window as any).fieldiaDemo.dataSource.responses.map((r: { values: unknown }) => r.values));
  expect(sent).toHaveLength(1);
  expect(sent[0]).toMatchObject({ full_name: 'Sara Hassan', email: 'sara@example.com' });
  expect(sent[0].company ?? '').toBe('');
  expect(problems).toEqual([]);
});
