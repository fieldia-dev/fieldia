import { expect, test, type Page } from '@playwright/test';
import { expectNoSidewaysScroll, node, open, screen } from './support';
import { VARIANTS } from './variants';

/**
 * The business widgets, used as a person uses them, on the fit-out task:
 * priority stars and a state's dot on the title's line, a live timer started
 * and stopped by the app, a range of dates, properties that follow the
 * project, an analytic distribution, tax totals, payments, a PDF shown
 * inline, and a grid whose cells are stars, dots, hours and bars — in every
 * framework, in Arabic right to left, and on a phone.
 */

const valueOf = (page: Page, field: string) => page.evaluate((name) => (window as any).fieldiaDemo.handle.form.getState().values[name], field);
const QUERY = 'page=business&skin=underline';

test.describe('the business widgets', () => {
  let problems: string[] = [];
  test.beforeEach(async ({ page }) => {
    ({ problems } = await open(page, 'plain', QUERY));
  });
  test.afterEach(() => expect(problems).toEqual([]));

  test('priority stars and a state’s dot sit on the title’s line, used with the mouse and the keys', async ({ page }) => {
    const line = page.locator('.fd-title-line');
    await expect(line.locator('> [data-node]')).toHaveCount(3);
    const stars = node(page, 'f-priority').getByRole('radio');
    await expect(stars).toHaveCount(3);
    await stars.nth(2).click();
    expect(await valueOf(page, 'priority')).toBe('3');
    await stars.nth(2).click();
    expect(await valueOf(page, 'priority')).toBe('0');
    await stars.first().focus();
    await page.keyboard.press('ArrowRight');
    expect(await valueOf(page, 'priority')).toBe('1');

    const dot = node(page, 'f-state').getByRole('button', { name: 'Status: In progress' });
    await dot.click();
    const menu = page.getByRole('menu', { name: 'Status' });
    await expect(menu).toBeVisible();
    await menu.getByRole('menuitemradio', { name: 'Blocked' }).click();
    expect(await valueOf(page, 'kanban_state')).toBe('blocked');
    await expect(menu).toBeHidden();
    await expect(node(page, 'f-state').getByRole('button', { name: 'Status: Blocked' })).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    expect(await valueOf(page, 'kanban_state')).toBe('done');
  });

  test('the timer runs once started, and stopping it logs the time', async ({ page }) => {
    const timer = node(page, 'f-duration').getByRole('timer');
    await expect(timer).toHaveText('12:45:00');
    await page.getByRole('button', { name: 'Start timer' }).click();
    await expect(timer).toHaveAttribute('data-running', 'true');
    await expect(timer).not.toHaveText('12:45:00', { timeout: 3000 });
    await page.getByRole('button', { name: 'Stop timer and log' }).click();
    await expect(page.getByText('1 min logged.')).toBeVisible();
    await expect(timer).not.toHaveAttribute('data-running');
    expect(await valueOf(page, 'duration')).toBeCloseTo(12.77, 2);
  });

  test('a range of dates is picked on its calendar, the first day then the last', async ({ page }) => {
    const range = node(page, 'f-dates');
    await range.getByRole('button', { name: 'Choose a date' }).click();
    const calendar = range.getByRole('dialog');
    await calendar.getByRole('button', { name: /20 October 2026/ }).click();
    await calendar.getByRole('button', { name: /14 October 2026/ }).click();
    expect([await valueOf(page, 'date_from'), await valueOf(page, 'date_to')]).toEqual(['2026-10-14', '2026-10-20']);
    await expect(range.getByLabel('Ends')).toHaveValue('2026-10-20');
  });

  test('properties follow the project, and one is added in place', async ({ page }) => {
    const props = node(page, 'f-properties');
    await expect(props.locator('.fd-property > label')).toHaveText(['Floor', 'Lift booked', 'Site contact', 'Handover']);
    await props.getByRole('button', { name: '+ Add a property' }).click();
    await props.getByLabel('Property name').fill('Locker number');
    await props.getByLabel('Kind').selectOption('integer');
    await props.getByRole('button', { name: 'Add', exact: true }).click();
    await expect(props.getByLabel('Locker number')).toBeFocused();
    await props.getByLabel('Locker number').fill('14');
    expect(await valueOf(page, 'task_properties')).toMatchObject({ locker_number: 14 });

    const project = node(page, 'f-project').getByRole('combobox');
    await project.fill('clinic');
    await page.getByRole('option', { name: 'Amira Clinics, Zamalek' }).click();
    await expect(props.locator('.fd-property > label')).toHaveText(['Treatment rooms', 'Medical gas lines']);
  });

  test('invoicing: shares of accounts, a tax amount corrected, and a payment’s details', async ({ page }) => {
    await page.getByRole('tab', { name: 'Invoicing' }).click();
    const analytic = node(page, 'f-analytic');
    await expect(analytic.getByRole('combobox').first()).toHaveValue('Cairo office');
    await expect(analytic.getByRole('combobox').nth(1)).toHaveValue('Fit-out projects');
    await expect(analytic.locator('tfoot')).toContainText('100%');
    await analytic.getByLabel('Percentage').nth(1).fill('20');
    await expect(analytic.locator('.fd-distribution-off')).toHaveText('The shares add up to 90%, not 100%');

    const totals = node(page, 'f-tax-totals');
    await totals.getByLabel('VAT 14%').fill('25000');
    await totals.getByLabel('VAT 14%').press('Tab');
    await expect(totals.locator('.fd-tax-total td')).toHaveText('E£210,800.00');

    const payments = node(page, 'f-payments');
    await payments.getByRole('button', { name: 'Payment of E£40,000.00' }).click();
    const details = page.getByRole('dialog', { name: 'Payment of E£40,000.00' });
    await expect(details).toContainText('Site deposit');
    await page.keyboard.press('Escape');
    await expect(details).toBeHidden();
    await expect(payments.getByRole('button', { name: 'Payment of E£40,000.00' })).toBeFocused();
    await expect(payments.locator('.fd-payment-due')).toContainText('E£51,560.00');
  });

  test('a PDF is shown inline, and a page at an address typed in', async ({ page }) => {
    await page.getByRole('tab', { name: 'Documents' }).click();
    await expect(node(page, 'f-instructions').locator('iframe')).toHaveAttribute('src', /^blob:/);
    const address = new URL('/plain/?page=signup', page.url()).href;
    await node(page, 'f-slides').getByRole('textbox').fill(address);
    await expect(node(page, 'f-slides').locator('iframe')).toHaveAttribute('src', address);
    await expect(node(page, 'f-slides').getByRole('link', { name: 'Open in a new tab' })).toHaveAttribute('href', address);
  });

  test('a grid’s cells are stars, dots, hours and bars, its hours added up', async ({ page }) => {
    const grid = node(page, 'f-subtasks');
    await expect(grid.locator('.ag-row-pinned [col-id="allocated_hours"], .ag-floating-bottom [col-id="allocated_hours"]').first()).toHaveText('36:30');
    await expect(grid.locator('.ag-row[row-index="1"] [col-id="allocated_hours"]')).toHaveText('16:30');
    await expect(grid.locator('.ag-row[row-index="1"] [role="progressbar"]')).toHaveAttribute('aria-valuetext', '45%');
    await grid.locator('.ag-row[row-index="1"] [col-id="priority"]').getByRole('radio').click();
    const lines = (await valueOf(page, 'child_ids')) as { values: { priority: string } }[];
    expect(lines[1].values.priority).toBe('1');
    await grid.locator('.ag-row[row-index="2"] [col-id="kanban_state"]').getByRole('button').click();
    await page.getByRole('menuitemradio', { name: 'Ready' }).click();
    expect(((await valueOf(page, 'child_ids')) as { values: { kanban_state: string } }[])[2].values.kanban_state).toBe('done');
    await screen(page, 'business-widgets');
  });
});

