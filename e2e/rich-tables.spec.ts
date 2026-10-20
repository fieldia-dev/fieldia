import { type Locator, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { expect, test } from './fixtures';
import { axeFindings } from './a11y-support';
import { chromiumSheets, firefoxSheets } from './print-support';
import { squash } from './pdf-text';
import { expectNoSidewaysScroll, node, open, screen } from './support';

/**
 * Tables inside formatted text, on the service agreement (examples/pages/contract-fees.page.json): a table pasted
 * from Word, Excel, Google Docs or Google Sheets — their clipboard's own HTML (libs/widgets/src/lib/fixtures/clipboard)
 * — kept as a plain table in the field's look, in the work item's editor and in the classic one, and text from Word or
 * Docs with its heading, marks, link and lists, its fonts and colours left behind; the table tool's
 * picker, its menu of what to do where the cursor is, Tab from cell to cell and Escape out, the browser's Undo of a
 * change; right to left; and on paper, each table whole, its header row again on a new sheet, nothing cut.
 */

const QUERY = 'page=contract-fees&skin=underline';
const CLIPBOARD = 'libs/widgets/src/lib/fixtures/clipboard';
const fixture = (name: string) => readFileSync(`${CLIPBOARD}/${name}.html`, 'utf8');

const value = (page: Page, field: string) =>
  page.evaluate((field) => (window as unknown as { fieldiaDemo: { handle: { form: { getState(): { values: Record<string, unknown> } } } } }).fieldiaDemo.handle.form.getState().values[field] as string | null, field);
const area = (page: Page, id: string) => node(page, id).locator('.fd-text-area, .fd-richtext').first();

/**
 * A paste as the browser hands one to the page: the clipboard's HTML (and its words), where the cursor is. Its data
 * as the event's own, read as a page reads a real paste's: Firefox gives a page's own paste event no data to read.
 */
async function paste(box: Locator, html: string) {
  await box.evaluate((el, html) => {
    const event = new ClipboardEvent('paste', { bubbles: true, cancelable: true });
    const data = { 'text/html': html, 'text/plain': 'pasted' } as Record<string, string>;
    Object.defineProperty(event, 'clipboardData', { value: { types: Object.keys(data), files: [], getData: (type: string) => data[type] ?? '' } });
    el.dispatchEvent(event);
  }, html);
}

/** A table's rows as their cells' words, a cell at its line's end marked `>` ("1,500.00>"), a header cell `#`. */
const rows = (table: Locator) =>
  table.evaluate((t: HTMLTableElement) =>
    [...t.rows].map((row) => [...row.cells].map((cell) => `${cell.tagName === 'TH' ? '#' : ''}${cell.textContent?.trim() || '_'}${getComputedStyle(cell).textAlign === 'right' ? '>' : ''}${cell.colSpan > 1 ? `:${cell.colSpan}` : ''}`).join(' | '))
  );

const PRICES = [
  'Service | Qty> | Unit price> | Amount>',
  'Discovery workshop | 2> | 1,500.00> | 3,000.00>',
  'Site build, three languages | 1> | 12,000.00> | 12,000.00>',
];

test.describe('a table pasted into a formatted text', () => {
  for (const [name, app, total] of [
    ['word-table', 'Word', 'Total>:3 | 15,000.00>'],
    ['excel-table', 'Excel', 'Total | _ | _ | 15,000.00>'],
    ['google-docs-table', 'Google Docs', 'Total>:3 | 15,000.00>'],
    ['google-sheets-table', 'Google Sheets', 'Total | _ | _ | 15,000.00>'],
  ] as const) {
    test(`from ${app}: a plain table in the field’s look, kept as it is saved`, async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 900 });
      const { problems } = await open(page, 'plain', QUERY);
      const box = area(page, 'f-payment');
      await box.click();
      await paste(box, fixture(name));
      const table = box.locator('table');
      await expect(table).toHaveCount(1);
      expect(await rows(table)).toEqual([...PRICES, total]);
      // Stored plain: no widths, columns' sizes, borders, fonts or classes — only a cell's alignment and its span.
      const stored = (await value(page, 'payment')) ?? '';
      expect(stored).toMatch(/<table( dir="ltr")?><tbody>/);
      expect(stored).not.toMatch(/colgroup|<col\b|width|class=|border|font-family|mso-|data-sheets|<span|<o:p|<style/i);
      expect(stored.match(/style="[^"]*"/g)?.every((style) => /^style="text-align: (right|left);"$/.test(style))).toBe(true);
      // Drawn in the field's own look: its edges the page's strong border, a header's ground none of Word's.
      const cell = table.locator('td').first();
      expect(await cell.evaluate((el) => [getComputedStyle(el).borderTopStyle, getComputedStyle(el).borderTopWidth])).toEqual(['solid', '1px']);
      await expectNoSidewaysScroll(page);
      await screen(page, `rich-tables-pasted-${name}`);
      // Saved and shown again, it is the same table.
      await page.getByRole('button', { name: 'Save' }).first().click();
      await expect.poll(() => value(page, 'payment')).toBe(stored);
      expect(problems).toEqual([]);
    });
  }

  for (const [name, app] of [
    ['word-text', 'Word'],
    ['google-docs-text', 'Google Docs'],
  ] as const) {
    for (const [field, editor] of [
      ['f-payment', 'the work item’s editor'],
      ['f-scope', 'the classic editor'],
    ] as const) {
      test(`text from ${app} into ${editor}: its heading, marks, link and lists kept, its fonts and colours left behind`, async ({ page }) => {
        const { problems } = await open(page, 'plain', QUERY);
        const box = area(page, field);
        await box.click();
        await box.press('ControlOrMeta+End');
        await paste(box, fixture(name));
        await expect(box.locator('h2')).toHaveText('Payment terms');
        // Lists again, nested as the source has them; the numbered one numbered.
        expect(await box.locator(':scope > ul > li').evaluateAll((items) => items.map((li) => li.firstChild?.textContent))).toEqual(['Design', 'Build']);
        await expect(box.locator(':scope > ul > li > ul > li')).toHaveText(['Brand guide']);
        await expect(box.locator(':scope > ol > li')).toHaveText(['Sign', 'Pay the first part']);
        await expect(box.locator('b')).toHaveText(['within 30 days']);
        await expect(box.locator('i')).toHaveText(['late payment']);
        await expect(box.getByRole('link', { name: 'the full terms' })).toHaveAttribute('href', 'https://nile.example/terms');
        // The link in the page's own link colour, underlined once by the page; the last line centred.
        expect(await box.locator('a u').count()).toBe(0);
        expect(await box.locator('p', { hasText: 'Thank you' }).evaluate((el) => getComputedStyle(el).textAlign)).toBe('center');
        const stored = (await value(page, field === 'f-scope' ? 'scope' : 'payment')) ?? '';
        expect(stored).toContain('<h2>Payment terms</h2><p>The Client pays <b>within 30 days</b>; a <i>late payment</i> adds 2% a month.');
        expect(stored).not.toMatch(/font|color|background|mso-|class=|<span|<o:p|lang=|Georgia|Arial|·/i);
        await screen(page, `rich-tables-text-${name}-${field}`);
        expect(problems).toEqual([]);
      });
    }
  }

  test('the classic editor on a page that had no need of the text part: it comes as one pastes, and puts the words in', async ({ page }) => {
    const { problems } = await open(page, 'plain', 'page=fields&skin=outlined');
    const parts = () => page.evaluate(() => performance.getEntriesByType('resource').filter((entry) => /text-part/.test(entry.name)).length);
    expect(await parts(), 'the text part before the paste').toBe(0);
    const box = node(page, 'f-brief').locator('.fd-richtext');
    // Pasted over the brief's words, all of them chosen.
    await box.click();
    await page.keyboard.press('ControlOrMeta+a');
    const waited = await box.evaluate(async (el, html) => {
      const event = new ClipboardEvent('paste', { bubbles: true, cancelable: true });
      Object.defineProperty(event, 'clipboardData', { value: { types: ['text/html'], files: [], getData: (type: string) => (type === 'text/html' ? html : '') } });
      const from = performance.now();
      el.dispatchEvent(event);
      while (!el.querySelector('h2')) await new Promise((done) => setTimeout(done, 5));
      return performance.now() - from;
    }, fixture('word-text'));
    expect(await parts(), 'the text part as the paste came').toBe(1);
    // As long as the part took to come, measured: said in the report, held well under a second here.
    test.info().annotations.push({ type: 'first paste waited', description: `${Math.round(waited)} ms` });
    expect(waited).toBeLessThan(1000);
    await expect(box.locator(':scope > ul > li > ul > li')).toHaveText(['Brand guide']);
    expect(problems).toEqual([]);
  });

  test('into the classic editor too, made plain by the text part as it is pasted', async ({ page }) => {
    const { problems } = await open(page, 'plain', QUERY);
    const box = area(page, 'f-scope');
    await expect(box).toHaveClass(/fd-richtext/);
    await box.click();
    await box.press('ControlOrMeta+End');
    await paste(box, fixture('google-docs-table'));
    await expect(box.locator('table')).toHaveCount(1);
    expect(await rows(box.locator('table'))).toEqual([...PRICES, 'Total>:3 | 15,000.00>']);
    await expect.poll(() => value(page, 'scope')).toMatch(/^<p>Nile Digital Studio designs[\s\S]*<table><tbody><tr><td><b>Service<\/b><\/td>/);
    expect(await value(page, 'scope')).not.toMatch(/docs-internal|font-weight|color|<span|<div/);
    expect(problems).toEqual([]);
  });

  test('runs nothing it carries: no script, no event, no link to script', async ({ page }) => {
    const { problems } = await open(page, 'plain', QUERY);
    const dialogs: string[] = [];
    page.on('dialog', (dialog) => {
      dialogs.push(dialog.message());
      void dialog.dismiss();
    });
    const box = area(page, 'f-payment');
    await box.click();
    await paste(box, '<table onmouseover="alert(1)"><tr><td style="background:url(javascript:alert(2))" onclick="alert(3)">a<img src="x" onerror="alert(4)"><script>alert(5)</script></td><td><a href="javascript:alert(6)">b</a><svg onload="alert(7)"></svg></td></tr></table>');
    await expect(box.locator('table')).toHaveCount(1);
    await box.locator('td').first().hover();
    await box.locator('td').first().click();
    expect(await value(page, 'payment')).toBe('<table><tbody><tr><td>a</td><td><a>b</a></td></tr></tbody></table>');
    expect(dialogs).toEqual([]);
    expect(problems).toEqual([]);
  });

  test('a real paste, Ctrl+V from the clipboard, takes the same way', async ({ page, browserName, context }) => {
    test.skip(browserName !== 'chromium', 'the clipboard is written for the test where the browser lets a page write HTML to it');
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await open(page, 'plain', QUERY);
    await page.evaluate(async (html) => navigator.clipboard.write([new ClipboardItem({ 'text/html': new Blob([html], { type: 'text/html' }), 'text/plain': new Blob(['Service'], { type: 'text/plain' }) })]), fixture('excel-table'));
    const box = area(page, 'f-payment');
    await box.click();
    await page.keyboard.press('ControlOrMeta+v');
    await expect(box.locator('table')).toHaveCount(1);
    expect(await rows(box.locator('table'))).toEqual([...PRICES, 'Total | _ | _ | 15,000.00>']);
  });
});

