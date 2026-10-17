import { type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { inflateRawSync } from 'node:zlib';
import { expect, test } from './fixtures';
import { expectNoSidewaysScroll, open, screen } from './support';

/**
 * Getting a customer's data in (the plain demo's Contacts): Import in the
 * list's bar, a workbook as Excel writes one chosen and a CSV file dropped
 * (the demo's samples, demos/samples, a few rows wrong in each), its columns
 * matched and one picked by hand, every row checked before anything is
 * written — the rows refused named with why and downloaded to fix — then
 * written, said under the list, and undone. And rows copied from a
 * spreadsheet pasted into a table of lines, lines added for them.
 */

const SAMPLES = join(__dirname, '../demos/samples');
const rows = (page: Page) => page.locator('.fd-list-table tbody tr.fd-list-row');
const dialog = (page: Page) => page.getByRole('dialog', { name: 'Import into Contacts' });
const report = (page: Page) => page.locator('.fd-list-report');
const goesInto = (page: Page, header: string) => dialog(page).getByRole('combobox', { name: `${header}: Goes into` });

async function contacts(page: Page) {
  const opened = await open(page, 'plain', 'page=contacts&skin=underline');
  await expect(rows(page)).toHaveCount(10);
  await expect(page.locator('.fd-pager-text')).toHaveText('1–10 / 1,284');
  return opened;
}

/** The file chosen with the dialog's own button, as a person picks one. */
async function choose(page: Page, name: string) {
  const chooser = page.waitForEvent('filechooser');
  await dialog(page).getByRole('button', { name: 'Choose a file' }).click();
  await (await chooser).setFiles(join(SAMPLES, name));
}

/** The file dropped on the dialog, as a person drags one from their folder. */
async function drop(page: Page, name: string) {
  const bytes = [...readFileSync(join(SAMPLES, name))];
  await page.locator('.fd-import-drop').evaluate((zone, [file, data]) => {
    const transfer = new DataTransfer();
    transfer.items.add(new File([new Uint8Array(data as number[])], file as string, { type: 'text/csv' }));
    for (const type of ['dragenter', 'dragover', 'drop']) zone.dispatchEvent(new DragEvent(type, { dataTransfer: transfer, bubbles: true, cancelable: true }));
  }, [name, bytes] as const);
}

/** The files of a zip, by name: each inflated where it was squeezed. */
function unzip(bytes: Buffer): Map<string, string> {
  const end = bytes.length - 22;
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

test.describe('a customer’s contacts brought in from a file', () => {
  test('a workbook as Excel writes one: matched, checked, the rows refused named and downloaded, imported, undone', async ({ page }) => {
    const { problems } = await contacts(page);
    await page.getByRole('button', { name: 'Import' }).click();
    await expect(dialog(page)).toBeVisible();
    await expect(dialog(page).getByText('Drop an Excel or CSV file here')).toBeVisible();
    await screen(page, 'lists-import-drop', { viewport: true });
    await choose(page, 'contacts-to-import.xlsx');
    await expect(dialog(page).locator('.fd-import-file')).toHaveText('contacts-to-import.xlsx: 17 rows');
    // Matched by their headers; Full name and Notes left out, and Name, which every record needs, said.
    await expect(goesInto(page, 'E-mail')).toHaveValue('email');
    await expect(goesInto(page, 'Full name')).toHaveValue('');
    await expect(dialog(page).locator('.fd-import-said')).toContainText('Left out: Full name, Notes');
    await expect(dialog(page).locator('.fd-import-said')).toContainText('Name is required, and no column fills it: every row would be refused.');
    await screen(page, 'lists-import-match', { viewport: true });
    await goesInto(page, 'Full name').selectOption({ label: 'Name' });
    await expect(dialog(page).locator('.fd-import-said')).toHaveText('Left out: Notes');
    await dialog(page).getByRole('button', { name: 'Check 17 rows' }).click();
    await expect(dialog(page).locator('.fd-import-ready')).toHaveText('10 rows can be imported.');
    await expect(dialog(page).locator('.fd-import-refused li')).toHaveText([
      'Row 11: Owner: more than one is called “Omar Said”',
      'Row 12: Name is required',
      'Row 13: Status: nothing is called “Prospect”',
      'Row 14: Country: nothing is called “Atlantis”',
      'Row 15: Owner: nothing is called “Mona”',
      'Row 16: Last order: February 2026 has 28 days',
      'Row 17: Newsletter: “maybe” is neither yes nor no',
    ]);
    // The first rows as they will be saved, each value as the page writes it.
    await expect(dialog(page).locator('.fd-import-preview tbody tr').first().locator('td')).toHaveText(['Amira Hassan', 'Delta Foods', 'amira.hassan@deltafoods.example', 'Egypt', 'Customer', 'Sara Haddad', /^14 Sept? 2026$/, 'Yes']);
    await screen(page, 'lists-import-checked', { viewport: true });
    // The rows refused, as a workbook like the one chosen, why in a last column.
    const saving = page.waitForEvent('download');
    await dialog(page).getByRole('button', { name: 'Download the rows to fix' }).click();
    const fix = await saving;
    expect(fix.suggestedFilename()).toBe('contacts-to-import – not imported.xlsx');
    const sheet = unzip(readFileSync(await fix.path())).get('xl/worksheets/sheet1.xml') as string;
    expect(sheet).toContain('Why it was not imported');
    expect(sheet).toContain('Status: nothing is called “Prospect”');
    expect(sheet.match(/<row /g)).toHaveLength(8);
    await dialog(page).getByRole('button', { name: 'Import 10 records' }).click();
    await expect(dialog(page)).toBeHidden();
    await expect(report(page).locator('.fd-list-report-words')).toHaveText('10 of 17 records imported. Not imported:');
    await expect(report(page).locator('li')).toHaveCount(7);
    await expect(page.locator('.fd-pager-text')).toHaveText('1–10 / 1,294');
    await screen(page, 'lists-import-report', { viewport: true });
    // Undone, after a question: the records it made are gone again.
    await report(page).getByRole('button', { name: 'Undo the import' }).click();
    const question = page.getByRole('alertdialog');
    await expect(question).toHaveText(/Delete the 10 records this import made\?/);
    await question.getByRole('button', { name: 'OK' }).click();
    await expect(page.locator('.fd-say')).toContainText('Import undone: 10 records deleted.');
    await expect(page.locator('.fd-pager-text')).toHaveText('1–10 / 1,284');
    await expect(report(page)).toBeHidden();
    expect(problems).toEqual([]);
  });

  test('a CSV file dropped: its semicolons and its UTF-8 guessed, days day first, Arabic names kept', async ({ page }) => {
    const { problems } = await contacts(page);
    await page.getByRole('button', { name: 'Import' }).click();
    await drop(page, 'contacts-to-import.csv');
    await expect(dialog(page).getByRole('combobox', { name: 'Characters' })).toHaveValue('utf-8');
    await expect(dialog(page).getByRole('combobox', { name: 'Values separated by' })).toHaveValue(';');
    await expect(goesInto(page, 'Name')).toHaveValue('name');
    await dialog(page).getByRole('button', { name: 'Check 10 rows' }).click();
    await expect(dialog(page).locator('.fd-import-ready')).toHaveText('6 rows can be imported.');
    await expect(dialog(page).locator('.fd-import-refused li')).toHaveText([
      'Row 8: Status: nothing is called “Customr”',
      'Row 9: Country: nothing is called “Egypte”',
      'Row 10: Last order: months go from 1 to 12',
      'Row 11: Newsletter: “sometimes” is neither yes nor no',
    ]);
    await dialog(page).getByRole('button', { name: 'Import 6 records' }).click();
    await expect(report(page).locator('.fd-list-report-words')).toHaveText('6 of 10 records imported. Not imported:');
    await page.locator('.fd-search-input').fill('سلمى');
    await expect(page.locator('.fd-search-suggestions [role="option"]').first()).toBeVisible();
    await page.locator('.fd-search-input').press('Enter');
    await expect(rows(page)).toHaveCount(1);
    await expect(rows(page).first()).toContainText('فنادق وردة الصحراء');
    await expectNoSidewaysScroll(page);
    expect(problems).toEqual([]);
  });

  test('in Arabic, right to left and dark: the dialog wears the page’s look and says it all in Arabic', async ({ page }) => {
    const { problems } = await open(page, 'plain', 'page=contacts&skin=underline&locale=ar&dir=rtl&scheme=dark');
    await page.getByRole('button', { name: 'استيراد' }).click();
    const dialog = page.getByRole('dialog', { name: 'استيراد إلى Contacts' });
    await expect(dialog).toHaveAttribute('dir', 'rtl');
    const chooser = page.waitForEvent('filechooser');
    await dialog.getByRole('button', { name: 'اختر ملفًا' }).click();
    await (await chooser).setFiles(join(SAMPLES, 'contacts-to-import.xlsx'));
    await dialog.getByRole('combobox', { name: 'Full name: يذهب إلى' }).selectOption({ label: 'Name' });
    await dialog.getByRole('button', { name: 'افحص 17 من الصفوف' }).click();
    await expect(dialog.locator('.fd-import-ready')).toHaveText('يمكن استيراد 10 من الصفوف.');
    await expect(dialog.locator('.fd-import-refused li').first()).toHaveText('الصف 11: Owner: أكثر من واحد باسم «Omar Said»');
    await screen(page, 'lists-import-arabic-dark', { viewport: true });
    expect(problems).toEqual([]);
  });

  test('on a phone: the dialog fills the screen, its columns’ pickers in reach, nothing sideways', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 780 });
    const { problems } = await open(page, 'plain', 'page=contacts&skin=underline');
    await page.getByRole('button', { name: 'Import' }).click();
    await choose(page, 'contacts-to-import.xlsx');
    await expect(goesInto(page, 'Full name')).toBeVisible();
    const box = await dialog(page).boundingBox();
    expect(box?.width).toBeLessThanOrEqual(390);
    await expectNoSidewaysScroll(page);
    await screen(page, 'lists-import-phone', { viewport: true });
    expect(problems).toEqual([]);
  });
});

