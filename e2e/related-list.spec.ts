import { type Locator, type Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { expectNoSidewaysScroll, open, screen } from './support';

/**
 * A related list inside a record, as a person uses it: a customer with its invoices and quotations, a property with
 * its viewings (shared/related-lists.ts, shared/invoices.ts), the demos' clock pinned to Wednesday 14 October 2026 so
 * the records are the same every run. What each list should hold is worked out here from the demo's own records,
 * never written down from the screen.
 */

const NOW = 'now=2026-10-14T09:40';
const CUSTOMER = `page=customer-account&record=1&skin=underline&${NOW}`;
const PROPERTY = `page=property&record=1&skin=underline&${NOW}`;

type Link = { id: number; label: string };
type Invoice = { name: string; partner_id: Link; invoice_date: string; due_date: string; state: string; amount: number };
type Quotation = { name: string; partner_id: Link; date: string; state: string };
type Viewing = { starts_at: string; home_id: Link; client: string; state: string };
const records = async <T>(page: Page, model: string) => Object.entries(await page.evaluate((m) => (window as any).fieldiaDemo.dataSource.records[m], model)).map(([id, values]) => ({ id: Number(id), ...(values as T) }));

const part = (page: Page, id: string) => page.locator(`[data-node="${id}"]`);
const rows = (list: Locator) => list.locator('.fd-list-row');
const count = (list: Locator) => list.locator('.fd-related-count');
const button = (list: Locator, name: string) => list.locator('.fd-related-tools button', { hasText: name });
const dialog = (page: Page) => page.getByRole('dialog');
const money = (n: number) => `EGP ${n.toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
/** The invoices' order in the list: the latest first, the higher number first on one day. */
const latestFirst = (a: Invoice, b: Invoice) => b.invoice_date.localeCompare(a.invoice_date) || b.name.localeCompare(a.name);

test.describe('a customer’s invoices, inside the customer', () => {
  test('lists this customer’s alone, the latest five, how many there are, and their total', async ({ page }) => {
    const { problems } = await open(page, 'plain', CUSTOMER);
    const mine = (await records<Invoice>(page, 'invoice')).filter((invoice) => invoice.partner_id.id === 1).sort(latestFirst);
    expect(mine.length, 'the demo’s customer has more than a page of invoices').toBeGreaterThan(5);
    const invoices = part(page, 'invoices');
    await expect(invoices.locator('.fd-related-title')).toContainText('Invoices');
    await expect(count(invoices)).toHaveText(String(mine.length));
    await expect(invoices).toHaveAccessibleName(`Invoices, ${mine.length}`);
    await expect(rows(invoices).locator('td:first-child')).toHaveText(mine.slice(0, 5).map((invoice) => invoice.name));
    await expect(invoices.locator('.fd-pager-text')).toHaveText(`1–5 / ${mine.length}`);
    // Every one of this customer's, not only the five shown, in the totals row under them.
    await expect(invoices.locator('.fd-list-totals tr[data-total="all"] td[data-field="amount"]')).toHaveText(money(mine.reduce((sum, invoice) => sum + invoice.amount, 0)));
    // Past a page, a search box — a box alone, no menu of filters.
    await expect(invoices.locator('.fd-search-input')).toBeVisible();
    await expect(invoices.getByRole('button', { name: 'Search options' })).toHaveCount(0);
    await expectNoSidewaysScroll(page);
    await screen(page, 'related-invoices');
    expect(problems).toEqual([]);
  });

  test('turns its pages, searches its records alone and puts them in order, its count staying theirs', async ({ page }) => {
    await open(page, 'plain', CUSTOMER);
    const mine = (await records<Invoice>(page, 'invoice')).filter((invoice) => invoice.partner_id.id === 1).sort(latestFirst);
    const invoices = part(page, 'invoices');
    await invoices.getByRole('button', { name: 'Next page' }).click();
    await expect(rows(invoices).locator('td:first-child')).toHaveText(mine.slice(5, 10).map((invoice) => invoice.name));
    const box = invoices.locator('.fd-search-input');
    await box.fill('paid');
    await page.getByRole('option', { name: 'Status: Paid' }).click();
    const paid = mine.filter((invoice) => invoice.state === 'paid');
    await expect(rows(invoices)).toHaveCount(Math.min(5, paid.length));
    await expect(rows(invoices).locator('td:nth-child(4)')).toHaveText(Array(Math.min(5, paid.length)).fill('Paid'));
    await expect(count(invoices)).toHaveText(String(mine.length));
    await invoices.locator('.fd-facet-remove').click();
    // Amount's header: the smallest first.
    await invoices.locator('th[data-field="amount"] button').click();
    const smallest = [...mine].sort((a, b) => a.amount - b.amount)[0];
    await expect(rows(invoices).first().locator('td').first()).toHaveText(smallest.name);
  });

  test('New makes an invoice for this customer in a dialog, then lists it and counts it', async ({ page }) => {
    const { demo } = await open(page, 'plain', CUSTOMER);
    const invoices = part(page, 'invoices');
    const before = (await records<Invoice>(page, 'invoice')).filter((invoice) => invoice.partner_id.id === 1).length;
    await expect(count(invoices)).toHaveText(String(before));
    await button(invoices, 'New').click();
    await expect(dialog(page)).toBeVisible();
    await expect(dialog(page).locator('.fd-form-dialog-title')).toHaveText('New in Invoices');
    // The customer filled in, by its name.
    await expect(dialog(page).locator('[data-node="f-partner"] input')).toHaveValue('Nile Traders');
    await dialog(page).locator('[data-node="#title"] textarea').fill('INV/2026/9999');
    await dialog(page).locator('[data-node="f-amount"] input').fill('12500');
    await screen(page, 'related-new-invoice', { viewport: true });
    await dialog(page).getByRole('button', { name: 'Save & Close' }).click();
    await expect(dialog(page)).toBeHidden();
    await expect(count(invoices)).toHaveText(String(before + 1));
    // Dated today, it is the latest: first.
    await expect(rows(invoices).first().locator('td').first()).toHaveText('INV/2026/9999');
    const made = Object.values(await demo<Record<string, Invoice>>('dataSource.records.invoice')).find((invoice) => invoice.name === 'INV/2026/9999');
    expect(made?.partner_id).toEqual({ id: 1, label: 'Nile Traders' });
  });

  test('a row opens its invoice in a dialog; changed and saved, the list shows it', async ({ page }) => {
    await open(page, 'plain', CUSTOMER);
    const invoices = part(page, 'invoices');
    const mine = (await records<Invoice>(page, 'invoice')).filter((invoice) => invoice.partner_id.id === 1).sort(latestFirst);
    const first = rows(invoices).first();
    const name = mine[0].name;
    await expect(first.locator('td').first()).toHaveText(name);
    await first.click();
    await expect(dialog(page).locator('.fd-form-dialog-title')).toHaveText(name);
    await dialog(page).locator('[data-node="f-amount"] input').fill('777');
    await dialog(page).getByRole('button', { name: 'Save & Close' }).click();
    await expect(dialog(page)).toBeHidden();
    await expect(rows(invoices).first().locator('td[data-col="amount"]')).toHaveText('EGP 777.00');
    // The focus back on its row.
    await expect(rows(invoices).first()).toBeFocused();
  });

  test('View all goes to the invoices list by the app’s own route, kept to this customer’s, all of them', async ({ page }) => {
    const { problems } = await open(page, 'plain', CUSTOMER);
    const mine = (await records<Invoice>(page, 'invoice')).filter((invoice) => invoice.partner_id.id === 1);
    await expect(button(part(page, 'invoices'), 'View all')).toHaveAccessibleName('View all Invoices');
    await button(part(page, 'invoices'), 'View all').click();
    await expect(page).toHaveURL(/page=invoices&filter=/);
    await expect(page.locator('.fd-list-row').first()).toBeVisible();
    // No "This year": the list's own default filter is off for one customer's.
    await expect(page.locator('.fd-facet')).toHaveCount(0);
    await expect(page.locator('.fd-pager-text')).toHaveText(`1–${Math.min(10, mine.length)} / ${mine.length}`);
    await expect(page.locator('.fd-list-row td[data-field="partner_id"], .fd-list-row td:nth-child(3)').first()).toContainText('Nile Traders');
    // Its rows open an invoice.
    await page.locator('.fd-list-row').first().click();
    await expect(page).toHaveURL(/[?&]page=invoice&(.+&)?record=\d+$/);
    expect(page.url()).not.toContain('filter=');
    await expect(page.locator('[data-node="f-partner"] input')).toHaveValue('Nile Traders');
    expect(problems).toEqual([]);
  });

  test('its quotations in a tab, the lost left out, made with New; the next customer’s lists are that customer’s', async ({ page }) => {
    await open(page, 'plain', CUSTOMER);
    const quotations = part(page, 'quotations');
    await page.getByRole('tab', { name: 'Quotations' }).click();
    const mine = (await records<Quotation>(page, 'quotation')).filter((q) => q.partner_id.id === 1 && q.state !== 'lost').sort((a, b) => b.date.localeCompare(a.date));
    await expect(rows(quotations).locator('td:first-child')).toHaveText(mine.slice(0, 5).map((q) => q.name));
    await expect(quotations.locator('.fd-pager-text')).toHaveText(mine.length > 5 ? `1–5 / ${mine.length}` : /.*/);
    await screen(page, 'related-quotations');
    // The pager over the record: Amira Clinics, its own invoices and quotations, never Nile Traders'.
    await page.getByRole('button', { name: 'Next record' }).click();
    await expect(page.locator('[data-node="#title"] textarea')).toHaveValue('Amira Clinics');
    const theirs = (await records<Invoice>(page, 'invoice')).filter((invoice) => invoice.partner_id.id === 20).sort(latestFirst);
    await expect(count(part(page, 'invoices'))).toHaveText(String(theirs.length));
    await expect(rows(part(page, 'invoices')).locator('td:first-child')).toHaveText(theirs.slice(0, 5).map((invoice) => invoice.name));
    await page.getByRole('tab', { name: 'Quotations' }).click();
    const quoted = (await records<Quotation>(page, 'quotation')).filter((q) => q.partner_id.id === 20 && q.state !== 'lost');
    await expect(rows(quotations)).toHaveCount(Math.min(5, quoted.length));
  });

  test('on a phone, its invoices are cards, as a list’s: the number, its status a pill in its tone, its amount — a card opens its invoice', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const { problems } = await open(page, 'plain', CUSTOMER);
    const mine = (await records<Invoice>(page, 'invoice')).filter((invoice) => invoice.partner_id.id === 1).sort(latestFirst);
    const invoices = part(page, 'invoices');
    await expect(invoices.locator('.fd-list')).toHaveAttribute('data-as', 'cards');
    await expect(invoices.locator('.fd-list-card-title')).toHaveText(mine.slice(0, 5).map((invoice) => invoice.name));
    const first = rows(invoices).first();
    const states: Record<string, [string, string]> = { draft: ['Draft', 'muted'], sent: ['Sent', 'info'], paid: ['Paid', 'success'] };
    const pill = first.locator('.fd-list-card-head .fd-value-badge');
    await expect(pill).toHaveText(states[mine[0].state][0]);
    await expect(pill).toHaveAttribute('data-tone', states[mine[0].state][1]);
    // Its amount leads its lines, as on the invoices list's cards.
    await expect(first.locator('.fd-list-card-lines > div[data-field="amount"] dd')).toHaveText(money(mine[0].amount));
    await expect(first.locator('.fd-list-card-lines')).toHaveAttribute('data-lead', '');
    // The table's columns are not drawn; each card is, in full, inside the screen.
    await expect(first.locator('td[data-col="invoice_date"]')).toBeHidden();
    const box = (await first.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(390);
    await expectNoSidewaysScroll(page);
    await first.scrollIntoViewIfNeeded();
    await screen(page, 'related-invoices-phone-cards', { viewport: true });
    // A card is its row: pressed, its invoice opens in a dialog.
    await first.click();
    await expect(dialog(page).locator('.fd-form-dialog-title')).toHaveText(mine[0].name);
    expect(problems).toEqual([]);
  });

  test('on paper, its invoices as shown — five, and “5 of” how many — without its pager, search or buttons', async ({ page }) => {
    const { problems } = await open(page, 'plain', CUSTOMER);
    const mine = (await records<Invoice>(page, 'invoice')).filter((invoice) => invoice.partner_id.id === 1).sort(latestFirst);
    const invoices = part(page, 'invoices');
    await expect(rows(invoices)).toHaveCount(5);
    const shown = invoices.locator('.fd-list-shown');
    await expect(shown).toBeHidden();
    await page.evaluate(() => window.dispatchEvent(new Event('beforeprint')));
    await page.emulateMedia({ media: 'print' });
    await expect(rows(invoices).locator('td:first-child')).toHaveText(mine.slice(0, 5).map((invoice) => invoice.name));
    await expect(shown).toBeVisible();
    await expect(shown).toHaveText(`5 of ${mine.length}`);
    await expect(invoices.locator('.fd-pager')).toBeHidden();
    await expect(invoices.locator('.fd-search-input')).toBeHidden();
    await expect(button(invoices, 'New')).toBeHidden();
    await screen(page, 'related-invoices-print');
    await page.emulateMedia({ media: 'screen' });
    await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
    await expect(shown).toBeHidden();
    expect(problems).toEqual([]);
  });

  test('its rows as a list’s: an overdue invoice in red, a draft in bold, Send a reminder on one sent — given that invoice alone', async ({ page }) => {
    const { problems, demo } = await open(page, 'plain', CUSTOMER);
    const mine = (await records<Invoice>(page, 'invoice')).filter((invoice) => invoice.partner_id.id === 1).sort(latestFirst).slice(0, 5);
    // Today as the form counts it: the overdue are those sent and due before it.
    const today = await page.evaluate(() => (window as any).fieldiaDemo.handle.form.today() as string);
    const invoices = part(page, 'invoices');
    await expect(rows(invoices)).toHaveCount(5);
    const overdue = (invoice: Invoice) => invoice.state === 'sent' && invoice.due_date < today;
    for (const [i, invoice] of mine.entries()) {
      const row = rows(invoices).nth(i);
      if (overdue(invoice)) await expect(row).toHaveAttribute('data-tone', 'danger');
      else await expect(row).not.toHaveAttribute('data-tone', /.+/);
      if (invoice.state === 'draft') await expect(row).toHaveAttribute('data-bold', '');
      else await expect(row).not.toHaveAttribute('data-bold', /.*/);
      await expect(row.getByRole('button', { name: 'Send a reminder' })).toHaveCount(invoice.state === 'sent' ? 1 : 0);
    }
    expect(mine.some(overdue) || mine.some((invoice) => invoice.state === 'draft'), 'the demo’s first five show a tone or a bold').toBe(true);
    const sent = mine.findIndex((invoice) => invoice.state === 'sent');
    expect(sent, 'one of the first five is sent').toBeGreaterThanOrEqual(0);
    await rows(invoices).nth(sent).getByRole('button', { name: 'Send a reminder' }).click();
    await expect.poll(() => demo<{ action: string; recordId?: unknown; recordIds?: unknown[] }[]>('requests').then((requests) => requests.at(-1))).toEqual(expect.objectContaining({ action: 'send_reminder', recordId: 1, recordIds: [mine[sent].id] }));
    // Its press is the button's, never its row's: no invoice opened.
    await expect(dialog(page)).toHaveCount(0);
    await screen(page, 'related-invoices-rows');
    expect(problems).toEqual([]);
  });

  test('a new customer: nothing points at it until it is saved, then none yet and New', async ({ page }) => {
    const { problems } = await open(page, 'plain', `page=customer-account&record=new&skin=underline&${NOW}`);
    const invoices = part(page, 'invoices');
    await expect(invoices.locator('.fd-related-note')).toHaveText('Nothing here until this record is saved.');
    await expect(button(invoices, 'New')).toBeHidden();
    await expect(button(invoices, 'View all')).toBeHidden();
    await expect(invoices.locator('.fd-list')).toHaveCount(0);
    await screen(page, 'related-unsaved');
    await page.locator('[data-node="#title"] textarea').fill('Nile Delta Shipping');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(invoices.locator('.fd-list-empty')).toHaveText('None yet.');
    await expect(count(invoices)).toHaveText('0');
    await expect(button(invoices, 'New')).toBeVisible();
    await expect(invoices.locator('.fd-related-note')).toBeHidden();
    expect(problems).toEqual([]);
  });
});

test.describe('a property’s viewings, inside the property', () => {
  test('lists its viewings, the latest first, phones as people read them, and View all of them in a dialog', async ({ page }) => {
    const { problems } = await open(page, 'plain', PROPERTY);
    const mine = (await records<Viewing>(page, 'viewing')).filter((viewing) => viewing.home_id.id === 1).sort((a, b) => b.starts_at.localeCompare(a.starts_at));
    const viewings = part(page, 'viewings');
    await expect(count(viewings)).toHaveText(String(mine.length));
    await expect(rows(viewings).locator('td:nth-child(2)')).toHaveText(mine.slice(0, 5).map((viewing) => viewing.client));
    // A phone as people read it: "+20 10 …".
    await expect(rows(viewings).first().locator('td:nth-child(3)')).toHaveText(/^\+20 10 \d{4} \d{4}$/);
    await screen(page, 'related-viewings');
    await button(viewings, 'View all').click();
    await expect(dialog(page)).toBeVisible();
    await expect(dialog(page).locator('.fd-list-row')).toHaveCount(mine.length);
    await expect(dialog(page).locator('.fd-pager-text')).toHaveText(`1–${mine.length} / ${mine.length}`);
    // A list has nothing to save: Close alone at the dialog's foot.
    await expect(dialog(page).locator('.fd-form-dialog-foot button:visible')).toHaveText(['Close']);
    await screen(page, 'related-view-all-dialog', { viewport: true });
    await page.keyboard.press('Escape');
    await expect(dialog(page)).toBeHidden();
    expect(problems).toEqual([]);
  });

  test('New books a viewing of this home; the third home has had none, and says so', async ({ page }) => {
    await open(page, 'plain', PROPERTY);
    const viewings = part(page, 'viewings');
    const before = (await records<Viewing>(page, 'viewing')).filter((viewing) => viewing.home_id.id === 1).length;
    await expect(count(viewings)).toHaveText(String(before));
    await button(viewings, 'New').click();
    await expect(dialog(page).locator('[data-node="f-home"] input')).toHaveValue(/bedroom/);
    await dialog(page).locator('[data-node="#title"] textarea').fill('Mona Kamal');
    // After every viewing booked so far (up to ten days on): first in the list.
    await dialog(page).locator('[data-node="f-when"] input').first().fill('30/10/2026 11:00');
    await dialog(page).locator('[data-node="f-when"] input').first().press('Tab');
    await dialog(page).getByRole('button', { name: 'Save & Close' }).click();
    await expect(dialog(page)).toBeHidden();
    await expect(count(viewings)).toHaveText(String(before + 1));
    await expect(rows(viewings).locator('td:nth-child(2)').first()).toHaveText('Mona Kamal');
    // Two homes on: none yet.
    await page.getByRole('button', { name: 'Next record' }).click();
    await page.getByRole('button', { name: 'Next record' }).click();
    await expect(viewings.locator('.fd-list-empty')).toHaveText('None yet.');
    await expect(count(viewings)).toHaveText('0');
  });

  test('on a phone, the page keeps to its width; the list scrolls in its card', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await open(page, 'plain', PROPERTY);
    await expect(rows(part(page, 'viewings')).first()).toBeVisible();
    await expectNoSidewaysScroll(page);
    await screen(page, 'related-viewings-phone');
  });
});
