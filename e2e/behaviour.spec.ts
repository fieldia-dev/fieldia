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
    await expect(rate).toHaveValue('7.00'); // at rest, with the field's two decimals
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
    await page.getByRole('button', { name: 'Send my answers' }).click();
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
    await expect(page.locator('[data-node="#title"] input')).toHaveValue('Nile Traders');
    await expect(page.getByRole('button', { name: 'Activate' })).toBeHidden();

    await page.getByRole('button', { name: 'Block', exact: true }).click();
    await expect(page.getByRole('alertdialog')).toContainText('Block this customer? New orders will be refused.');
    await screen(page, `${variant}-customer-confirm`);
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
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
    await node(page, 'f-company-type').getByLabel('Individual').check();
    await expect(page.getByRole('tab', { name: 'Contacts' })).toBeHidden();
  });

  test('a warning from the server appears under the field that changed', async ({ page }) => {
    await open(page, variant, 'page=customer&skin=underline');
    await expect(page.locator('[data-node="#title"] input')).toHaveValue('Nile Traders');
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

  test('adds up the milestones’ hours and amounts under the table, and follows a change', async ({ page }) => {
    await open(page, variant, 'page=fields&skin=outlined');
    const totals = node(page, 'f-milestones').locator('tfoot td');
    // The first column holds each line's grip.
    await expect(totals).toHaveText(['', 'Total', '', '76.0', 'EGP 425,000.00', '', '', '']);
    const hours = node(page, 'f-milestones').locator('tbody tr').first().getByLabel('Hours');
    await hours.fill('20');
    await expect(totals.nth(3)).toHaveText('84.0');
    await node(page, 'f-milestones').scrollIntoViewIfNeeded();
    await screen(page, `${variant}-fields-totals`);
  });

  test('numbers are written and read the way a German reader writes them', async ({ page }) => {
    await open(page, variant, 'page=fields&skin=outlined&locale=de');
    const budget = node(page, 'f-budget').getByLabel('Budget'); // the amount, not the currency beside it
    await expect(budget).toHaveValue('1.850.000,00');
    await expect(field(page, 'f-area')).toHaveValue('640,5'); // the field keeps one decimal
    await budget.fill('2.000.000,5');
    await budget.press('Tab');
    await expect(budget).toHaveValue('2.000.000,50');
    expect(await value(page, 'budget')).toBe(2000000.5);
    await expect(node(page, 'f-milestones').locator('tfoot td').nth(4)).toHaveText('EGP 425.000,00');
    await budget.scrollIntoViewIfNeeded();
    await screen(page, `${variant}-fields-german-numbers`);
  });

  test('progress bars fill and colour by how far they have come, and an editable one takes a typed value', async ({ page }) => {
    await open(page, variant, 'page=fields&skin=outlined');
    const progress = node(page, 'f-progress');
    const bar = progress.locator('.fd-progressbar');
    await expect(bar).toHaveAttribute('data-tone', 'warning');
    await expect(bar).toHaveText('64%');
    const box = progress.getByLabel('Fit-out progress');
    await box.fill('85');
    await box.press('Tab');
    await expect(bar).toHaveAttribute('data-tone', 'success');
    await expect(bar).toHaveText('85%');
    expect(await value(page, 'progress')).toBe(85);
    // The fill really covers 85 % of the track.
    await expect
      .poll(async () => {
        const track = (await bar.boundingBox())!;
        const filled = (await bar.locator('.fd-progressbar-fill').boundingBox())!;
        return Math.round((filled.width / track.width) * 100);
      })
      .toBeGreaterThanOrEqual(83);
    const spent = node(page, 'f-spent').getByRole('progressbar', { name: 'Spent so far' });
    await expect(spent).toHaveAttribute('aria-valuetext', '64%');
    await expect(spent).toHaveAttribute('data-tone', 'warning');
    const hours = node(page, 'f-hours').getByRole('progressbar', { name: 'Hours logged' });
    await expect(hours).toHaveAttribute('aria-valuetext', '37%');
    await expect(hours).toHaveAttribute('data-tone', 'info');
    await progress.scrollIntoViewIfNeeded();
    await screen(page, `${variant}-fields-progress`);
  });

  test('labels show a value between words, read from the page or another field', async ({ page }) => {
    await open(page, variant, 'page=fields&skin=outlined');
    await expect(page.getByLabel('Warranty')).toHaveText('24 months');
    await expect(page.getByLabel('Cable run')).toHaveText('240.0 m');
    await expect(page.getByLabel('Deposit paid')).toHaveText('370,000.00 EGP');
    await node(page, 'f-warranty').scrollIntoViewIfNeeded();
    await screen(page, `${variant}-fields-labels`);
  });

  test('free-text tags: picked from suggestions, typed with a comma, taken away with Backspace', async ({ page }) => {
    await open(page, variant, 'page=fields&skin=outlined');
    const tags = node(page, 'f-materials');
    const chips = tags.locator('.fd-chip-label');
    await expect(chips).toHaveText(['oak', 'glass']);
    const box = tags.getByRole('combobox');
    await box.click();
    await page.keyboard.type('st');
    await expect(tags.getByRole('option', { name: 'steel' })).toBeVisible();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await page.keyboard.type('concrete,');
    await expect(chips).toHaveText(['oak', 'glass', 'steel', 'concrete']);
    expect(await value(page, 'materials')).toBe('oak, glass, steel, concrete');
    await screen(page, `${variant}-fields-tags`);
    await page.keyboard.press('Backspace');
    await expect(chips).toHaveText(['oak', 'glass', 'steel']);
  });

  test('statusbars in the form: a selection’s states and a link’s stages, moved by a click', async ({ page }) => {
    await open(page, variant, 'page=fields&skin=outlined');
    const stage = node(page, 'f-stage').getByRole('list', { name: 'Stage' });
    await expect(stage.getByRole('listitem')).toHaveText(['Site survey', 'Design', 'Build', 'Handover']);
    await expect(stage.locator('[aria-current="step"]')).toHaveText('Design');
    await stage.getByRole('button', { name: 'Build' }).click();
    await expect(stage.locator('[aria-current="step"]')).toHaveText('Build');
    expect(await value(page, 'stage')).toBe('build');
    const permit = node(page, 'f-permit').getByRole('list', { name: 'Building permit' });
    await expect(permit.getByRole('listitem')).toHaveText(['Applied', 'Inspected', 'Approved']);
    await expect(permit.locator('[aria-current="step"]')).toHaveText('Inspected');
    await permit.getByRole('button', { name: 'Approved' }).click();
    expect(await value(page, 'permit_id')).toEqual({ id: 3, label: 'Approved' });
    await stage.scrollIntoViewIfNeeded();
    await screen(page, `${variant}-fields-statusbars`);
  });

  test('money can change its currency beside the amount, and every field on that currency follows', async ({ page }) => {
    await open(page, variant, 'page=fields&skin=outlined');
    const budget = node(page, 'f-budget');
    const picker = budget.getByRole('combobox', { name: 'Currency' });
    await expect(picker).toHaveValue('EGP');
    await expect(budget.getByLabel('Budget')).toHaveValue('1,850,000.00');
    await picker.click();
    await picker.fill('jo');
    await budget.getByRole('option', { name: 'JOD' }).click();
    expect(await value(page, 'currency_id')).toEqual({ id: 2, label: 'JOD' });
    await expect(page.getByLabel('Deposit paid')).toHaveText('370,000.00 JOD');
    await budget.scrollIntoViewIfNeeded();
    await screen(page, `${variant}-fields-currency-picker`);
  });

  test('a calendar with week numbers opens beside a date, and picks a day by mouse or keyboard', async ({ page }) => {
    await open(page, variant, 'page=fields&skin=outlined');
    const start = node(page, 'f-start');
    const button = start.getByRole('button', { name: 'Choose a date' });
    await button.click();
    const calendar = start.getByRole('dialog', { name: 'October 2026' });
    await expect(calendar).toBeVisible();
    await expect(calendar.locator('tbody th')).toHaveText(['40', '41', '42', '43', '44']);
    await expect(calendar.getByRole('button', { name: /Sunday,? 11 October 2026/ })).toBeFocused();
    await screen(page, `${variant}-fields-calendar`);
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await expect(calendar).toBeHidden();
    expect(await value(page, 'start_date')).toBe('2026-10-18');
    await expect(button).toBeFocused();
    await button.click();
    await start.getByRole('button', { name: /Thursday,? 22 October 2026/ }).click();
    expect(await value(page, 'start_date')).toBe('2026-10-22');
  });

  test('formatted text: the toolbar makes bold, a heading, a centred line and a link, and keeps them safe', async ({ page }) => {
    await open(page, variant, 'page=fields&skin=outlined');
    const brief = node(page, 'f-brief');
    const text = brief.locator('[contenteditable]');
    const bar = brief.getByRole('toolbar', { name: 'Formatting' });
    /** Select the first word of the first paragraph, as a drag across it would. */
    const selectFirstWord = () =>
      text.evaluate((el) => {
        const first = document.createTreeWalker(el, NodeFilter.SHOW_TEXT).nextNode()!;
        const range = document.createRange();
        range.setStart(first, 0);
        range.setEnd(first, 4);
        (el as HTMLElement).focus();
        getSelection()!.removeAllRanges();
        getSelection()!.addRange(range);
      });
    await selectFirstWord();
    await bar.getByRole('button', { name: 'Bold' }).click();
    await expect.poll(() => value(page, 'brief')).toMatch(/<b>Calm<\/b>/);
    await expect(bar.getByRole('button', { name: 'Bold' })).toHaveAttribute('aria-pressed', 'true');
    await bar.getByLabel('Text style').selectOption('h2');
    await expect.poll(() => value(page, 'brief')).toMatch(/^<h2>/);
    await bar.getByRole('button', { name: 'Align centre' }).click();
    await expect.poll(() => value(page, 'brief')).toMatch(/<h2 style="text-align: center;">/);
    await selectFirstWord();
    await bar.getByRole('button', { name: 'Link' }).click();
    await brief.getByLabel('Link address').fill('niletraders.example');
    await brief.getByRole('button', { name: 'Apply' }).click();
    await expect.poll(() => value(page, 'brief')).toMatch(/<a href="https:\/\/niletraders\.example">/);
    await text.scrollIntoViewIfNeeded();
    await screen(page, `${variant}-fields-richtext`);
  });

  test('building details are edited one by one, each with the field for its type', async ({ page }) => {
    await open(page, variant, 'page=fields&skin=outlined');
    await node(page, 's-structured').getByRole('button', { name: 'Structured data' }).click();
    const details = node(page, 'f-extra');
    await expect(details.getByLabel('Floor')).toHaveValue('12');
    await expect(details.getByLabel('Lift access')).toHaveValue('Freight lift, 08:00-10:00');
    await expect(details.getByLabel('Sprinklers fitted')).toBeChecked();
    await details.getByLabel('Floor').fill('14');
    await details.getByLabel('Sprinklers fitted').uncheck();
    await details.getByLabel('Fire zone').selectOption({ label: 'Zone A' });
    expect(await value(page, 'extra')).toEqual({ floor: 14, lift_access: 'Freight lift, 08:00-10:00', parking: 6, sprinklers: false, zone: 'a' });
    await details.scrollIntoViewIfNeeded();
    await screen(page, `${variant}-fields-properties`);
  });

  test('a client not on the list yet is created from the name typed, and chosen', async ({ page }) => {
    await open(page, variant, 'page=fields&skin=outlined');
    const client = node(page, 'f-client').getByRole('combobox');
    await client.fill('Hilton Cairo');
    const create = node(page, 'f-client').getByRole('option', { name: 'Create “Hilton Cairo”' });
    await expect(create).toBeVisible();
    await screen(page, `${variant}-fields-quick-create`);
    await create.click();
    await expect(client).toHaveValue('Hilton Cairo');
    const made = await value(page, 'client_id');
    expect(made).toEqual({ id: expect.any(Number), label: 'Hilton Cairo' });
    expect(await page.evaluate((id) => (window as any).fieldiaDemo.dataSource.records.partner[id], (made as { id: number }).id)).toEqual({ name: 'Hilton Cairo' });
  });

  test('a JSON field in the code editor: typed JSON reaches the form, broken JSON is said so', async ({ page }) => {
    await open(page, variant, 'page=fields&skin=outlined');
    await node(page, 's-structured').getByRole('button', { name: 'Structured data' }).click();
    const doors = node(page, 'f-doors');
    const editor = doors.getByRole('textbox', { name: 'Door schedule' });
    await expect(editor).toContainText('"weekdays": "07:00-20:00"');
    await editor.click();
    await page.keyboard.press('ControlOrMeta+A');
    await page.keyboard.type('{ "weekdays": "08:00-18:00", "weekends": "closed" }');
    await expect.poll(() => value(page, 'door_schedule')).toEqual({ weekdays: '08:00-18:00', weekends: 'closed' });
    await page.keyboard.press('Backspace'); // the closing brace: no longer valid
    await expect(doors.getByRole('alert')).toHaveText('Not valid JSON');
    expect(await value(page, 'door_schedule')).toEqual({ weekdays: '08:00-18:00', weekends: 'closed' });
    await doors.scrollIntoViewIfNeeded();
    await screen(page, `${variant}-fields-code-editor`);
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
