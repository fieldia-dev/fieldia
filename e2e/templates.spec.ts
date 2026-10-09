import { expect, test, type Locator, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DEMOS } from '../demos/catalog.mjs';
import { axeFindings, settle } from './a11y-support';
import { expectNoSidewaysScroll, node, open, screen } from './support';

/**
 * The template library, examples/templates, as people meet it: each in the
 * gallery under its own name and words, open in the theme it names, nothing
 * axe finds in the dark either, nothing sideways on a phone — and what each
 * card's "how to try it" promises, done by typing and clicking.
 */

const TEMPLATES = join(__dirname, '..', 'examples', 'templates');
const INDEX: { id: string; name: string; theme: string; blurb: string }[] = JSON.parse(readFileSync(join(TEMPLATES, 'index.json'), 'utf8'));
const isRecord = (id: string) => JSON.parse(readFileSync(join(TEMPLATES, `${id}.page.json`), 'utf8')).data.kind === 'record';
const query = (id: string) => DEMOS.find((demo) => demo.id === `template-${id}`)!.query;

const box = (page: Page, id: string) => node(page, id).locator('input, select, textarea').first();
const lines = (page: Page, id: string) => node(page, id).locator('tbody tr[data-line]');
const cell = (row: Locator, label: string) => row.getByLabel(label, { exact: true });

test('the gallery lists each template once, under the library’s own name and words, in its theme', () => {
  const cards = DEMOS.filter((demo) => demo.category === 'templates');
  expect(cards.map((card) => card.id)).toEqual(INDEX.map((t) => `template-${t.id}`));
  for (const t of INDEX) {
    const card = cards.find((c) => c.id === `template-${t.id}`)!;
    expect([card.name, card.blurb]).toEqual([t.name, t.blurb]);
    expect(card.query).toBe(`page=template-${t.id}&theme=${t.theme}${isRecord(t.id) ? '&record=new' : ''}`);
    expect(card.howTo.length).toBeGreaterThanOrEqual(2);
  }
});

for (const t of INDEX) {
  test(`${t.id}: in ${t.theme}, axe-clean light and dark, and nothing sideways on a phone`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    const { problems } = await open(page, 'plain', query(t.id));
    const form = page.locator('.fd-form').first();
    await expect(form).toHaveAttribute('data-fd-theme', t.theme);
    await screen(page, `template-${t.id}`);
    await form.evaluate((f) => f.setAttribute('data-scheme', 'dark'));
    await settle(page);
    expect(await axeFindings(page, `${t.id} dark`)).toEqual([]);
    await page.setViewportSize({ width: 390, height: 844 });
    await settle(page);
    await expectNoSidewaysScroll(page);
    await screen(page, `template-${t.id}-phone`);
    expect(problems).toEqual([]);
  });
}

