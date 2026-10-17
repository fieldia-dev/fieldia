import { type Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { expect, test } from './fixtures';
import { squash } from './pdf-text';
import { chromiumSheets, expectSheetsClean, firefoxSheets, headingsOf } from './print-support';
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

test.describe('what is in front', () => {
  test('with the invoice open in a dialog, Ctrl+P prints the dialog’s record alone: not the page behind it, nor its frame', async ({ page, browserName }) => {
    // Two forms on the page — the record, and the record again in the dialog over it — so not `open`'s one form.
    const problems: string[] = [];
    page.on('pageerror', (error) => problems.push(`page error: ${error.message}`));
    page.on('console', (message) => message.type() === 'error' && problems.push(`console: ${message.text()}`));
    await page.goto(`/plain/?${invoice()}&open=dialog`);
    const dialog = page.locator('.fd-form-dialog');
    await expect(dialog.locator('.fd-sheet-page')).toBeVisible();
    const front = dialog.locator('form.fd-form');
    const behind = page.locator('#app > form.fd-form');
    await printing(page);
    await expect(page.locator('html')).toHaveClass(/\bfd-print-one\b/);
    await expect(front).toHaveClass(/\bfd-print-this\b/);
    await expect(behind).toBeHidden();
    await expect(dialog.locator('.fd-form-dialog-title')).toBeHidden();
    await expect(front.locator('.fd-print-head .fd-print-title')).toHaveText('Account Entry · INV/2026/00038');
    await expect(front.locator('.fd-tabpanel[data-fd-tab="Journal Items"]')).toBeVisible();
    // As wide as the sheet, not the dialog's frame.
    expect((await front.boundingBox())?.width).toBeGreaterThan(600);
    await screen(page, 'print-front-dialog');
    if (browserName === 'chromium') expect(await pdf(page, 'print-front-dialog')).toBeGreaterThanOrEqual(2);
    else await printed(page);
    await page.emulateMedia({ media: 'screen' });
    await expect(page.locator('html')).not.toHaveClass(/\bfd-print-one\b/);
    await expect(behind).toBeVisible();
    expect(problems).toEqual([]);
  });
});

test.describe('a record’s footer under every sheet, each heading with what follows it', () => {
  // Sheets as each engine prints them, read (print-support.ts): Chromium's page.pdf, Firefox's own print to a file.
  test.skip(({ browserName }) => browserName === 'webkit', 'WebKit prints no PDF here: its layout for paper is checked below');
  test.setTimeout(180_000);

  const PAY = 'Pay by bank transfer to CIB, IBAN EG38 0010 0123 0000 0001 2345 6789, quoting INV/2026/00038. Thank you for your business.';
  const FILE = 'Confidential: a file for its own people alone, kept by Zamalek Office Supplies S.A.E., 26 July Street, Cairo. Shred it after use.';
  const footed = (query: string) => `${query}&print=${encodeURIComponent(JSON.stringify({ footer: FILE }))}`;
  /** A block of `height` over the record: all of it pushed down the sheet, so its headings come to a sheet's foot. */
  const pad = (height: number) => (page: Page) =>
    page.evaluate((height) => {
      const box = document.getElementById('print-pad') ?? Object.assign(document.createElement('div'), { id: 'print-pad' });
      box.style.cssText = `height:${height}px;border:1px dashed #999;box-sizing:border-box`;
      box.textContent = `${height}px over the record`;
      // In the record's card, or over a page's groups or steps.
      (document.querySelector('.fd-card') ?? document.querySelector('.fd-content > .fd-sections, .fd-content > div:not([hidden], .fd-print-end)'))?.prepend(box);
    }, height);

  /** Each print — the page, the block over it, its name — printed by this engine, its sheets read; its headings. */
  async function sheetsOf(page: Page, browserName: string, playwright: Parameters<typeof firefoxSheets>[0], baseURL: string, prints: { query: string; name: string; pad?: number }[]) {
    const { problems } = await open(page, 'plain', prints[0].query);
    const headings = await headingsOf(page);
    if (browserName === 'firefox') {
      const all = await firefoxSheets(playwright, baseURL, prints.map(({ query, name, pad: height }) => ({ query, name: `firefox-${name}`, ...(height ? { before: pad(height) } : {}) })));
      return { headings, all, problems };
    }
    const all: Awaited<ReturnType<typeof chromiumSheets>>[] = [];
    for (const one of prints) {
      if (one.query !== prints[0].query) await page.goto(`/plain/?${one.query}`);
      if (one.pad) await pad(one.pad)(page);
      all.push(await chromiumSheets(page, one.name));
    }
    return { headings, all, problems };
  }

  test('the invoice: its footer under each of its sheets, nothing under it, each tab with its first groups', async ({ page, browserName, playwright, baseURL }) => {
    const { headings, all, problems } = await sheetsOf(page, browserName, playwright, baseURL!, [{ query: invoice(), name: 'print-footer-invoice' }]);
    expect(headings).toEqual(expect.arrayContaining(['Invoice Lines', 'Journal Items', 'Currency Details', 'Other Info', 'Transaction Currency', 'Invoice']));
    expect(all[0].length).toBeGreaterThanOrEqual(3);
    expectSheetsClean(all[0], PAY, headings);
    // The footer under each sheet, the head once, over the first.
    const head = (line: { text: string }) => squash(line.text).includes(squash('Zamalek Office Supplies S.A.E.'));
    expect(all[0].map((sheet) => sheet.lines.some(head))).toEqual(all[0].map((_, at) => at === 0));
    expect(problems).toEqual([]);
  });

  test('pushed down a sheet a little at a time, the invoice leaves no heading alone at a sheet’s foot', async ({ page, browserName, playwright, baseURL }) => {
    const pads = [80, 160, 240, 320, 400, 480, 560];
    const { headings, all, problems } = await sheetsOf(page, browserName, playwright, baseURL!, pads.map((height) => ({ query: invoice(), name: `print-footer-invoice-${height}`, pad: height })));
    all.forEach((sheets, at) => {
      expect(sheets.length, `${pads[at]}px over it`).toBeGreaterThanOrEqual(3);
      expectSheetsClean(sheets, PAY, headings);
    });
    expect(problems).toEqual([]);
  });

  test('a long invoice: its lines over several sheets, their header over them on each, its footer under each', async ({ page, browserName, playwright, baseURL }) => {
    const { headings, all, problems } = await sheetsOf(page, browserName, playwright, baseURL!, [{ query: `${invoice()}&lines=40`, name: 'print-footer-long-invoice' }]);
    const sheets = all[0];
    expect(sheets.length).toBeGreaterThanOrEqual(5);
    expectSheetsClean(sheets, PAY, headings);
    // Every line, each once; on every sheet with lines, the table's header over the first of them.
    const lines = sheets.flatMap((sheet) => sheet.lines.flatMap((line) => [...line.text.matchAll(/\((\d+)\)/g)].map((one) => one[1])));
    expect(new Set(lines).size).toBe(40);
    for (const [at, sheet] of sheets.entries()) {
      const first = sheet.lines.findIndex((line) => /\(\d+\)/.test(line.text));
      if (first < 0) continue;
      expect(sheet.lines.slice(0, first).some((line) => /Product.*Label.*Account.*Quantity/.test(line.text)), `sheet ${at + 1}: the header over its lines`).toBe(true);
    }
    expect(problems).toEqual([]);
  });

  test('an employee, a work item, a survey’s steps and a customer in Arabic: clean on every sheet, pushed down or not', async ({ page, browserName, playwright, baseURL }) => {
    const records = [
      { query: footed(`page=real-employee&record=4122&skin=underline&${NOW}`), name: 'employee' },
      { query: footed(`page=real-employee&record=4122&skin=underline&${NOW}`), name: 'employee-pushed', pad: 300 },
      { query: footed(`page=work-item&skin=quiet&${NOW}`), name: 'work-item', pad: 520 },
      { query: footed(`page=survey&skin=outlined&${NOW}`), name: 'survey', pad: 640 },
      { query: footed(`page=customer&skin=underline&locale=ar&dir=rtl&${NOW}`), name: 'customer-arabic', pad: 760 },
    ];
    for (const record of records) {
      const { headings, all, problems } = await sheetsOf(page, browserName, playwright, baseURL!, [{ ...record, name: `print-footer-${record.name}` }]);
      expect(all[0].length, record.name).toBeGreaterThanOrEqual(2);
      expectSheetsClean(all[0], FILE, headings);
      expect(problems).toEqual([]);
    }
  });
});

test.describe('a record’s footer on paper, in every engine', () => {
  test('its content a table whose footer group the footer is — Safari’s once after it — the record’s groups side by side in lines', async ({ page, browserName }) => {
    const { problems } = await open(page, 'plain', invoice());
    await printing(page);
    // Safari breaks no table's cell between sheets: there the footer follows the record, once.
    const webkit = browserName === 'webkit';
    await expect(page.locator('form.fd-form > .fd-content')).toHaveCSS('display', webkit ? 'block' : 'table');
    const end = page.locator('form.fd-form > .fd-content > .fd-print-end');
    await expect(end).toHaveCSS('display', webkit ? 'block' : 'table-footer-group');
    await expect(end.locator('.fd-print-foot')).toHaveText(/quoting INV\/2026\/00038\. Thank you/);
    await expect(end.locator('.fd-print-foot')).toBeVisible();
    // The customer's group and the dates' side by side, each a box in the line.
    const sides = page.locator('.fd-sheet-page .fd-grid[data-columns="2"] > .fd-section');
    await expect(sides.first()).toHaveCSS('display', 'inline-block');
    const [left, right] = [await sides.nth(0).boundingBox(), await sides.nth(1).boundingBox()];
    expect(Math.abs((left?.y ?? 0) - (right?.y ?? 1))).toBeLessThan(2);
    await printed(page);
    await expect(page.locator('form.fd-form > .fd-content')).toHaveCSS('display', 'block');
    expect(problems).toEqual([]);
  });
});

test.describe('a list of invoices printed', () => {
  test('Print prints every invoice the search finds, grouped, with its sums, the totals and the search in words', async ({ page, browserName }) => {
    const { problems } = await open(page, 'plain', `page=invoices&skin=underline&${NOW}`);
    const rows = page.locator('.fd-list-table tbody tr.fd-list-row');
    await expect(rows).toHaveCount(10);
    await expect(page.locator('.fd-pager-text')).toHaveText('1–10 of 40 invoices');
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
    await expect(sheet.locator('.fd-print-about > div')).toHaveText(['Filters: This year', 'Grouped by Customer', '40 invoices']);
    // Every one of the forty under its customer — the screen showed ten, and no group open.
    await expect(sheet.locator('tbody tr:not(.fd-print-group)')).toHaveCount(40);
    await expect(sheet.locator('tbody tr.fd-print-group')).toHaveCount(7);
    await expect(sheet.locator('tbody tr.fd-print-group').first()).toContainText(/^Amira Clinics \(8\)\s*EGP\s1,608,000\.00$/);
    await expect(sheet.locator('tfoot tr')).toContainText(/Total\s*EGP\s8,909,650\.00/);
    // Its footer at the foot of every sheet where the engine keeps room for it there (Chromium's, Firefox's), its room kept.
    await expect(sheet).toHaveAttribute('data-print-room', '');
    if (browserName !== 'webkit') await expect(sheet.locator('.fd-print-foot')).toHaveCSS('position', 'fixed');
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

test.describe('what is printed follows what is shown', () => {
  const heads = (page: Page) => page.locator('.fd-list-table thead th[data-col]:visible');

  test('Print on the contacts prints the columns the person shows, in their order, as Export writes them', async ({ page }) => {
    const { problems } = await open(page, 'plain', `page=contacts&skin=underline&${NOW}`);
    await expect(page.locator('.fd-list-table tbody tr.fd-list-row')).toHaveCount(10);
    // Phone shown and moved up beside Name, Country hidden: as a person shapes them from the Columns menu.
    await page.getByRole('button', { name: 'Columns' }).click();
    const menu = page.getByRole('dialog', { name: 'Columns' });
    await menu.getByLabel('Phone', { exact: true }).check();
    await menu.getByLabel('Phone', { exact: true }).focus();
    for (let i = 0; i < 7; i++) await page.keyboard.press('Alt+ArrowUp');
    await menu.getByLabel('Country', { exact: true }).uncheck();
    await page.keyboard.press('Escape');
    const shown = ['Name', 'Phone', 'Company', 'Status', 'Owner', 'Last order', 'Lifetime value', 'Newsletter'];
    await expect(heads(page)).toHaveText(shown);
    await dialogOpen(page);
    const print = page.getByRole('button', { name: 'Print' });
    await print.click();
    const sheet = page.locator('.fd-print-sheet');
    await expect(sheet).toHaveCount(1);
    await page.emulateMedia({ media: 'print' });
    await expect(sheet.locator('thead th')).toHaveText(shown);
    await expect(sheet.locator('.fd-print-about > div').last()).toHaveText('1,284 contacts');
    // Each row's phone as people read it, where the list shows it.
    await expect(sheet.locator('tbody td:nth-child(2)').filter({ hasText: /\S/ }).first()).toHaveText(/^\+\d/);
    await printed(page);
    await expect(sheet).toHaveCount(0);
    await expect(print).not.toHaveAttribute('aria-busy', 'true');
    expect(problems).toEqual([]);
  });

  test.describe('on a phone', () => {
    test.use({ viewport: { width: 390, height: 844 } });

    test('a list shown as cards prints as a table, by Ctrl+P and by its Print', async ({ page }) => {
      const { problems } = await open(page, 'plain', `page=invoices&skin=underline&${NOW}`);
      const list = page.locator('.fd-list');
      await expect(list).toHaveAttribute('data-as', 'cards');
      const row = page.locator('.fd-list-table tbody tr.fd-list-row').first();
      await expect(row.locator('.fd-list-card')).toBeVisible();
      // Ctrl+P: its rows as rows, its columns' cells, no card.
      await printing(page);
      await expect(row).toHaveCSS('display', 'table-row');
      await expect(row.locator('.fd-list-card')).toBeHidden();
      await expect(row.locator('td[data-col="name"]')).toBeVisible();
      await expect(row.locator('td[data-col="amount"]')).toBeVisible();
      await expect(page.locator('.fd-list-table thead th[data-col="amount"]')).toBeVisible();
      await screen(page, 'print-invoices-from-cards', { viewport: true });
      await printed(page);
      await expect(row).not.toHaveCSS('display', 'table-row');
      // Its Print: the printout's table, the list's columns.
      await dialogOpen(page);
      await page.getByRole('button', { name: 'Print' }).click();
      const sheet = page.locator('.fd-print-sheet');
      await expect(sheet).toHaveCount(1);
      await page.emulateMedia({ media: 'print' });
      await expect(sheet.locator('table.fd-print-table')).toHaveCSS('display', 'table');
      await expect(sheet.locator('thead th')).toHaveText(['Number', 'Customer', 'City', 'Invoice date', 'Due date', 'Status', 'Amount']);
      await printed(page);
      await expect(sheet).toHaveCount(0);
      expect(problems).toEqual([]);
    });
  });
});

