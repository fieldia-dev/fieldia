import { type Locator, type Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { expectNoSidewaysScroll, node, open, screen } from './support';

/**
 * A page names its records (`"records": { "one": "contact", "other": "contacts", "a": "a contact" }`), and Fieldia's
 * own sentences say them as a person reads them: the contacts' pager and Select all, Edit's dialog and question, a
 * customer's invoices and quotations and a property's viewings named by their own pages ("New invoice", "View all
 * invoices", "No viewings yet"), the pager over a record ("Next property"), a customer typed twice ("A customer with
 * this phone already exists") — and the screen designer offering it, its list's pager saying it as it is typed.
 */

const WIDE = { width: 1280, height: 900 };
const PHONE = { width: 390, height: 844 };
const NOW = 'now=2026-10-14T09:40';
const part = (page: Page, id: string) => page.locator(`.fd-related[data-node="${id}"]`);
const tools = (list: Locator) => list.locator('.fd-related-tools button');

let problems: string[] = [];
test.afterEach(() => expect(problems).toEqual([]));

test.describe('a list that names its records', () => {
  test('the contacts: their pager, Select all, Edit’s dialog and question say contacts', async ({ page }) => {
    await page.setViewportSize(WIDE);
    ({ problems } = await open(page, 'plain', `page=contacts&skin=underline&${NOW}`));
    await expect(page.locator('.fd-pager-text')).toHaveText('1–10 of 1,284 contacts');
    await page.locator('thead .fd-list-checkbox').check();
    await expect(page.getByRole('button', { name: 'Select all 1,284 contacts that match' })).toBeVisible();
    await screen(page, 'record-names-contacts', { viewport: true });
    await page.locator('thead .fd-list-checkbox').uncheck();
    for (const row of [0, 1]) await page.locator('tbody .fd-list-row').nth(row).locator('.fd-list-checkbox').check();
    await page.locator('.fd-list-edit').click();
    const dialog = page.getByRole('dialog', { name: 'Edit 2 contacts' });
    await expect(dialog).toBeVisible();
    await dialog.locator('[data-node="bulk-pick"] select').selectOption({ label: 'Status' });
    await dialog.locator('[data-node="bulk-state"] select').selectOption({ label: 'Lead' });
    await dialog.getByRole('button', { name: 'Update' }).click();
    await expect(page.getByRole('alertdialog')).toContainText('Update 2 contacts? Status becomes “Lead”.');
    await screen(page, 'record-names-contacts-edit', { viewport: true });
    await page.getByRole('alertdialog').getByRole('button', { name: 'Cancel' }).click();
  });

  test('on a phone, the pager says them whole beside its arrows, nothing sideways', async ({ page }) => {
    await page.setViewportSize(PHONE);
    ({ problems } = await open(page, 'plain', `page=contacts&skin=underline&${NOW}`));
    const pager = page.locator('.fd-pager');
    await expect(pager.locator('.fd-pager-text')).toHaveText('1–10 of 1,284 contacts');
    const [words, next] = await Promise.all([pager.locator('.fd-pager-text').boundingBox(), pager.getByRole('button', { name: 'Next page' }).boundingBox()]);
    // On one line, before the arrows: never cut, never under them.
    expect(words!.height).toBeLessThan(30);
    expect(words!.x + words!.width).toBeLessThanOrEqual(next!.x);
    await expectNoSidewaysScroll(page);
    await screen(page, 'record-names-contacts-phone', { viewport: true });
  });
});

test.describe('related lists named by their own pages', () => {
  test('a customer’s invoices: New invoice, View all invoices, “5 of 9 invoices”; its quotations, kept to some, New quotation', async ({ page }) => {
    await page.setViewportSize(WIDE);
    ({ problems } = await open(page, 'plain', `page=customer-account&record=1&skin=underline&${NOW}`));
    const invoices = part(page, 'invoices');
    await expect(tools(invoices)).toHaveText(['View all invoices', 'New invoice']);
    await expect(invoices.locator('.fd-pager-text')).toHaveText(/^1–5 of \d+ invoices$/);
    await screen(page, 'record-names-customer-invoices');
    await invoices.getByRole('button', { name: 'New invoice' }).click();
    await expect(page.getByRole('dialog').locator('.fd-form-dialog-title')).toHaveText('New invoice');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toBeHidden();
    // Its quotations are kept to those not lost: "all" and "none" of them would be untrue, so those stay as they were.
    await page.getByRole('tab', { name: /Quotations/ }).click();
    const quotations = part(page, 'quotations');
    await expect(quotations.getByRole('button', { name: 'New quotation' })).toBeVisible();
  });

  test('a property’s viewings, and the pager over the property: Next property, then No viewings yet', async ({ page }) => {
    await page.setViewportSize(WIDE);
    ({ problems } = await open(page, 'plain', `page=property&record=1&skin=underline&${NOW}`));
    const viewings = part(page, 'viewings');
    await expect(tools(viewings)).toHaveText(['View all viewings', 'New viewing']);
    await expect(page.locator('.fd-record-pager')).toHaveAccessibleName('Properties');
    await page.getByRole('button', { name: 'Next property' }).click();
    await page.getByRole('button', { name: 'Next property' }).click();
    await expect(viewings.locator('.fd-list-empty')).toHaveText('No viewings yet.');
    await screen(page, 'record-names-property-none');
  });

  test('on a phone, a customer’s invoices name them whole, nothing sideways', async ({ page }) => {
    await page.setViewportSize(PHONE);
    ({ problems } = await open(page, 'plain', `page=customer-account&record=1&skin=underline&${NOW}`));
    const invoices = part(page, 'invoices');
    await expect(tools(invoices)).toHaveText(['View all invoices', 'New invoice']);
    for (const button of await tools(invoices).all()) expect(await button.evaluate((b) => b.scrollWidth <= b.clientWidth)).toBe(true);
    await expectNoSidewaysScroll(page);
    await invoices.scrollIntoViewIfNeeded();
    await screen(page, 'record-names-customer-invoices-phone', { viewport: true });
  });
});

test.describe('a customer typed twice', () => {
  test('is said as a customer, its field’s label small inside the sentence', async ({ page }) => {
    await page.setViewportSize(WIDE);
    ({ problems } = await open(page, 'plain', 'page=customer-card&record=new&skin=underline'));
    const phone = node(page, 'f-phone').locator('.fd-phone-input');
    await phone.click();
    await phone.pressSequentially('02 2345 6789');
    await phone.press('Tab');
    await expect(node(page, 'f-phone').locator('.fd-duplicate-words')).toHaveText('A customer with this phone already exists: Nile Traders');
    await expect(node(page, 'f-phone').locator('.fd-duplicates').getByRole('button')).toHaveText(['Open it', 'It’s a new customer']);
    await screen(page, 'record-names-duplicate', { viewport: true });
  });

  test('a refused save asks to check its fields by labels small, one that begins its sentence as written', async ({ page }) => {
    await page.setViewportSize(WIDE);
    ({ problems } = await open(page, 'plain', 'page=customer-card&record=new&skin=underline'));
    await node(page, 'f-email').locator('input').fill('mona@example.com');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.locator('.fd-announce')).toHaveText('Not saved. Check: name');
    await expect(node(page, '#title').locator('.fd-error')).toHaveText('Name is required');
    await screen(page, 'record-names-check', { viewport: true });
  });
});

