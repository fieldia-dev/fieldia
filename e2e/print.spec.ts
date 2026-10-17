import { type Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { expect, test } from './fixtures';
import { open, screen } from './support';

/**
 * On paper (the plain demo): an invoice printed — by Ctrl+P, by the gear's Print › This record, or as the app's own
 * PDF shown over it — and a list of invoices printed, every one the search finds, grouped and totalled. The browser's
 * own print is a dialog no test can press, so each test does what a browser does: it says printing begins (the
 * window's beforeprint), lays the page out for paper (`emulateMedia`), and — in Chromium — prints it to a PDF
 * (`page.pdf`, which says beforeprint and afterprint itself). The PDFs land in test-results/screens beside the
 * screens, each sheet a PNG where poppler's pdftoppm is at hand, for a person to look at.
 */

const NOW = 'now=2026-10-14T09:40';
const invoice = (record = 4102) => `page=real-invoice&record=${record}&skin=underline&${NOW}`;

/** As a browser begins printing: told, then laid out for paper. */
async function printing(page: Page) {
  await page.evaluate(() => window.dispatchEvent(new Event('beforeprint')));
  await page.emulateMedia({ media: 'print' });
}
/** As it ends. */
async function printed(page: Page) {
  await page.emulateMedia({ media: 'screen' });
  await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
}
/** The browser's print, its dialog open until the test says it closed: told before, not yet after. */
const dialogOpen = (page: Page) => page.evaluate(() => (window.print = () => void window.dispatchEvent(new Event('beforeprint'))));

/** The page printed to a PDF, kept for a person to look at; its sheets counted. */
async function pdf(page: Page, name: string): Promise<number> {
  const bytes = await page.pdf({ format: 'A4' });
  mkdirSync('test-results/screens', { recursive: true });
  const path = `test-results/screens/${name}.pdf`;
  writeFileSync(path, bytes);
  try {
    execFileSync('pdftoppm', ['-r', '70', '-png', path, `test-results/screens/${name}`]);
  } catch {
    // No poppler here: the PDF alone, to open.
  }
  return (bytes.toString('latin1').match(/\/Type\s*\/Page\b/g) ?? []).length;
}

test.describe('an invoice printed', () => {
  test('Ctrl+P lays it out for paper: every tab under its name, words for boxes, no bar, no buttons, the firm over it', async ({ page }) => {
    const { problems } = await open(page, 'plain', invoice());
    await expect(page.locator('.fd-tab[aria-selected="true"]')).toHaveText('Invoice Lines');
    await printing(page);
    // The firm's logo and words, the record's title and the day, over it.
    const head = page.locator('.fd-print-head');
    await expect(head).toBeVisible();
    await expect(head.locator('.fd-print-logo')).toBeVisible();
    await expect(head.locator('.fd-print-words')).toHaveText(/Zamalek Office Supplies S\.A\.E\.\s+26 July Street/);
    await expect(head.locator('.fd-print-title')).toHaveText('Account Entry · INV/2026/00038');
    await expect(head.locator('.fd-print-when')).toHaveText(/^Printed 14 Oct 2026, 09:40/);
    await expect(page.locator('.fd-print-foot')).toHaveText(/quoting INV\/2026\/00038\. Thank you/);
    // Every tab shown — the one picked and the rest — each under its name; none a condition hides.
    for (const tab of ['Invoice Lines', 'Journal Items', 'Other Info']) await expect(page.locator(`.fd-tabpanel[data-fd-tab="${tab}"]`).first()).toBeVisible();
    await expect(page.locator('.fd-tabpanel[data-off]').first()).toBeHidden();
    await expect(page.locator('.fd-tabbar')).toBeHidden();
    // No bar, no button, no hint; the statusbar the stage it is in.
    await expect(page.locator('.fd-record-bar')).toBeHidden();
    await expect(page.locator('.fd-header .fd-actions')).toBeHidden();
    await expect(page.locator('.fd-statusbar [aria-current="step"]')).toBeVisible();
    await expect(page.locator('.fd-statusbar li').filter({ hasNot: page.locator('[aria-current="step"]') }).first()).toBeHidden();
    // Boxes as their words: the customer by its name, wrapped, never cut at the box's edge.
    await expect(page.locator('[data-field="payment_reference"] .fd-print-box')).toHaveText('INV/2026/00038');
    await expect(page.locator('input[data-print-box]').first()).toBeHidden();
    // The lines whole, as a table as wide as the sheet: every line, every column.
    const lines = page.locator('[data-field="invoice_line_ids"] .fd-print-table');
    await expect(lines).toBeVisible();
    await expect(lines.locator('thead th')).toContainText(['Product', 'Label', 'Account']);
    await expect(lines.locator('tbody tr')).toHaveCount(2);
    await expect(page.locator('[data-field="invoice_line_ids"] .ag-root-wrapper')).toBeHidden();
    await screen(page, 'print-invoice-laid-out');
    await printed(page);
    // Back as it was: the words and the paper's table gone, the tab picked still the one picked.
    await expect(page.locator('.fd-print-box')).toHaveCount(0);
    await expect(page.locator('.fd-print-table')).toHaveCount(0);
    await expect(page.locator('.fd-tabpanel[data-fd-tab="Journal Items"]')).toBeHidden();
    expect(problems).toEqual([]);
  });

  test('prints to a PDF of its own sheets (Chromium)', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'only Chromium prints to a PDF here');
    const { problems } = await open(page, 'plain', invoice());
    await expect(page.locator('.fd-statusbar')).toBeVisible();
    // page.pdf() says beforeprint and afterprint itself, as a browser's Print does.
    expect(await pdf(page, 'print-invoice')).toBeGreaterThanOrEqual(2);
    await expect(page.locator('.fd-print-box')).toHaveCount(0);
    expect(problems).toEqual([]);
  });

  test('the gear’s Print › This record prints it alone, the app’s page round it left out, and is done once printed', async ({ page, browserName }) => {
    const { problems } = await open(page, 'plain', invoice());
    await dialogOpen(page);
    await page.getByRole('button', { name: 'Actions' }).click();
    const menu = page.getByRole('menu');
    await expect(menu.getByRole('group', { name: 'Print' }).getByRole('menuitem')).toHaveText(['Invoice', 'This record']);
    await menu.getByRole('menuitem', { name: 'This record' }).click();
    await expect(page.locator('html')).toHaveClass(/\bfd-print-one\b/);
    await expect(page.locator('form.fd-form').first()).toHaveClass(/\bfd-print-this\b/);
    await page.emulateMedia({ media: 'print' });
    // The demo's own frame is left out with the rest of the app's page.
    await expect(page.locator('#demo-head')).toBeHidden();
    await expect(page.locator('.fd-print-head')).toBeVisible();
    await screen(page, 'print-invoice-alone');
    if (browserName === 'chromium') expect(await pdf(page, 'print-invoice-alone')).toBeGreaterThanOrEqual(2);
    else await printed(page);
    await expect(page.locator('html')).not.toHaveClass(/\bfd-print-one\b/);
    await page.emulateMedia({ media: 'screen' });
    await expect(page.locator('#demo-head')).toBeVisible();
    expect(problems).toEqual([]);
  });

  test('the gear’s Print › Invoice shows the app’s own PDF over the record, to download', async ({ page }) => {
    const { problems } = await open(page, 'plain', invoice());
    await page.getByRole('button', { name: 'Actions' }).click();
    await page.getByRole('menuitem', { name: 'Invoice', exact: true }).click();
    const viewer = page.getByRole('dialog', { name: 'INV_2026_00038.pdf' });
    await expect(viewer).toBeVisible();
    await expect(viewer.locator('iframe')).toHaveAttribute('src', /^blob:/);
    await screen(page, 'print-app-pdf', { viewport: true });
    const [download] = await Promise.all([page.waitForEvent('download'), viewer.getByRole('link', { name: 'Download' }).click()]);
    expect(download.suggestedFilename()).toBe('INV_2026_00038.pdf');
    const path = 'test-results/screens/print-app-pdf.pdf';
    await download.saveAs(path);
    const bytes = readFileSync(path);
    expect(bytes.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    expect(bytes.toString('latin1')).toContain('(Invoice INV/2026/00038) Tj');
    // Closed with Escape, the focus back on the gear it was asked from.
    await page.keyboard.press('Escape');
    await expect(viewer).toBeHidden();
    await expect(page.getByRole('button', { name: 'Actions' })).toBeFocused();
    expect(problems).toEqual([]);
  });
});

