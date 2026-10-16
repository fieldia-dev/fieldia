import { type Locator, type Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { stubMaps } from './map-support';
import { node, open, screen } from './support';

/**
 * The input rules in tables, lists and the designer (0.21), typed and pasted as
 * a person does: keys one at a time, an Arabic keyboard's keys, an IME's text,
 * a real Ctrl+V of a block copied from a spreadsheet. A grid's first key goes
 * into its cell; a cell left with what does not read shows it, marked, and its
 * column's total waits for it in words; a list's search and filters read
 * Arabic digits and the page's marks; the designer's number settings read them
 * too, and keep what they had when what is typed does not fit, saying why.
 */

// The clipboard is the browser's, one for every page a worker has open: these tests take turns with it.
test.describe.configure({ mode: 'default' });

type Values = Record<string, unknown>;
type Line = { key: string; values: Values };
const lines = (page: Page, field: string) => page.evaluate((name) => (window as any).fieldiaDemo.handle.form.getState().values[name] as Line[], field);
const pairs = async (page: Page) => (await lines(page, 'line_ids')).map((line) => [line.values['qty'] ?? null, line.values['price'] ?? null]);

/** Text put on the clipboard, then pasted with Ctrl+V where the focus is. */
async function paste(page: Page, text: string) {
  await page.evaluate((t) => navigator.clipboard.writeText(t), text);
  await page.keyboard.press('Control+V');
}

/** Keys pressed as an Arabic keyboard sends them: the key's own character, on the key of its Latin digit. */
async function arabicKeys(page: Page, text: string) {
  const cdp = await page.context().newCDPSession(page);
  for (const key of text) {
    await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', key, code: `Digit${key.charCodeAt(0) - 0x0660}`, text: key, unmodifiedText: key });
    await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key, code: `Digit${key.charCodeAt(0) - 0x0660}` });
  }
  await cdp.detach();
}

/**
 * Escape, then a digit straight after it, as fast as a person's fingers can: the page is busy a moment (a loaded
 * laptop, a phone), so both keys wait in its queue together and come one right after the other, with nothing of the
 * page's own run between them.
 */
async function escapeThenDigit(page: Page, digit: string) {
  const cdp = await page.context().newCDPSession(page);
  const code = `Digit${digit}`;
  const keyCode = 48 + Number(digit);
  const busy = page.evaluate(() => {
    const end = performance.now() + 150;
    while (performance.now() < end);
  });
  await Promise.all([
    busy,
    cdp.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 }),
    cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 }),
    cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', key: digit, code, text: digit, unmodifiedText: digit, windowsVirtualKeyCode: keyCode }),
    cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: digit, code, windowsVirtualKeyCode: keyCode }),
  ]);
  await cdp.detach();
}

/** An IME's key (Process), then its words, as a phone's or a Japanese keyboard sends them. */
async function imeText(page: Page, text: string) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: 'Process', code: 'KeyA', windowsVirtualKeyCode: 229, nativeVirtualKeyCode: 229 });
  await cdp.send('Input.insertText', { text });
  await cdp.detach();
}

