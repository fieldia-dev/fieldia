import { type Page } from '@playwright/test';
import { expect, test } from './fixtures';

/**
 * A button's run of steps hands the app the record's values (`call`, or a button's own `action`): as Flectra pages
 * do, "Send" is [call action_invoice_sent, save]. docs/plans/input-rules.md §1 says a button's key reaches readTyped
 * through "a run of steps", waiting for a name looked up. But a run reads nothing typed unless a save or a check is in
 * it, and then only when that step comes: the app is handed a whole number made by dropping the keys held after a
 * refused one ("1.5" → 1), the record a link's name typed was replacing, and the old value under text that does not
 * read — and acts on it, before the save after it refuses.
 */

const RECORD = {
  fieldia: '0.1',
  id: 'quote',
  title: 'Quote',
  data: { kind: 'record', model: 'quote' },
  fields: {
    name: { type: 'char', label: 'Name' },
    seats: { type: 'integer', label: 'Seats' },
    who: { type: 'many2one', label: 'Customer', relation: 'person' },
  },
  layout: {
    type: 'sections',
    id: 's',
    children: [
      { type: 'field', id: 'f-name', field: 'name' },
      { type: 'field', id: 'f-seats', field: 'seats' },
      { type: 'field', id: 'f-who', field: 'who' },
      // As real-invoice.page.json's Send: the app's action, then a save.
      { type: 'button', id: 'b-send', label: 'Send quote', hotkey: 'k', steps: [{ do: 'call', action: 'send_quote' }, { do: 'save' }] },
      // A step that works a field out from another: the name from the seats.
      { type: 'button', id: 'b-name', label: 'Name it', hotkey: 'j', steps: [{ do: 'set', field: 'name', value: "'Seats: ' + seats" }] },
    ],
  },
};

/** The quote, its app's actions kept with the values each was handed. */
async function quote(page: Page) {
  const problems: string[] = [];
  page.on('pageerror', (error) => problems.push(`page error: ${error.message}`));
  await page.goto('/script/');
  await expect(page.locator('.fd-form')).toBeVisible();
  await page.evaluate(async (shown) => {
    const fieldia = (window as any).Fieldia;
    const demo = (window as any).fieldiaDemo;
    const dataSource = fieldia.createMemoryDataSource({ records: { quote: { 1: { name: 'Fit-out', seats: 3, who: null } }, person: { 1: { name: 'Mona' }, 2: { name: 'Omar' } } } });
    const handed: Record<string, unknown>[] = [];
    (window as any).handed = handed;
    demo.handle.destroy();
    demo.handle = fieldia.mountViewer(document.getElementById('app'), { page: shown, dataSource, recordId: 1, onAction: (request: { values: Record<string, unknown> }) => void handed.push(request.values) });
    await demo.handle.drawn;
  }, RECORD);
  return problems;
}
const handed = (page: Page) => page.evaluate(() => (window as any).handed as Record<string, unknown>[]);

test('Alt+K on Send with "1.5" typed in a whole number never hands the app 1 seat', async ({ page }) => {
  const problems = await quote(page);
  const seats = page.locator('[data-node="f-seats"] input');
  await seats.click();
  await seats.press('Control+A');
  await page.keyboard.type('1.5');
  // Typed key by key, it could still be "1.500" (a thousand and a half, written the other way round): the box holds it
  // all, and the field the 1 it took on the way.
  await expect(seats).toHaveValue('1.5');
  await page.keyboard.press('Alt+k');
  await expect.poll(async () => (await page.evaluate(() => (window as any).fieldiaDemo.handle.form.getState().status)) !== 'saving').toBe(true);
  await page.waitForTimeout(300);
  expect((await handed(page)).map((values) => values['seats'])).not.toContain(1);
  expect(problems).toEqual([]);
});

test('Alt+K on Send with a customer’s name typed hands the app the customer it names, as a save waits for it', async ({ page }) => {
  const problems = await quote(page);
  const who = page.locator('[data-node="f-who"] input');
  await who.click();
  await page.keyboard.type('Omar');
  await page.keyboard.press('Alt+k');
  await expect.poll(async () => (await handed(page)).length).toBeGreaterThan(0);
  expect((await handed(page))[0]['who']).toMatchObject({ id: 2, label: 'Omar' });
  expect(problems).toEqual([]);
});

test('Send pressed over seats left as "12a" does not run the app’s action on the old 3 before its save refuses', async ({ page }) => {
  const problems = await quote(page);
  const seats = page.locator('[data-node="f-seats"] input');
  await seats.click();
  await seats.press('Control+A');
  await page.keyboard.type('12a');
  await page.locator('#app button', { hasText: 'Send quote' }).click();
  await expect(seats).toHaveValue('12a');
  await expect(page.locator('[data-node="f-seats"] .fd-error')).toContainText('12a');
  await page.waitForTimeout(300);
  // The save after it refused: the quote was not sent with 3 seats meanwhile.
  expect(await handed(page)).toEqual([]);
  expect(problems).toEqual([]);
});

test('Alt+J on a button that sets the name from the seats, "1.5" typed in them, never works it out from 1', async ({ page }) => {
  const problems = await quote(page);
  const seats = page.locator('[data-node="f-seats"] input');
  await seats.click();
  await seats.press('Control+A');
  await page.keyboard.type('1.5');
  await page.keyboard.press('Alt+j');
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => (window as any).fieldiaDemo.handle.form.getState().values.name)).not.toBe('Seats: 1');
  expect(problems).toEqual([]);
});
