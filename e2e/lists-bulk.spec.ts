import { type Download, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { inflateRawSync } from 'node:zlib';
import { expect, test } from './fixtures';
import { expectNoSidewaysScroll, open, screen } from './support';

/**
 * A list people take away and change in bulk (the plain demo's Contacts:
 * 1,284 of them, ten to a page). Every record that matches chosen at once;
 * the rows ticked, or every match, exported to Excel or CSV; one field set
 * on many records at once, what could not be changed named with why. The
 * address makes the source behave as others do: ids cut short or none, no
 * bulk writing, an export written on the server (demos/shared/contacts.ts).
 */

const rows = (page: Page) => page.locator('.fd-list-table tbody tr.fd-list-row');
const count = (page: Page) => page.locator('.fd-list-count');
const every = (page: Page) => page.locator('.fd-list-every');
const header = (page: Page) => page.locator('.fd-list-table thead .fd-list-checkbox');
const exportButton = (page: Page) => page.getByRole('button', { name: 'Export' });
const menu = (page: Page) => page.getByRole('menu', { name: 'Export' });
const toast = (page: Page) => page.locator('.fd-say');
const cell = (page: Page, row: number, column: number) => rows(page).nth(row).locator('td').nth(column);

async function contacts(page: Page, query = '') {
  const opened = await open(page, 'plain', `page=contacts&skin=underline${query}`);
  await expect(rows(page)).toHaveCount(10);
  await expect(page.locator('.fd-pager-text')).toHaveText('1–10 of 1,284 contacts');
  return opened;
}

/** The files of a zip, by name: each inflated where it was squeezed. */
function unzip(bytes: Buffer): Map<string, string> {
  const end = bytes.length - 22;
  expect(bytes.readUInt32LE(end), 'a zip ends with its directory').toBe(0x06054b50);
  const files = new Map<string, string>();
  let at = bytes.readUInt32LE(end + 16);
  for (let i = bytes.readUInt16LE(end + 10); i > 0; i--) {
    const method = bytes.readUInt16LE(at + 10);
    const size = bytes.readUInt32LE(at + 20);
    const nameLength = bytes.readUInt16LE(at + 28);
    const offset = bytes.readUInt32LE(at + 42);
    const name = bytes.subarray(at + 46, at + 46 + nameLength).toString('utf8');
    const start = offset + 30 + bytes.readUInt16LE(offset + 26) + bytes.readUInt16LE(offset + 28);
    const body = bytes.subarray(start, start + size);
    files.set(name, (method === 8 ? inflateRawSync(body) : body).toString('utf8'));
    at += 46 + nameLength + bytes.readUInt16LE(at + 30) + bytes.readUInt16LE(at + 32);
  }
  return files;
}

/** Export, as a person: the button, then the file's kind; the file the browser saved. */
async function exportAs(page: Page, kind: 'Excel (.xlsx)' | 'CSV (.csv)'): Promise<Download> {
  await exportButton(page).click();
  await expect(menu(page)).toBeVisible();
  const saved = page.waitForEvent('download');
  await menu(page).getByRole('menuitem', { name: kind }).click();
  return saved;
}
const today = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

test.describe('a list people take away and change in bulk', () => {
  test('selects every contact that matches, keeps them ticked page to page, and hands the list’s button all 1,284', async ({ page }) => {
    const { problems, demo } = await contacts(page);
    await expect(every(page)).toBeHidden();
    await header(page).check();
    await expect(count(page)).toHaveText('10 selected');
    await expect(every(page)).toHaveText('Select all 1,284 contacts that match');
    await screen(page, 'lists-bulk-offer', { viewport: true });
    await every(page).click();
    await expect(count(page)).toHaveText('1,284 selected');
    await expect(every(page)).toBeHidden();
    await page.getByRole('button', { name: 'Next page' }).click();
    await expect(page.locator('.fd-pager-text')).toHaveText('11–20 of 1,284 contacts');
    for (const box of await rows(page).locator('.fd-list-checkbox').all()) await expect(box).toBeChecked();
    // One let go: the rest stay chosen.
    await rows(page).first().locator('.fd-list-checkbox').uncheck();
    await expect(count(page)).toHaveText('1,283 selected');
    await page.getByRole('button', { name: 'Send newsletter' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Send newsletter' }).click();
    await expect.poll(() => demo<{ recordIds: unknown[] }[]>('requests').then((requests) => requests.at(-1)?.recordIds.length)).toBe(1283);
    // The header's box, unticked, lets every one go.
    await header(page).check();
    await expect(count(page)).toHaveText('1,284 selected');
    await header(page).uncheck();
    await expect(page.locator('.fd-list-selection')).toBeHidden();
    expect(problems).toEqual([]);
  });

  test('says how many of how many when the source stops short, and pages through one that gives no ids alone', async ({ page }) => {
    const { problems } = await contacts(page, '&allIds=1000');
    await header(page).check();
    await every(page).click();
    await expect(count(page)).toHaveText('1,000 of 1,284 could be selected');
    await screen(page, 'lists-bulk-short', { viewport: true });
    await page.goto('/plain/?page=contacts&skin=underline&allIds=none');
    await expect(rows(page)).toHaveCount(10);
    await header(page).check();
    await every(page).click();
    await expect(count(page)).toHaveText('1,284 selected');
    expect(problems).toEqual([]);
  });

  test('exports every contact that matches to Excel: the columns as the list shows them, money with its currency, days as days', async ({ page }) => {
    const { problems } = await contacts(page);
    const first = await cell(page, 0, 1).textContent();
    const download = await exportAs(page, 'Excel (.xlsx)');
    expect(download.suggestedFilename()).toBe(`Contacts ${today()}.xlsx`);
    await expect(toast(page).filter({ hasText: '1,284 contacts exported.' })).toBeVisible();
    const files = unzip(readFileSync(await download.path()));
    const sheet = files.get('xl/worksheets/sheet1.xml') as string;
    // A header row and 1,284 contacts, in the list's order; the header stays in view and filters.
    expect(sheet.match(/<row /g)).toHaveLength(1285);
    expect([...sheet.matchAll(/<c r="[A-Z]1" t="inlineStr" s="1"><is><t>([^<]*)<\/t>/g)].map(([, words]) => words)).toEqual(['Name', 'Company', 'Country', 'Status', 'Owner', 'Last order', 'Lifetime value', 'Newsletter']);
    expect(sheet).toContain(`<c r="A2" t="inlineStr"><is><t>${first}</t></is></c>`);
    expect(sheet).toContain('state="frozen"');
    expect(sheet).toContain('<autoFilter ref="A1:H1285"/>');
    const styles = files.get('xl/styles.xml') as string;
    for (const format of ['&quot;E£&quot; #,##0.00', '&quot;JOD&quot; #,##0.000', '&quot;SAR&quot; #,##0.00', 'd mmm yyyy']) expect(styles).toContain(`formatCode="${format}"`);
    expect(problems).toEqual([]);
  });

  test('exports the rows ticked to CSV, as the list says them, in its order', async ({ page }) => {
    const { problems } = await contacts(page);
    for (const row of [0, 2, 3]) await rows(page).nth(row).locator('.fd-list-checkbox').check();
    await exportButton(page).click();
    await expect(menu(page).locator('.fd-list-export-what')).toHaveText('3 selected');
    await screen(page, 'lists-bulk-export-menu', { viewport: true });
    await page.keyboard.press('Escape');
    await expect(menu(page)).toBeHidden();
    await expect(exportButton(page)).toBeFocused();
    const download = await exportAs(page, 'CSV (.csv)');
    expect(download.suggestedFilename()).toBe(`Contacts ${today()}.csv`);
    const lines = readFileSync(await download.path(), 'utf8').split('\r\n');
    // The owner's walk: "E£ 51,086.00" was words a spreadsheet cannot add. An amount is a number now, its currency in a
    // column of its own; a day is ISO's.
    expect(lines[0]).toBe('\ufeffName,Company,Country,Status,Owner,Last order,Lifetime value,Lifetime value currency,Newsletter');
    expect(lines).toHaveLength(5);
    for (const [i, row] of [0, 2, 3].entries()) {
      expect(lines[i + 1].startsWith(`${await cell(page, row, 1).textContent()},${await cell(page, row, 2).textContent()},`)).toBe(true);
      const shown = ((await cell(page, row, 7).textContent()) ?? '').trim();
      const [, day, amount, currency] = /,(\d{4}-\d{2}-\d{2})?,(-?\d+\.\d{2})?,([A-Z]{3})?,(?:Yes|No)$/.exec(lines[i + 1]) ?? [];
      expect(lines[i + 1], 'an amount with its currency, or neither').toMatch(/,(\d{4}-\d{2}-\d{2})?,(-?\d+\.\d{2},[A-Z]{3}|,),(Yes|No)$/);
      if (shown) {
        expect(amount).toBe(shown.replace(/[^\d.-]/g, ''));
        expect(['EGP', 'SAR', 'AED', 'USD', 'EUR', 'JOD']).toContain(currency);
      } else expect(amount).toBeUndefined();
      if ((await cell(page, row, 6).textContent())?.trim()) expect(day).toMatch(/^20\d\d-\d\d-\d\d$/);
    }
    expect(problems).toEqual([]);
  });

  test('edits many at once: a field and a value, the question, then what could not be changed and why, the rest done', async ({ page }) => {
    const { problems } = await contacts(page);
    await header(page).check();
    // Those it cannot change: Karim's, and a blocked contact's status.
    const owners = await rows(page).locator('td:nth-child(6)').allTextContents();
    const states = await rows(page).locator('td:nth-child(5)').allTextContents();
    const names = await rows(page).locator('td:nth-child(2)').allTextContents();
    const refused = names.flatMap((name, i) =>
      owners[i] === 'Karim Nasser' ? [`${name}: Only its owner, Karim Nasser, can change this contact.`] : states[i] === 'Blocked' ? [`${name}: A blocked contact’s status is changed by the credit team.`] : []
    );
    expect(refused.length, 'the first page holds contacts that cannot be changed').toBeGreaterThan(0);
    await page.locator('.fd-list-selection').getByRole('button', { name: 'Edit' }).click();
    const dialog = page.getByRole('dialog', { name: 'Edit 10 contacts' });
    await expect(dialog).toBeVisible();
    await dialog.getByLabel('Field').selectOption({ label: 'Status' });
    await dialog.getByLabel('Status').selectOption({ label: 'Inactive' });
    await screen(page, 'lists-bulk-edit-dialog', { viewport: true });
    await dialog.getByRole('button', { name: 'Update' }).click();
    const question = page.getByRole('alertdialog');
    await expect(question).toHaveText(/Update 10 contacts\? Status becomes “Inactive”\./);
    await question.getByRole('button', { name: 'Update' }).click();
    const report = page.locator('.fd-list-report');
    await expect(report).toBeVisible();
    await expect(report.locator('.fd-list-report-words')).toHaveText(`${10 - refused.length} of 10 contacts updated. Not changed:`);
    await expect(report.locator('li')).toHaveText(refused);
    await screen(page, 'lists-bulk-edit-report', { viewport: true });
    // Those not changed stay chosen; the rest read Inactive now, saved.
    await expect(count(page)).toHaveText(`${refused.length} selected`);
    for (const name of names) {
      if (refused.some((line) => line.startsWith(`${name}:`))) continue;
      await expect(rows(page).filter({ hasText: name }).first().locator('td').nth(4)).toHaveText('Inactive');
    }
    await report.getByRole('button', { name: 'Dismiss' }).click();
    await expect(report).toBeHidden();
    expect(problems).toEqual([]);
  });

  test('saves each in turn where the source cannot write many at once', async ({ page }) => {
    const { problems } = await contacts(page, '&writeMany=none');
    const names = await rows(page).locator('td:nth-child(2)').allTextContents();
    const owners = await rows(page).locator('td:nth-child(6)').allTextContents();
    const free = names.map((name, i) => ({ name, i })).filter(({ i }) => owners[i] !== 'Karim Nasser').slice(0, 3);
    for (const { i } of free) await rows(page).nth(i).locator('.fd-list-checkbox').check();
    await page.locator('.fd-list-selection').getByRole('button', { name: 'Edit' }).click();
    const dialog = page.getByRole('dialog', { name: 'Edit 3 contacts' });
    await dialog.getByLabel('Field').selectOption({ label: 'Newsletter' });
    await dialog.getByRole('checkbox', { name: 'Newsletter' }).check();
    await dialog.getByRole('button', { name: 'Update' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Update' }).click();
    await expect(toast(page).filter({ hasText: '3 contacts updated.' })).toBeVisible();
    for (const { name } of free) await expect(rows(page).filter({ hasText: name }).first().locator('td').nth(8)).toHaveText('✓');
    expect(problems).toEqual([]);
  });

  test('leaves an export to the server where it writes one: its words for a big one, its file for a small one', async ({ page }) => {
    const { problems } = await contacts(page, '&export=server');
    await exportButton(page).click();
    await menu(page).getByRole('menuitem', { name: 'Excel (.xlsx)' }).click();
    await expect(toast(page).filter({ hasText: `Contacts ${today()}.xlsx is being made on the server: it will be emailed to you.` })).toBeVisible();
    await rows(page).first().locator('.fd-list-checkbox').check();
    const download = await exportAs(page, 'CSV (.csv)');
    expect(download.suggestedFilename()).toBe(`Contacts ${today()} (server).csv`);
    // A small workbook the server leaves to the browser.
    expect((await exportAs(page, 'Excel (.xlsx)')).suggestedFilename()).toBe(`Contacts ${today()}.xlsx`);
    expect(problems).toEqual([]);
  });

  test('opens a contact from its row, read-only where it is not this person’s to change', async ({ page }) => {
    const { problems } = await contacts(page);
    const owners = await rows(page).locator('td:nth-child(6)').allTextContents();
    const karims = owners.indexOf('Karim Nasser');
    const name = await cell(page, karims, 1).textContent();
    await cell(page, karims, 1).click();
    await expect(page).toHaveURL(/page=contact&/);
    await expect(page.locator('[data-node="contact-name"] input')).toHaveValue(name ?? '');
    await expect(page.getByText('Only its owner, Karim Nasser, can change this contact.')).toBeVisible();
    expect(problems).toEqual([]);
  });

  test('reads right to left in Arabic, its numbers as the page writes them', async ({ page }) => {
    const { problems } = await open(page, 'plain', 'page=contacts&skin=underline&locale=ar&dir=rtl');
    await expect(rows(page)).toHaveCount(10);
    await header(page).check();
    await expect(every(page)).toHaveText('تحديد كل السجلات المطابقة (1,284)');
    await every(page).click();
    await expect(count(page)).toHaveText('تم تحديد 1,284');
    await page.getByRole('button', { name: 'تصدير' }).click();
    await expect(page.getByRole('menu', { name: 'تصدير' })).toBeVisible();
    await expectNoSidewaysScroll(page);
    await screen(page, 'lists-bulk-arabic', { viewport: true });
    expect(problems).toEqual([]);
  });
});