test.describe('what the templates’ cards say to try', () => {
  test('contact us: a topic that asks for more, and Submit sends the cursor to the first answer missing', async ({ page }) => {
    await open(page, 'plain', query('contact-us'));
    await expect(node(page, 'f-order')).toBeHidden();
    await box(page, 'f-topic').selectOption({ label: 'Help with something' });
    await expect(node(page, 'f-order')).toBeVisible();
    await page.getByRole('button', { name: 'Submit' }).click();
    await expect(box(page, 'f-name')).toBeFocused();
    await expect(node(page, 'f-reply').locator('.fd-choice-clear')).toBeHidden();
  });

  test('customer feedback: a contact allowed asks for the email, and needs it', async ({ page }) => {
    await open(page, 'plain', query('customer-feedback'));
    await expect(node(page, 'f-email')).toBeHidden();
    await node(page, 'f-follow').getByRole('switch').click();
    await expect(node(page, 'f-email')).toBeVisible();
    await expect(box(page, 'f-email')).toHaveAttribute('aria-required', 'true');
  });

  test('event registration: the ticket sets the price, and a student is asked for the card', async ({ page }) => {
    await open(page, 'plain', query('event-registration'));
    await expect(box(page, 'f-price')).toHaveValue('120.00');
    await node(page, 'f-ticket').getByLabel('VIP, with the dinner').check();
    await expect(box(page, 'f-price')).toHaveValue('250.00');
    await node(page, 'f-ticket').getByLabel('Student').check();
    await expect(box(page, 'f-price')).toHaveValue('40.00');
    await expect(node(page, 'f-student')).toBeVisible();
  });

  test('job application: Next waits for the role; three steps end in Send my application', async ({ page }) => {
    await open(page, 'plain', query('job-application'));
    await page.getByRole('button', { name: 'Next' }).click();
    await expect(box(page, 'f-role')).toBeFocused();
    await box(page, 'f-role').selectOption({ label: 'Product designer' });
    await page.getByRole('button', { name: 'Next' }).click();
    await box(page, 'f-name').fill('Sara Hassan');
    await box(page, 'f-email').fill('sara@example.com');
    await box(page, 'f-phone').fill('+20 100 000 0000');
    await page.getByRole('button', { name: 'Next' }).click();
    await expect(page.getByRole('button', { name: 'Send my application' })).toBeVisible();
  });

  test('support request: a fault asks for the steps; urgency is stars', async ({ page }) => {
    await open(page, 'plain', query('support-request'));
    await expect(node(page, 'f-steps')).toBeHidden();
    await node(page, 'f-kind').getByLabel('Something is broken').check();
    await expect(node(page, 'f-steps')).toBeVisible();
    await expect(node(page, 'f-priority').getByRole('radio')).toHaveCount(3);
  });

  test('property enquiry: renting swaps the budget for the rent, and a viewing asks for a day', async ({ page }) => {
    await open(page, 'plain', query('property-enquiry'));
    await expect(node(page, 'f-budget')).toBeVisible();
    await node(page, 'f-purpose').getByLabel('Rent').check();
    await expect(node(page, 'f-budget')).toBeHidden();
    await expect(node(page, 'f-rent')).toBeVisible();
    await node(page, 'f-viewing').getByRole('switch').click();
    await expect(node(page, 'f-viewing-date')).toBeVisible();
  });

  test('patient intake: allergies ask for their details, on the second step', async ({ page }) => {
    await open(page, 'plain', query('patient-intake'));
    // A step jumped to checks the steps before it.
    await box(page, 'f-name').fill('Sara Hassan');
    await box(page, 'f-birth').fill('1990-04-12');
    await box(page, 'f-phone').fill('+20 100 000 0000');
    await page.getByRole('button', { name: /Your health/ }).click();
    await expect(node(page, 'f-allergies')).toBeHidden();
    await node(page, 'f-has-allergies').getByRole('switch').click();
    await expect(node(page, 'f-allergies')).toBeVisible();
  });

  test('invoice: a line’s subtotal less its discount, the totals with tax, and Confirm then Register payment', async ({ page }) => {
    await open(page, 'plain', query('invoice'));
    await node(page, 'f-lines').getByRole('button', { name: /Add a line/ }).click();
    const line = lines(page, 'f-lines').first();
    await cell(line, 'Description').pressSequentially('Consulting, May');
    await cell(line, 'Quantity').fill('10');
    await cell(line, 'Unit price').pressSequentially('150');
    await expect(cell(line, 'Subtotal')).toHaveValue('1,500.00');
    await cell(line, 'Disc. %').fill('10');
    await expect(cell(line, 'Subtotal')).toHaveValue('1,350.00');
    await expect(box(page, 'f-untaxed')).toHaveValue('1,350.00');
    await expect(box(page, 'f-tax')).toHaveValue('189.00');
    await expect(box(page, 'f-total')).toHaveValue('1,539.00');
    await screen(page, 'template-invoice-typed');
    await node(page, 'f-partner').locator('input').pressSequentially('Nile');
    await page.getByRole('option', { name: 'Nile Traders' }).click();
    await page.getByRole('button', { name: 'Confirm' }).click();
    await expect(page.getByRole('button', { name: 'Register payment' })).toBeVisible();
    await expect(page.locator('.fd-statusbar [aria-current="step"]')).toHaveText('Posted');
  });

  test('expense claim: the total adds up the expenses; Submit hands it to the approver', async ({ page }) => {
    await open(page, 'plain', query('expense-claim'));
    for (const amount of ['120', '80.5']) {
      await node(page, 'f-lines').getByRole('button', { name: /Add a line/ }).click();
      const line = lines(page, 'f-lines').last();
      await cell(line, 'Date').fill('2026-10-01');
      await cell(line, 'Kind').selectOption({ label: 'Meals' });
      await cell(line, 'Amount').pressSequentially(amount);
    }
    await expect(box(page, 'f-total')).toHaveValue('200.50');
    await expect(node(page, 'f-paid-by').locator('.fd-choice-clear')).toBeHidden();
  });

  test('time off: the days count themselves, half a day is 0.5, and sick leave asks for a certificate', async ({ page }) => {
    await open(page, 'plain', query('leave-request'));
    const dates = node(page, 'f-from').locator('input[type="date"]');
    await dates.first().fill('2026-10-12');
    await dates.last().fill('2026-10-14');
    await expect(box(page, 'f-days')).toHaveValue('3.0');
    await node(page, 'f-half').getByRole('switch').click();
    await expect(box(page, 'f-days')).toHaveValue('0.5');
    await box(page, 'f-type').selectOption({ label: 'Sick leave' });
    await expect(node(page, 'f-certificate')).toBeVisible();
  });

  test('product: the margin works itself out, and a service has no stock', async ({ page }) => {
    await open(page, 'plain', query('product'));
    await box(page, 'f-price').pressSequentially('250');
    await box(page, 'f-cost').pressSequentially('140');
    await expect(box(page, 'f-margin')).toHaveValue('110.00');
    await expect(page.getByRole('tab', { name: 'Inventory' })).toBeVisible();
    await node(page, 'f-kind').getByLabel('Service').check();
    await expect(page.getByRole('tab', { name: 'Inventory' })).toBeHidden();
  });

  test('customer: a person’s name is asked for as a person’s', async ({ page }) => {
    await open(page, 'plain', query('customer'));
    const name = page.locator('[data-node="#title"] input');
    await expect(name).toHaveAttribute('placeholder', 'e.g. Nile Traders');
    await node(page, 'f-kind').getByLabel('Person').check();
    await expect(name).toHaveAttribute('placeholder', 'e.g. Sara Hassan');
  });

  test('employee onboarding: a fixed term asks when it ends; Pay may be skipped', async ({ page }) => {
    await open(page, 'plain', query('employee-onboarding'));
    await box(page, 'f-name').fill('Omar Khaled');
    await box(page, 'f-email').fill('omar@example.com');
    await page.getByRole('button', { name: /The job/ }).click();
    await expect(node(page, 'f-contract-end')).toBeHidden();
    await node(page, 'f-contract').getByLabel('Fixed term').check();
    await expect(node(page, 'f-contract-end')).toBeVisible();
  });

  test('task: the checklist counts its own progress', async ({ page }) => {
    await open(page, 'plain', query('task'));
    await page.getByRole('tab', { name: 'Checklist' }).click();
    for (const item of ['Draft', 'Review', 'Send']) {
      await node(page, 'f-checklist').getByRole('button', { name: /Add a line/ }).click();
      await cell(lines(page, 'f-checklist').last(), 'Item').pressSequentially(item);
    }
    await cell(lines(page, 'f-checklist').first(), 'Done').check();
    await expect(node(page, 'f-progress')).toContainText('33%');
  });
});