test.describe('copied from a Fieldia editor and pasted back', () => {
  /** The words' look where they stand in a box: their colour and size, and the highlight behind them. */
  const look = (box: Locator, words: string) =>
    box.evaluate((el, words) => {
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      let node = walker.nextNode();
      while (node && !node.textContent?.includes(words)) node = walker.nextNode();
      if (!node?.parentElement) return null;
      const style = getComputedStyle(node.parentElement);
      let ground = 'none';
      for (let at: Element | null = node.parentElement; at && at !== el; at = at.parentElement) {
        const behind = getComputedStyle(at).backgroundColor;
        if (behind !== 'rgba(0, 0, 0, 0)' && behind !== 'transparent') {
          ground = behind;
          break;
        }
      }
      return [style.color, ground, style.fontSize];
    }, words);
  const RED_ON_YELLOW_20 = ['rgb(209, 52, 56)', 'rgb(255, 255, 0)', '20px'];

  /** "650.00" in the fees' last line, made red, highlighted yellow and 20px with the toolbar, and left selected. */
  async function marked(page: Page) {
    const fees = area(page, 'f-fees');
    const choose = async () =>
      fees.evaluate((el) => {
        const words = [...el.querySelectorAll('p')].at(-1)!;
        const walker = document.createTreeWalker(words, NodeFilter.SHOW_TEXT);
        let node = walker.nextNode();
        while (node && !node.textContent?.includes('650.00')) node = walker.nextNode();
        const at = node!.textContent!.indexOf('650.00');
        const range = document.createRange();
        range.setStart(node!, at);
        range.setEnd(node!, at + 6);
        getSelection()?.removeAllRanges();
        getSelection()?.addRange(range);
      });
    await fees.click();
    for (const [tool, choice] of [
      ['Text colour', 'Red'],
      ['Highlight', 'Yellow'],
      ['Text size', '20px'],
    ]) {
      await choose();
      await node(page, 'f-fees').getByRole('button', { name: tool, exact: true }).click();
      await page.getByRole('menu', { name: tool }).getByRole('menuitem', { name: choice }).click();
    }
    expect(await look(fees, '650.00')).toEqual(RED_ON_YELLOW_20);
    await choose();
    return fees;
  }

  test('Ctrl+C and Ctrl+V: its colour, highlight and size kept, here, in another editor and in the classic one', async ({ page, browserName, context }) => {
    test.skip(browserName !== 'chromium', 'the browser’s own clipboard, as a person copies; the other engines by the event’s data, below');
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.setViewportSize({ width: 1280, height: 900 });
    const { problems } = await open(page, 'plain', QUERY);
    const fees = await marked(page);
    await page.keyboard.press('ControlOrMeta+c');
    // Here, at the end of the text.
    await page.keyboard.press('ControlOrMeta+End');
    await page.keyboard.type(' Late: ');
    await page.keyboard.press('ControlOrMeta+v');
    await expect(fees.locator('p').last()).toContainText('Late: 650.00');
    expect(await look(fees.locator('p').last(), 'Late: ')).not.toEqual(RED_ON_YELLOW_20);
    expect(await fees.locator('p').last().evaluate((p) => [...p.querySelectorAll('span')].filter((span) => span.textContent === '650.00').length)).toBeGreaterThan(1);
    // In another editor, and in the classic one.
    for (const [id, field] of [
      ['f-payment', 'payment'],
      ['f-scope', 'scope'],
    ] as const) {
      const box = area(page, id);
      await box.click();
      await page.keyboard.press('ControlOrMeta+End');
      await page.keyboard.press('ControlOrMeta+v');
      await expect(box).toContainText('650.00');
      expect(await look(box, '650.00'), id).toEqual(RED_ON_YELLOW_20);
      await expect.poll(() => value(page, field)).toMatch(/color: rgb\(209, 52, 56\)[\s\S]*650\.00/);
    }
    await screen(page, 'rich-tables-own-copy');
    expect(problems).toEqual([]);
  });

  test('what the editor puts on the clipboard, pasted in another editor and the classic one, keeps its own look', async ({ page }) => {
    const { problems } = await open(page, 'plain', QUERY);
    await page.setViewportSize({ width: 1280, height: 900 });
    const fees = await marked(page);
    // The copy as the browser asks the page for it, its data kept as the clipboard keeps it.
    const copied = await fees.evaluate((el) => {
      const data: Record<string, string> = {};
      const event = new ClipboardEvent('copy', { bubbles: true, cancelable: true });
      Object.defineProperty(event, 'clipboardData', { value: { types: [], files: [], setData: (type: string, words: string) => (data[type] = words), getData: (type: string) => data[type] ?? '' } });
      el.dispatchEvent(event);
      return { data, prevented: event.defaultPrevented };
    });
    expect(copied.prevented).toBe(true);
    expect(copied.data['text/plain']).toBe('650.00');
    expect(copied.data['text/html']).toMatch(/^<div data-fieldia-copy="">/);
    for (const id of ['f-payment', 'f-scope']) {
      const box = area(page, id);
      await box.click();
      await box.press('ControlOrMeta+End');
      await paste(box, copied.data['text/html']);
      await expect(box).toContainText('650.00');
      expect(await look(box, '650.00'), id).toEqual(RED_ON_YELLOW_20);
    }
    // The same words from Word, or anywhere else, come in the field's own look: at the start of the fees' plain text.
    await fees.click();
    await fees.press('ControlOrMeta+Home');
    await paste(fees, copied.data['text/html'].replace(' data-fieldia-copy=""', ''));
    await expect(fees).toHaveText(/^\s*650\.00\s*The Client pays/);
    const [colour, ground, size] = (await look(fees, '650.00')) ?? [];
    expect([colour === RED_ON_YELLOW_20[0], ground, size === '20px']).toEqual([false, 'none', false]);
    expect(problems).toEqual([]);
  });
});

