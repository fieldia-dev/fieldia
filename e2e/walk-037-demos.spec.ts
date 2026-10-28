import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { node, open, screen } from './support';

/**
 * The gallery as the owner's walk of 0.37 met it: a line's and a card's dialogs titled by what a person reads, a line's
 * dialog drawing each field as its column does, and a featured list's record with its way back. (The bill's copy, the
 * invoices' counts and the recorder's words have their own: record.spec, the how-to replays, media.spec.)
 */

const dialogNamed = (page: Page, name: string) => page.getByRole('dialog', { name, exact: true });

test('a sales order line’s dialog draws Analytic Distribution as its column does — accounts and shares, never JSON', async ({ page }) => {
  await open(page, 'plain', 'page=real-sale-order&record=7101&skin=underline');
  await node(page, 'f-order-line').locator('.ag-row[row-index="1"] .ag-cell[col-id="__open"]').getByRole('button', { name: 'Open line' }).click();
  const dialog = dialogNamed(page, '[PM-12] Patient monitor PM-12');
  await expect(dialog.getByRole('textbox', { name: 'Quantity' })).toBeVisible();
  // The column's widget (the page's `cells`): its accounts, each with its share (the 0.37 walk: `{"4101": 70, "4102": 30}`).
  const distribution = dialog.locator('[data-node="values-analytic_distribution"] .fd-distribution');
  await expect(distribution).toBeVisible();
  await expect(distribution.locator('tbody tr')).toHaveCount(2);
  await expect(dialog.locator('textarea').filter({ hasText: '4101' })).toHaveCount(0);
  for (const box of await dialog.locator('textarea, input').all()) expect(await box.inputValue()).not.toMatch(/"4101"/);
  await screen(page, 'walk-037-line-distribution', { viewport: true });
});

test('a contact card’s dialog is titled by its contact’s name; one with no words yet, as its card is', async ({ page }) => {
  await open(page, 'plain', 'page=real-contact&record=7001&skin=underline');
  const card = page.getByRole('group', { name: /^Contact 2/ });
  const name = await card.getByRole('textbox').first().inputValue();
  expect(name).toMatch(/\S/);
  await card.getByRole('button', { name: /^Open/ }).first().click();
  await expect(dialogNamed(page, name)).toBeVisible();
});

test('on a phone, a question added to a survey opens titled by the button that added it, never "Line 11"', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page, 'plain', 'page=real-survey&record=7&skin=underline');
  const add = node(page, 'f-questions').getByRole('button', { name: 'Add a question' });
  await add.scrollIntoViewIfNeeded();
  await add.click();
  await expect(dialogNamed(page, 'Add a question')).toBeVisible();
  await expect(page.getByRole('dialog', { name: /^Line \d+$/ })).toHaveCount(0);
});

test('the Customer list, featured, opens a customer with its way back to the list', async ({ page }) => {
  await open(page, 'plain', 'page=customers&skin=underline');
  const row = page.locator('.fd-list-row').first();
  await expect(row).toBeVisible();
  await row.click({ position: { x: 40, y: 10 } });
  await expect(page).toHaveURL(/page=customer(&|$)/);
  const trail = page.getByRole('navigation', { name: 'Breadcrumbs' });
  await expect(trail.getByRole('link', { name: 'Customers' })).toBeVisible();
  await trail.getByRole('link', { name: 'Customers' }).click();
  await expect(page).toHaveURL(/page=customers(&|$)/);
  await expect(page.locator('.fd-list-row').first()).toBeVisible();
});
