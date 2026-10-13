import { type Locator, type Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { node, open, screen } from './support';

/**
 * The input rules (0.21), typed and pasted as a person does — keys pressed one
 * by one, a real Ctrl+V from the clipboard, text inserted as a phone keyboard
 * inserts it, an IME's composition — on the "Every field", "Business",
 * "Order" and "Rules" examples, in English, Arabic right to left with Arabic
 * digits, French and German. A number box never takes a letter and says why
 * under it; it reads every way a number is written; what it cannot read stays,
 * marked, with its reason once the box is left.
 */

// The clipboard is the browser's, one for every page a worker has open: these tests take turns with it.
test.describe.configure({ mode: 'default' });

type Values = Record<string, unknown>;
const values = (page: Page) => page.evaluate(() => (window as any).fieldiaDemo.handle.form.getState().values as Values);
const valueOf = async (page: Page, field: string) => (await values(page))[field];
const setValue = (page: Page, field: string, value: unknown) => page.evaluate(([name, v]) => (window as any).fieldiaDemo.handle.form.setValue(name, v), [field, value] as const);
/** A field's own box: its number box, not the currency picked beside it. */
const boxOf = (page: Page, id: string) => node(page, id).locator('input.fd-number-input').first();
const hintOf = (page: Page, id: string) => node(page, id).locator('.fd-refusal-hint');
const errorOf = (page: Page, id: string) => node(page, id).locator('.fd-error');

/** A box entered as a person enters it, its text all chosen so typing replaces it. */
async function enter(box: Locator) {
  await box.click();
  await box.press('Control+A');
}

/** Text put on the clipboard, then pasted with Ctrl+V. */
async function paste(page: Page, box: Locator, text: string) {
  await page.evaluate((t) => navigator.clipboard.writeText(t), text);
  await box.press('Control+V');
}

/** An IME's composition, committed: edits a page cannot stop before they land. */
async function compose(page: Page, text: string) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.imeSetComposition', { text, selectionStart: text.length, selectionEnd: text.length });
  await cdp.send('Input.insertText', { text });
  await cdp.detach();
}

