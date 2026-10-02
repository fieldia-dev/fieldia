import { expect, test, type Page } from '@playwright/test';
import { expectNoSidewaysScroll, node, open, screen } from './support';
import { VARIANTS } from './variants';

/**
 * The React engine's Playwright scenarios, ported: the same promises, kept by
 * the plain-DOM viewer in a real browser with a real keyboard and mouse.
 */

const field = (page: Page, id: string) => node(page, id).locator('input, textarea, select').first();
const value = (page: Page, name: string) =>
  page.evaluate((n) => (window as any).fieldiaDemo.handle.form.getState().values[n], name);

for (const variant of VARIANTS) {
test.describe(variant, () => {
test.describe('sign-up form', () => {
  test('marks required fields and shows help', async ({ page }) => {
    await open(page, variant, 'page=signup&skin=outlined');
    await expect(node(page, 'f-name')).toHaveClass(/fd-required/);
    await expect(node(page, 'f-company')).not.toHaveClass(/fd-required/);
    await expect(node(page, 'f-email').locator('.fd-help')).toHaveText('We send the joining details here.');
  });

  test('typing in the middle of a word keeps focus and the caret', async ({ page }) => {
    await open(page, variant, 'page=signup');
    const name = field(page, 'f-name');
    await name.click();
    await page.keyboard.type('Nile Trading');
    await page.keyboard.press('Home');
    for (let i = 0; i < 4; i++) await page.keyboard.press('ArrowRight');
    await page.keyboard.type('X');
    await expect(name).toHaveValue('NileX Trading');
    expect(await name.evaluate((el: HTMLInputElement) => el.selectionStart)).toBe(5);
    expect(await name.evaluate((el) => el === document.activeElement)).toBe(true);
    expect(await value(page, 'full_name')).toBe('NileX Trading');
  });

  test('a decimal can be typed one keystroke at a time', async ({ page }) => {
    await open(page, variant, 'page=signup');
    const rate = field(page, 'f-rate');
    await rate.click();
    await page.keyboard.type('1.');
    await expect(rate).toHaveValue('1.');
    expect(await value(page, 'hourly_rate')).toBe(1);
    await page.keyboard.type('5');
    await expect(rate).toHaveValue('1.5');
    expect(await value(page, 'hourly_rate')).toBe(1.5);
  });

  test('deleting from the middle of a decimal keeps the rest', async ({ page }) => {
    await open(page, variant, 'page=signup');
    const rate = field(page, 'f-rate');
    await rate.click();
    await page.keyboard.type('12.34');
    await page.keyboard.press('End');
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('Backspace');
    await expect(rate).toHaveValue('12.4');
    expect(await value(page, 'hourly_rate')).toBe(12.4);
  });

  test('a trailing point is kept while typing and tidied on leaving', async ({ page }) => {
    await open(page, variant, 'page=signup');
    const rate = field(page, 'f-rate');
    await rate.click();
    await page.keyboard.type('7.');
    await expect(rate).toHaveValue('7.');
    await page.keyboard.press('Tab');
    await expect(rate).toHaveValue('7');
  });

  test('conditions show and require fields as answers change', async ({ page }) => {
    await open(page, variant, 'page=signup');
    await expect(node(page, 'f-other-role')).toBeHidden();
    await field(page, 'f-role').selectOption({ label: 'Something else' });
    await expect(node(page, 'f-other-role')).toBeVisible();
    await expect(node(page, 'f-other-role')).toHaveClass(/fd-required/);
    await field(page, 'f-role').selectOption({ label: 'Manager' });
    await expect(node(page, 'f-other-role')).toBeHidden();
    await expect(node(page, 'f-team')).toBeVisible();
    await field(page, 'f-role').selectOption({ label: 'Developer' });
    await expect(node(page, 'f-team')).toBeHidden();
  });

  test('a toggle reveals the question it controls', async ({ page }) => {
    await open(page, variant, 'page=signup');
    await expect(node(page, 'f-dietary')).toBeHidden();
    await field(page, 'f-dinner').click();
    await expect(node(page, 'f-dietary')).toBeVisible();
    await field(page, 'f-dietary').fill('Vegetarian');
    expect(await value(page, 'dietary')).toBe('Vegetarian');
  });

  test('Tab moves through the fields in reading order', async ({ page }) => {
    await open(page, variant, 'page=signup');
    await field(page, 'f-name').click();
    const focused = () => page.evaluate(() => document.activeElement?.closest('[data-node]')?.getAttribute('data-node'));
    const order = [];
    for (let i = 0; i < 3; i++) {
      await page.keyboard.press('Tab');
      order.push(await focused());
    }
    expect(order).toEqual(['f-email', 'f-company', 'f-role']);
  });

  test('keeps special characters and very long text exactly', async ({ page }) => {
    await open(page, variant, 'page=signup');
    const special = `"<b>O'Neil & Sons</b>" — ١٢٣ 🙂 \\ / %`;
    await field(page, 'f-company').fill(special);
    expect(await value(page, 'company')).toBe(special);
    const long = 'x'.repeat(1000);
    await field(page, 'f-company').fill(long);
    expect(((await value(page, 'company')) as string).length).toBe(1000);
  });

  test('rapid typing loses nothing', async ({ page }) => {
    await open(page, variant, 'page=signup');
    const text = 'The quick brown fox jumps over the lazy dog 0123456789';
    await field(page, 'f-company').click();
    await page.keyboard.type(text, { delay: 0 });
    expect(await value(page, 'company')).toBe(text);
  });

  test('an empty submit names every missing answer, then a full one is sent', async ({ page }) => {
    const { demo } = await open(page, variant, 'page=signup');
    await page.getByRole('button', { name: 'Submit' }).click();
    await expect(node(page, 'f-name').locator('.fd-error')).toHaveText('Full name is required');
    await expect(node(page, 'f-email').locator('.fd-error')).toHaveText('Email is required');
    await expect(node(page, 'f-role').locator('.fd-error')).toHaveText('Your role is required');
    await expect(field(page, 'f-name')).toBeFocused();
    await screen(page, `${variant}-signup-errors`);

    await field(page, 'f-name').fill('Sara Hassan');
    await field(page, 'f-email').fill('sara@example.com');
    await field(page, 'f-role').selectOption({ label: 'Designer' });
    await page.getByRole('button', { name: 'Submit' }).click();
    await expect(page.locator('.fd-done')).toBeVisible();
    const responses = await demo<{ values: Record<string, unknown> }[]>('dataSource.responses');
    expect(responses).toHaveLength(1);
    expect(responses[0].values).toMatchObject({ full_name: 'Sara Hassan', email: 'sara@example.com', role: 'designer', ticket: 1500 });
    expect(responses[0].values).not.toHaveProperty('other_role');
  });

  test('runs right to left', async ({ page }) => {
    await open(page, variant, 'page=signup&skin=outlined&dir=rtl');
    await expect(page.locator('.fd-form')).toHaveAttribute('dir', 'rtl');
    const nameBox = await field(page, 'f-name').boundingBox();
    const emailBox = await field(page, 'f-email').boundingBox();
    expect(nameBox!.x).toBeGreaterThan(emailBox!.x); // the first column is on the right
    await expectNoSidewaysScroll(page);
    await screen(page, `${variant}-signup-rtl`);
  });
});

test.describe('survey', () => {
  test('walks the branch the answers choose, then submits', async ({ page }) => {
    const { demo } = await open(page, variant, 'page=survey&skin=outlined');
    await expect(page.locator('.fd-progress-text')).toHaveText('Step 1 of 3');
    await field(page, 'q-name').fill('Omar');
    await page.getByRole('button', { name: 'Next' }).click();
    await page.getByLabel('Yes').check();
    await expect(page.locator('.fd-progress-text')).toHaveText('Step 2 of 4');
    await page.getByRole('button', { name: 'Next' }).click();
    await expect(page.getByRole('heading', { name: 'Your experience' })).toBeVisible();
    await node(page, 'q-rating').getByRole('radio', { name: '4 of 5' }).click();
    await page.getByLabel('Speed').check();
    await page.getByLabel('Support').check();
    await screen(page, `${variant}-survey-experience`);
    await page.getByRole('button', { name: 'Next' }).click();
    await page.getByRole('button', { name: 'Submit' }).click();
    await expect(page.locator('.fd-done')).toBeVisible();
    const responses = await demo<{ values: Record<string, unknown> }[]>('dataSource.responses');
    expect(responses[0].values).toMatchObject({ name: 'Omar', uses_product: 'yes', rating: 4, liked: ['speed', 'support'] });
    expect(responses[0].values).not.toHaveProperty('reason_not');
  });

  test('a rating answers to the arrow keys', async ({ page }) => {
    await open(page, variant, 'page=survey');
    await field(page, 'q-name').fill('Omar');
    await page.getByRole('button', { name: 'Next' }).click();
    await page.getByLabel('Yes').check();
    await page.getByRole('button', { name: 'Next' }).click();
    const stars = node(page, 'q-rating');
    await stars.getByRole('radio', { name: '2 of 5' }).click();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    expect(await value(page, 'rating')).toBe(4);
    await expect(stars.getByRole('radio', { name: '4 of 5' })).toBeFocused();
  });
});

test.describe('customer sheet', () => {
  test('asks before blocking, moves through states, and saves', async ({ page }) => {
    const { demo } = await open(page, variant, 'page=customer&skin=underline');
    await expect(page.locator('.fd-title input')).toHaveValue('Nile Traders');
    await expect(page.getByRole('button', { name: 'Activate' })).toBeHidden();

    await page.getByRole('button', { name: 'Block', exact: true }).click();
    await expect(page.getByRole('alertdialog')).toContainText('Block this customer? New orders will be refused.');
    await screen(page, `${variant}-customer-confirm`);
    await page.getByRole('button', { name: 'Cancel' }).click();
    expect(await demo<string[]>('actions')).toEqual([]);
    await page.getByRole('button', { name: 'Block', exact: true }).click();
    await page.getByRole('button', { name: 'OK' }).click();
    await expect.poll(() => demo<string[]>('actions')).toEqual(['block']);

    await page.locator('.fd-statusbar').getByRole('button', { name: 'Blocked' }).click();
    await expect(page.locator('.fd-ribbon')).toBeVisible();
    await expect(page.locator('.fd-ribbon')).toHaveText('Blocked');
    // The ribbon sits in the corner without covering any stat button.
    const ribbon = (await page.locator('.fd-ribbon').boundingBox())!;
    for (const stat of await page.locator('.fd-stat').all()) {
      const box = (await stat.boundingBox())!;
      const overlaps = ribbon.x < box.x + box.width && box.x < ribbon.x + ribbon.width && ribbon.y < box.y + box.height && box.y < ribbon.y + ribbon.height;
      expect(overlaps, `ribbon covers "${await stat.textContent()}"`).toBe(false);
    }
    await page.getByRole('tab', { name: 'Sales and billing' }).click();
    await expect(field(page, 'f-credit-limit')).toHaveJSProperty('readOnly', true);
    await screen(page, `${variant}-customer-blocked`);

    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.locator('.fd-status')).toHaveText('Saved');
    await expect(page.getByRole('button', { name: 'Save' })).toBeHidden();
    const stored = await demo<Record<string, unknown>>('dataSource.records.partner.1');
    expect(stored['state']).toBe('blocked');
  });

  test('stat buttons hand their action to the app', async ({ page }) => {
    const { demo } = await open(page, variant, 'page=customer');
    await page.getByRole('button', { name: /18\s*Sales/ }).click();
    await expect.poll(() => demo<string[]>('actions')).toEqual(['open_sales']);
  });

  test('tabs switch, and a tab hides when its condition fails', async ({ page }) => {
    await open(page, variant, 'page=customer&skin=outlined');
    await expect(page.getByRole('tab', { name: 'Contacts' })).toHaveAttribute('aria-selected', 'true');
    await page.getByRole('tab', { name: 'Notes' }).click();
    await expect(node(page, 'f-notes')).toBeVisible();
    await page.getByRole('tab', { name: 'Notes' }).press('ArrowLeft');
    await expect(page.getByRole('tab', { name: 'Sales and billing' })).toBeFocused();
    await field(page, 'f-is-company').uncheck();
    await expect(page.getByRole('tab', { name: 'Contacts' })).toBeHidden();
  });

  test('a warning from the server appears under the field that changed', async ({ page }) => {
    await open(page, variant, 'page=customer&skin=underline');
    await expect(page.locator('.fd-title input')).toHaveValue('Nile Traders');
    await page.getByRole('tab', { name: 'Sales and billing' }).click();
    const limit = field(page, 'f-credit-limit');
    await limit.fill('250000');
    await limit.press('Tab');
    const warning = node(page, 'f-credit-limit').locator('.fd-warning');
    await expect(warning).toHaveText('Above the 100,000 approval limit: a manager has to sign this off.');
    await screen(page, `${variant}-onchange-warning`);
    await limit.fill('5000');
    await limit.press('Tab');
    await expect(warning).toBeHidden();
  });

  test('Discard puts the record back', async ({ page }) => {
    await open(page, variant, 'page=customer');
    await field(page, 'f-website').fill('https://changed.example');
    await page.getByRole('button', { name: 'Discard' }).click();
    await expect(field(page, 'f-website')).toHaveValue('');
    await expect(page.getByRole('button', { name: 'Save' })).toBeHidden();
  });
});
test.describe('every field', () => {
  test('loads the record into every widget', async ({ page }) => {
    await open(page, variant, 'page=fields&skin=outlined');
    await expect(field(page, 'f-name')).toHaveValue('Office fit-out, Nile Towers 12th floor');
    await expect(field(page, 'f-password')).toHaveAttribute('type', 'password');
    await expect(field(page, 'f-password')).toHaveValue('nile-12th-floor');
    await expect(node(page, 'f-readiness').getByRole('radio', { name: '3', exact: true })).toHaveAttribute('aria-checked', 'true');
    await expect(node(page, 'f-rating').getByRole('radio', { name: '4 of 5' })).toHaveAttribute('aria-checked', 'true');
    await expect(field(page, 'f-kickoff')).toHaveValue('2026-10-12T10:00');
    await expect(node(page, 'f-source').locator('select')).toHaveValue('partner');
    await expect(node(page, 'f-services').getByLabel('Design', { exact: true })).toBeChecked();
    await expect(node(page, 'f-services').getByLabel('After-care')).not.toBeChecked();
    await expect(node(page, 'f-team')).toContainText('Karim Fathy');
    await expect(node(page, 'f-milestones').locator('tbody tr')).toHaveCount(2);
    await expect(node(page, 'f-contract').getByRole('button', { name: 'Upload a file' })).toBeVisible();
  });

  test('a folded section opens from its title and shows its fields', async ({ page }) => {
    await open(page, variant, 'page=fields');
    const title = node(page, 's-structured').getByRole('button', { name: 'Structured data' });
    await expect(title).toHaveAttribute('aria-expanded', 'false');
    await expect(node(page, 'f-settings')).toBeHidden();
    await title.click();
    await expect(title).toHaveAttribute('aria-expanded', 'true');
    await expect(node(page, 'f-settings').locator('textarea')).toHaveValue(/badge_readers/);
    await title.press('Enter');
    await expect(node(page, 'f-settings')).toBeHidden();
  });

  test('offers Save only after a change, and Discard puts the record back', async ({ page }) => {
    await open(page, variant, 'page=fields');
    await expect(field(page, 'f-seats')).toHaveValue('48');
    await expect(page.getByRole('button', { name: 'Save' })).toBeHidden();
    await field(page, 'f-seats').fill('52');
    await page.getByRole('button', { name: 'Discard' }).click();
    await expect(field(page, 'f-seats')).toHaveValue('48');
    await expect(page.getByRole('button', { name: 'Save' })).toBeHidden();
    await screen(page, `${variant}-fields-page`);
  });
});
});
}