test.describe('a list of invoices printed', () => {
  test('Print prints every invoice the search finds, grouped, with its sums, the totals and the search in words', async ({ page, browserName }) => {
    const { problems } = await open(page, 'plain', `page=invoices&skin=underline&${NOW}`);
    const rows = page.locator('.fd-list-table tbody tr.fd-list-row');
    await expect(rows).toHaveCount(10);
    await expect(page.locator('.fd-pager-text')).toHaveText('1–10 / 40');
    // Grouped by customer: the headings on screen, their rows folded.
    await page.getByRole('button', { name: 'Search options' }).click();
    await page.getByLabel('Group By').getByRole('button', { name: 'Customer', exact: true }).click();
    await page.keyboard.press('Escape');
    await expect(page.locator('.fd-group-toggle')).toHaveCount(7);
    await dialogOpen(page);
    const print = page.getByRole('button', { name: 'Print' });
    await print.click();
    const sheet = page.locator('.fd-print-sheet');
    await expect(sheet).toHaveCount(1);
    await expect(print).toHaveAttribute('aria-busy', 'true');
    await page.emulateMedia({ media: 'print' });
    await expect(sheet).toBeVisible();
    await expect(page.locator('.fd-list-table')).toBeHidden();
    await expect(sheet.locator('.fd-print-title')).toHaveText('Invoices');
    await expect(sheet.locator('.fd-print-about > div')).toHaveText(['Filters: This year', 'Grouped by Customer', '40 records']);
    // Every one of the forty under its customer — the screen showed ten, and no group open.
    await expect(sheet.locator('tbody tr:not(.fd-print-group)')).toHaveCount(40);
    await expect(sheet.locator('tbody tr.fd-print-group')).toHaveCount(7);
    await expect(sheet.locator('tbody tr.fd-print-group').first()).toContainText(/^Amira Clinics \(8\)\s*EGP\s1,608,000\.00$/);
    await expect(sheet.locator('tfoot tr')).toContainText(/Total\s*EGP\s8,909,650\.00/);
    await screen(page, 'print-invoices-list');
    if (browserName === 'chromium') expect(await pdf(page, 'print-invoices-list')).toBe(2);
    else await printed(page);
    // Printed: the printout gone, the list as it was.
    await page.emulateMedia({ media: 'screen' });
    await expect(sheet).toHaveCount(0);
    await expect(print).not.toHaveAttribute('aria-busy', 'true');
    await expect(page.locator('.fd-group-toggle')).toHaveCount(7);
    expect(problems).toEqual([]);
  });

  test('Ctrl+P on the list prints the rows as they stand, without its bar or its boxes', async ({ page }) => {
    const { problems } = await open(page, 'plain', `page=invoices&skin=underline&${NOW}`);
    await expect(page.locator('.fd-list-table tbody tr.fd-list-row')).toHaveCount(10);
    await printing(page);
    await expect(page.locator('.fd-list-table')).toBeVisible();
    await expect(page.locator('.fd-list-bar')).toBeHidden();
    await expect(page.locator('.fd-list-table .fd-list-checkbox').first()).toBeHidden();
    await printed(page);
    expect(problems).toEqual([]);
  });
});