test.describe('the table tool', () => {
  test('a size picked on its grid with the keys: a table with its header row, the cursor in its first cell', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    const { problems } = await open(page, 'plain', QUERY);
    const box = area(page, 'f-payment');
    await box.click();
    await page.keyboard.type('Paid in three parts:');
    const tool = node(page, 'f-payment').getByRole('button', { name: 'Table', exact: true });
    await tool.click();
    const picker = page.getByRole('menu', { name: 'Insert a table' });
    await expect(picker).toBeVisible();
    await expect(picker.getByRole('menuitem')).toHaveCount(64);
    await expect(picker.getByRole('menuitem', { name: '1 row by 1 column' })).toBeFocused();
    for (const key of ['ArrowDown', 'ArrowDown', 'ArrowRight', 'ArrowRight', 'ArrowRight']) await page.keyboard.press(key);
    await expect(picker.getByRole('menuitem', { name: '3 rows by 4 columns' })).toBeFocused();
    await expect(picker.locator('.fd-table-pick-size')).toHaveText('3 rows by 4 columns');
    await expect(picker.locator('.fd-on')).toHaveCount(12);
    await screen(page, 'rich-tables-picker', { viewport: true });
    expect(await axeFindings(page, 'the picker open')).toEqual([]);
    await page.keyboard.press('Enter');
    const table = box.locator('table');
    await expect(table).toHaveCount(1);
    expect(await rows(table)).toEqual(['#_ | #_ | #_ | #_', '_ | _ | _ | _', '_ | _ | _ | _']);
    // Said once how to go on and get out, kept while typed on; typed into from its first cell, Tab across.
    const said = node(page, 'f-payment').locator('.fd-text-say');
    await expect(said).toHaveText('In a table, Tab goes to the next cell and Escape leaves the table.');
    await page.keyboard.type('Milestone');
    await expect(said).toHaveText('In a table, Tab goes to the next cell and Escape leaves the table.');
    for (const words of ['Due', 'Share', 'Amount', 'Signing', 'On signing', '30%', '5,220.00']) {
      await page.keyboard.press('Tab');
      await page.keyboard.type(words);
    }
    expect(await rows(table)).toEqual(['#Milestone | #Due | #Share | #Amount', 'Signing | On signing | 30% | 5,220.00', '_ | _ | _ | _']);
    await expect.poll(() => value(page, 'payment')).toContain('<th>Milestone</th><th>Due</th>');
    await screen(page, 'rich-tables-typed');
    expect(problems).toEqual([]);
  });

  test('Tab past the last cell adds a row; Shift+Tab goes back; Escape leaves the table, and Tab then the box', async ({ page }) => {
    const { problems } = await open(page, 'plain', QUERY);
    const fees = area(page, 'f-fees');
    const table = fees.locator('table');
    await table.locator('td', { hasText: '17,400.00' }).click();
    await page.keyboard.press('Tab');
    expect(await rows(table)).toHaveLength(6);
    await page.keyboard.type('Domain, a year');
    await page.keyboard.press('Tab');
    await page.keyboard.type('1');
    await page.keyboard.press('Shift+Tab');
    // Its words selected, as Tab and Shift+Tab select them: typing replaces them.
    await page.keyboard.type('Domain and mail, a year');
    expect((await rows(table))[5]).toBe('Domain and mail, a year | 1 | _ | _');
    await page.keyboard.press('Escape');
    // Out of the table: the line after it.
    await page.keyboard.type(' Prices hold until 31 December.');
    await expect(fees.locator('table + p')).toContainText('Prices hold until 31 December.');
    await page.keyboard.press('Tab');
    await expect(fees).not.toBeFocused();
    await expect.poll(() => value(page, 'fees')).toContain('<td>Domain and mail, a year</td><td>1</td>');
    expect(problems).toEqual([]);
  });

  test('its menu where the cursor is: rows and columns added and taken away, the header row off and on, Undo', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    const { problems } = await open(page, 'plain', QUERY);
    const fees = area(page, 'f-fees');
    const table = fees.locator('table');
    const tool = node(page, 'f-fees').getByRole('button', { name: 'Table', exact: true });
    const choose = async (cell: string, what: string) => {
      await table.locator('td, th', { hasText: cell }).first().click();
      await tool.click();
      await page.getByRole('menu', { name: 'Table' }).getByRole(what === 'Header row' ? 'menuitemcheckbox' : 'menuitem', { name: what }).click();
    };
    await table.locator('td', { hasText: 'Discovery workshop' }).click();
    await tool.click();
    const menu = page.getByRole('menu', { name: 'Table' });
    await expect(menu.getByRole('menuitem')).toHaveText(['Insert row above', 'Insert row below', 'Insert column left', 'Insert column right', 'Delete row', 'Delete column', 'Delete table']);
    await expect(menu.getByRole('menuitemcheckbox', { name: 'Header row' })).toHaveAttribute('aria-checked', 'true');
    await screen(page, 'rich-tables-menu', { viewport: true });
    expect(await axeFindings(page, 'the table menu open')).toEqual([]);
    await page.keyboard.press('Escape');

    await choose('Discovery workshop', 'Insert row above');
    await expect(node(page, 'f-fees').locator('.fd-text-say')).toHaveText('Row added.');
    expect((await rows(table))[1]).toBe('_ | _ | _ | _');
    await page.keyboard.type('Brand guide');
    await choose('Qty', 'Insert column right');
    expect((await rows(table))[0]).toBe('#Service | #Qty> | #_ | #Unit price> | #Amount>');
    // The total's cell across three columns, wider by the one added in it.
    expect((await rows(table)).at(-1)).toBe('Total>:4 | 17,400.00>');
    await choose('Qty', 'Delete column');
    expect((await rows(table))[0]).toBe('#Service | #_ | #Unit price> | #Amount>');
    await choose('Hosting and care, a year', 'Delete row');
    expect(await rows(table)).toHaveLength(5);
    await choose('Service', 'Header row');
    expect((await rows(table))[0]).toBe('Service | _ | Unit price> | Amount>');
    await expect.poll(() => value(page, 'fees')).not.toContain('<thead>');
    // The browser's own Undo takes back the last change, as any typing.
    await page.keyboard.press('ControlOrMeta+z');
    await expect.poll(async () => (await rows(table))[0]).toBe('#Service | #_ | #Unit price> | #Amount>');
    await expect.poll(() => value(page, 'fees')).toContain('<thead>');
    await choose('Brand guide', 'Delete table');
    await expect(table).toHaveCount(0);
    await expect(node(page, 'f-fees').locator('.fd-text-say')).toHaveText('Table deleted.');
    await page.keyboard.press('ControlOrMeta+z');
    await expect(table).toHaveCount(1);
    expect(problems).toEqual([]);
  });

  test('right to left: the picker mirrored, a column inserted left as the table is drawn, Tab right to left', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    const { problems } = await open(page, 'plain', `${QUERY}&locale=ar&dir=rtl`);
    const fees = area(page, 'f-fees');
    const table = fees.locator('table');
    const tool = node(page, 'f-fees').getByRole('button', { name: 'جدول', exact: true });
    const cell = table.locator('td', { hasText: 'Discovery workshop' });
    await cell.click();
    await tool.click();
    await page.getByRole('menu').getByRole('menuitem', { name: 'إدراج عمود إلى اليسار' }).click();
    // The new column drawn left of the cell: after it, as its words run.
    expect((await rows(table))[1]).toBe('Discovery workshop | _ | 2> | 1,500.00> | 3,000.00>');
    const [first, added] = await Promise.all([cell.boundingBox(), table.locator('tr').nth(1).locator('td').nth(1).boundingBox()]);
    expect(added!.x + added!.width).toBeLessThanOrEqual(first!.x + 1);
    // Tab to the next cell: the one to its left.
    await cell.click();
    await page.keyboard.press('Tab');
    await page.keyboard.type('x');
    expect((await rows(table))[1]).toBe('Discovery workshop | x | 2> | 1,500.00> | 3,000.00>');
    // The picker's arrows mirrored: ← goes on along the row.
    await page.keyboard.press('Escape');
    await tool.click();
    const picker = page.getByRole('menu', { name: 'إدراج جدول' });
    await expect(picker).toBeVisible();
    await page.keyboard.press('ArrowLeft');
    await expect(picker.locator('.fd-table-pick-size')).toHaveText('صف واحد × 2 أعمدة');
    await screen(page, 'rich-tables-rtl', { viewport: true });
    expect(problems).toEqual([]);
  });
});

