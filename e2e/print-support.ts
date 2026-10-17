import { type Page, type PlaywrightWorkerArgs } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect } from './fixtures';
import { pdfSheets, sheetProblems, type PdfSheet } from './pdf-text';

/**
 * A record on paper as each engine prints it: Chromium by `page.pdf()` (which says beforeprint and afterprint itself),
 * Firefox by its own print to a file — silent, to "Save to PDF", in a Firefox of its own launched for it with those
 * settings, its header and footer words blank — each sheet then read (pdf-text.ts) and kept, with a PNG of each where
 * poppler's pdftoppm is at hand, in test-results/screens for a person to look at. A4, 12mm margins all round.
 */

const SCREENS = 'test-results/screens';
const MARGIN = '12mm';

function keep(bytes: Buffer, name: string): void {
  mkdirSync(SCREENS, { recursive: true });
  const path = `${SCREENS}/${name}.pdf`;
  writeFileSync(path, bytes);
  try {
    execFileSync('pdftoppm', ['-r', '60', '-png', path, `${SCREENS}/${name}`]);
  } catch {
    // No poppler here: the PDF alone, to open.
  }
}

/** The page as Chromium prints it. */
export async function chromiumSheets(page: Page, name: string): Promise<PdfSheet[]> {
  const bytes = await page.pdf({ format: 'A4', margin: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN } });
  keep(bytes, name);
  return pdfSheets(bytes);
}

/** A print in Firefox: the demo's address, and what is done to the page first. */
export interface FirefoxPrint {
  query: string;
  name: string;
  before?: (page: Page) => Promise<unknown>;
}

/** Each page as Firefox prints it to a file, one after another in one Firefox. */
export async function firefoxSheets(playwright: PlaywrightWorkerArgs['playwright'], baseURL: string, prints: FirefoxPrint[]): Promise<PdfSheet[][]> {
  mkdirSync(SCREENS, { recursive: true });
  // A file of this Firefox's own: tests print side by side.
  const file = resolve(`${SCREENS}/firefox-printing-${randomUUID()}.pdf`);
  const to = 'print.printer_Mozilla_Save_to_PDF.';
  const inches = String(12 / 25.4);
  const browser = await playwright.firefox.launch({
    firefoxUserPrefs: {
      'print.always_print_silent': true,
      'print.show_print_progress': false,
      print_printer: 'Mozilla Save to PDF',
      [`${to}print_to_file`]: true,
      [`${to}print_to_filename`]: file,
      [`${to}print_paper_name`]: 'iso_a4',
      [`${to}print_shrink_to_fit`]: false,
      [`${to}print_scaling`]: '1.0',
      ...Object.fromEntries(['top', 'bottom', 'left', 'right'].map((side) => [`${to}print_margin_${side}`, inches])),
      ...Object.fromEntries(['headerleft', 'headercenter', 'headerright', 'footerleft', 'footercenter', 'footerright'].map((words) => [`${to}print_${words}`, ''])),
    },
  });
  try {
    const all: PdfSheet[][] = [];
    for (const one of prints) {
      rmSync(file, { force: true });
      const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
      await page.goto(`${baseURL}/plain/?${one.query}`);
      await expect(page.locator('form.fd-form').first()).not.toHaveAttribute('aria-busy', 'true');
      await one.before?.(page);
      // Printed as the person's Ctrl+P prints it; the file is whole once its size holds still.
      void page.evaluate(() => window.print()).catch(() => undefined);
      let size = -1;
      await expect
        .poll(
          () => {
            const now = existsSync(file) ? statSync(file).size : 0;
            const still = now > 0 && now === size;
            size = now;
            return still && readFileSync(file).subarray(-1024).toString('latin1').includes('%%EOF');
          },
          { timeout: 30_000, intervals: [250] }
        )
        .toBe(true);
      const bytes = readFileSync(file);
      keep(bytes, one.name);
      all.push(pdfSheets(bytes));
      await page.close();
    }
    return all;
  } finally {
    await browser.close();
    rmSync(file, { force: true });
  }
}

/** The headings the page prints — its tabs' names, its groups' and steps' titles — every tab drawn as printing begins. */
export async function headingsOf(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    window.dispatchEvent(new Event('beforeprint'));
    const tabs = [...document.querySelectorAll('.fd-tabpanel[data-fd-tab]')].map((panel) => panel.getAttribute('data-fd-tab') ?? '');
    const titles = [...document.querySelectorAll('.fd-section-title, .fd-step-title')].map((title) => title.textContent?.trim() ?? '');
    window.dispatchEvent(new Event('afterprint'));
    return [...new Set([...tabs, ...titles])].filter(Boolean);
  });
}

/** Every sheet clean (sheetProblems): none found, listed by sheet where one is. */
export function expectSheetsClean(sheets: PdfSheet[], footer: string, headings: string[]): void {
  expect(sheets.length, 'a sheet at least').toBeGreaterThan(0);
  expect(sheetProblems(sheets, footer, headings)).toEqual([]);
}