test.describe('the business widgets, right to left and on a phone', () => {
  test('in Arabic, mirrored, their words in Arabic', async ({ page }) => {
    const { problems } = await open(page, 'plain', `${QUERY}&locale=ar&dir=rtl`);
    const stars = node(page, 'f-priority').getByRole('radio');
    await stars.first().focus();
    await page.keyboard.press('ArrowLeft');
    expect(await valueOf(page, 'priority')).toBe('3');
    await page.getByRole('tab', { name: 'Invoicing' }).click();
    await expect(page.locator('.fd-tax-totals')).toContainText('الإجمالي');
    await screen(page, 'business-widgets-arabic');
    expect(problems).toEqual([]);
  });

  test('on a phone, nothing scrolls sideways', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const { problems } = await open(page, 'plain', QUERY);
    await expectNoSidewaysScroll(page);
    await expect(node(page, 'f-dates').getByLabel('Ends')).toBeVisible();
    expect(problems).toEqual([]);
  });
});

for (const variant of VARIANTS) {
  test(`${variant}: the title’s line and the timer`, async ({ page }) => {
    const { problems } = await open(page, variant, QUERY);
    await node(page, 'f-priority').getByRole('radio').nth(2).click();
    expect(await valueOf(page, 'priority')).toBe('3');
    await page.getByRole('button', { name: 'Start timer' }).click();
    await expect(node(page, 'f-duration').getByRole('timer')).toHaveAttribute('data-running', 'true');
    expect(problems).toEqual([]);
  });
}
