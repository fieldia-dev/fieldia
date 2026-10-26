import type { Locator, Page } from '@playwright/test';
import { expect } from '../../fixtures';
import type { DemoReplay, Hand } from '../hand';
import { pdfSheets, squash } from '../../pdf-text';

/** A formatted text's editing area, by its field's layout id; a table's rows as their cells' words, a header cell `#`. */
const textArea = (page: Page, id: string) => page.locator(`[data-node="${id}"]`).locator('.fd-text-area, .fd-richtext').first();
/** The toolbar's Table, of a field: on a phone, in its More menu (the toolbar's narrow row folds it there). */
async function pressTable({ page, phone, press }: Hand, id: string) {
  const toolbar = page.locator(`[data-node="${id}"]`).getByRole('toolbar', { name: 'Formatting' });
  if (phone) {
    await press(toolbar.getByRole('button', { name: 'More' }));
    await press(page.getByRole('menu', { name: 'More' }).getByRole('menuitem', { name: 'Table' }));
  } else await press(toolbar.getByRole('button', { name: 'Table', exact: true }));
}
const tableRows = (table: Locator) =>
  table.evaluate((t: HTMLTableElement) => [...t.rows].map((row) => [...row.cells].map((cell) => `${cell.tagName === 'TH' ? '#' : ''}${cell.textContent?.trim() || '_'}`).join(' | ')));