test.describe('the order grid', () => {
  let problems: string[] = [];
  test.beforeEach(async ({ context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  });
  test.afterEach(() => expect(problems).toEqual([]));

  const grid = (page: Page) => node(page, 'f-lines');
  const cell = (page: Page, row: number, column: string) => grid(page).locator(`.ag-row[row-index="${row}"] .ag-cell[col-id="${column}"]`);
  const editor = (page: Page) => grid(page).locator('.fd-grid-editor input').first();
  /** A cell chosen, not edited: clicked (which opens its editor), then Escape. */
  async function choose(page: Page, row: number, column: string) {
    await cell(page, row, column).click();
    await expect(editor(page)).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(grid(page).locator('.fd-grid-editor')).toHaveCount(0);
    await expect(cell(page, row, column)).toBeFocused();
  }

  for (const [locale, query, refused] of [
    ['en', '', 'Quantity: numbers only'],
    ['ar', '&locale=ar&dir=rtl', 'Quantity: أرقام فقط'],
    ['fr', '&locale=fr', 'Quantity : des nombres uniquement'],
  ] as const) {
    test(`${locale}: the key that opens a cell goes into it, as a spreadsheet's does`, async ({ page }) => {
      ({ problems } = await open(page, 'plain', `page=order&skin=outlined${query}`));
      for (const [typed, value] of [
        ['57', 57],
        ['-3', -3],
        [locale === 'en' ? '.5' : ',5', 0.5],
      ] as const) {
        await choose(page, 1, 'qty');
        await page.keyboard.type(typed);
        await expect(editor(page)).toHaveValue(typed);
        await page.keyboard.press('Enter');
        expect((await pairs(page))[1][0]).toBe(value);
      }
      // An Arabic keyboard's digits, the first of them opening the cell.
      await choose(page, 1, 'qty');
      await arabicKeys(page, '٣٤٥');
      await expect(editor(page)).toHaveValue('٣٤٥');
      await page.keyboard.press('Enter');
      expect((await pairs(page))[1][0]).toBe(345);
      // A letter opening the cell is refused there, said, and the quantity kept.
      await choose(page, 1, 'qty');
      await page.keyboard.type('a');
      await expect(grid(page).locator('.fd-refusal-hint')).toHaveText(refused);
      await expect(editor(page)).toHaveValue(locale === 'fr' ? '345,00' : '345.00');
      await screen(page, `input-tables-first-key-${locale}`, { viewport: true });
      await page.keyboard.press('Escape');
      expect((await pairs(page))[1][0]).toBe(345);
    });
  }

  for (const [locale, query] of [
    ['en', ''],
    ['ar', '&locale=ar&dir=rtl'],
    ['fr', '&locale=fr'],
  ] as const) {
    test(`${locale}: the key typed straight after Escape opens the cell with that key, however fast it comes`, async ({ page }) => {
      ({ problems } = await open(page, 'plain', `page=order&skin=outlined${query}`));
      for (const digit of ['5', '6', '7', '8']) {
        await cell(page, 1, 'qty').click();
        await expect(editor(page)).toBeFocused();
        // At any speed: typed at once, and with the two keys queued together on a busy page.
        if (digit === '5' || digit === '7') {
          await page.keyboard.press('Escape');
          await page.keyboard.type(digit);
        } else await escapeThenDigit(page, digit);
        await expect(editor(page)).toHaveValue(digit);
        await page.keyboard.press('Enter');
        expect({ digit, qty: (await pairs(page))[1][0] }).toEqual({ digit, qty: Number(digit) });
      }
    });
  }

  test('an IME’s words open the cell and go into it', async ({ page }) => {
    ({ problems } = await open(page, 'plain', 'page=order&skin=outlined&locale=ar&dir=rtl'));
    await choose(page, 1, 'qty');
    await imeText(page, '٢٣');
    await expect(editor(page)).toHaveValue('٢٣');
    await page.keyboard.press('Enter');
    expect((await pairs(page))[1][0]).toBe(23);
  });

  for (const [locale, query, waits] of [
    // The Office chair, the first line under the Workstations heading: line 1, as people count lines.
    ['en', '', 'Fix line 1 to see this total'],
    ['ar', '&locale=ar&dir=rtl', 'صحّح السطر 1 ليظهر هذا الإجمالي'],
  ] as const) {
    test(`${locale}: a cell left with what does not read shows it, marked, and its total waits in words — never NaN`, async ({ page }) => {
      ({ problems } = await open(page, 'plain', `page=order&skin=outlined${query}`));
      await choose(page, 1, 'qty');
      await page.keyboard.type('12 34');
      await page.keyboard.press('Enter');
      await expect(cell(page, 1, 'qty')).toHaveText('12 34');
      await expect(cell(page, 1, 'qty')).toHaveClass(/fd-grid-invalid/);
      expect((await pairs(page))[1][0]).toBe(12);
      const total = grid(page).locator('.fd-grid-totals .ag-cell[col-id="qty"] .fd-grid-total');
      await expect(total).toHaveAttribute('title', waits);
      await expect(total.locator('.fd-sr-only')).toHaveText(waits);
      await expect(grid(page)).not.toContainText('NaN');
      await expect(grid(page).locator('.fd-grid-problems')).toBeVisible();
      await screen(page, `input-tables-unread-${locale}`, { viewport: true });
      // Put right, the total adds up again.
      await choose(page, 1, 'qty');
      await page.keyboard.type('5');
      await page.keyboard.press('Enter');
      await expect(total.locator('.fd-sr-only')).toHaveCount(0);
      await expect(cell(page, 1, 'qty')).not.toHaveClass(/fd-grid-invalid/);
    });
  }

  for (const [locale, query, said] of [
    ['en', '', 'Pasted into 4 cells.'],
    ['ar', '&locale=ar&dir=rtl', 'لُصق في 4 من الخلايا.'],
    ['fr', '&locale=fr', 'Collé dans 4 cellules.'],
  ] as const) {
    test(`${locale}: a block copied from a spreadsheet fills across and down, read cell by cell`, async ({ page }) => {
      ({ problems } = await open(page, 'plain', `page=order&skin=outlined${query}`));
      await choose(page, 1, 'qty');
      await paste(page, '3\t100\n4\t200\n');
      await expect.poll(() => pairs(page)).toEqual([[null, null], [3, 100], [4, 200], [null, null], [null, null], [12, 380]]);
      const note = grid(page).locator('.fd-grid-paste-note');
      await expect(note).toHaveText(said);
      await expect(note).toHaveAttribute('role', 'status');
      // What cannot be read, or goes past the last line, is named and left as it was.
      await choose(page, 5, 'qty');
      await paste(page, locale === 'ar' ? '٧\tabc\n٨\t٩' : '7\tabc\n8\t9');
      await expect.poll(async () => (await pairs(page))[5]).toEqual([7, 380]);
      await expect(note).toContainText(locale === 'ar' ? 'لم يُلصق في' : locale === 'fr' ? 'Non collé' : 'Not pasted: Unit price, line 3');
      await screen(page, `input-tables-paste-${locale}`, { viewport: true });
    });
  }
});

test.describe('a plain table’s cells', () => {
  let problems: string[] = [];
  test.afterEach(() => expect(problems).toEqual([]));

  test('a cell’s message is linked to its box and said once, politely, as it is left', async ({ page }) => {
    ({ problems } = await open(page, 'plain', 'page=rules&skin=outlined'));
    const qty = page.locator('.fd-lines-table td input.fd-number-input').first();
    await qty.click();
    await qty.press('Control+A');
    await qty.pressSequentially('12 34');
    await page.keyboard.press('Tab');
    const error = qty.locator('xpath=ancestor::td[1]').locator('.fd-cell-error');
    await expect(error).toHaveText('Digits are grouped in threes, like 1,234,567');
    await expect(error).toHaveAttribute('aria-live', 'polite');
    await expect(qty).toHaveAttribute('aria-describedby', new RegExp(await error.getAttribute('id') as string));
    await expect(qty).toHaveValue('12 34');
  });

  for (const [locale, query, waits] of [
    ['en', '', 'Fix line 1 to see this total'],
    ['ar', '&locale=ar&dir=rtl', 'صحّح السطر 1 ليظهر هذا الإجمالي'],
  ] as const) {
    test(`${locale}: a column’s total waits for a line that does not read`, async ({ page }) => {
      ({ problems } = await open(page, 'plain', `page=fields&skin=outlined${query}`));
      const table = node(page, 'f-milestones');
      if (!(await table.locator('tbody tr').count())) await table.locator('.fd-lines-add').first().click();
      const hours = table.locator('td[data-column="hours"] input').first();
      await hours.click();
      await hours.press('Control+A');
      await hours.pressSequentially(locale === 'ar' ? '١٢ ٣٤' : '12 34');
      await page.keyboard.press('Tab');
      const total = table.locator('tfoot td[data-column="hours"]');
      await expect(total).toHaveAttribute('title', waits);
      await expect(total).not.toContainText(/NaN|0[.,]00/);
      await table.scrollIntoViewIfNeeded();
      await screen(page, `input-tables-lines-total-${locale}`, { viewport: true });
    });
  }
});

test.describe('a list’s search and filters', () => {
  let problems: string[] = [];
  test.afterEach(() => expect(problems).toEqual([]));
  const names = (page: Page) => page.locator('.fd-list-row').evaluateAll((rows) => rows.map((row) => row.querySelectorAll('td')[1]?.textContent?.trim()));

  for (const [locale, query, typed] of [
    ['en', '', '3334400'],
    ['en', '', '٤٤٠٠'],
    ['ar', '&locale=ar&dir=rtl', '+٢٠ ٤٠ ٣٣٣ ٤٤٠٠'],
  ] as const) {
    test(`${locale}: a phone searched as "${typed}" finds it, whatever the spacing`, async ({ page }) => {
      ({ problems } = await open(page, 'plain', `page=customers&skin=underline${query}`));
      const search = page.locator('.fd-search-input');
      await search.click();
      await search.pressSequentially(typed);
      const option = page.locator('.fd-search-suggestions [role=option]').filter({ hasText: /Phone|الهاتف/ });
      await expect(option).toHaveCount(1);
      await option.click();
      await expect.poll(() => names(page)).toEqual(['Delta Foods']);
    });
  }

  for (const [locale, query, typed, chip, wrong] of [
    ['en', '', '٤٠٠٠٠٠', /400,000$/, 'Enter a number'],
    ['ar', '&locale=ar&dir=rtl', '۴۰۰۰۰۰', /400,000$/, 'أدخل رقمًا'],
    ['fr', '&locale=fr', '400 000,5', /400\s000,5$/, 'Saisissez un nombre'],
  ] as const) {
    test(`${locale}: a custom filter reads "${typed}", and says what goes there when it cannot`, async ({ page }) => {
      ({ problems } = await open(page, 'plain', `page=customers&skin=underline${query}`));
      await page.locator('.fd-search-toggle').first().click();
      await page.locator('.fd-search-add').first().click();
      const form = page.locator('.fd-custom-filter:visible');
      await form.locator('select').first().selectOption('credit_limit');
      await form.locator('select').nth(1).selectOption('>');
      const value = form.locator('.fd-custom-filter-value input');
      await expect(value).toHaveAttribute('type', 'text');
      await value.pressSequentially('-');
      await form.locator('.fd-button-primary').click();
      const hint = form.locator('.fd-refusal-hint');
      await expect(hint).toHaveText(wrong);
      await expect(hint).toHaveAttribute('role', 'status');
      await expect(value).toHaveValue('-');
      await screen(page, `input-tables-custom-filter-${locale}`, { viewport: true });
      await value.press('Control+A');
      await value.pressSequentially(typed);
      await form.locator('.fd-button-primary').click();
      await expect(page.locator('.fd-facet .fd-facet-text')).toHaveText(chip);
      await expect.poll(() => names(page)).toEqual(['Delta Foods']);
    });
  }
});

test.describe('the backlog’s filter bar', () => {
  for (const [locale, query, typed] of [
    ['en', '', '٤١٧٢'],
    ['ar', '?locale=ar&dir=rtl', '۴۱۷۲'],
    ['de', '?locale=de', '4.172'],
  ] as const) {
    test(`${locale}: "${typed}" finds work item 4172`, async ({ page }) => {
      const problems: string[] = [];
      page.on('pageerror', (error) => problems.push(error.message));
      await page.goto(`/backlog/${query}`);
      const keyword = page.locator('.fd-filter-keyword');
      await keyword.click();
      await keyword.pressSequentially(typed);
      await keyword.press('Enter');
      await expect(page.locator('.fd-list-row').filter({ hasText: 'Sales reps can see the jobs of other reps' })).toHaveCount(1);
      await expect(page.locator('.fd-list-row')).toHaveCount(1);
      expect(problems).toEqual([]);
    });
  }
});

test.describe('the designer’s number settings', () => {
  const built = (page: Page) => page.evaluate(() => (window as any).fieldiaDesigner.designer.getPage());
  const hintBy = (box: Locator) => box.locator('xpath=following-sibling::*[contains(@class,"fd-refusal-hint")][1]');

  for (const [locale, query, from] of [
    ['en', '', 'From'],
    ['ar', '&locale=ar&dir=rtl', 'من'],
  ] as const) {
    test(`${locale}: a number’s From takes ٥ and a decimal comma, and a letter never removes it`, async ({ page }) => {
      await page.goto(`/designer/?start=survey${query}`);
      await page.locator('.fd-toolbox [data-tool="kind:number"]').click();
      const box = page.getByRole('textbox', { name: from, exact: true }).first();
      await box.click();
      await box.pressSequentially('٥');
      await box.press('Tab');
      // The least of the question just added, the one picked.
      const least = () =>
        page.evaluate(() => {
          const designer = (window as any).fieldiaDesigner.designer;
          const id = designer.getState().selected;
          const find = (nodes: any[]): any => nodes.map((n) => (n.id === id ? n : n.children ? find(n.children) : null)).find(Boolean) ?? null;
          const picked = find(designer.getPage().layout.children);
          return designer.getPage().fields[picked?.field]?.min;
        });
      const min = async () => [await least()];
      await expect.poll(min).toEqual([5]);
      await box.click();
      await box.pressSequentially('abc');
      await expect(hintBy(box)).toBeVisible();
      await screen(page, `input-tables-designer-letter-${locale}`, { viewport: true });
      await box.press('Tab');
      await expect.poll(min).toEqual([5]);
      await box.click();
      await box.press('Control+A');
      await box.pressSequentially('1,5');
      await box.press('Tab');
      await expect.poll(min).toEqual([1.5]);
    });
  }

  for (const [locale, query] of [
    ['en', ''],
    ['ar', '&locale=ar&dir=rtl'],
  ] as const) {
    test(`${locale}: rows on a page read ٢٥, and 600 is refused with its range, 25 kept`, async ({ page }) => {
      await page.goto(`/screen/?start=list${query}`);
      const rows = page.locator('.fd-properties input[aria-label="Rows on a page"], .fd-properties input[aria-label="عدد الصفوف في الصفحة"]').first();
      await rows.click();
      await rows.press('Control+A');
      await rows.pressSequentially('٢٥');
      await rows.press('Tab');
      await expect.poll(async () => (await built(page)).layout.pageSize).toBe(25);
      await rows.click();
      await rows.press('Control+A');
      await rows.pressSequentially('600');
      await rows.press('Tab');
      await expect(rows).toHaveValue('25');
      await expect(hintBy(rows)).toContainText('500');
      expect((await built(page)).layout.pageSize).toBe(25);
      await screen(page, `input-tables-designer-rows-${locale}`, { viewport: true });
    });
  }
});

test.describe('the designer’s maps', () => {
  const built = (page: Page) => page.evaluate(() => (window as any).fieldiaDesigner.designer.getPage());
  /** The maps on the page being built, wherever they sit. */
  const reach = async (page: Page) => {
    const found: { layers: { reachable?: { minutes: number }; label?: string }[] }[] = [];
    const walk = (n: any) => {
      if (!n || typeof n !== 'object') return;
      if (n.type === 'map') found.push(n);
      for (const v of Object.values(n)) walk(v);
    };
    walk((await built(page)).layout);
    return found[0].layers[1];
  };

  for (const [locale, query, minutesName] of [
    ['en', '', 'Minutes'],
    ['ar', '&locale=ar&dir=rtl', 'الدقائق'],
  ] as const) {
    test(`${locale}: a kitchen’s reachable minutes and a layer’s words are typed whole, the box keeping the focus`, async ({ page }) => {
      const problems: string[] = [];
      page.on('pageerror', (error) => problems.push(error.message));
      await stubMaps(page);
      await page.goto(`/screen/?start=kitchen&ride=off${query}`);
      await page.locator('.fd-map-preview.fd-canvas-block').click();
      const near = page.locator('.fd-map-layer:not(.fd-map-fence)').nth(1);
      const minutes = near.getByRole('textbox', { name: minutesName, exact: true });
      await minutes.click();
      await minutes.press('Control+A');
      await minutes.pressSequentially(locale === 'ar' ? '٤٥' : '45');
      await expect(minutes).toBeFocused();
      await minutes.press('Tab');
      await expect.poll(async () => (await reach(page)).reachable?.minutes).toBe(45);
      await minutes.click();
      await minutes.press('Control+A');
      await minutes.pressSequentially('600');
      await minutes.press('Tab');
      await expect(minutes).toHaveValue('45');
      await expect(near.locator('.fd-refusal-hint')).toContainText('120');
      expect((await reach(page)).reachable?.minutes).toBe(45);
      const words = near.locator('input').first();
      await words.click();
      await words.press('Control+A');
      await words.pressSequentially('Delivery zone');
      await expect(words).toBeFocused();
      await expect.poll(async () => (await reach(page)).label).toBe('Delivery zone');
      await near.scrollIntoViewIfNeeded();
      await screen(page, `input-tables-designer-minutes-${locale}`, { viewport: true });
      expect(problems).toEqual([]);
    });
  }

  test('homes: a fit zoom past 22 is refused with its range, never brought into it in silence', async ({ page }) => {
    await stubMaps(page);
    await page.goto('/screen/?start=homes');
    const map = page.locator('[data-part="map"]');
    const zoom = map.getByLabel('Closest it zooms to show the records');
    await zoom.click();
    await zoom.press('Control+A');
    await zoom.pressSequentially('14');
    await zoom.press('Tab');
    await expect.poll(async () => (await built(page)).layout.map.fitZoom).toBe(14);
    await zoom.click();
    await zoom.press('Control+A');
    await zoom.pressSequentially('30');
    await zoom.press('Tab');
    await expect(zoom).toHaveValue('14');
    await expect(map.locator('.fd-refusal-hint')).toHaveText('Closest it zooms to show the records is a whole number from 1 to 22. It stays 14.');
    expect((await built(page)).layout.map.fitZoom).toBe(14);
  });
});

test.describe('the refusal hints’ look', () => {
  for (const [scheme, query] of [
    ['light', ''],
    ['dark', ''],
    ['light', '&locale=ar&dir=rtl'],
    ['dark', '&locale=ar&dir=rtl'],
  ] as const) {
    test(`${scheme}${query ? ', right to left' : ''}: the grid's, the custom filter's and the designer's`, async ({ page, context }) => {
      await context.grantPermissions(['clipboard-read', 'clipboard-write']);
      await page.emulateMedia({ colorScheme: scheme });
      const { problems } = await open(page, 'plain', `page=order&skin=outlined${query}`);
      const grid = node(page, 'f-lines');
      await grid.locator('.ag-row[row-index="1"] .ag-cell[col-id="qty"]').click();
      await page.keyboard.press('Escape');
      await page.keyboard.type('x');
      await expect(grid.locator('.fd-refusal-hint')).toBeVisible();
      await grid.screenshot({ path: `test-results/screens/input-tables-hint-grid-${scheme}${query ? '-rtl' : ''}.png` });
      await page.keyboard.press('Escape');
      await page.evaluate((t) => navigator.clipboard.writeText(t), '3\tabc');
      await grid.locator('.ag-row[row-index="1"] .ag-cell[col-id="qty"]').click();
      await page.keyboard.press('Escape');
      await page.keyboard.press('Control+V');
      await expect(grid.locator('.fd-grid-paste-note')).toBeVisible();
      await grid.screenshot({ path: `test-results/screens/input-tables-hint-paste-${scheme}${query ? '-rtl' : ''}.png` });
      // The custom filter's words, beside its value.
      await page.goto(`/plain/?page=customers&skin=underline${query}`);
      await page.locator('.fd-search-toggle').first().click();
      await page.locator('.fd-search-add').first().click();
      const form = page.locator('.fd-custom-filter:visible');
      await form.locator('select').first().selectOption('credit_limit');
      await form.locator('.fd-custom-filter-value input').pressSequentially('x');
      await expect(form.locator('.fd-refusal-hint')).toBeVisible();
      await form.screenshot({ path: `test-results/screens/input-tables-hint-filter-${scheme}${query ? '-rtl' : ''}.png` });
      // The designer's, under a setting's box.
      await page.goto(`/screen/?start=list${query}`);
      const rows = page.locator('.fd-properties input.fd-input[placeholder="40"]').first();
      await rows.click();
      await rows.press('Control+A');
      await rows.pressSequentially('600');
      await rows.press('Tab');
      await expect(page.locator('.fd-properties .fd-refusal-hint').first()).toBeVisible();
      await page.locator('.fd-properties').screenshot({ path: `test-results/screens/input-tables-hint-designer-${scheme}${query ? '-rtl' : ''}.png` });
      expect(problems).toEqual([]);
    });
  }
});