/** Rows copied as a spreadsheet puts them on the clipboard: from a box of their own, chosen whole and copied with the keys. */
async function copy(page: Page, text: string) {
  await page.evaluate((words) => {
    const sheet = document.createElement('textarea');
    sheet.id = 'e2e-copied';
    sheet.value = words;
    document.body.append(sheet);
    sheet.focus();
    sheet.select();
  }, text);
  await page.keyboard.press('ControlOrMeta+C');
  await page.evaluate(() => document.getElementById('e2e-copied')?.remove());
}

test.describe('rows copied from a spreadsheet, pasted into a table of lines', () => {
  test('fill across and down from the cell, a line added for each row past the last, what did not go in named', async ({ page }) => {
    const { problems } = await open(page, 'plain', 'page=rules&skin=outlined');
    const table = page.locator('[data-node="f-lines"] .fd-lines-table');
    await expect(table.locator('tbody tr')).toHaveCount(1);
    const item = table.locator('tbody tr').first().locator('td[data-column="item"] input');
    // Three rows of item, quantity and price copied from a spreadsheet, then pasted in the cell.
    await copy(page, 'Toner, black\t3\t1,250.00\nStapler\t2\tabc\nPens, box of 12\t١٠\t45\n');
    await item.click();
    await page.keyboard.press('ControlOrMeta+V');
    await expect(table.locator('tbody tr')).toHaveCount(3);
    const values = (row: number, column: string) => table.locator('tbody tr').nth(row).locator(`td[data-column="${column}"] input`);
    await expect(values(0, 'item')).toHaveValue('Toner, black');
    await expect(values(1, 'item')).toHaveValue('Stapler');
    await expect(values(2, 'qty')).toHaveValue('10');
    const note = page.locator('[data-node="f-lines"] .fd-lines-paste-note');
    await expect(note).toHaveText('Pasted into 8 cells. 2 lines added. Not pasted: Unit price, line 2 (Unit price: “⁨abc⁩” is not a number)');
    await expect(note).toHaveAttribute('role', 'status');
    await screen(page, 'lines-paste-block', { viewport: true });
    expect(problems).toEqual([]);
  });

  test('on the grid: a line added for each row past the last, as the plain table does, said in the same note', async ({ page }) => {
    const { problems } = await open(page, 'plain', 'page=order&skin=outlined');
    const grid = page.locator('[data-node="f-lines"]');
    const lines = () => page.evaluate(() => ((window as any).fieldiaDemo.handle.form.getState().values.line_ids ?? []) as { values: Record<string, unknown> }[]);
    await expect(grid.locator('.ag-row[row-index="5"] .ag-cell[col-id="qty"]')).toBeVisible();
    await expect.poll(async () => (await lines()).length).toBe(6);
    // The last line's quantity chosen (clicked, its editor left with Escape), then two rows pasted on it.
    const last = grid.locator('.ag-row[row-index="5"] .ag-cell[col-id="qty"]');
    await copy(page, '7\tabc\n8\t9\n');
    await last.click();
    await page.keyboard.press('Escape');
    await expect(last).toBeFocused();
    await page.keyboard.press('ControlOrMeta+V');
    await expect.poll(async () => (await lines()).map((line) => [line.values['qty'] ?? null, line.values['price'] ?? null]).slice(5)).toEqual([[7, 380], [8, 9]]);
    await expect(grid.locator('.ag-row[row-index="6"] .ag-cell[col-id="qty"]')).toBeVisible();
    await expect(grid.locator('.fd-grid-paste-note')).toHaveText('Pasted into 3 cells. 1 line added. Not pasted: Unit price, line 3 (Unit price: “⁨abc⁩” is not a number)');
    await screen(page, 'grid-paste-lines-added', { viewport: true });
    expect(problems).toEqual([]);
  });
});
