import { type Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { open, screen } from './support';

/**
 * A list whose cells are changed in place (`editable`), as a clinic keeps its price list, a front desk its week's hours
 * and a sales team its pipeline's stages: a press or Enter opens a cell in its field's own box, Tab goes across the
 * cells and on to the next row, Escape puts back; each row is saved as it is left — the fields it changed alone — and
 * one refused stays as typed, why said under it; a row is added at the end; someone else's save first is said as a
 * record's page says it; a block pasted from a spreadsheet goes down the rows; on a phone a card is changed in a sheet.
 */

// The clipboard is the browser's, one for every page a worker has open: these tests take turns with it.
test.describe.configure({ mode: 'default' });

type Call = { method: string; request: Record<string, unknown> & { values?: Record<string, unknown>; ids?: unknown[]; partial?: boolean; id?: unknown } };
const calls = (page: Page, method: string) => page.evaluate((m) => (window as any).fieldiaDemo.dataSource.calls.filter((call: Call) => call.method === m).map((call: Call) => JSON.parse(JSON.stringify(call.request))), method) as Promise<Call['request'][]>;
const stored = (page: Page, model: string, id: number) => page.evaluate(([m, i]) => (window as any).fieldiaDemo.dataSource.records[m as string][String(i)], [model, id]) as Promise<Record<string, unknown>>;
/** Each sample record's id, by its name: a row is found by its record, whatever its cells show while they change. */
const IDS: Record<string, number> = {
  // The clinic's services (shared/editable-lists.ts), and the one the test adds.
  'Botox, forehead': 1, 'Botox, crow’s feet': 2, 'Lip filler, 1 ml': 3, 'Cheek filler, 2 ml': 4, 'Chemical peel': 5, Hydrafacial: 6, Microneedling: 7, 'Skin consultation': 8,
  'Body contouring, one area': 9, 'Lymphatic drainage': 10, 'Laser, underarms': 11, 'Laser, full legs': 12, 'Laser, face': 13, 'Laser, back': 14,
  // The front desk's week, and the pipeline's stages.
  'Hana Wael': 5, Offer: 4, Won: 6,
};
const row = (page: Page, name: string) => page.locator(`.fd-list-row[data-id="${IDS[name]}"]`);
const cell = (page: Page, name: string, column: string) => row(page, name).locator(`td[data-col="${column}"]`);
const editor = (page: Page) => page.locator('td[data-editing]');
const note = (page: Page, name: string) => row(page, name).locator('xpath=following-sibling::tr[1][contains(@class, "fd-list-note")]');
// (A row's note is in the table while its row has work on it, and hidden once it has nothing to say.)

async function prices(page: Page) {
  const opened = await open(page, 'plain', 'page=service-prices&skin=underline');
  await expect(row(page, 'Hydrafacial')).toBeVisible();
  return opened;
}

/** Rows copied as a spreadsheet puts them on the clipboard, in every engine: from a box of their own, chosen whole and copied with the keys. */
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

/** The open cell's box: its text, and the part of it chosen (where nothing is chosen, start and end are the caret). */
const chosen = (page: Page) =>
  page.evaluate(() => {
    const box = document.activeElement as HTMLInputElement | HTMLTextAreaElement | null;
    return box && 'selectionStart' in box ? { value: box.value, start: box.selectionStart, end: box.selectionEnd } : null;
  });
/** Its whole text chosen, so typing replaces it. */
async function choseWhole(page: Page) {
  const now = await chosen(page);
  expect(now?.value).not.toBe('');
  expect(now).toEqual({ value: now?.value, start: 0, end: now?.value.length });
}

/**
 * The owner's walk of 0.29: the demos' own first steps, followed with the mouse — a press on a cell, the keys typed,
 * Tab — replaced its value as a spreadsheet does. Before, the press left the caret after the old value: Hydrafacial
 * saved at E£ 28,003,000, Hana's Wednesday "00:009:30", Offer at "7,065%". Every engine.
 */
test.describe('a cell opened by a press: its value chosen whole, so what is typed replaces it', () => {
  test('the price list’s first steps by mouse: Hydrafacial’s price becomes 3,000, saved as 3000', async ({ page }) => {
    const { problems } = await prices(page);
    // "Press Hydrafacial’s price, type 3000 and press Tab: its price per hour follows as you type, and Tab goes on to Offered."
    await cell(page, 'Hydrafacial', 'price').click();
    await choseWhole(page);
    await screen(page, 'list-editable-pressed-chosen', { viewport: true });
    await page.keyboard.type('3000');
    await expect(cell(page, 'Hydrafacial', 'per_hour')).toHaveText('E£ 3,000');
    await screen(page, 'list-editable-pressed-typed', { viewport: true });
    await page.keyboard.press('Tab');
    await expect(editor(page)).toHaveAttribute('data-col', 'active');
    await expect(cell(page, 'Hydrafacial', 'price')).toHaveText('E£ 3,000');
    // "Press another row: Hydrafacial is saved — its price alone."
    await cell(page, 'Microneedling', 'name').click();
    await expect.poll(async () => (await stored(page, 'clinic.service', 6))['price']).toBe(3000);
    expect((await calls(page, 'save'))[0].values).toEqual({ price: 3000, per_hour: 3000 });
    // Every kind its cells open as, the same: a name, a link, a number, a sum of money.
    for (const column of ['name', 'done_by', 'minutes', 'price']) {
      await cell(page, 'Chemical peel', column).click();
      await expect(editor(page)).toHaveAttribute('data-col', column);
      await choseWhole(page);
    }
    await page.keyboard.type('2500');
    await page.keyboard.press('Escape');
    await expect(cell(page, 'Chemical peel', 'price')).toHaveText('E£ 2,200');
    expect(problems).toEqual([]);
  });

  test('a second press puts the caret where it is pressed, and F2 after the value: to change within it', async ({ page }) => {
    const { problems } = await prices(page);
    await cell(page, 'Hydrafacial', 'name').click();
    await choseWhole(page);
    const box = cell(page, 'Hydrafacial', 'name').locator('input');
    const size = await box.boundingBox();
    // Pressed again, past its words: the caret there, nothing chosen.
    await box.click({ position: { x: (size?.width ?? 100) - 6, y: (size?.height ?? 20) / 2 } });
    await expect.poll(() => chosen(page)).toEqual({ value: 'Hydrafacial', start: 11, end: 11 });
    await page.keyboard.type(' plus');
    await expect(box).toHaveValue('Hydrafacial plus');
    await page.keyboard.press('Escape');
    await expect(cell(page, 'Hydrafacial', 'name')).toHaveText('Hydrafacial');
    // F2 on a cell at rest: opened with the caret after its value.
    await expect(cell(page, 'Hydrafacial', 'name')).toBeFocused();
    await page.keyboard.press('F2');
    await expect(editor(page)).toHaveAttribute('data-col', 'name');
    expect(await chosen(page)).toEqual({ value: 'Hydrafacial', start: 11, end: 11 });
    await page.keyboard.press('Escape');
    // F2 in a cell opened by a press, its value chosen whole: the caret after it.
    await cell(page, 'Hydrafacial', 'minutes').click();
    await choseWhole(page);
    await page.keyboard.press('F2');
    expect(await chosen(page)).toEqual({ value: '60', start: 2, end: 2 });
    await page.keyboard.type('5');
    await expect(cell(page, 'Hydrafacial', 'minutes').locator('input')).toHaveValue('605');
    await page.keyboard.press('Escape');
    expect(problems).toEqual([]);
  });

  test('the staff hours’ steps by mouse: Hana’s Wednesday becomes 09:30, her week 54:30; then 2:30 on Thursday saves 48', async ({ page }) => {
    const { problems } = await open(page, 'plain', 'page=staff-hours&skin=underline');
    await expect(row(page, 'Hana Wael')).toBeVisible();
    // "Press Hana Wael’s Wednesday, type 9:30 and press Tab: her week says 54:30 as you type."
    await cell(page, 'Hana Wael', 'wed').click();
    await choseWhole(page);
    await page.keyboard.type('9:30');
    await page.keyboard.press('Tab');
    await expect(cell(page, 'Hana Wael', 'wed')).toHaveText('09:30');
    await expect(cell(page, 'Hana Wael', 'week')).toHaveText('54:30');
    // "Press the search box: the server refuses her week."
    await page.locator('.fd-search-input').click();
    await expect(note(page, 'Hana Wael')).toContainText('the labour rules allow 48');
    // "Type 2:30 in her Thursday and leave the row: 48 hours, saved."
    await cell(page, 'Hana Wael', 'thu').click();
    await choseWhole(page);
    await page.keyboard.type('2:30');
    await page.locator('.fd-search-input').click();
    await expect(note(page, 'Hana Wael')).toBeHidden();
    await expect.poll(async () => (await stored(page, 'staff.week', 5))['week']).toBe(48);
    await expect(cell(page, 'Hana Wael', 'thu')).toHaveText('02:30');
    expect(problems).toEqual([]);
  });

  test('the deal stages’ first step by mouse: Offer’s chance becomes 65%, saved as 0.65; its words and order the same', async ({ page }) => {
    const { problems } = await open(page, 'plain', 'page=deal-stages&skin=underline');
    await expect(row(page, 'Offer')).toBeVisible();
    // "Press Offer’s chance of winning, type 65 and leave the row: 65%, saved as 0.65."
    await cell(page, 'Offer', 'probability').click();
    await choseWhole(page);
    await page.keyboard.type('65');
    await page.locator('.fd-search-input').click();
    await expect.poll(async () => (await stored(page, 'deal.stage', 4))['probability']).toBe(0.65);
    await expect(cell(page, 'Offer', 'probability')).toHaveText('65%');
    // A text of several lines and an order: chosen whole too.
    for (const column of ['requirements', 'sequence']) {
      await cell(page, 'Offer', column).click();
      await expect(editor(page)).toHaveAttribute('data-col', column);
      await choseWhole(page);
    }
    await page.keyboard.press('Escape');
    expect(problems).toEqual([]);
  });
});

test.describe('a clinic’s service prices', () => {
  test('a price typed in its cell, Tab on to the next cell it changes, and the row saved as it is left — its change alone', async ({ page }) => {
    const { problems } = await prices(page);
    await cell(page, 'Hydrafacial', 'price').click();
    await expect(editor(page)).toHaveAttribute('data-col', 'price');
    const box = cell(page, 'Hydrafacial', 'price').locator('input');
    await expect(box).toBeFocused();
    await box.fill('3000');
    // Worked out from the row as it is typed: 3,000 for 60 minutes.
    await page.keyboard.press('Tab');
    await expect(cell(page, 'Hydrafacial', 'per_hour')).toHaveText('E£ 3,000');
    // Per hour is worked out: Tab passes it, to Offered.
    await expect(editor(page)).toHaveAttribute('data-col', 'active');
    await expect(cell(page, 'Hydrafacial', 'price')).toHaveText('E£ 3,000');
    expect(await calls(page, 'save')).toEqual([]);
    await screen(page, 'list-editable-typed', { viewport: true });
    // Another row's cell: this row is left, and saved.
    await cell(page, 'Microneedling', 'minutes').click();
    await expect.poll(() => calls(page, 'save')).toHaveLength(1);
    const [save] = await calls(page, 'save');
    expect(save.partial).toBe(true);
    expect(Object.keys(save.values ?? {}).sort()).toEqual(['per_hour', 'price']);
    expect(save.values?.['price']).toBe(3000);
    // The version it was listed at: a save over someone else's is refused.
    expect(save.version?.['token']).toBeTruthy();
    await expect.poll(async () => (await stored(page, 'clinic.service', 6))['price']).toBe(3000);
    await expect(row(page, 'Hydrafacial')).not.toHaveAttribute('data-changed');
    expect(problems).toEqual([]);
  });

  test('Escape puts back what the cell held, and nothing is saved', async ({ page }) => {
    const { problems } = await prices(page);
    await cell(page, 'Chemical peel', 'minutes').click();
    await cell(page, 'Chemical peel', 'minutes').locator('input').fill('90');
    await page.keyboard.press('Escape');
    await expect(editor(page)).toHaveCount(0);
    await expect(cell(page, 'Chemical peel', 'minutes')).toHaveText('45');
    await expect(cell(page, 'Chemical peel', 'minutes')).toBeFocused();
    await cell(page, 'Hydrafacial', 'name').click();
    await page.keyboard.press('Escape');
    await page.locator('.fd-search-input').click();
    // Nothing changed is nothing to save.
    await expect(row(page, 'Chemical peel')).not.toHaveAttribute('data-changed');
    expect(await calls(page, 'save')).toEqual([]);
    expect(problems).toEqual([]);
  });

  test('from the keyboard: Enter on a row opens its first cell, Enter takes a cell and goes down its column', async ({ page }) => {
    const { problems } = await prices(page);
    await row(page, 'Botox, forehead').focus();
    await page.keyboard.press('Enter');
    await expect(editor(page)).toHaveAttribute('data-col', 'name');
    await expect(row(page, 'Botox, forehead').locator('td[data-col="name"] input')).toBeFocused();
    // Shift+Tab from the row's first cell: the last cell of the row above.
    await page.keyboard.press('Tab');
    await expect(editor(page)).toHaveAttribute('data-col', 'category');
    await page.keyboard.press('Shift+Tab');
    await expect(editor(page)).toHaveAttribute('data-col', 'name');
    // Arrow keys on a cell at rest; Enter in a box takes it and goes down.
    await page.keyboard.press('Escape');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await expect(cell(page, 'Botox, forehead', 'minutes')).toBeFocused();
    await page.keyboard.press('Enter');
    await page.keyboard.type('35');
    await page.keyboard.press('Enter');
    await expect(editor(page)).toHaveCount(0);
    await expect(cell(page, 'Cheek filler, 2 ml', 'minutes')).toBeFocused();
    await expect.poll(() => calls(page, 'save')).toHaveLength(1);
    expect((await calls(page, 'save'))[0].values).toEqual({ minutes: 35, per_hour: 7714 });
    // A key typed on a cell at rest starts it, that key its first.
    await page.keyboard.type('75');
    await expect(cell(page, 'Cheek filler, 2 ml', 'minutes').locator('input')).toHaveValue('75');
    expect(problems).toEqual([]);
  });

  test('a row refused by the page’s rules stays as typed, why said under it; a value worked out from it waits; Put back', async ({ page }) => {
    const { problems } = await prices(page);
    await cell(page, 'Laser, face', 'minutes').click();
    await cell(page, 'Laser, face', 'minutes').locator('input').fill('2');
    await cell(page, 'Laser, full legs', 'name').click();
    await expect(note(page, 'Laser, face')).toBeVisible();
    await expect(note(page, 'Laser, face')).toContainText('Not saved: Minutes must be at least 5.');
    await expect(cell(page, 'Laser, face', 'minutes')).toHaveText('2');
    await expect(cell(page, 'Laser, face', 'minutes')).toHaveAttribute('aria-invalid', 'true');
    // Per hour waits for an answer the form refuses, never worked out from it.
    await expect(cell(page, 'Laser, face', 'per_hour')).toHaveText('—Fix Minutes to see Per hour');
    expect(await calls(page, 'save')).toEqual([]);
    await screen(page, 'list-editable-refused', { viewport: true });
    // Back in it, as typed: never lost.
    await cell(page, 'Laser, face', 'minutes').click();
    await expect(cell(page, 'Laser, face', 'minutes').locator('input')).toHaveValue('2');
    await page.keyboard.press('Escape');
    await note(page, 'Laser, face').getByRole('button', { name: 'Put back' }).click();
    await expect(note(page, 'Laser, face')).toBeHidden();
    await expect(cell(page, 'Laser, face', 'minutes')).toHaveText('20');
    await expect(cell(page, 'Laser, face', 'per_hour')).toHaveText('E£ 3,300');
    expect(problems).toEqual([]);
  });

  test('text that does not read is kept in its cell, marked with why, and the row not saved', async ({ page }) => {
    const { problems } = await prices(page);
    await cell(page, 'Skin consultation', 'price').click();
    const box = cell(page, 'Skin consultation', 'price').locator('input');
    await box.fill('');
    await box.pressSequentially('7x0');
    await cell(page, 'Microneedling', 'name').click();
    await expect(note(page, 'Skin consultation')).toContainText('Not saved:');
    await expect(cell(page, 'Skin consultation', 'price').locator('.fd-list-unread')).toHaveText('7x0');
    expect(await calls(page, 'save')).toEqual([]);
    await cell(page, 'Skin consultation', 'price').click();
    await expect(cell(page, 'Skin consultation', 'price').locator('input')).toHaveValue('7x0');
    expect(problems).toEqual([]);
  });

  test('a service added at the end, saved once it is left, counted in the pager', async ({ page }) => {
    const { problems } = await prices(page);
    await expect(page.locator('.fd-pager-text')).toHaveText('1–13 of 13 services');
    await page.getByRole('button', { name: 'Add a service' }).click();
    const added = page.locator('.fd-list-row[data-new]');
    await expect(added).toHaveCount(1);
    await expect(added.locator('td[data-col="name"] input')).toBeFocused();
    await page.keyboard.type('Laser, back');
    await page.keyboard.press('Tab');
    await expect(editor(page)).toHaveAttribute('data-col', 'category');
    await added.locator('td[data-col="category"] select').selectOption({ label: 'Hair removal' });
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await expect(editor(page)).toHaveAttribute('data-col', 'minutes');
    await page.keyboard.type('45');
    await page.keyboard.press('Tab');
    await page.keyboard.type('2600');
    await page.locator('.fd-search-input').click();
    await expect.poll(() => calls(page, 'save')).toHaveLength(1);
    const [save] = await calls(page, 'save');
    expect(save.id).toBeNull();
    expect(save.values).toMatchObject({ name: 'Laser, back', category: 'hair', minutes: 45, price: 2600 });
    await expect(page.locator('.fd-list-row[data-new]')).toHaveCount(0);
    await expect(row(page, 'Laser, back').locator('td[data-col="name"]')).toHaveText('Laser, back');
    await expect(page.locator('.fd-pager-text')).toHaveText('1–14 of 14 services');
    // A row added and left with nothing in it goes.
    await page.getByRole('button', { name: 'Add a service' }).click();
    await page.locator('.fd-search-input').click();
    await expect(page.locator('.fd-list-row[data-new]')).toHaveCount(0);
    expect(await calls(page, 'save')).toHaveLength(1);
    expect(problems).toEqual([]);
  });

  test('someone else changed the price meanwhile: said under the row as a record’s page says it, Keep mine saves over theirs', async ({ page }) => {
    const { problems } = await prices(page);
    // Mona changes the first row's price on another screen.
    await page.getByRole('button', { name: 'Someone else changes a price' }).click();
    const first = 'Body contouring, one area';
    await cell(page, first, 'minutes').click();
    await cell(page, first, 'minutes').locator('input').fill('100');
    await page.locator('.fd-search-input').click();
    await expect(note(page, first).locator('.fd-conflict')).toBeVisible();
    await expect(note(page, first).locator('.fd-conflict')).toContainText('Mona Adel changed this service');
    await screen(page, 'list-editable-conflict', { viewport: true });
    await note(page, first).getByRole('button', { name: 'Keep mine' }).click();
    await expect(note(page, first)).toBeHidden();
    // Theirs kept where this person changed nothing, the price; this person's, the minutes.
    await expect.poll(async () => (await stored(page, 'clinic.service', 9))['minutes']).toBe(100);
    expect((await stored(page, 'clinic.service', 9))['price']).toBe(7150);
    await expect(cell(page, first, 'minutes')).toHaveText('100');
    expect(problems).toEqual([]);
  });

  test('a block pasted from a spreadsheet goes across and down the rows, each row then saved; one value in many rows in one write', async ({ page }) => {
    const { problems } = await prices(page);
    // Three rows' Minutes and Price, pasted on a cell chosen (opened, then Escape).
    await copy(page, '25\t3800\n35\t4800\n50\t8200\n');
    await cell(page, 'Botox, crow’s feet', 'minutes').click();
    await page.keyboard.press('Escape');
    await page.keyboard.press('ControlOrMeta+V');
    await expect(page.locator('.fd-list-paste-note')).toHaveText('Pasted into 6 cells.');
    await expect.poll(() => calls(page, 'save')).toHaveLength(3);
    await expect(cell(page, 'Botox, crow’s feet', 'price')).toHaveText('E£ 3,800');
    await expect(cell(page, 'Botox, forehead', 'minutes')).toHaveText('35');
    await expect(cell(page, 'Cheek filler, 2 ml', 'price')).toHaveText('E£ 8,200');
    // The same one in three rows: one writeMany, each with the version it was listed at.
    await copy(page, 'Doctor\nDoctor\nDoctor\n');
    await cell(page, 'Laser, face', 'done_by').click();
    await page.keyboard.press('Escape');
    await page.keyboard.press('ControlOrMeta+V');
    await expect.poll(() => calls(page, 'writeMany')).toHaveLength(1);
    const [many] = await calls(page, 'writeMany');
    expect(many.ids).toEqual([13, 12, 11]);
    expect(many.values).toEqual({ done_by: { id: 1, label: 'Doctor' } });
    await expect(cell(page, 'Laser, underarms', 'done_by')).toHaveText('Doctor');
    await screen(page, 'list-editable-pasted', { viewport: true });
    expect(problems).toEqual([]);
  });

  test('a yes or no pressed is answered by the press', async ({ page }) => {
    const { problems } = await prices(page);
    await expect(cell(page, 'Lymphatic drainage', 'active')).toHaveText('');
    await cell(page, 'Lymphatic drainage', 'active').click();
    await expect(cell(page, 'Lymphatic drainage', 'active').locator('input[type="checkbox"]')).toBeChecked();
    await page.locator('.fd-search-input').click();
    await expect.poll(async () => (await stored(page, 'clinic.service', 10))['active']).toBe(true);
    await expect(cell(page, 'Lymphatic drainage', 'active')).toHaveText('✓');
    expect(problems).toEqual([]);
  });

  test('under Group By headings its rows are changed in place, and no row is added', async ({ page }) => {
    const { problems } = await prices(page);
    await page.getByRole('button', { name: 'Search options' }).click();
    await page.locator('.fd-search-panel [data-group-kind="groupBy"]').getByRole('button', { name: 'Category' }).click();
    await page.keyboard.press('Escape');
    await expect(page.locator('.fd-list-group')).toHaveCount(4);
    await expect(page.getByRole('button', { name: 'Add a service' })).toBeHidden();
    await page.locator('.fd-group-toggle', { has: page.locator('.fd-group-label', { hasText: /^Skin$/ }) }).click();
    await cell(page, 'Hydrafacial', 'minutes').click();
    await cell(page, 'Hydrafacial', 'minutes').locator('input').fill('50');
    await page.keyboard.press('Tab');
    await expect(editor(page)).toHaveAttribute('data-col', 'price');
    await page.locator('.fd-search-input').click();
    await expect.poll(async () => (await stored(page, 'clinic.service', 6))['minutes']).toBe(50);
    expect(problems).toEqual([]);
  });

  test('a row kept from the search until it is saved or put back: its work stays in sight', async ({ page }) => {
    const { problems } = await prices(page);
    await cell(page, 'Laser, face', 'minutes').click();
    await cell(page, 'Laser, face', 'minutes').locator('input').fill('2');
    await page.locator('.fd-search-input').fill('Botox');
    await page.keyboard.press('Enter');
    await expect(page.locator('.fd-list-row')).toHaveCount(3);
    await expect(row(page, 'Laser, face')).toHaveAttribute('data-kept', '');
    await expect(note(page, 'Laser, face')).toContainText('Not saved: Minutes must be at least 5.');
    await note(page, 'Laser, face').getByRole('button', { name: 'Put back' }).click();
    await expect(cell(page, 'Laser, face', 'minutes')).toHaveText('20');
    expect(problems).toEqual([]);
  });

  test('the columns a person chose: Tab goes across them in their order, a hidden one passed', async ({ page }) => {
    const { problems } = await prices(page);
    await page.locator('.fd-list-columns-button').click();
    await page.locator('.fd-list-columns-item', { hasText: 'Done by' }).locator('input[type="checkbox"]').uncheck();
    await page.keyboard.press('Escape');
    await cell(page, 'Hydrafacial', 'category').click();
    await page.keyboard.press('Tab');
    await expect(editor(page)).toHaveAttribute('data-col', 'minutes');
    expect(problems).toEqual([]);
  });
});

test.describe('a front desk’s week of hours', () => {
  test('hours typed as hours and minutes, the week added up as they are typed; a week over 48 refused by the server with why', async ({ page }) => {
    const { problems } = await open(page, 'plain', 'page=staff-hours&skin=underline');
    await expect(row(page, 'Hana Wael')).toBeVisible();
    // Names and roles are not changed here; Add a line is not offered.
    await expect(cell(page, 'Hana Wael', 'name')).not.toHaveAttribute('data-edit');
    await expect(page.locator('.fd-list-add')).toHaveCount(0);
    await cell(page, 'Hana Wael', 'wed').click();
    await cell(page, 'Hana Wael', 'wed').locator('input').fill('9:30');
    await page.keyboard.press('Tab');
    await expect(cell(page, 'Hana Wael', 'week')).toHaveText('54:30');
    await page.locator('.fd-search-input').click();
    await expect(note(page, 'Hana Wael')).toContainText('Not saved: Hana Wael would work 54:30 hours this week: the labour rules allow 48.');
    await expect(cell(page, 'Hana Wael', 'wed')).toHaveText('09:30');
    await screen(page, 'list-editable-hours-refused', { viewport: true });
    // Fixed, and left: saved.
    await cell(page, 'Hana Wael', 'thu').click();
    await cell(page, 'Hana Wael', 'thu').locator('input').fill('2:30');
    await page.locator('.fd-search-input').click();
    await expect(note(page, 'Hana Wael')).toBeHidden();
    await expect.poll(async () => (await stored(page, 'staff.week', 5))['week']).toBe(48);
    expect(problems).toEqual([]);
  });
});

test.describe('a pipeline’s deal stages', () => {
  test('a stage’s chance of winning typed as a per cent, and the won stage the sales manager’s alone', async ({ page }) => {
    const { problems } = await open(page, 'plain', 'page=deal-stages&skin=underline');
    await expect(row(page, 'Offer')).toBeVisible();
    await expect(row(page, 'Won').locator('td[data-edit]')).toHaveCount(0);
    await cell(page, 'Offer', 'probability').click();
    await cell(page, 'Offer', 'probability').locator('input').fill('65');
    await page.locator('.fd-search-input').click();
    await expect.poll(async () => (await stored(page, 'deal.stage', 4))['probability']).toBe(0.65);
    await expect(cell(page, 'Offer', 'probability')).toHaveText('65%');
    expect(problems).toEqual([]);
  });
});

test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('a service’s card changed in a sheet over the list, saved as Done closes it', async ({ page }) => {
    const { problems } = await prices(page);
    await expect(page.locator('.fd-list[data-as="cards"]')).toBeVisible();
    await row(page, 'Hydrafacial').locator('.fd-list-card').click();
    const sheet = page.getByRole('dialog');
    await expect(sheet).toBeVisible();
    await expect(sheet).toContainText('Change Hydrafacial');
    await sheet.getByLabel('Price').fill('3100');
    await screen(page, 'list-editable-phone-sheet', { viewport: true });
    await sheet.getByRole('button', { name: 'Save & Close' }).click();
    await expect(sheet).toHaveCount(0);
    await expect.poll(async () => (await stored(page, 'clinic.service', 6))['price']).toBe(3100);
    await expect(row(page, 'Hydrafacial').locator('.fd-list-card')).toContainText('3,100');
    expect(problems).toEqual([]);
  });
});
