import { type Locator, type Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { open, screen } from './support';

/**
 * The owner's walk of 0.25 (finding 1): a record's dialog — a related list's New and its row, a calendar's New — closed
 * on Escape or × with what was typed lost, unasked, where a line's own dialog has asked "Discard your changes?" since
 * 0.24. Every dialog or panel holding a form with a person's edits asks now, by one rule (the form's `leave()`, every
 * change not saved counting): Cancel focused, Enter keeps, Discard lets them go. A dialog opened and left as it was
 * closes at once, as it always has.
 */

const NOW = 'now=2026-10-14T09:40';
const CUSTOMER = `page=customer-account&record=1&skin=underline&${NOW}`;
const PROPERTY = `page=property&record=1&skin=underline&${NOW}`;
const DRIVES = 'page=test-drives&skin=outlined&now=2026-10-14T09:40';

const dialog = (page: Page) => page.getByRole('dialog');
const ask = (page: Page) => page.getByRole('alertdialog');
const tool = (list: Locator, name: string) => list.locator('.fd-related-tools button', { hasText: name });
const records = (page: Page, model: string) => page.evaluate((m) => Object.values((window as any).fieldiaDemo.dataSource.records[m] ?? {}) as Record<string, unknown>[], model);

/** Escape (or ×) asks, Cancel has the focus, Enter keeps the dialog and what was typed; then × asks again and Discard lets go. */
async function asksThenLetsGo(page: Page, typed: Locator, value: string | RegExp, name: string) {
  await page.keyboard.press('Escape');
  await expect(ask(page)).toContainText('Discard your changes');
  await expect(ask(page).getByRole('button', { name: 'Cancel' })).toBeFocused();
  await screen(page, `${name}-asks`, { viewport: true });
  await page.keyboard.press('Enter');
  await expect(ask(page)).toHaveCount(0);
  await expect(dialog(page)).toBeVisible();
  await expect(typed).toHaveValue(value);
  // ×, the same question; Discard lets the typing go.
  await dialog(page).locator('.fd-dialog-close').click();
  await expect(ask(page)).toContainText('Discard your changes');
  await ask(page).getByRole('button', { name: 'Discard' }).click();
  await expect(dialog(page)).toHaveCount(0);
}

test('a customer’s New invoice with its number typed: Escape and × ask, Enter keeps it, Discard makes nothing', async ({ page }) => {
  const { problems } = await open(page, 'plain', CUSTOMER);
  const before = (await records(page, 'invoice')).length;
  await tool(page.locator('[data-node="invoices"]'), 'New').click();
  const number = dialog(page).locator('[data-node="#title"] textarea');
  await number.fill('INV/2026/0042');
  await asksThenLetsGo(page, number, 'INV/2026/0042', 'dialog-ask-new-invoice');
  expect((await records(page, 'invoice')).length).toBe(before);
  // Opened and left as it was (its customer filled in by New): Escape closes it at once.
  await tool(page.locator('[data-node="invoices"]'), 'New').click();
  await expect(dialog(page).locator('[data-node="f-partner"] input')).toHaveValue('Nile Traders');
  await page.keyboard.press('Escape');
  await expect(dialog(page)).toHaveCount(0);
  await expect(ask(page)).toHaveCount(0);
  expect(problems).toEqual([]);
});

test('a property’s viewing set Done with its feedback typed: Escape asks; Discard leaves it Planned and empty', async ({ page }) => {
  const { problems } = await open(page, 'plain', PROPERTY);
  const viewings = page.locator('[data-node="viewings"]');
  const first = viewings.locator('.fd-list-row', { hasText: 'Planned' }).first();
  const client = (await first.locator('td').nth(1).textContent())?.trim() ?? '';
  const was = (await records(page, 'viewing')).find((viewing) => viewing['client'] === client);
  expect(was?.['state'], 'a viewing still to happen').toBe('planned');
  await first.click();
  await expect(dialog(page)).toBeVisible();
  await dialog(page).locator('[data-node="f-state"] select').selectOption({ label: 'Done' });
  const feedback = dialog(page).locator('[data-node="f-feedback"] input');
  await feedback.fill('Liked the light, wants a second look');
  await asksThenLetsGo(page, feedback, 'Liked the light, wants a second look', 'dialog-ask-viewing');
  const kept = (await records(page, 'viewing')).find((viewing) => viewing['client'] === client);
  expect(kept?.['state']).toBe('planned');
  expect(kept?.['feedback'] ?? '').toBe('');
  expect(problems).toEqual([]);
});

test('the showroom calendar’s New with a name typed: Escape asks, and so does ×', async ({ page }) => {
  const { problems } = await open(page, 'plain', DRIVES);
  await expect(page.locator('.fd-cal')).toBeVisible();
  const before = (await records(page, 'drive.booking')).length;
  await page.locator('.fd-cal-new').click();
  const name = dialog(page).locator('[data-node="f-customer"] input');
  await name.fill('Walk-in customer');
  await asksThenLetsGo(page, name, 'Walk-in customer', 'dialog-ask-test-drive');
  expect((await records(page, 'drive.booking')).length).toBe(before);
  expect(problems).toEqual([]);
});

test('a press on the dimmed page behind a record’s dialog never closes it, typed in or not', async ({ page }) => {
  await open(page, 'plain', CUSTOMER);
  await tool(page.locator('[data-node="invoices"]'), 'New').click();
  const number = dialog(page).locator('[data-node="#title"] textarea');
  await number.fill('INV/2026/0043');
  await page.mouse.click(5, 5);
  await expect(dialog(page)).toBeVisible();
  await expect(number).toHaveValue('INV/2026/0043');
});

test('a page an `open` step shows in this one’s place: Back with a change asks, Cancel stays', async ({ page }) => {
  const { problems } = await open(page, 'plain', 'page=quick-order&skin=underline');
  const customer = page.locator('[data-node="f-customer"] input').first();
  await customer.fill('Nile');
  await page.getByRole('option', { name: 'Nile Traders' }).first().click();
  await page.getByRole('button', { name: 'Customer’s page' }).click();
  const back = page.locator('.fd-back');
  await expect(back).toBeVisible();
  const website = page.locator('[data-field="website"] input');
  await website.fill('niletraders.example');
  await back.click();
  await expect(ask(page)).toContainText('Discard your changes');
  await expect(ask(page).getByRole('button', { name: 'Cancel' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(website).toHaveValue('niletraders.example');
  await back.click();
  await ask(page).getByRole('button', { name: 'Discard' }).click();
  await expect(back).toHaveCount(0);
  expect(problems).toEqual([]);
});