test.describe('the screen designer', () => {
  test('offers what a list’s records are called first on its panel; its canvas’s pager says it as it is typed', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/screen/?start=list');
    const panel = page.locator('.fd-properties');
    const called = panel.locator('[data-setting="Records are called"]');
    await expect(called).toBeVisible();
    await expect(panel.locator('[data-setting="One with its article"]')).toBeHidden();
    await called.getByLabel('One record is called').pressSequentially('customer');
    // One word alone: nothing kept yet, and the panel says what is missing.
    await expect(called.locator('.fd-records-half')).toHaveText('Give the word for one and for more.');
    await called.getByLabel('More are called').pressSequentially('customers');
    await expect(called.locator('.fd-records-half')).toBeHidden();
    await expect(page.locator('.fd-canvas .fd-pager-text, .fd-designer .fd-pager-text').first()).toHaveText(/^1–40 of \d+ customers$/);
    await panel.locator('[data-setting="One with its article"]').getByLabel('One with its article').pressSequentially('a customer');
    await panel.locator('[data-setting="Field names small inside them"]').getByLabel('Field names small inside them').check();
    expect(await page.evaluate(() => (window as any).fieldiaDesigner.designer.getPage().records)).toEqual({ one: 'customer', other: 'customers', a: 'a customer', lowerLabels: true });
    await screen(page, 'record-names-designer', { viewport: true });
    expect(errors).toEqual([]);
  });
});
