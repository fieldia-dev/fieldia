import { type Locator, type Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { addField, editing, inAdvanced, watch } from './designer-support';
import { mapReady, mapOf, stubMaps } from './map-support';
import { node, open, screen } from './support';

/**
 * Numbers everywhere, typed and pasted as a person does (0.20.1): a number is
 * never made of what was typed by dropping a key ("1.5" is never 15, "-3"
 * never 3, "1e5" never 15); a 0 never leads a group ("0,500" is a half,
 * never 500); every right way to write a number can be typed key by key, as
 * it can be pasted ("1.234,56" on an English page); trailing zeros are no
 * places ("12.50", "1,200.00"); and a designer's setting refused because of
 * another says why at its own box. In English, Arabic right to left, French
 * and German.
 */

// The clipboard is the browser's, one for every page a worker has open: these tests take turns with it.
test.describe.configure({ mode: 'default' });

type Values = Record<string, unknown>;
const values = (page: Page) => page.evaluate(() => (window as any).fieldiaDemo.handle.form.getState().values as Values);
const valueOf = async (page: Page, field: string) => (await values(page))[field];
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

test.describe('a number box never makes a number by dropping a key', () => {
  let problems: string[] = [];
  test.beforeEach(async ({ context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  });
  test.afterEach(() => expect(problems).toEqual([]));

  for (const [locale, query, typed, shows, said] of [
    ['en', '', '1.5', '1.5', 'Workstations must be a whole number'],
    ['en', '', '.5', '.', 'Workstations must be a whole number'],
    ['en', '', '0.500', '0.', 'Workstations must be a whole number'],
    ['ar', '&locale=ar&dir=rtl', '١٫٥', '١٫', 'يجب أن يكون Workstations رقمًا صحيحًا'],
    ['fr', '&locale=fr', '1,5', '1,5', 'Workstations doit être un nombre entier'],
    ['fr', '&locale=fr', '1 234,56', '1 234,56', 'Workstations doit être un nombre entier'],
    ['de', '&locale=de', '1.234,56', '1.234,', 'Workstations muss eine ganze Zahl sein'],
  ] as const) {
    test(`${locale}: "${typed}" in Workstations is never 15: left, it stays as typed, marked, said to a screen reader`, async ({ page }) => {
      ({ problems } = await open(page, 'plain', `page=fields&skin=outlined${query}`));
      const before = await valueOf(page, 'seats');
      const seats = boxOf(page, 'f-seats');
      await enter(seats);
      await seats.pressSequentially(typed);
      // Nothing after a refused key is taken: the box never holds a different number.
      await expect(seats).toHaveValue(shows);
      await page.keyboard.press('Tab');
      await expect(seats).toHaveValue(typed);
      const error = errorOf(page, 'f-seats');
      await expect(error).toHaveText(said);
      await expect(seats).toHaveAttribute('aria-invalid', 'true');
      await expect(seats).toHaveAttribute('aria-describedby', new RegExp(`(^| )${await error.getAttribute('id')}( |$)`));
      expect(await valueOf(page, 'seats')).toEqual(before);
      if (typed === '1.5' || locale === 'ar') await screen(page, `input-numbers-held-${locale}`, { viewport: true });
    });
  }

  test('en: "-3" and "1e5" are never 3 or 15; the keys after a refused one wait, and Backspace takes them back', async ({ page }) => {
    ({ problems } = await open(page, 'plain', 'page=fields&skin=outlined'));
    const seats = boxOf(page, 'f-seats');
    const hint = hintOf(page, 'f-seats');
    await enter(seats);
    const held = await seats.inputValue();
    await seats.pressSequentially('-3');
    // The minus is refused, and the 3 after it waits with it: the box still holds what it held.
    await expect(seats).toHaveValue(held);
    await expect(hint).toHaveText('Workstations must be at least 1');
    await expect(hint).toBeVisible();
    await page.keyboard.press('Tab');
    // As typed: -3, which its least says no to.
    await expect(seats).toHaveValue('-3');
    await expect(errorOf(page, 'f-seats')).toHaveText('Workstations must be at least 1');
    expect(await valueOf(page, 'seats')).toBe(-3);
    await enter(seats);
    await seats.pressSequentially('1e5');
    await expect(seats).toHaveValue('1');
    await expect(hint).toHaveText('Workstations: numbers only');
    await page.keyboard.press('Tab');
    await expect(seats).toHaveValue('1e5');
    await expect(errorOf(page, 'f-seats')).toContainText('1e5');
    await enter(seats);
    await seats.pressSequentially('12a3');
    await expect(seats).toHaveValue('12');
    await expect(hint).toHaveText('Workstations: numbers only');
    await seats.press('Backspace');
    await expect(hint).toBeVisible();
    await seats.press('Backspace');
    await expect(hint).toBeHidden();
    await seats.press('3');
    await expect(seats).toHaveValue('123');
    await page.keyboard.press('Tab');
    expect(await valueOf(page, 'seats')).toBe(123);
    await expect(errorOf(page, 'f-seats')).toBeHidden();
  });

  test('the editable bar’s box: "50.5" is never 505', async ({ page }) => {
    ({ problems } = await open(page, 'plain', 'page=fields&skin=outlined'));
    const progress = boxOf(page, 'f-progress');
    await enter(progress);
    await progress.pressSequentially('50.5');
    await page.keyboard.press('Tab');
    await expect(progress).toHaveValue('50.5');
    await expect(errorOf(page, 'f-progress')).toHaveText('Fit-out progress must be a whole number');
  });
});

test.describe('a number led by 0, typed key by key, with trailing zeros, as it can be pasted', () => {
  let problems: string[] = [];
  test.beforeEach(async ({ context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  });
  test.afterEach(() => expect(problems).toEqual([]));

  for (const [locale, query] of [
    ['en', ''],
    ['ar', '&locale=ar&dir=rtl'],
  ] as const) {
    test(`${locale}: "0,500" is a half and "0,750" three quarters, typed or pasted — never 500`, async ({ page }) => {
      ({ problems } = await open(page, 'plain', `page=fields&skin=outlined${query}`));
      const budget = boxOf(page, 'f-budget');
      await enter(budget);
      await budget.pressSequentially('0,500');
      expect(await valueOf(page, 'budget')).toBe(0.5);
      await page.keyboard.press('Tab');
      await expect(budget).toHaveValue('0.50');
      await enter(budget);
      await paste(page, budget, '0,750');
      expect(await valueOf(page, 'budget')).toBe(0.75);
      const area = boxOf(page, 'f-area');
      await enter(area);
      await area.pressSequentially('0,500');
      await page.keyboard.press('Tab');
      expect(await valueOf(page, 'area')).toBe(0.5);
    });

    test(`${locale}: "1.234,56" typed into Budget is 1234.56, as pasted — never 1.23`, async ({ page }) => {
      ({ problems } = await open(page, 'plain', `page=fields&skin=outlined${query}`));
      const budget = boxOf(page, 'f-budget');
      await enter(budget);
      await budget.pressSequentially('1.234,56');
      await expect(budget).toHaveValue('1.234,56');
      await expect(hintOf(page, 'f-budget')).toBeHidden();
      await page.keyboard.press('Tab');
      expect(await valueOf(page, 'budget')).toBe(1234.56);
      await expect(budget).toHaveValue('1,234.56');
      await expect(errorOf(page, 'f-budget')).toBeHidden();
    });
  }

  test('de: "0.500" in Floor area is a half; fr: "1,234.5" typed is 1234.5', async ({ page }) => {
    ({ problems } = await open(page, 'plain', 'page=fields&skin=outlined&locale=de'));
    const area = boxOf(page, 'f-area');
    await enter(area);
    await area.pressSequentially('0.500');
    await page.keyboard.press('Tab');
    expect(await valueOf(page, 'area')).toBe(0.5);
    await expect(area).toHaveValue('0,5');
    ({ problems } = await open(page, 'plain', 'page=fields&skin=outlined&locale=fr'));
    const fr = boxOf(page, 'f-area');
    await enter(fr);
    await fr.pressSequentially('1,234.5');
    await expect(hintOf(page, 'f-area')).toBeHidden();
    await page.keyboard.press('Tab');
    expect(await valueOf(page, 'area')).toBe(1234.5);
  });

  for (const [locale, query] of [
    ['en', ''],
    ['ar', '&locale=ar&dir=rtl'],
  ] as const) {
    test(`${locale}: a value copied with trailing zeros pastes: 1,200.00 and 12.0 into a whole number, 12.50 into one place`, async ({ page }) => {
      ({ problems } = await open(page, 'plain', `page=fields&skin=outlined${query}`));
      const seats = boxOf(page, 'f-seats');
      for (const [pasted, expected] of [
        ['1,200.00', 1200],
        ['12.0', 12],
      ] as const) {
        await enter(seats);
        await paste(page, seats, pasted);
        await expect(hintOf(page, 'f-seats')).toBeHidden();
        expect(await valueOf(page, 'seats')).toBe(expected);
      }
      const area = boxOf(page, 'f-area');
      for (const [pasted, expected] of [
        ['12.50', 12.5],
        ['٠٫٥٠', 0.5],
      ] as const) {
        await enter(area);
        await paste(page, area, pasted);
        await expect(hintOf(page, 'f-area')).toBeHidden();
        expect(await valueOf(page, 'area')).toBe(expected);
      }
    });
  }
});

test.describe('the order grid’s numbers pasted', () => {
  let problems: string[] = [];
  test.beforeEach(async ({ context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  });
  test.afterEach(() => expect(problems).toEqual([]));

  type Line = { key: string; values: Values };
  const lineValues = async (page: Page, row: number) => ((await page.evaluate(() => (window as any).fieldiaDemo.handle.form.getState().values['line_ids'])) as Line[])[row].values;
  const grid = (page: Page) => node(page, 'f-lines');
  const cell = (page: Page, row: number, column: string) => grid(page).locator(`.ag-row[row-index="${row}"] .ag-cell[col-id="${column}"]`);
  async function choose(page: Page, row: number, column: string) {
    await cell(page, row, column).click();
    await expect(grid(page).locator('.fd-grid-editor input').first()).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(grid(page).locator('.fd-grid-editor')).toHaveCount(0);
    await expect(cell(page, row, column)).toBeFocused();
  }

  for (const [locale, query, pasted, column, expected] of [
    ['en', '', '12.50', 'discount', 12.5],
    ['en', '', '0,500', 'qty', 0.5],
    ['ar', '&locale=ar&dir=rtl', '0,500', 'qty', 0.5],
    ['fr', '&locale=fr', '0,500', 'qty', 0.5],
  ] as const) {
    test(`${locale}: "${pasted}" pasted on ${column} is ${expected}`, async ({ page }) => {
      ({ problems } = await open(page, 'plain', `page=order&skin=outlined${query}`));
      await choose(page, 1, column);
      await page.evaluate((t) => navigator.clipboard.writeText(t), pasted);
      await page.keyboard.press('Control+V');
      await expect.poll(async () => (await lineValues(page, 1))[column]).toBe(expected);
      await expect(grid(page)).not.toContainText('Not pasted');
    });
  }
});

test.describe('a custom filter on a whole number', () => {
  for (const [locale, query, typed, said] of [
    ['en', '', '1.5', 'Sales must be a whole number'],
    ['ar', '&locale=ar&dir=rtl', '١٫٥', 'يجب أن يكون Sales رقمًا صحيحًا'],
    ['fr', '&locale=fr', '1,5', 'Sales doit être un nombre entier'],
  ] as const) {
    test(`${locale}: "${typed}" never becomes "greater than 15": Apply keeps it, saying why`, async ({ page }) => {
      const { problems } = await open(page, 'plain', `page=customers&skin=underline${query}`);
      await page.locator('.fd-search-toggle').first().click();
      await page.locator('.fd-search-add').first().click();
      const form = page.locator('.fd-custom-filter:visible');
      await form.locator('select').first().selectOption('sale_order_count');
      await form.locator('select').nth(1).selectOption('>');
      const value = form.locator('.fd-custom-filter-value input');
      await value.click();
      await value.pressSequentially(typed);
      await form.locator('.fd-button-primary').click();
      await expect(form.locator('.fd-refusal-hint')).toHaveText(said);
      await expect(value).toHaveValue(typed);
      await expect(page.locator('.fd-facet .fd-facet-text')).toHaveCount(0);
      expect(problems).toEqual([]);
    });
  }
});

test.describe('the designer: a setting refused because of another', () => {
  for (const [locale, query, from, to, said] of [
    ['en', '', 'From', 'To', 'From is not less than To'],
    ['ar', '&locale=ar&dir=rtl', 'من', 'إلى', '«من» ليس أصغر من «إلى»'],
  ] as const) {
    test(`${locale}: From 5 after To 2 is said at From, in view, to a screen reader`, async ({ page }) => {
      await page.goto(`/designer/?start=survey${query}`);
      await page.locator('.fd-toolbox [data-tool="kind:number"]').click();
      const toBox = page.getByRole('textbox', { name: to, exact: true }).first();
      const fromBox = page.getByRole('textbox', { name: from, exact: true }).first();
      await toBox.click();
      await toBox.pressSequentially('2');
      await toBox.press('Tab');
      await fromBox.click();
      await fromBox.pressSequentially('5');
      await fromBox.press('Tab');
      const hint = fromBox.locator('xpath=following-sibling::*[contains(@class,"fd-refusal-hint")][1]');
      await expect(hint).toHaveText(said);
      await expect(hint).toBeInViewport();
      await expect(fromBox).toHaveAttribute('aria-describedby', new RegExp(`(^| )${await hint.getAttribute('id')}( |$)`));
      await screen(page, `input-numbers-designer-from-${locale}`, { viewport: true });
    });
  }

  test('Most characters: "1.5", "٢٫٥", "-5" are never 15, 25 or 5, and say what fits', async ({ page }) => {
    const problems = watch(page);
    await page.goto('/screen/?start=blank');
    await expect(page.locator('.fd-toolbox')).toBeVisible();
    await addField(page, 'short-answer', 'Project name');
    const most = editing(page).card.getByLabel('Most characters', { exact: true });
    await most.fill('40');
    await most.press('Tab');
    const size = () => page.evaluate(() => Object.values((window as any).fieldiaDesigner.designer.getPage().fields as Record<string, any>).find((f) => f.label === 'Project name')?.size);
    await expect.poll(size).toBe(40);
    for (const typed of ['1.5', '٢٫٥', '-5']) {
      await most.click();
      await most.press('Control+A');
      await most.pressSequentially(typed);
      await most.press('Tab');
      await expect(most).toHaveValue('40');
      expect([typed, await size()]).toEqual([typed, 40]);
      await expect(most.locator('xpath=following-sibling::*[contains(@class,"fd-refusal-hint")][1]')).toHaveText('Most characters is a whole number, 1 or more. It stays 40.');
    }
    expect(problems).toEqual([]);
  });
});

test.describe('the designer’s typed numbers', () => {
  const panel = (page: Page) => page.locator('.fd-properties');
  const fieldOf = (page: Page, label: string) =>
    page.evaluate((l) => Object.values((window as any).fieldiaDesigner.designer.getPage().fields as Record<string, any>).find((f) => f.label === l), label);

  for (const [locale, query, words, typed, expected] of [
    ['en', '', { rules: 'Rules', setWhen: 'Set when…', setTo: 'Set to', as: 'Set' }, '1,5', '1.5'],
    ['ar', '?locale=ar&dir=rtl', { rules: 'القواعد', setWhen: 'يُضبط عندما…', setTo: 'يُضبط على', as: 'يُضبط' }, '٥٠', '50'],
  ] as const) {
    test(`${locale}: a value set when, typed "${typed}" in its number box, is ${expected}; "1e3" is never 13 or 1000`, async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await inAdvanced(page);
      const problems = watch(page);
      await page.goto(`/screen/${query}`);
      await addField(page, 'number', 'Quantity');
      await addField(page, 'number', 'Price');
      await panel(page).getByRole('tab', { name: words.rules, exact: true }).click();
      await panel(page).getByRole('button', { name: words.setWhen, exact: true }).click();
      const to = panel(page).getByRole('textbox', { name: words.setTo, exact: true });
      // Never the browser's number box, which reads by the browser's language and empties itself on Arabic digits.
      await expect(to).toHaveAttribute('type', 'text');
      const as = panel(page).getByRole('combobox', { name: words.as, exact: true });
      await as.selectOption((await as.locator('option', { hasText: 'Quantity' }).getAttribute('value')) as string);
      await to.click();
      await to.pressSequentially(typed);
      await to.press('Tab');
      await expect.poll(async () => (await fieldOf(page, 'Price'))?.setWhen?.[0]?.value).toBe(expected);
      // An exponent cannot be typed: the e is refused, the 3 after it waits with it, and leaving keeps what was set.
      await to.click();
      await to.press('ControlOrMeta+a');
      await to.pressSequentially('1e3');
      await expect(to).toHaveValue('1');
      await to.press('Tab');
      await expect(to).toHaveValue(expected);
      const hint = to.locator('xpath=following-sibling::*[contains(@class,"fd-refusal-hint")][1]');
      await expect(hint).toBeVisible();
      await expect(hint).toContainText(expected);
      expect((await fieldOf(page, 'Price'))?.setWhen?.[0]?.value).toBe(expected);
      await screen(page, `input-numbers-designer-set-to-${locale}`, { viewport: true });
      expect(problems).toEqual([]);
    });
  }

  for (const [locale, query, only, has] of [
    ['en', '', 'Only where', 'has the value'],
    ['ar', '&locale=ar&dir=rtl', 'فقط حيث', 'قيمته'],
  ] as const) {
    test(`${locale}: a link’s filter value is read as every box reads a number: "٥" is 5, "1,5" one and a half, "0x10" and "1e3" words`, async ({ page }) => {
      const problems = watch(page);
      await page.goto(`/screen/?start=blank${query}`);
      await expect(page.locator('.fd-toolbox')).toBeVisible();
      await addField(page, 'links', 'Tags');
      const setting = (name: string) => editing(page).card.getByLabel(name, { exact: true });
      await setting(only).click();
      await setting(only).pressSequentially('level');
      await setting(only).press('Tab');
      for (const [typed, expected] of [
        ['٥', 5],
        ['۵', 5],
        ['1,5', 1.5],
        ['0x10', '0x10'],
        ['1e3', '1e3'],
      ] as const) {
        await setting(has).click();
        await setting(has).press('ControlOrMeta+a');
        await setting(has).pressSequentially(typed);
        await setting(has).press('Tab');
        await expect.poll(async () => [typed, (await fieldOf(page, 'Tags'))?.filter?.[0]?.value]).toEqual([typed, expected]);
      }
      expect(problems).toEqual([]);
    });
  }
});

test.describe('tax amounts in the record’s currency', () => {
  let problems: string[] = [];
  test.beforeEach(async ({ context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  });
  test.afterEach(() => expect(problems).toEqual([]));
  const taxOf = (page: Page) =>
    page.evaluate(() => ((window as any).fieldiaDemo.handle.form.getState().values['tax_totals'] as any).groups_by_subtotal['Untaxed Amount'][0].tax_group_amount as number);

  for (const [locale, query, typed, shown, pasted] of [
    ['en', '', '12.345', '12.345', 'KWD 1.250'],
    ['ar', '&locale=ar&dir=rtl', '١٢٫٣٤٥', /^12[.٫]345$/, 'KWD 1.250'],
    ['fr', '&locale=fr', '12,345', '12,345', '1,250 KWD'],
  ] as const) {
    test(`${locale}: a Kuwaiti dinar amount takes its three places, typed or pasted with its currency`, async ({ page }) => {
      ({ problems } = await open(page, 'plain', `page=business&skin=underline${query}`));
      await page.getByRole('tab', { name: 'Invoicing' }).click();
      // The record's currency: the Kuwaiti dinar, which has three places.
      await page.evaluate(() => (window as any).fieldiaDemo.handle.form.setValue('currency_id', { id: 9001, label: 'KWD' }));
      const tax = node(page, 'f-tax-totals').locator('input').first();
      await enter(tax);
      await tax.pressSequentially(typed);
      await expect(node(page, 'f-tax-totals').locator('.fd-refusal-hint').first()).toBeHidden();
      await page.keyboard.press('Tab');
      await expect.poll(() => taxOf(page)).toBe(12.345);
      // Shown as it is, never a rounded picture of another amount.
      await expect(tax).toHaveValue(shown);
      await enter(tax);
      await paste(page, tax, pasted);
      await expect(node(page, 'f-tax-totals').locator('.fd-refusal-hint').first()).toBeHidden();
      await page.keyboard.press('Tab');
      await expect.poll(() => taxOf(page)).toBe(1.25);
    });
  }
});

test.describe('a place’s coordinates', () => {
  test('Persian digits and direction marks read; a letter is refused and the keys after it wait', async ({ page }) => {
    await stubMaps(page, {});
    const { problems } = await open(page, 'plain', 'page=map-delivery&skin=outlined&locale=ar&dir=rtl');
    await mapReady(mapOf(page, 'deliver_to'));
    const field = node(page, 'deliver_to');
    const latitude = field.locator('.fd-map-coords input').first();
    const longitude = field.locator('.fd-map-coords input').nth(1);
    await latitude.click();
    await latitude.pressSequentially('۳۰٫۰۴۴۴');
    await longitude.click();
    await longitude.pressSequentially('‏٣١٫٢٣‏');
    await longitude.press('Enter');
    await expect.poll(() => valueOf(page, 'deliver_to')).toEqual({ type: 'Point', coordinates: [31.23, 30.0444] });
    await latitude.click();
    await latitude.press('Control+A');
    await latitude.pressSequentially('30.0a4');
    await expect(latitude).toHaveValue('30.0');
    await expect(field.locator('.fd-refusal-hint').first()).toBeVisible();
    await latitude.press('Enter');
    await expect(latitude).toHaveValue('30.0a4');
    await expect(latitude).toHaveAttribute('aria-invalid', 'true');
    expect(await valueOf(page, 'deliver_to')).toEqual({ type: 'Point', coordinates: [31.23, 30.0444] });
    expect(problems).toEqual([]);
  });
});