test.describe('a number box in the viewer', () => {
  let problems: string[] = [];
  test.beforeEach(async ({ context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  });
  test.afterEach(() => expect(problems).toEqual([]));

  for (const [locale, query, said] of [
    ['en', '', 'Workstations: numbers only'],
    ['ar', '&locale=ar&dir=rtl', 'Workstations: أرقام فقط'],
    ['fr', '&locale=fr', 'Workstations : des nombres uniquement'],
    ['de', '&locale=de', 'Workstations: nur Zahlen'],
  ] as const) {
    test(`${locale}: letters typed, pasted or inserted never land, and a hint under the box says why`, async ({ page }) => {
      ({ problems } = await open(page, 'plain', `page=fields&skin=outlined${query}`));
      const seats = boxOf(page, 'f-seats');
      await enter(seats);
      await seats.pressSequentially(locale === 'ar' ? '١٢abc' : '12abc');
      await expect(seats).toHaveValue(locale === 'ar' ? '١٢' : '12');
      expect(await valueOf(page, 'seats')).toBe(12);
      const hint = hintOf(page, 'f-seats');
      await expect(hint).toHaveText(said);
      await expect(hint).toHaveAttribute('role', 'status');
      await expect(seats).toHaveAttribute('aria-describedby', new RegExp(await hint.getAttribute('id') as string));
      await screen(page, `input-rules-hint-${locale}`, { viewport: true });
      // The next key taken lets it go.
      await seats.press('3');
      await expect(hint).toBeHidden();
      for (const text of ['abc', '1e5', '0x1F', '😀']) await page.keyboard.insertText(text);
      await paste(page, seats, '12abc');
      await expect(seats).not.toHaveValue(/[a-z😀]/i);
      expect(typeof (await valueOf(page, 'seats'))).toBe('number');
      // Never a dialog, never a disabled box.
      await expect(page.getByRole('dialog')).toHaveCount(0);
      await expect(seats).toBeEnabled();
    });
  }

  test('an IME’s letters are put back, with the hint; its digits are numbers like any other', async ({ page }) => {
    ({ problems } = await open(page, 'plain', 'page=fields&skin=outlined'));
    const seats = boxOf(page, 'f-seats');
    await enter(seats);
    await seats.pressSequentially('12');
    await compose(page, 'ab');
    await expect(seats).toHaveValue('12');
    await expect(hintOf(page, 'f-seats')).toHaveText('Workstations: numbers only');
    await compose(page, '３');
    await expect(seats).toHaveValue('12３');
    expect(await valueOf(page, 'seats')).toBe(123);
  });

  test('reads a leading plus, the minus sign, fullwidth digits, the Arabic comma and a decimal comma', async ({ page }) => {
    ({ problems } = await open(page, 'plain', 'page=fields&skin=outlined&locale=ar&dir=rtl'));
    const area = boxOf(page, 'f-area');
    for (const [typed, expected] of [
      ['+5', 5],
      ['\u22125', -5],
      ['５', 5],
      ['١،٥', 1.5],
      ['١٢٫٥', 12.5],
      ['1,5', 1.5],
      ['1 234,5', 1234.5],
    ] as const) {
      await enter(area);
      await page.keyboard.insertText(typed);
      await expect(area).toHaveValue(typed);
      expect(await valueOf(page, 'area')).toBe(expected);
    }
  });

  test('ar: a negative number is edited like any other, no direction mark in the box', async ({ page }) => {
    ({ problems } = await open(page, 'plain', 'page=fields&skin=outlined&locale=ar&dir=rtl'));
    await setValue(page, 'budget', -1500);
    const budget = boxOf(page, 'f-budget');
    await budget.click();
    await budget.press('End');
    await budget.press('Backspace');
    const typed = await budget.inputValue();
    expect([...typed].map((c) => c.charCodeAt(0).toString(16))).not.toContain('200e');
    expect(await valueOf(page, 'budget')).toBe(-1500);
    await setValue(page, 'area', -12.5);
    const area = boxOf(page, 'f-area');
    await area.click();
    await area.press('Home');
    await area.press('Delete');
    expect(await valueOf(page, 'area')).toBe(12.5);
  });

  for (const [locale, query, typed, expected] of [
    ['en', '', '1,5', 1.5],
    ['en', '', '1,500', 1500],
    ['de', '&locale=de', '1.5', 1.5],
    ['de', '&locale=de', '1.500', 1500],
    ['fr', '&locale=fr', '1,5', 1.5],
  ] as const) {
    test(`${locale}: "${typed}" is ${expected}, never multiplied in silence`, async ({ page }) => {
      ({ problems } = await open(page, 'plain', `page=fields&skin=outlined${query}`));
      const area = boxOf(page, 'f-area');
      await enter(area);
      await area.pressSequentially(typed);
      expect(await valueOf(page, 'area')).toBe(expected);
    });
  }

  test('keeps to its field: a decimal mark in a whole number, a place past the field’s, a 16th digit', async ({ page }) => {
    ({ problems } = await open(page, 'plain', 'page=fields&skin=outlined'));
    const seats = boxOf(page, 'f-seats');
    await enter(seats);
    await seats.pressSequentially('1.5');
    await expect(seats).toHaveValue('15');
    await expect(hintOf(page, 'f-seats')).toBeHidden();
    await seats.press('.');
    await expect(hintOf(page, 'f-seats')).toHaveText('Workstations must be a whole number');
    const area = boxOf(page, 'f-area');
    await enter(area);
    await area.pressSequentially('12.345');
    await expect(area).toHaveValue('12.3');
    await expect(hintOf(page, 'f-area')).toHaveText('Floor area (m²) takes at most 1 decimal place');
    await enter(seats);
    await seats.pressSequentially('12345678901234567890');
    expect(await valueOf(page, 'seats')).toBe(123456789012345);
    await expect(hintOf(page, 'f-seats')).toHaveText('Workstations takes at most 15 digits');
    await page.keyboard.press('Tab');
    await expect(seats).toHaveValue('123,456,789,012,345');
  });

  for (const [locale, query, pasted] of [
    ['en', '', '370,000.00 EGP'],
    ['ar', '&locale=ar&dir=rtl', '370,000.00 EGP'],
    ['fr', '&locale=fr', '370\u202f000,00 EGP'],
  ] as const) {
    test(`${locale}: an amount copied with the box’s own currency pastes, another currency is named`, async ({ page }) => {
      ({ problems } = await open(page, 'plain', `page=fields&skin=outlined${query}`));
      await setValue(page, 'currency_id', { id: 1, label: 'EGP' });
      const budget = boxOf(page, 'f-budget');
      await enter(budget);
      await paste(page, budget, pasted);
      expect(await valueOf(page, 'budget')).toBe(370000);
      await enter(budget);
      await budget.press('Delete');
      await budget.pressSequentially('12');
      await paste(page, budget, '$1,500.00');
      await expect(budget).toHaveValue('12');
      await expect(hintOf(page, 'f-budget')).toContainText('$');
      await paste(page, budget, '12\t380');
      await expect(budget).toHaveValue('12');
    });
  }

  test('text left that does not read stays, marked, with its reason said once; Save refuses it', async ({ page }) => {
    ({ problems } = await open(page, 'plain', 'page=fields&skin=outlined&locale=ar&dir=rtl'));
    await setValue(page, 'area', 40);
    const area = boxOf(page, 'f-area');
    await enter(area);
    await area.pressSequentially('12 34');
    await page.keyboard.press('Tab');
    await expect(area).toHaveValue('12 34');
    await expect(area).toHaveAttribute('aria-invalid', 'true');
    const error = errorOf(page, 'f-area');
    await expect(error).toHaveText('تُجمع الأرقام في مجموعات من ثلاثة، مثل 1,234,567');
    await expect(error).toHaveAttribute('aria-live', 'polite');
    expect(await valueOf(page, 'area')).toBe(40);
    expect(await page.evaluate(() => (window as any).fieldiaDemo.handle.form.validate())).toBe(false);
    await node(page, 'f-area').scrollIntoViewIfNeeded();
    await screen(page, 'input-rules-unread-ar', { viewport: true });
    await enter(area);
    await area.pressSequentially('1234');
    await page.keyboard.press('Tab');
    await expect(error).toBeHidden();
    expect(await valueOf(page, 'area')).toBe(1234);
  });

  test('a value outside its limits is said as the box is left, not only at Save', async ({ page }) => {
    ({ problems } = await open(page, 'plain', 'page=fields&skin=outlined'));
    const seats = boxOf(page, 'f-seats');
    await enter(seats);
    await seats.pressSequentially('0');
    await page.keyboard.press('Tab');
    await expect(errorOf(page, 'f-seats')).toHaveText('Workstations must be at least 1');
    await expect(seats).toHaveAttribute('aria-invalid', 'true');
  });

  test('hours: "6 30" and "12:75" say why, 6h30 and 6:30:00 read', async ({ page }) => {
    ({ problems } = await open(page, 'plain', 'page=fields&skin=outlined&locale=fr'));
    const hours = boxOf(page, 'f-time-on-site');
    await enter(hours);
    await hours.pressSequentially('6 30');
    await page.keyboard.press('Tab');
    await expect(errorOf(page, 'f-time-on-site')).toHaveText('Time on site : écrivez heures et minutes, par exemple 6:30, ou des heures, par exemple 6,5');
    await enter(hours);
    await hours.pressSequentially('12:75');
    await page.keyboard.press('Tab');
    await expect(errorOf(page, 'f-time-on-site')).toHaveText('Time on site : les minutes vont de 0 à 59, par exemple 6:30');
    for (const [typed, expected] of [['6h30', 6.5], ['6:30:00', 6.5], ['6,5', 6.5]] as const) {
      await enter(hours);
      await hours.pressSequentially(typed);
      await page.keyboard.press('Tab');
      expect(await valueOf(page, 'time_on_site')).toBe(expected);
    }
  });

  test('a per cent box reads ٪, and an editable bar keeps to its range', async ({ page }) => {
    ({ problems } = await open(page, 'plain', 'page=fields&skin=outlined&locale=ar&dir=rtl'));
    const margin = boxOf(page, 'f-margin');
    await enter(margin);
    await margin.pressSequentially('٢٥٪');
    expect(await valueOf(page, 'margin')).toBe(0.25);
    const progress = boxOf(page, 'f-progress');
    await enter(progress);
    await progress.pressSequentially('-150');
    await expect(progress).toHaveValue('150');
    await page.keyboard.press('Tab');
    await expect(errorOf(page, 'f-progress')).toHaveText('يجب ألا يزيد Fit-out progress عن 100');
  });

  test('a number cell in a table takes the same rules', async ({ page }) => {
    ({ problems } = await open(page, 'plain', 'page=fields&skin=outlined'));
    const table = node(page, 'f-milestones');
    if (!(await table.locator('tbody tr').count())) await table.getByRole('button', { name: 'Add a milestone' }).click();
    const hours = table.locator('td input.fd-number-input').first();
    await enter(hours);
    await hours.pressSequentially('abc2,5');
    await expect(hours).toHaveValue('2,5');
    await expect(table.locator('.fd-refusal-hint')).toBeHidden();
    await hours.pressSequentially('x');
    await expect(table.locator('.fd-refusal-hint')).toHaveText('Hours: numbers only');
    await table.scrollIntoViewIfNeeded();
    await screen(page, 'input-rules-lines', { viewport: true });
    const lines = (await valueOf(page, 'milestone_ids')) as { values: Values }[];
    expect(lines.map((line) => line.values['hours'])).toContain(2.5);
    await paste(page, hours, '12\t380');
    await expect(table.locator('.fd-refusal-hint')).toHaveText('Hours takes one value, and several were pasted');
  });
});

test.describe('the business widgets’ boxes', () => {
  let problems: string[] = [];
  test.afterEach(() => expect(problems).toEqual([]));

  test('a distribution’s share refuses letters and a minus, and an emptied share is 0 in the total', async ({ page }) => {
    ({ problems } = await open(page, 'plain', 'page=business&skin=underline'));
    await page.getByRole('tab', { name: 'Invoicing' }).click();
    const share = node(page, 'f-analytic').locator('input.fd-share').first();
    await enter(share);
    await share.pressSequentially('abc');
    await expect(node(page, 'f-analytic').locator('.fd-refusal-hint').first()).toHaveText('Percentage: numbers only');
    await node(page, 'f-analytic').scrollIntoViewIfNeeded();
    await screen(page, 'input-rules-share-hint', { viewport: true });
    await share.pressSequentially('-');
    await expect(node(page, 'f-analytic').locator('.fd-refusal-hint').first()).toHaveText('Percentage must be at least 0');
    await share.press('Delete');
    await page.keyboard.press('Tab');
    const total = node(page, 'f-analytic').locator('.fd-distribution-total');
    await expect(total).not.toHaveText('100%');
    await node(page, 'f-analytic').scrollIntoViewIfNeeded();
    await screen(page, 'input-rules-distribution', { viewport: true });
  });

  test('a tax amount refuses letters, and an emptied box goes back to the amount kept, saying so', async ({ page }) => {
    ({ problems } = await open(page, 'plain', 'page=business&skin=underline&locale=de'));
    await page.getByRole('tab', { name: 'Invoicing' }).click();
    const tax = node(page, 'f-tax-totals').locator('input').first();
    const kept = await tax.inputValue();
    await enter(tax);
    await tax.pressSequentially('abc');
    await expect(node(page, 'f-tax-totals').locator('.fd-refusal-hint').first()).toContainText('nur Zahlen');
    await tax.press('Delete');
    await page.keyboard.press('Tab');
    await expect(tax).toHaveValue(kept);
    await expect(node(page, 'f-tax-totals').locator('.fd-tax-note')).toContainText('bleibt bei');
  });
});

test.describe('the order grid and the rules page', () => {
  let problems: string[] = [];
  test.afterEach(() => expect(problems).toEqual([]));

  test('a grid cell’s editor refuses letters and reads a decimal comma', async ({ page }) => {
    // Tall enough that the last line's hint is seen where it goes: above its box, the grid's totals under it.
    await page.setViewportSize({ width: 1280, height: 1000 });
    ({ problems } = await open(page, 'plain', 'page=order&skin=outlined'));
    const grid = node(page, 'f-lines');
    // The sample order's sixth row, its lamp: a cell clicked opens its editor, its text chosen.
    await grid.locator('.ag-row[row-index="5"] .ag-cell[col-id="qty"]').click();
    const editor = grid.locator('.ag-cell-inline-editing input, .ag-popup-editor input').first();
    await expect(editor).toBeFocused();
    await page.keyboard.type('abc1,5');
    await expect(editor).toHaveValue('1,5');
    await expect(grid.locator('.fd-refusal-hint')).toBeHidden();
    await page.keyboard.type('x');
    await expect(grid.locator('.fd-refusal-hint')).toHaveText('Quantity: numbers only');
    await expect(grid.locator('.fd-refusal-hint')).toHaveAttribute('data-above', '');
    await screen(page, 'input-rules-grid', { viewport: true });
    await page.keyboard.press('Enter');
    const lines = (await valueOf(page, 'line_ids')) as { values: Values }[];
    expect(lines[5].values['qty']).toBe(1.5);
  });

  test('a line’s whole-number quantity refuses a decimal mark', async ({ page }) => {
    ({ problems } = await open(page, 'plain', 'page=rules&skin=outlined'));
    const qty = page.locator('.fd-lines-table td input.fd-number-input').first();
    await enter(qty);
    await qty.pressSequentially('2.5');
    await expect(qty).toHaveValue('25');
  });
});

test.describe('cells in Arabic, French and German', () => {
  let problems: string[] = [];
  test.beforeEach(async ({ context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  });
  test.afterEach(() => expect(problems).toEqual([]));
  const lineKeys = (page: Page, field: string) => page.evaluate((name) => ((window as any).fieldiaDemo.handle.form.getState().values[name] as { key: string }[]).map((line) => line.key), field);
  const updateLine = (page: Page, field: string, key: string, name: string, value: unknown) =>
    page.evaluate(([f, k, n, v]) => (window as any).fieldiaDemo.handle.form.updateLine(f, k, n, v), [field, key, name, value] as const);
  const cellValue = async (page: Page, field: string, index: number, name: string) => ((await valueOf(page, field)) as { values: Values }[])[index].values[name];

  test('ar: a negative number in a table’s cell and in the grid is edited like any other, and one copied pastes', async ({ page }) => {
    ({ problems } = await open(page, 'plain', 'page=fields&skin=outlined&locale=ar&dir=rtl'));
    const [first] = await lineKeys(page, 'milestone_ids');
    await updateLine(page, 'milestone_ids', first, 'hours', -5);
    const hours = node(page, 'f-milestones').locator('td input.fd-number-input').first();
    await hours.click();
    await hours.press('End');
    await hours.press('Backspace');
    expect([...(await hours.inputValue())].map((c) => c.charCodeAt(0))).not.toContain(0x200e);
    await hours.pressSequentially('5');
    expect(await cellValue(page, 'milestone_ids', 0, 'hours')).toBe(-5.5);
    await page.goto('/plain/?page=order&skin=outlined&locale=ar&dir=rtl');
    const keys = await lineKeys(page, 'line_ids');
    await updateLine(page, 'line_ids', keys[5], 'price', -50);
    const grid = node(page, 'f-lines');
    await grid.locator('.ag-row[row-index="5"] .ag-cell[col-id="price"]').click();
    const editor = grid.locator('.ag-cell-inline-editing input, .ag-popup-editor input').first();
    await expect(editor).toBeFocused();
    expect([...(await editor.inputValue())].map((c) => c.charCodeAt(0))).not.toContain(0x200e);
    await editor.press('Control+A');
    await paste(page, editor, '\u200e-1,200.00');
    await editor.press('Enter');
    expect(await cellValue(page, 'line_ids', 5, 'price')).toBe(-1200);
  });

  for (const [locale, query, pasted] of [
    ['en', '', 'E£ 1,200.00'],
    ['fr', '&locale=fr', '1\u202f200,00 £E'],
    ['de', '&locale=de', 'E£ 1.200,00'],
  ] as const) {
    test(`${locale}: an amount written the page’s way pastes into a table’s money cell and the grid’s`, async ({ page }) => {
      ({ problems } = await open(page, 'plain', `page=fields&skin=outlined${query}`));
      const amount = node(page, 'f-milestones').locator('td input.fd-number-input').nth(1);
      await enter(amount);
      await paste(page, amount, pasted);
      expect(await cellValue(page, 'milestone_ids', 0, 'amount')).toBe(1200);
      await paste(page, amount, 'abc');
      expect(await cellValue(page, 'milestone_ids', 0, 'amount')).toBe(1200);
      await page.goto(`/plain/?page=order&skin=outlined${query}`);
      const grid = node(page, 'f-lines');
      await grid.locator('.ag-row[row-index="5"] .ag-cell[col-id="price"]').click();
      const editor = grid.locator('.ag-cell-inline-editing input, .ag-popup-editor input').first();
      await expect(editor).toBeFocused();
      await editor.press('Control+A');
      await paste(page, editor, pasted);
      await editor.press('Enter');
      expect(await cellValue(page, 'line_ids', 5, 'price')).toBe(1200);
    });
  }

  test('ar: the rules page’s whole-number quantity refuses the Arabic decimal mark, in Arabic', async ({ page }) => {
    ({ problems } = await open(page, 'plain', 'page=rules&skin=outlined&locale=ar&dir=rtl'));
    const qty = page.locator('.fd-lines-table td input.fd-number-input').first();
    await enter(qty);
    await qty.pressSequentially('٢٫');
    await expect(page.locator('.fd-lines-table .fd-refusal-hint').first()).toContainText('رقمًا صحيحًا');
    await qty.pressSequentially('٥');
    await expect(qty).toHaveValue('٢٥');
    await expect(page.locator('.fd-lines-table .fd-refusal-hint').first()).toBeHidden();
  });
});

test.describe('the refusal hint’s look', () => {
  for (const [scheme, query] of [
    ['light', ''],
    ['dark', ''],
    ['light', '&locale=ar&dir=rtl'],
    ['dark', '&locale=ar&dir=rtl'],
  ] as const) {
    test(`${scheme}${query ? ', right to left' : ''}: readable under its box`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      const { problems } = await open(page, 'plain', `page=fields&skin=outlined${query}`);
      const seats = boxOf(page, 'f-seats');
      await enter(seats);
      await seats.pressSequentially('a');
      const hint = hintOf(page, 'f-seats');
      await expect(hint).toBeVisible();
      const [boxAt, hintAt] = [await seats.boundingBox(), await hint.boundingBox()];
      expect(hintAt!.y).toBeGreaterThanOrEqual(boxAt!.y + boxAt!.height - 1);
      await node(page, 'f-seats').screenshot({ path: `test-results/screens/input-rules-hint-${scheme}${query ? '-rtl' : ''}.png` });
      expect(problems).toEqual([]);
    });
  }
});
