import { type Locator, type Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { expect, test } from './fixtures';
import { pdfSheets, squash } from './pdf-text';
import { chromiumSheets, expectSheetsClean, firefoxSheets, headingsOf, pressPrint } from './print-support';
import { open, screen } from './support';

/**
 * On paper (the plain demo): an invoice printed — by Ctrl+P, by the gear's Print › This record, or as the app's own
 * PDF shown over it — and a list of invoices printed, every one the search finds, grouped and totalled. Ctrl+P is
 * pressed as a person presses it: Fieldia's, which loads the print part the first time (0.26) and asks the browser
 * to print. The browser's own print is a dialog no test can press, so each test does what a browser does once asked:
 * it says printing begins (the window's beforeprint), lays the page out for paper (`emulateMedia`), and — in
 * Chromium — prints it to a PDF (`page.pdf`, which says beforeprint and afterprint itself). The PDFs land in
 * test-results/screens beside the screens, each sheet a PNG where poppler's pdftoppm is at hand, for a person to look
 * at. The print part on intent — asked for only as a person shows they mean to print — is checked at the end.
 */

const NOW = 'now=2026-10-14T09:40';
const invoice = (record = 4102) => `page=real-invoice&record=${record}&skin=underline&${NOW}`;

/** Ctrl+P, as a person presses it: the browser asked to print, which tells the page so, then lays it out for paper. */
async function printing(page: Page) {
  await pressPrint(page);
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
    await expect(head.locator('.fd-print-words .fd-print-line')).toHaveText(['Zamalek Office Supplies S.A.E.', '26 July Street, Zamalek, Cairo · VAT EG 100-200-300']);
    // The record's own name: never the model's title ("Account Entry") over an invoice.
    await expect(head.locator('.fd-print-title')).toHaveText('INV/2026/00038');
    await expect(head.locator('.fd-print-when')).toHaveText(/^Printed 14 Oct 2026, 09:40/);
    await expect(page.locator('.fd-print-foot')).toHaveText(/quoting INV\/2026\/00038\. Thank you/);
    // Every tab shown — the one picked and the rest — each under its name; none a condition hides, nor one its page
    // leaves off paper (Journal Items, `"print": false`).
    for (const tab of ['Invoice Lines', 'Other Info']) await expect(page.locator(`.fd-tabpanel[data-fd-tab="${tab}"]`).first()).toBeVisible();
    await expect(page.locator('.fd-tabpanel[data-fd-tab="Journal Items"]')).toBeHidden();
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

  test('Ctrl+P prints to a PDF of its own sheets (Chromium)', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'only Chromium prints to a PDF here');
    const { problems } = await open(page, 'plain', invoice());
    await expect(page.locator('.fd-statusbar')).toBeVisible();
    // page.pdf() says beforeprint and afterprint itself, as a browser's Print does: the dialog Ctrl+P opened, printed.
    await pressPrint(page);
    expect(await pdf(page, 'print-invoice')).toBeGreaterThanOrEqual(2);
    await expect(page.locator('.fd-print-box')).toHaveCount(0);
    expect(problems).toEqual([]);
  });

  test('the gear’s Print › This invoice prints it alone, the app’s page round it left out, and is done once printed', async ({ page, browserName }) => {
    const { problems } = await open(page, 'plain', invoice());
    await dialogOpen(page);
    await page.getByRole('button', { name: 'Actions' }).click();
    const menu = page.getByRole('menu');
    // The demo names its records (`records`): "This invoice", where a page that names none says "This record".
    await expect(menu.getByRole('group', { name: 'Print' }).getByRole('menuitem')).toHaveText(['Invoice', 'This invoice']);
    await menu.getByRole('menuitem', { name: 'This invoice' }).click();
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
    await expect(front.locator('.fd-print-head .fd-print-title')).toHaveText('INV/2026/00038');
    await expect(front.locator('.fd-tabpanel[data-fd-tab="Other Info"]').first()).toBeVisible();
    await expect(front.locator('.fd-tabpanel[data-fd-tab="Journal Items"]')).toBeHidden();
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

test.describe('the owner’s walk of 0.25, on paper', () => {
  test('a draft invoice: its title the record’s word and stage, no required star, no line of an empty value, nothing its page leaves off', async ({ page }) => {
    const { problems } = await open(page, 'plain', invoice(4101));
    // On the screen, as ever: Journal Items a tab, To Check a box, the required star by Journal.
    await expect(page.getByRole('tab', { name: 'Journal Items' })).toBeVisible();
    await printing(page);
    const head = page.locator('.fd-print-head');
    // No name yet (a draft's): what the page calls its records and the stage it is in, never "Account Entry".
    await expect(head.locator('.fd-print-title')).toHaveText('Invoice · Draft');
    // Its footer quotes {name}, which is empty: the line left out whole, never "quoting . Thank you".
    await expect(page.locator('.fd-print-foot .fd-print-line')).toBeHidden();
    await expect(page.locator('.fd-print-foot')).toBeHidden();
    // Its header has no value: every line of it.
    await expect(head.locator('.fd-print-words .fd-print-line')).toHaveCount(2);
    for (const line of await head.locator('.fd-print-words .fd-print-line').all()) await expect(line).toBeVisible();
    // No red star by a required field, in the label's ::after (underline) or ::before (the other skins).
    const stars = await page.locator('.fd-field.fd-required > .fd-label').evaluateAll((labels) =>
      labels.filter((label) => label.getClientRects().length).flatMap((label) => [getComputedStyle(label, '::after').content, getComputedStyle(label, '::before').content]).filter((content) => content.includes('*'))
    );
    expect(stars).toEqual([]);
    // Left off paper by its page: Journal Items and To Check.
    await expect(page.locator('.fd-tabpanel[data-fd-tab="Journal Items"]')).toBeHidden();
    await expect(page.locator('[data-node="f-to-check"]')).toBeHidden();
    await screen(page, 'print-draft-invoice');
    await printed(page);
    await expect(page.locator('[data-node="f-to-check"]')).toBeHidden(); // in a tab not open
    await page.getByRole('tab', { name: 'Other Info' }).click();
    await expect(page.locator('[data-node="f-to-check"]')).toBeVisible();
    expect(problems).toEqual([]);
  });

  test('stars never print in any skin: outlined puts its star before the label', async ({ page }) => {
    await open(page, 'plain', `page=customer&skin=outlined&${NOW}`);
    await printing(page);
    const before = await page.locator('.fd-field.fd-required > .fd-label').first().evaluate((label) => getComputedStyle(label, '::before').content);
    expect(before).not.toContain('*');
    await printed(page);
    expect(await page.locator('.fd-field.fd-required > .fd-label').first().evaluate((label) => getComputedStyle(label, '::before').content)).toContain('*');
  });

  test('the contacts printout keeps a phone number, a day and an amount on one line each', async ({ page, browserName }) => {
    const { problems } = await open(page, 'plain', `page=contacts&skin=underline&${NOW}`);
    await page.getByRole('button', { name: 'Columns' }).click();
    await page.getByRole('dialog', { name: 'Columns' }).getByLabel('Phone', { exact: true }).check();
    await page.keyboard.press('Escape');
    await dialogOpen(page);
    await page.getByRole('button', { name: 'Print' }).click();
    const sheet = page.locator('.fd-print-sheet');
    await expect(sheet).toHaveCount(1);
    await page.emulateMedia({ media: 'print' });
    const whole = sheet.locator('tbody td.fd-whole');
    await expect(whole.first()).toBeVisible();
    // Phone, Last order and Lifetime value: one line each, however narrow the sheet makes the columns.
    const lines = await whole.evaluateAll((cells) => cells.filter((cell) => cell.textContent?.trim()).map((cell) => ({ text: cell.textContent?.trim(), wraps: getComputedStyle(cell).whiteSpace !== 'nowrap' || cell.getClientRects().length !== 1 || cell.getBoundingClientRect().height > 2.2 * parseFloat(getComputedStyle(cell).lineHeight || '16') })));
    expect(lines.length).toBeGreaterThan(20);
    expect(lines.filter((line) => line.wraps)).toEqual([]);
    expect(lines.some((line) => /^\+\d[\d ]+$/.test(line.text ?? ''))).toBe(true);
    // On a sheet: Chromium's PDF, to look at.
    if (browserName === 'chromium') expect(await pdf(page, 'print-contacts-whole')).toBeGreaterThanOrEqual(1);
    await printed(page);
    expect(problems).toEqual([]);
  });

  test('a related list in a tab with no title of its own prints no empty head over its rows', async ({ page }) => {
    const { problems } = await open(page, 'plain', `page=customer-account&record=1&skin=underline&${NOW}`);
    await printing(page);
    const quotations = page.locator('[data-node="quotations"]');
    await expect(quotations.locator('.fd-list-row').first()).toBeVisible();
    await expect(quotations.locator('.fd-related-head')).toBeHidden();
    // A titled one keeps its title, with no room kept for its buttons.
    const invoices = page.locator('[data-node="invoices"] .fd-related-head');
    await expect(invoices).toBeVisible();
    await expect(invoices).toHaveCSS('min-height', '0px');
    await printed(page);
    await page.getByRole('tab', { name: 'Quotations' }).click();
    await expect(quotations.locator('.fd-related-head')).toBeVisible();
    expect(problems).toEqual([]);
  });
});

test.describe('the sales orders of the owner’s walk, on paper in each engine', () => {
  test.skip(({ browserName }) => browserName === 'webkit', 'WebKit prints no PDF here');
  test.setTimeout(120_000);

  /** The record printed by this engine, its sheets read. */
  async function sheets(page: Page, browserName: string, playwright: Parameters<typeof firefoxSheets>[0], baseURL: string, query: string, name: string) {
    const { problems } = await open(page, 'plain', query);
    const all = browserName === 'firefox' ? (await firefoxSheets(playwright, baseURL, [{ query, name: `firefox-${name}` }]))[0] : await chromiumSheets(page, name);
    return { all, problems, text: (sheet: { lines: { text: string }[] }) => squash(sheet.lines.map((line) => line.text).join(' ')) };
  }

  test('the sales order: its customer group printed — Firefox left it a blank band — the whole order on one sheet', async ({ page, browserName, playwright, baseURL }) => {
    const { all, problems, text } = await sheets(page, browserName, playwright, baseURL!, `page=order&skin=underline&${NOW}`, 'print-walk-order');
    expect(all.length).toBe(1);
    for (const words of ['Customer', 'Nile Traders', 'Payment terms', '30 days', 'Expiration', 'Order date', 'Terms and', 'freight lift']) expect(text(all[0])).toContain(squash(words));
    expect(text(all[0])).not.toContain('*');
    expect(problems).toEqual([]);
  });

  test('the full sales order: a group that fits stays on its sheet, never carried away with the last one', async ({ page, browserName, playwright, baseURL }) => {
    const { all, problems, text } = await sheets(page, browserName, playwright, baseURL!, `page=real-sale-order&record=7101&skin=underline&${NOW}`, 'print-walk-real-sale-order');
    const of = (words: string) => all.findIndex((sheet) => text(sheet).includes(squash(words)));
    /** The sheet with a line of these words alone: a group's title. */
    const titled = (words: string) => all.findIndex((sheet) => sheet.lines.some((line) => squash(line.text) === squash(words)));
    // Each group whole on one sheet, its title with it.
    expect(titled('DELIVERY')).toBe(of('Incoterm Location'));
    expect(titled('TRACKING')).toBe(of('Source Document'));
    // Chromium has room for Delivery under Invoicing (0.26 carried it to the next sheet with Tracking: a sheet's two
    // lines at its head); Firefox's taller lines leave it less than Delivery takes.
    if (browserName === 'chromium') expect(of('Incoterm Location')).toBe(of('Fiscal Position'));
    expect(problems).toEqual([]);
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

  /** Where an element is on the screen; it must be there. */
  const boxOf = async (target: Locator) => {
    const box = await target.boundingBox();
    if (!box) throw new Error('not on screen');
    return box;
  };
  /** A hand's drag along a header's row: pressed in the middle of `from`, moved in steps to `to`. Let go by the caller. */
  async function carry(page: Page, from: Locator, to: number) {
    const box = await boxOf(from);
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(to, box.y + box.height / 2, { steps: 24 });
  }

  test('a column dragged by its header prints in its new place, by Ctrl+P and by Print, the records named; never the Columns cell, a drag’s ghost or its line', async ({ page, browserName }) => {
    const { problems } = await open(page, 'plain', `page=contacts&skin=underline&${NOW}`);
    await expect(page.locator('.fd-list-table tbody tr.fd-list-row')).toHaveCount(10);
    const header = (column: string) => page.locator(`.fd-list-table thead th[data-col="${column}"]`);
    // Country carried toward Name at a hand's speed and let go: right after it — the name column stays first.
    await carry(page, header('country_id'), (await boxOf(header('name'))).x + 10);
    await page.mouse.up();
    const shown = ['Name', 'Country', 'Company', 'Status', 'Owner', 'Last order', 'Lifetime value', 'Newsletter'];
    await expect(heads(page)).toHaveText(shown);
    if (browserName === 'chromium') {
      // On Chromium's paper: the header in that order, every row's words clear of one another — the first column at
      // the table's start, not held where the boxes left out stood — and no Columns button.
      const sheets = await chromiumSheets(page, 'print-contacts-dragged');
      const lines = sheets[0].lines;
      // (A sheet's width is narrower than the screen's: a header of two words may take two lines.)
      expect(lines.some((line) => /^Name\s+Country\s+Company\s+Status\s+Owner\b/.test(line.text.trim()))).toBe(true);
      expect(lines.filter((line) => line.over)).toEqual([]);
    }
    // Ctrl+P: the rows as they stand, in the person's order, the column after the fields (its Columns cell) left out.
    await printing(page);
    await expect(heads(page)).toHaveText(shown);
    await expect(page.getByRole('button', { name: 'Columns' })).toBeHidden();
    await expect(page.locator('.fd-list-table .fd-list-tail:visible')).toHaveCount(0);
    const table = await boxOf(page.locator('.fd-list-table'));
    const first = await boxOf(header('name'));
    expect(Math.abs(first.x - table.x)).toBeLessThanOrEqual(1);
    expect(first.x + first.width).toBeLessThanOrEqual((await boxOf(header('country_id'))).x + 0.5);
    await screen(page, 'print-contacts-dragged');
    await printed(page);
    // A drag under way as printing begins: its ghost and its line are the screen's, the lifted column's cells as the others'.
    await carry(page, header('country_id'), (await boxOf(header('owner_id'))).x + 40);
    await expect(page.locator('.fd-list-ghost')).toBeVisible();
    await expect(page.locator('.fd-list-drop')).toBeVisible();
    await page.emulateMedia({ media: 'print' });
    await expect(page.locator('.fd-list-ghost')).toBeHidden();
    await expect(page.locator('.fd-list-drop')).toBeHidden();
    const lifted = page.locator('.fd-list-table tbody td[data-col="country_id"][data-lifted]').first();
    await expect(lifted).toHaveCSS('opacity', '1');
    await expect(lifted).toHaveCSS('transform', 'none');
    await page.emulateMedia({ media: 'screen' });
    await page.keyboard.press('Escape');
    await page.mouse.up();
    await expect(heads(page)).toHaveText(shown);
    // Its Print: the printout's columns in the person's order, its records called what the page calls them.
    await dialogOpen(page);
    const print = page.getByRole('button', { name: 'Print' });
    await print.click();
    const sheet = page.locator('.fd-print-sheet');
    await expect(sheet).toHaveCount(1);
    await page.emulateMedia({ media: 'print' });
    await expect(sheet.locator('thead th')).toHaveText(shown);
    await expect(sheet.locator('.fd-print-about > div').last()).toHaveText('1,284 contacts');
    await printed(page);
    await expect(sheet).toHaveCount(0);
    await expect(print).not.toHaveAttribute('aria-busy', 'true');
    expect(problems).toEqual([]);
  });

  test('a grid in a tab never opened prints as its lines’ paper table, like the one shown, with no page error in any engine', async ({ page }) => {
    // WebKit said "ResizeObserver loop completed with undelivered notifications" here (0.25.0 too): the delivery schedule's
    // grid, drawn for paper after the window said printing began, made no paper table, and was laid out across the sheet.
    const { problems } = await open(page, 'plain', `page=order&skin=underline&${NOW}`);
    await expect(page.locator('[data-node="f-lines"] .ag-row[row-index="5"]')).toBeVisible();
    await printing(page);
    for (const id of ['f-lines', 'f-deliveries']) {
      const grid = page.locator(`[data-node="${id}"]`);
      await expect(grid.locator('.fd-print-table')).toBeVisible();
      await expect(grid.locator('.ag-root-wrapper')).toBeHidden();
    }
    await expect(page.locator('[data-node="f-deliveries"] .fd-print-table thead th')).toHaveText(['Date', 'Deliver to', 'Carrier', 'Boxes']);
    await screen(page, 'print-order-grids');
    await printed(page);
    await expect(page.locator('.fd-print-table')).toHaveCount(0);
    // Back on the screen, the schedule's tab opens on its grid.
    await page.getByRole('tab', { name: 'Other information' }).click();
    await expect(page.locator('[data-node="f-deliveries"] .ag-root-wrapper')).toBeVisible();
    expect(problems).toEqual([]);
  });

  test('a grid’s column dragged by its header prints in its new place: the lines’ paper table in the order the screen shows', async ({ page }) => {
    // In every engine: WebKit said "ResizeObserver loop completed with undelivered notifications" as every tab was shown
    // for paper (0.25.0 too), a grid in a tab not shown put back on the page inside its own size's observer.
    const { problems } = await open(page, 'plain', `page=order&skin=underline&${NOW}`);
    const grid = page.locator('[data-node="f-lines"]');
    const cellHead = (column: string) => grid.locator(`.ag-header-cell[col-id="${column}"]`);
    await expect(grid.locator('.ag-row[row-index="5"] .ag-cell[col-id="subtotal"]')).toHaveText('E£ 4,560.00');
    /** The grid's own columns in the order a person sees them (AG Grid moves header cells on screen, not in the markup), and their headers' words. */
    const seen = () =>
      grid.locator('.ag-header-cell[col-id]:not([col-id^="__"])').evaluateAll((cells) =>
        cells
          .map((cell) => ({ id: cell.getAttribute('col-id') as string, words: cell.querySelector('.ag-header-cell-text')?.textContent?.trim() ?? '', x: cell.getBoundingClientRect().x }))
          .sort((p, q) => p.x - q.x)
          .map(({ id, words }) => ({ id, words }))
      );
    const before = await seen();
    expect(before.findIndex((one) => one.id === 'price')).toBe(before.findIndex((one) => one.id === 'qty') + 1);
    // Unit price carried before Quantity once the grid holds still, and let go.
    let last = '';
    await expect
      .poll(async () => {
        const now = JSON.stringify(await cellHead('price').boundingBox());
        const still = now === last;
        last = now;
        return still;
      })
      .toBe(true);
    await carry(page, cellHead('price'), (await boxOf(cellHead('qty'))).x + 10);
    await page.mouse.up();
    const swap = (one: { id: string }) => (one.id === 'qty' ? 'price' : one.id === 'price' ? 'qty' : one.id);
    const moved = before.map((one) => before.find((other) => other.id === swap(one)) as { id: string; words: string });
    await expect.poll(seen).toEqual(moved);
    await printing(page);
    await expect(grid.locator('.fd-print-table thead th')).toHaveText(moved.map((one) => one.words));
    await printed(page);
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

test.describe('a work item’s head title and a tab’s count on paper', () => {
  // Sheets as each engine prints them, read (print-support.ts): Chromium's page.pdf, Firefox's own print to a file.
  test.skip(({ browserName }) => browserName === 'webkit', 'WebKit prints no PDF here');
  test.setTimeout(120_000);

  const TITLE = 'Checkout fails for customers paying by bank transfer when the order total holds several currencies and a discount code was applied before the shipping address changed';
  const WORK_ITEM = `page=wi-head&${NOW}`;
  const retitle = (page: Page) => page.locator('[data-node="#title"] textarea').fill(TITLE);
  const sheetsOf = async (page: Page, browserName: string, playwright: Parameters<typeof firefoxSheets>[0], baseURL: string, query: string, name: string, before?: (page: Page) => Promise<unknown>) => {
    if (browserName === 'firefox') return (await firefoxSheets(playwright, baseURL, [{ query, name: `firefox-${name}`, ...(before ? { before } : {}) }]))[0];
    await before?.(page);
    return chromiumSheets(page, name);
  };

  test('its title — a box of one line that wraps — prints as its words, wrapped whole over lines, nothing beside it', async ({ page, browserName, playwright, baseURL }) => {
    const { problems } = await open(page, 'plain', WORK_ITEM);
    await expect(page.locator('[data-node="#title"] textarea')).toBeVisible();
    const sheets = await sheetsOf(page, browserName, playwright, baseURL!, WORK_ITEM, 'print-work-item-title', retitle);
    const lines = sheets[0].lines;
    // Under the printout's head (which names the record too): its number, then its words.
    const first = lines.findIndex((line) => /^4127\s+Checkout fails/.test(line.text.trim()));
    expect(first, 'the title after its number').toBeGreaterThanOrEqual(0);
    let last = first;
    while (last < lines.length - 1 && !squash(lines.slice(first, last + 1).map((line) => line.text).join(' ')).includes(squash(TITLE))) last++;
    const words = lines.slice(first, last + 1).map((line) => line.text.trim());
    expect(squash(words.join(' ')), 'every word of it, in order').toBe(squash(`4127 ${TITLE}`));
    expect(words.length, 'over more than one line').toBeGreaterThan(1);
    // Whole words at each line's end: none broken by a hyphen, and no Copy title beside it.
    expect(words.join(' ').split(/\s+/)).toEqual(['4127', ...TITLE.split(' ')]);
    expect(problems).toEqual([]);
  });

  test('a tab’s count of its related list is the screen’s: on paper the tab’s name alone heads what it holds', async ({ page, browserName, playwright, baseURL }) => {
    const CUSTOMER = `page=customer-account&record=1&skin=underline&${NOW}`;
    const { problems } = await open(page, 'plain', CUSTOMER);
    const pill = page.locator('[data-node="tab-quotations"] .fd-tab-count');
    await expect(pill).toHaveText(/^\d+$/);
    // Its name over what it holds on each engine's paper, and no number beside it.
    const lines = (await sheetsOf(page, browserName, playwright, baseURL!, CUSTOMER, 'print-tab-count')).flatMap((sheet) => sheet.lines.map((line) => line.text.trim()));
    expect(lines).toContain('Quotations');
    expect(lines.filter((line) => /^Quotations\s*\d/.test(line))).toEqual([]);
    // The tab bar and its pill left out; the tab drawn under its name.
    await printing(page);
    await expect(pill).toBeHidden();
    await expect(page.locator('.fd-tabpanel[data-fd-tab="Quotations"]')).toBeVisible();
    await printed(page);
    expect(problems).toEqual([]);
  });
});

test.describe('the print part, on intent', () => {
  /** Each time the page asked for the print part: its chunk (as an app's bundler splits it) or its script (fieldia.print.js). */
  const asks = (page: Page) => {
    const asked: string[] = [];
    page.on('request', (request) => {
      const path = new URL(request.url()).pathname;
      if (/\/(chunks\/print-part-[\w-]+|fieldia\.print)\.js$/.test(path)) asked.push(path);
    });
    return asked;
  };
  /**
   * Long enough for what a page asks for once it is drawn and the browser idle (print.ts): an idle moment, then past
   * the second a browser that says nothing of idle waits — or, for one never idle, that second alone. Nothing is
   * awaited here but that time: what is checked after it is that nothing came of it.
   */
  const settled = (page: Page, idle = true) =>
    page.evaluate(
      (idle) =>
        new Promise<void>((done) => {
          const later = () => setTimeout(done, 1300);
          if (idle && 'requestIdleCallback' in window) requestIdleCallback(later, { timeout: 3000 });
          else later();
        }),
      idle
    );
  /** The browser's print, counted, telling nothing: what a page asks of it. */
  const countPrints = (page: Page) => page.evaluate(() => ((window as unknown as { fdPrints: number }).fdPrints = 0, (window.print = () => void ((window as unknown as { fdPrints: number }).fdPrints += 1))));
  const prints = (page: Page) => page.evaluate(() => (window as unknown as { fdPrints: number }).fdPrints);
  const laidOut = (page: Page) => page.evaluate(() => [...document.querySelectorAll('form.fd-form')].some((form) => form.hasAttribute('data-fd-print')));

  test('a page no one prints never asks for it: a form filled in and sent from one <script> tag; there Ctrl+P brings fieldia.print.js', async ({ page }) => {
    const asked = asks(page);
    const problems: string[] = [];
    page.on('pageerror', (error) => problems.push(error.message));
    await page.goto('/script/');
    await expect(page.locator('.fd-form')).toBeVisible();
    await page.getByLabel('Your name').fill('Omar Farouk');
    await page.getByLabel('Phone').fill('+20 100 555 0101');
    await page.getByLabel('Afternoon').check();
    await page.getByRole('button', { name: 'Submit' }).click();
    await expect.poll(() => page.evaluate(() => (window as any).fieldiaDemo.dataSource.responses.length)).toBe(1);
    await settled(page);
    expect(asked).toEqual([]);
    // Ctrl+P: the part beside fieldia.js, then the form laid out for paper as the browser prints it.
    await pressPrint(page);
    expect(asked).toEqual(['/script/fieldia.print.js']);
    expect(await laidOut(page)).toBe(true);
    await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
    expect(await laidOut(page)).toBe(false);
    expect(problems).toEqual([]);
  });

  test('a customer’s record opened and its tabs gone through asks for none of it', async ({ page }) => {
    const asked = asks(page);
    const { problems } = await open(page, 'plain', `page=customer&skin=underline&${NOW}`);
    for (const tab of ['Contacts', 'Sales and billing', 'Notes']) {
      await page.getByRole('tab', { name: tab }).click();
      await expect(page.locator(`.fd-tabpanel[data-fd-tab="${tab}"]`)).toBeVisible();
    }
    await settled(page);
    expect(asked).toEqual([]);
    expect(problems).toEqual([]);
  });

  test('Ctrl+P before it came asks for it, then prints the whole look — every tab under its name, the day over it (Chromium’s PDF)', async ({ page, browserName }) => {
    const asked = asks(page);
    const { problems } = await open(page, 'plain', `page=real-employee&record=4122&skin=underline&${NOW}`);
    await settled(page);
    expect(asked).toEqual([]);
    const tabs = ['Resume', 'Work Information', 'Private Information', 'HR Settings'];
    // A tab never opened is not drawn yet.
    await expect(page.locator('.fd-tabpanel[data-fd-tab="HR Settings"] .fd-field')).toHaveCount(0);
    // ⌘P where the keyboard is a Mac's — Safari's engine — and Ctrl+P elsewhere.
    await pressPrint(page, browserName === 'webkit' ? 'Meta+p' : 'Control+p');
    expect(asked).toHaveLength(1);
    if (browserName === 'chromium') {
      const bytes = await page.pdf({ format: 'A4', margin: { top: '12mm', bottom: '12mm', left: '12mm', right: '12mm' } });
      mkdirSync('test-results/screens', { recursive: true });
      writeFileSync('test-results/screens/print-on-intent-employee.pdf', bytes);
      try {
        execFileSync('pdftoppm', ['-r', '60', '-png', 'test-results/screens/print-on-intent-employee.pdf', 'test-results/screens/print-on-intent-employee']);
      } catch {
        // No poppler here: the PDF alone, to open.
      }
      const lines = pdfSheets(bytes).flatMap((sheet) => sheet.lines.map((line) => line.text.trim()));
      for (const tab of tabs) expect(lines, `${tab} under its name`).toContain(tab);
      // The day it was printed (this page keeps no clock of its own: today's).
      expect(lines.some((line) => /^Printed \d{1,2} \w{3} \d{4}/.test(line))).toBe(true);
      expect(await laidOut(page)).toBe(false);
    } else {
      await page.emulateMedia({ media: 'print' });
      for (const tab of tabs) await expect(page.locator(`.fd-tabpanel[data-fd-tab="${tab}"]`)).toBeVisible();
      await expect(page.locator('.fd-tabpanel[data-fd-tab="HR Settings"] .fd-field').first()).toBeVisible();
      await expect(page.locator('.fd-print-head .fd-print-when')).toHaveText(/^Printed \d{1,2} \w{3} \d{4}/);
      await screen(page, 'print-on-intent-employee');
      await printed(page);
    }
    expect(problems).toEqual([]);
  });

  test('the browser’s own menu before it came prints the plain look, light, no buttons — and asks for it: the next print whole', async ({ page }) => {
    const asked = asks(page);
    const { problems } = await open(page, 'plain', `page=customer&skin=underline&scheme=dark&${NOW}`);
    const form = page.locator('form.fd-form');
    await expect(page.locator('.fd-tabpanel[data-fd-tab="Notes"] .fd-field')).toHaveCount(0);
    // As the browser's menu prints: told, then laid out for paper, nothing waited for.
    await page.evaluate(() => window.dispatchEvent(new Event('beforeprint')));
    await page.emulateMedia({ media: 'print' });
    expect(await laidOut(page)).toBe(false);
    await expect(form).toHaveCSS('color', 'rgb(29, 32, 36)');
    expect(await form.locator('.fd-button, .fd-actions, .fd-help').evaluateAll((all) => all.filter((one) => one.getClientRects().length).length)).toBe(0);
    await expect(page.locator('.fd-print-head')).toBeHidden();
    // The page as it is on the screen: the tab never opened not drawn.
    await expect(page.locator('.fd-tabpanel[data-fd-tab="Notes"] .fd-field')).toHaveCount(0);
    await screen(page, 'print-plain-look');
    await expect.poll(() => asked.length, { message: 'the part asked for as that print began' }).toBe(1);
    await printed(page);
    // The next print, by the menu again: whole.
    await page.evaluate(() => window.dispatchEvent(new Event('beforeprint')));
    await page.emulateMedia({ media: 'print' });
    expect(await laidOut(page)).toBe(true);
    for (const tab of ['Contacts', 'Sales and billing', 'Notes']) await expect(page.locator(`.fd-tabpanel[data-fd-tab="${tab}"]`)).toBeVisible();
    await expect(page.locator('.fd-tabpanel[data-fd-tab="Notes"] .fd-field').first()).toBeVisible();
    await expect(page.locator('.fd-print-head')).toBeVisible();
    await screen(page, 'print-whole-after-menu');
    await printed(page);
    expect(asked).toHaveLength(1);
    expect(problems).toEqual([]);
  });

  test('shown intent fetches it and prints nothing: the gear opened with Print in it, a pointer resting on a list’s Print', async ({ page }) => {
    // A browser never idle: what the page asks for on its own, it never asks.
    await page.addInitScript(() => ((window as unknown as { requestIdleCallback: () => number }).requestIdleCallback = () => 0));
    const asked = asks(page);
    const { problems } = await open(page, 'plain', invoice());
    await countPrints(page);
    await settled(page, false);
    expect(asked).toEqual([]);
    await page.getByRole('button', { name: 'Actions' }).click();
    await expect.poll(() => asked.length, { message: 'the gear opened' }).toBe(1);
    expect(await laidOut(page)).toBe(false);
    expect(await prints(page)).toBe(0);
    // Its This invoice prints, at once.
    await page.getByRole('menuitem', { name: 'This invoice' }).click();
    await expect.poll(() => prints(page)).toBe(1);
    // A list's Print, a pointer resting on it.
    await page.goto(`/plain/?page=contacts&skin=underline&${NOW}`);
    await expect(page.locator('.fd-list-table tbody tr.fd-list-row')).toHaveCount(10);
    await countPrints(page);
    await settled(page, false);
    expect(asked).toHaveLength(1);
    await page.getByRole('button', { name: 'Print' }).hover();
    await expect.poll(() => asked.length, { message: 'a pointer resting on Print' }).toBe(2);
    expect(await prints(page)).toBe(0);
    expect(problems).toEqual([]);
  });

  test('a page meant for paper asks for it once drawn and the browser idle, prints nothing — and its menu’s print is whole', async ({ page }) => {
    const asked = asks(page);
    const { problems } = await open(page, 'plain', invoice());
    await countPrints(page);
    await expect.poll(() => asked.length, { message: 'its own words for paper' }).toBe(1);
    await settled(page);
    expect(await laidOut(page)).toBe(false);
    expect(await prints(page)).toBe(0);
    await page.evaluate(() => window.dispatchEvent(new Event('beforeprint')));
    await page.emulateMedia({ media: 'print' });
    expect(await laidOut(page)).toBe(true);
    await expect(page.locator('.fd-tabpanel[data-fd-tab="Other Info"]').first()).toBeVisible();
    await printed(page);
    expect(problems).toEqual([]);
  });
});