/** The contract-fees demo's how-to steps, replayed by hand (e2e/how-to.spec.ts). */
export const replay: DemoReplay = {
  timeout: 90_000,
  steps: [
    {
      says: 'Copy a table from Word, Excel or Google Docs — or from the sample price list — and paste it',
      notOnPhone: 'a copy and a paste: a phone’s are a long press’s menu, which Playwright cannot open, and it has no Ctrl+C or Ctrl+V',
      async run({ page, follow, press, keys, see }) {
        await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
        // The sample opens in a tab of its own: its table chosen with the mouse there, and copied.
        const opened = page.context().waitForEvent('page');
        await follow('the sample price list');
        const sample = await opened;
        await sample.waitForLoadState();
        const from = (await sample.getByText('Milestone', { exact: true }).boundingBox())!;
        const to = (await sample.getByRole('cell', { name: '6,960.00' }).boundingBox())!;
        await sample.mouse.move(from.x + 2, from.y + from.height / 2);
        await sample.mouse.down();
        await sample.mouse.move(to.x + to.width - 2, to.y + to.height / 2, { steps: 10 });
        await sample.mouse.up();
        await sample.keyboard.press('Control+c');
        await sample.close();
        await page.bringToFront();
        // Pasted into 5. Payment schedule.
        const box = textArea(page, 'f-payment');
        await press(box);
        await keys('Control+v');
        const table = box.locator('table');
        await see(table).toHaveCount(1);
        await see(table.locator('tr')).toHaveCount(4);
        await see(table.locator('tr').first()).toContainText('Milestone');
        await see(table.locator('tr').last()).toContainText('6,960.00');
        expect((await tableRows(table)).slice(1)).toEqual(['Signing | On signing | 30% | 5,220.00', 'Design approved | Week 4 | 30% | 5,220.00', 'Shop live | Week 10 | 40% | 6,960.00']);
        // In the page's own look: none of the sample's blue header, its fonts or its stripes.
        const head = table.locator('tr').first().locator('th, td').first();
        await see(head).not.toHaveCSS('background-color', 'rgb(11, 92, 173)');
        await see(table.locator('td').first()).not.toHaveCSS('font-family', /Arial/);
        await see(table.locator('tr').nth(2).locator('td').first()).not.toHaveCSS('background-color', 'rgb(238, 243, 249)');
        await see(table.locator('td').first()).toHaveCSS('border-top-style', 'solid');
      },
    },
    {
      says: 'Click a cell in 4. Fees and press Tab: the next cell’s words are selected',
      notOnPhone: 'a phone has no Tab or Escape key to move about a table with',
      async run({ page, press, keys, see }) {
        const fees = textArea(page, 'f-fees');
        const table = fees.locator('table');
        await press(table.getByRole('cell', { name: 'Discovery workshop' }));
        await keys('Tab');
        // The next cell's words, selected: typing would replace them.
        expect(await page.evaluate(() => getSelection()?.toString())).toBe('2');
        await see(table.getByRole('cell', { name: '2', exact: true })).toBeVisible();
        // Tab in the last cell: a row added.
        await see(table.locator('tr')).toHaveCount(5);
        await press(table.getByRole('cell', { name: '17,400.00' }));
        await keys('Tab');
        await see(table.locator('tr')).toHaveCount(6);
        await page.keyboard.type('Domain, a year', { delay: 15 });
        await see(table.locator('tr').last()).toContainText('Domain, a year');
        // Escape leaves the table: what is typed next is on the line after it.
        await keys('Escape');
        await page.keyboard.type(' Prices hold until 31 December.', { delay: 15 });
        await see(fees.locator('table + p')).toContainText('Prices hold until 31 December.');
        await see(table.locator('tr').last()).not.toContainText('Prices hold');
      },
    },
    {
      says: 'With the cursor in the table, press Table in the toolbar: insert a row or a column beside the cell',
      async run(hand) {
        const { page, press, see } = hand;
        const fees = textArea(page, 'f-fees');
        const table = fees.locator('table');
        const menu = page.getByRole('menu', { name: 'Table' });
        const choose = async (cell: string | Locator, what: string) => {
          await press(typeof cell === 'string' ? table.locator('td, th', { hasText: cell }).first() : cell);
          await pressTable(hand, 'f-fees');
          await see(menu).toBeVisible();
          await press(menu.getByRole(what === 'Header row' ? 'menuitemcheckbox' : 'menuitem', { name: what }));
        };
        const rows = (await tableRows(table)).length;
        await choose('Discovery workshop', 'Insert row below');
        await see(page.locator('[data-node="f-fees"] .fd-text-say')).toHaveText('Row added.');
        await see(table.locator('tr')).toHaveCount(rows + 1);
        expect((await tableRows(table))[2]).toBe('_ | _ | _ | _');
        await choose('Qty', 'Insert column right');
        expect((await tableRows(table))[0]).toBe('#Service | #Qty | #_ | #Unit price | #Amount');
        await see(table.locator('tr').first().locator('th')).toHaveCount(5);
        // The column just added, by its header cell, deleted again.
        await choose(table.locator('tr').first().locator('th').nth(2), 'Delete column');
        await see(table.locator('tr').first().locator('th')).toHaveCount(4);
        expect((await tableRows(table))[0]).toBe('#Service | #Qty | #Unit price | #Amount');
        await choose('Hosting and care, a year', 'Delete row');
        await see(table.locator('tr')).toHaveCount(rows);
        await see(table.getByRole('cell', { name: 'Hosting and care, a year' })).toHaveCount(0);
        await choose('Service', 'Header row');
        await see(table.locator('th')).toHaveCount(0);
        expect((await tableRows(table))[0]).toBe('Service | Qty | Unit price | Amount');
      },
    },
    {
      says: 'Press Ctrl+Z (⌘Z on a Mac): the last change to the table is taken back, as any typing is',
      notOnPhone: 'a phone has no Ctrl+Z',
      async run({ page, keys, see }) {
        const table = textArea(page, 'f-fees').locator('table');
        await keys('Control+z');
        await see(table.locator('tr').first().locator('th')).toHaveCount(4);
        expect((await tableRows(table))[0]).toBe('#Service | #Qty | #Unit price | #Amount');
      },
    },
    {
      says: 'With the cursor outside a table, press Table and pick 3 rows by 4 columns on its grid',
      async run(hand) {
        const { page, press, see } = hand;
        const fees = textArea(page, 'f-fees');
        await see(fees.locator('table')).toHaveCount(1);
        // In the words before the fees' table.
        await press(fees.locator('p').first());
        await pressTable(hand, 'f-fees');
        const picker = page.getByRole('menu', { name: 'Insert a table' });
        await see(picker).toBeVisible();
        await press(picker.getByRole('menuitem', { name: '3 rows by 4 columns' }));
        await see(fees.locator('table')).toHaveCount(2);
        const made = fees.locator('table').filter({ hasNotText: 'Discovery workshop' });
        expect(await tableRows(made)).toEqual(['#_ | #_ | #_ | #_', '_ | _ | _ | _', '_ | _ | _ | _']);
        // The cursor in its first cell: what is typed lands there.
        await page.keyboard.type('Milestone', { delay: 15 });
        await see(made.locator('th').first()).toHaveText('Milestone');
      },
    },
    {
      says: 'Press Ctrl+P (⌘P on a Mac) to print: the agreement on paper, under the studio’s name',
      notOnPhone: 'a phone has no Ctrl+P: its browser prints from its own share sheet, which a test cannot press',
      async run({ page, keys, see }) {
        await keys('Control+p');
        // The page as the browser's print lays it out (its preview): the agreement alone, the demo's frame left out,
        // the studio's name over it; then the sheets it prints.
        await page.emulateMedia({ media: 'print' });
        await see(page.locator('#demo-head')).toBeHidden();
        await see(page.locator('.fd-print-head')).toContainText('Nile Digital Studio');
        await see(textArea(page, 'f-fees').locator('table').first()).toBeVisible();
        const sheets = pdfSheets(await page.pdf({ format: 'A4', margin: { top: '12mm', bottom: '12mm', left: '12mm', right: '12mm' } }));
        await page.emulateMedia({ media: 'screen' });
        const lines = sheets.map((sheet) => sheet.lines.map((line) => squash(line.text)));
        const on = (words: string) => lines.flatMap((sheet, at) => (sheet.some((line) => line.includes(squash(words))) ? [at] : []));
        // Each table whole on one sheet: the fees' first row and its total; the schedule pasted in step 1, its first and last.
        expect(new Set([...on('Discovery workshop'), ...on('17,400.00')]).size).toBe(1);
        expect(new Set([...on('SigningOn signing'), ...on('Shop liveWeek 10')]).size).toBe(1);
        expect(on('Service agreement SA-2026-014 between Nile Digital Studio and Nile Traders.').length).toBeGreaterThan(0);
        await see(page.locator('#demo-head')).toBeVisible();
      },
    },
  ],
};
