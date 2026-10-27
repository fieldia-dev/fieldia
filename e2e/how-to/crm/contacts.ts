import { readFileSync } from 'node:fs';
import { inflateRawSync } from 'node:zlib';
import { expect } from '../../fixtures';
import type { DemoReplay } from '../hand';
import { download, chips, closePanel } from './support';

/** The files of a workbook (a zip), by name, each inflated where it was squeezed: what a spreadsheet opens. */
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
/** A workbook's first sheet, as its XML. */
const firstSheet = (path: string) => unzip(readFileSync(path)).get('xl/worksheets/sheet1.xml') as string;

/** The contacts demo’s how-to steps, replayed by hand (e2e/how-to.spec.ts). */
export const replay: DemoReplay = {
  timeout: 120_000,
  steps: [
    {
      says: 'Download the sample workbook, press Import and',
      async run(hand) {
        const { page, press, pick, see } = hand;
        const workbook = await download(page, () => hand.follow('the sample workbook'));
        expect(workbook.name).toBe('contacts-to-import.xlsx');
        await closePanel(hand);
        await press(page.getByRole('button', { name: 'Import' }));
        const dialog = page.getByRole('dialog', { name: 'Import into Contacts' });
        await see(dialog.getByText('Drop an Excel or CSV file here')).toBeVisible();
        // The workbook into the box: no hand can drag a file from a folder into the test's browser, so it is chosen
        // with the box's own button — the same file into the same box.
        await pick(dialog.getByRole('button', { name: 'Choose a file' }), workbook.path);
        await see(dialog.locator('.fd-import-file')).toHaveText('contacts-to-import.xlsx: 17 rows');
        await see(dialog.getByRole('combobox', { name: 'E-mail: Goes into' })).toHaveValue('email');
        await see(dialog.getByRole('combobox', { name: 'Full name: Goes into' })).toHaveValue('');
        await see(dialog.locator('.fd-import-said')).toContainText('Left out: Full name, Notes');
      },
    },
    {
      says: 'Pick Name for Full name, then Check 17 rows: 10',
      async run({ page, press, see }) {
        const dialog = page.getByRole('dialog', { name: 'Import into Contacts' });
        // A list of the page's own (a <select>): its option picked as the browser's list picks it.
        await dialog.getByRole('combobox', { name: 'Full name: Goes into' }).selectOption({ label: 'Name' });
        await see(dialog.locator('.fd-import-said')).toHaveText('Left out: Notes');
        await press(dialog.getByRole('button', { name: 'Check 17 rows' }));
        await see(dialog.locator('.fd-import-ready')).toHaveText('10 rows can be imported.');
        await see(dialog.locator('.fd-import-refused li')).toHaveText([
          'Row 11: Owner: more than one is called “Omar Said”',
          'Row 12: Name is required',
          'Row 13: Status: nothing is called “Prospect”',
          'Row 14: Country: nothing is called “Atlantis”',
          'Row 15: Owner: nothing is called “Mona”',
          'Row 16: Last order: February 2026 has 28 days',
          'Row 17: Newsletter: “maybe” is neither yes nor no',
        ]);
      },
    },
    {
      says: 'Press “Download the rows to fix” for a workbook',
      async run({ page, press, see }) {
        const dialog = page.getByRole('dialog', { name: 'Import into Contacts' });
        const fix = await download(page, () => press(dialog.getByRole('button', { name: 'Download the rows to fix' })));
        expect(fix.name).toBe('contacts-to-import – not imported.xlsx');
        const sheet = firstSheet(fix.path);
        // The seven, under a header row, why in a last column.
        expect(sheet.match(/<row /g)).toHaveLength(8);
        expect(sheet).toContain('Why it was not imported');
        expect(sheet).toContain('Status: nothing is called “Prospect”');
        await press(dialog.getByRole('button', { name: 'Import 10 contacts' }));
        await see(dialog).toBeHidden();
        const report = page.locator('.fd-list-report');
        await see(report.locator('.fd-list-report-words')).toHaveText('10 of 17 contacts imported. Not imported:');
        await see(page.locator('.fd-pager-text')).toHaveText('1–10 of 1,294 contacts');
        await press(report.getByRole('button', { name: 'Undo the import' }));
        const question = page.getByRole('alertdialog');
        await see(question).toContainText('Delete the 10 contacts this import made?');
        await press(question.getByRole('button', { name: 'Delete', exact: true }));
        await see(page.locator('.fd-say')).toContainText('Import undone: 10 contacts deleted.');
        await see(page.locator('.fd-pager-text')).toHaveText('1–10 of 1,284 contacts');
        await see(report).toBeHidden();
      },
    },
    {
      says: 'Import the sample CSV file: its semicolons and',
      async run(hand) {
        const { page, press, pick, see } = hand;
        const csv = await download(page, () => hand.follow('the sample CSV file'));
        expect(csv.name).toBe('contacts-to-import.csv');
        await closePanel(hand);
        await press(page.getByRole('button', { name: 'Import' }));
        const dialog = page.getByRole('dialog', { name: 'Import into Contacts' });
        await pick(dialog.getByRole('button', { name: 'Choose a file' }), csv.path);
        await see(dialog.locator('.fd-import-file')).toHaveText('contacts-to-import.csv: 10 rows');
        await see(dialog.getByRole('combobox', { name: 'Characters' })).toHaveValue('utf-8');
        await see(dialog.getByRole('combobox', { name: 'Values separated by' })).toHaveValue(';');
        await see(dialog.getByRole('combobox', { name: 'Name: Goes into' })).toHaveValue('name');
        await press(dialog.getByRole('button', { name: 'Check 10 rows' }));
        await see(dialog.locator('.fd-import-ready')).toHaveText('6 rows can be imported.');
        // The Arabic names as they were written; 22/09/2026 read day first, the 22nd of September.
        const preview = dialog.locator('.fd-import-preview tbody tr');
        await see(preview.nth(0)).toContainText(/Salma Al-Otaibi.*22 Sept? 2026/);
        await see(preview.nth(1)).toContainText('سلمى العتيبي');
        await see(preview.nth(1)).toContainText('فنادق وردة الصحراء');
        await press(dialog.getByRole('button', { name: 'Import 6 contacts' }));
        await see(page.locator('.fd-list-report .fd-list-report-words')).toHaveText('6 of 10 contacts imported. Not imported:');
        await see(page.locator('.fd-pager-text')).toHaveText('1–10 of 1,290 contacts');
      },
    },
    {
      says: 'Tick the box in the header, then press “Select',
      async run({ page, press, see }) {
        await press(page.locator('.fd-list-table thead').getByRole('checkbox', { name: 'Select all' }));
        await see(page.locator('.fd-list-count')).toHaveText('10 selected');
        const every = page.locator('.fd-list-every');
        // Every contact that matches: 1,284, and the six the step before imported.
        await see(every).toHaveText('Select all 1,290 contacts that match');
        await press(every);
        await see(page.locator('.fd-list-count')).toHaveText('1,290 selected');
        await press(page.getByRole('button', { name: 'Next page' }));
        await see(page.locator('.fd-pager-text')).toHaveText('11–20 of 1,290 contacts');
        const boxes = page.locator('.fd-list-table tbody tr.fd-list-row .fd-list-checkbox');
        await see(boxes).toHaveCount(10);
        for (const box of await boxes.all()) await see(box).toBeChecked();
      },
    },
    {
      says: 'Press Export and pick Excel: the workbook has',
      async run({ page, press, see }) {
        await press(page.getByRole('button', { name: 'Export' }));
        const menu = page.getByRole('menu', { name: 'Export' });
        await see(menu).toBeVisible();
        const workbook = await download(page, () => press(menu.getByRole('menuitem', { name: 'Excel (.xlsx)' })));
        expect(workbook.name).toMatch(/^Contacts \d{4}-\d{2}-\d{2}\.xlsx$/);
        await see(page.locator('.fd-say').filter({ hasText: 'contacts exported.' })).toBeVisible();
        const sheet = firstSheet(workbook.path);
        const written = [...sheet.matchAll(/<c r="[A-Z]1" t="inlineStr" s="1"><is><t>([^<]*)<\/t>/g)].map(([, words]) => words);
        expect(written, 'the workbook’s headers: the list’s columns, in its order').toEqual(await page.locator('.fd-list-table thead th[data-col]:visible').allTextContents());
        // Money with its currency, days as days: the cells' formats a spreadsheet reads.
        const styles = unzip(readFileSync(workbook.path)).get('xl/styles.xml') as string;
        for (const format of ['&quot;E£&quot; #,##0.00', 'd mmm yyyy']) expect(styles).toContain(`formatCode="${format}"`);
      },
    },
    {
      says: 'Search for a company, tick a few rows, press',
      async run({ page, phone, press, type, see }) {
        await type(page.getByRole('combobox', { name: 'Search' }), 'Delta Foods');
        await press(page.getByRole('option', { name: 'Search Company for: Delta Foods' }));
        await see(chips(page)).toHaveText(['Company: Delta Foods']);
        await see(page.locator('.fd-pager-text')).toHaveText(/^1–10 of \d+ contacts$/);
        // Three of them not Karim Nasser's, whose contacts only he changes.
        const rows = page.locator('.fd-list-table tbody tr.fd-list-row').filter({ hasNot: page.locator('td[data-col="owner_id"]', { hasText: 'Karim Nasser' }) });
        const names: string[] = [];
        for (const row of (await rows.all()).slice(0, 3)) {
          await press(row.locator('.fd-list-checkbox'));
          names.push((await row.locator('td[data-col="name"]').textContent()) ?? '');
        }
        await see(page.locator('.fd-list-count')).toHaveText('3 selected');
        await press(page.locator('.fd-list-selection').getByRole('button', { name: 'Edit' }));
        const dialog = page.getByRole('dialog', { name: 'Edit 3 contacts' });
        await see(dialog).toBeVisible();
        await dialog.getByLabel('Field').selectOption({ label: 'Owner' });
        await type(dialog.getByRole('combobox', { name: 'Owner' }), 'Sara');
        await press(page.getByRole('option', { name: 'Sara Haddad' }));
        await see(dialog.getByRole('combobox', { name: 'Owner' })).toHaveValue('Sara Haddad');
        await press(dialog.getByRole('button', { name: 'Update' }));
        const question = page.getByRole('alertdialog');
        await see(question).toContainText('Update 3 contacts? Owner becomes “Sara Haddad”.');
        await press(question.getByRole('button', { name: 'Update' }));
        await see(page.locator('.fd-say').filter({ hasText: '3 contacts updated.' })).toBeVisible();
        // Each one's owner, in its Owner column — on a phone, on its card.
        for (const name of names) {
          const row = page.locator('.fd-list-table tbody tr.fd-list-row').filter({ hasText: name });
          await see(phone ? row.locator('.fd-list-card dd').filter({ hasText: /^Sara Haddad$/ }) : row.locator('td[data-col="owner_id"]')).toHaveText('Sara Haddad');
        }
      },
    },
    {
      says: 'Try it with a server that hands over at most',
      async run(hand) {
        const { page, press, see, seePage } = hand;
        await hand.follow('Try it with a server that hands over at most 1,000 at once');
        await seePage().toHaveURL(/allIds=1000/);
        await see(page.locator('.fd-list-table tbody tr.fd-list-row')).toHaveCount(10);
        await closePanel(hand);
        // Every contact there is: 1,284, and the six step 4 imported, kept while the tab is open.
        await see(page.locator('.fd-pager-text')).toHaveText('1–10 of 1,290 contacts');
        await press(page.locator('.fd-list-table thead').getByRole('checkbox', { name: 'Select all' }));
        await press(page.locator('.fd-list-every'));
        await see(page.locator('.fd-list-count')).toHaveText('1,000 of 1,290 could be selected');
      },
    },
    {
      says: 'Press Columns at the header’s end: tick Phone',
      notOnPhone: 'a phone shows each contact as a card: there are no columns, and no Columns button, to shape',
      async run({ page, press, keys, see }) {
        const heads = page.locator('.fd-list-table thead th[data-col]:visible');
        await see(heads).toHaveText(['Name', 'Company', 'Country', 'Status', 'Owner', 'Last order', 'Lifetime value', 'Newsletter']);
        await press(page.getByRole('button', { name: 'Columns' }));
        const menu = page.getByRole('dialog', { name: 'Columns' });
        await see(menu).toBeVisible();
        await press(menu.getByRole('checkbox', { name: 'Phone' }));
        await see(heads).toHaveText(['Name', 'Company', 'Country', 'Status', 'Owner', 'Last order', 'Lifetime value', 'Newsletter', 'Phone']);
        // Up, a press at a time, until it is beside Name.
        for (let i = 0; i < 7; i++) await press(menu.getByRole('button', { name: 'Move Phone up' }));
        await see(heads).toHaveText(['Name', 'Phone', 'Company', 'Country', 'Status', 'Owner', 'Last order', 'Lifetime value', 'Newsletter']);
        await press(menu.getByRole('checkbox', { name: 'Country' }));
        const shaped = ['Name', 'Phone', 'Company', 'Status', 'Owner', 'Last order', 'Lifetime value', 'Newsletter'];
        await see(heads).toHaveText(shaped);
        await keys('Escape');
        await see(menu).toBeHidden();
        await page.reload();
        await see(page.locator('.fd-list-table tbody tr.fd-list-row')).toHaveCount(10);
        await see(heads).toHaveText(shaped);
        await press(page.getByRole('button', { name: 'Columns' }));
        await press(menu.getByRole('button', { name: 'Reset columns' }));
        await see(heads).toHaveText(['Name', 'Company', 'Country', 'Status', 'Owner', 'Last order', 'Lifetime value', 'Newsletter']);
      },
    },
    {
      says: 'Search for a company, then press Print: the',
      async run({ page, press, type, see }) {
        await type(page.getByRole('combobox', { name: 'Search' }), 'Delta Foods');
        await press(page.getByRole('option', { name: 'Search Company for: Delta Foods' }));
        await see(chips(page)).toHaveText(['Company: Delta Foods']);
        const found = ((await page.locator('.fd-pager-text').textContent()) ?? '').replace(/^.* of | contacts$/g, '');
        const shown = await page.locator('.fd-list-table thead th[data-col]').evaluateAll((heads) => heads.filter((head) => getComputedStyle(head).display !== 'none').map((head) => head.textContent));
        // The browser's print dialog stood in for, as e2e/print.spec.ts does: told it is printing, open until the
        // paper has been looked at, then told it is done.
        await page.evaluate(() => (window.print = () => void window.dispatchEvent(new Event('beforeprint'))));
        await press(page.getByRole('button', { name: 'Print' }));
        const sheet = page.locator('.fd-print-sheet');
        await see(sheet).toHaveCount(1);
        await page.emulateMedia({ media: 'print' });
        await see(sheet.locator('thead th')).toHaveText(shown as string[]);
        await see(sheet.locator('.fd-print-about')).toContainText('Company: Delta Foods');
        await see(sheet.locator('.fd-print-about')).toContainText(`${found} contacts`);
        await see(sheet.locator('tbody tr')).toHaveCount(Number(found));
        await see(sheet.locator('tbody td:nth-child(2)').first()).toHaveText('Delta Foods');
        await page.emulateMedia({ media: 'screen' });
        await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
        await see(sheet).toHaveCount(0);
      },
    },
    {
      says: 'Drag the Company header sideways past Status',
      notOnPhone: 'a drag: Playwright’s WebKit has no touch drag, and a phone shows cards, not headers to carry',
      async run({ page, keys, see }) {
        const heads = page.locator('.fd-list-table thead th[data-col]:visible');
        const head = (column: string) => page.locator(`.fd-list-table thead th[data-col="${column}"]`);
        await see(heads).toHaveText(['Name', 'Company', 'Country', 'Status', 'Owner', 'Last order', 'Lifetime value', 'Newsletter']);
        const company = (await head('company').boundingBox())!;
        const status = (await head('state').boundingBox())!;
        const y = company.y + company.height / 2;
        await page.mouse.move(company.x + company.width / 2, y);
        await page.mouse.down();
        await page.mouse.move(status.x + status.width * 0.75, y, { steps: 24 });
        // It follows the hand, and Country and Status slide back to where it began.
        await see(page.locator('.fd-list-ghost')).toHaveText('Company');
        await expect.poll(async () => Math.round((await head('country_id').boundingBox())!.x)).toBe(Math.round(company.x));
        await page.mouse.up();
        const moved = ['Name', 'Country', 'Status', 'Company', 'Owner', 'Last order', 'Lifetime value', 'Newsletter'];
        await see(heads).toHaveText(moved);
        await see(page.locator('.fd-list-ghost')).toHaveCount(0);
        await page.reload();
        await see(page.locator('.fd-list-table tbody tr.fd-list-row')).toHaveCount(10);
        await see(heads).toHaveText(moved);
        // Carried again, past Owner, and Escape before it is let go: back where it was.
        const again = (await head('company').boundingBox())!;
        const owner = (await head('owner_id').boundingBox())!;
        await page.mouse.move(again.x + again.width / 2, again.y + again.height / 2);
        await page.mouse.down();
        await page.mouse.move(owner.x + owner.width * 0.75, again.y + again.height / 2, { steps: 24 });
        await see(page.locator('.fd-list-ghost')).toBeVisible();
        await keys('Escape');
        await see(page.locator('.fd-list-ghost')).toHaveCount(0);
        await page.mouse.up();
        await see(heads).toHaveText(moved);
      },
    },
    {
      says: 'Drag the edge of a header to make its column',
      notOnPhone: 'a drag: Playwright’s WebKit has no touch drag, and a phone shows cards, with no columns to widen',
      async run({ page, drag, see }) {
        const company = page.locator('.fd-list-table thead th[data-col="company"]');
        const before = (await company.boundingBox())!;
        const grip = company.locator('.fd-list-grip');
        const at = (await grip.boundingBox())!;
        await drag(grip, { x: at.x + at.width / 2 + 400, y: at.y + at.height / 2 }, { steps: 24 });
        await expect.poll(async () => Math.round((await company.boundingBox())!.width)).toBeGreaterThan(Math.round(before.width) + 300);
        // Its cells as wide as its header.
        const first = page.locator('.fd-list-table tbody tr.fd-list-row').first();
        await see(first.locator('td[data-col="company"]')).toBeVisible();
        expect(Math.round((await first.locator('td[data-col="company"]').boundingBox())!.width)).toBe(Math.round((await company.boundingBox())!.width));
        // The list scrolled sideways, as a hand on a trackpad or a mouse's wheel with Shift does.
        const scroller = page.locator('.fd-list-scroll');
        const name = first.locator('td[data-col="name"]');
        const nameAt = (await name.boundingBox())!.x;
        const box = (await scroller.boundingBox())!;
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.mouse.wheel(500, 0);
        await expect.poll(() => scroller.evaluate((element) => element.scrollLeft)).toBeGreaterThan(200);
        await see(scroller).toHaveAttribute('data-scrolled', '');
        // The names where they were, in view; each header still over its rows.
        await see(name).toBeInViewport();
        expect(Math.round((await name.boundingBox())!.x)).toBe(Math.round(nameAt));
        const owner = page.locator('.fd-list-table thead th[data-col="owner_id"]');
        expect(Math.round((await owner.boundingBox())!.x)).toBe(Math.round((await first.locator('td[data-col="owner_id"]').boundingBox())!.x));
        expect(Math.round((await page.locator('.fd-list-table thead th[data-col="name"]').boundingBox())!.x)).toBe(Math.round(nameAt));
      },
    },
    {
      says: 'Narrow the window, or open the page on a phone',
      async run({ page, phone, see }) {
        if (!phone) await page.setViewportSize({ width: 390, height: 844 });
        await see(page.locator('.fd-list').first()).toHaveAttribute('data-as', 'cards');
        const card = page.locator('.fd-list-table tbody tr.fd-list-row').first();
        await see(card.locator('.fd-list-card-title')).toBeVisible();
        await see(card.locator('.fd-list-card-photo .fd-list-card-initials, .fd-list-card-photo img').first()).toBeVisible();
        await see(card.locator('.fd-list-card-head .fd-value-badge')).toBeVisible();
        await see(card.locator('td[data-col="company"]')).toBeHidden();
        const withPhone = page.locator('.fd-list-card').filter({ has: page.getByRole('link', { name: /^Call \+/ }) }).first();
        await see(withPhone.getByRole('link', { name: /^Call \+/ })).toHaveAttribute('href', /^tel:\+\d+$/);
        await see(withPhone.getByRole('link', { name: /on WhatsApp$/ })).toHaveAttribute('href', /^https:\/\/wa\.me\/\d+$/);
      },
    },
  ],
};