test.describe('on paper', () => {
  /** The agreement's payment schedule a long table: 40 rows, its header row over them. */
  async function longSchedule(page: Page) {
    await expect(node(page, 'f-payment')).toBeVisible();
    const body = Array.from({ length: 40 }, (_, i) => `<tr><td>Instalment ${i + 1}</td><td>Month ${i + 1}</td><td style="text-align: right;">435.00</td></tr>`).join('');
    await page.evaluate((html) => (window as unknown as { fieldiaDemo: { handle: { form: { setValue(name: string, value: string): void } } } }).fieldiaDemo.handle.form.setValue('payment', html), `<table><thead><tr><th>Instalment</th><th>Due</th><th style="text-align: right;">Amount</th></tr></thead><tbody>${body}</tbody></table>`);
  }

  test('each table whole where it fits, a long one broken between rows, its header row again, nothing cut', async ({ page, browserName, playwright, baseURL }) => {
    test.skip(browserName === 'webkit', 'Safari prints through its own dialog, which a test cannot drive');
    await page.setViewportSize({ width: 1280, height: 900 });
    let sheets;
    if (browserName === 'firefox') [sheets] = await firefoxSheets(playwright, baseURL!, [{ query: QUERY, name: 'firefox-rich-tables-print', before: longSchedule }]);
    else {
      await open(page, 'plain', QUERY);
      await longSchedule(page);
      sheets = await chromiumSheets(page, 'rich-tables-print');
    }
    const lines = sheets.map((sheet) => sheet.lines.map((line) => line.text));
    const all = lines.flat().map(squash);
    // Every cell's words, none cut at the sheet's edge: the fees' widest row whole on its line.
    for (const words of ['Site build, three languages', '12,000.00', 'Hosting and care, a year', '17,400.00']) expect(all.some((line) => line.includes(squash(words))), words).toBe(true);
    expect(sheets.length).toBeGreaterThan(1);
    // The fees' table on one sheet; each instalment on one; the schedule's header row over its rows on each sheet it is on.
    const on = (words: string) => lines.flatMap((sheet, at) => (sheet.some((line) => squash(line).includes(squash(words))) ? [at] : []));
    expect(new Set([...on('Discovery workshop'), ...on('17,400.00')]).size).toBe(1);
    const instalments = Array.from({ length: 40 }, (_, i) => on(`Instalment ${i + 1}Month ${i + 1}`));
    instalments.forEach((at, i) => expect(at, `instalment ${i + 1} on one sheet`).toHaveLength(1));
    const scheduleSheets = [...new Set(instalments.flat())];
    expect(scheduleSheets.length, 'the schedule across two sheets at least').toBeGreaterThan(1);
    for (const at of scheduleSheets) expect(lines[at].some((line) => squash(line).startsWith('instalmentdue')), `the header row on sheet ${at + 1}`).toBe(true);
  });
});
