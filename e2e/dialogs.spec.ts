import { expect, test, type Page } from '@playwright/test';
import { node, open, screen } from './support';
import { VARIANTS } from './variants';

/** Records opened, made, searched and edited in dialogs, in every framework. */
const value = (page: Page, name: string) => page.evaluate((n) => (window as any).fieldiaDemo.handle.form.getState().values[n], name);
const partners = (page: Page) => page.evaluate(() => (window as any).fieldiaDemo.dataSource.records.partner as Record<number, Record<string, unknown>>);
const holdsFocus = (page: Page) => page.getByRole('dialog').evaluate((el) => el.contains(document.activeElement));

for (const variant of VARIANTS) {
  test.describe(`${variant} · dialogs`, () => {
    test('Create and edit… opens the customer page with the typed name, and Save & Close links the new client', async ({ page }) => {
      await open(page, variant, 'page=fields&skin=outlined');
      const client = node(page, 'f-client').getByRole('combobox');
      await client.fill('Hilton Cairo');
      await node(page, 'f-client').getByRole('option', { name: 'Create and edit…' }).click();
      const dialog = page.getByRole('dialog', { name: 'Client' });
      await expect(dialog.locator('[data-node="#title"] input')).toHaveValue('Hilton Cairo');
      expect(await holdsFocus(page)).toBe(true);
      await dialog.locator('[data-node="f-email"] input').fill('events@hiltoncairo.example');
      await screen(page, `${variant}-dialog-create-and-edit`, { viewport: true });
      await dialog.getByRole('button', { name: 'Save & Close' }).click();
      await expect(dialog).toBeHidden();
      await expect(client).toHaveValue('Hilton Cairo');
      await expect(client).toBeFocused();
      const made = (await value(page, 'client_id')) as { id: number; label: string };
      expect(made).toEqual({ id: expect.any(Number), label: 'Hilton Cairo' });
      expect((await partners(page))[made.id]).toEqual(expect.objectContaining({ name: 'Hilton Cairo', email: 'events@hiltoncairo.example' }));
    });

    test('the open button edits the linked client in a large dialog that keeps Tab inside, and the link follows its new name', async ({ page }) => {
      await open(page, variant, 'page=fields&skin=outlined');
      await node(page, 'f-client').getByRole('button', { name: 'Open Nile Traders' }).click();
      const dialog = page.getByRole('dialog', { name: 'Nile Traders' });
      const name = dialog.locator('[data-node="#title"] input');
      await expect(name).toHaveValue('Nile Traders');
      await expect(dialog.locator('[data-node="f-email"] input')).toHaveValue('orders@niletraders.example');
      // Large: most of a wide window, never past it.
      const box = (await dialog.boundingBox())!;
      const width = page.viewportSize()!.width;
      expect(box.width).toBeGreaterThan(Math.min(900, width * 0.8));
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(width);
      // The record fills it: no empty column where the page would keep its chatter.
      const sheet = (await dialog.locator('.fd-card').first().boundingBox())!;
      expect(sheet.width, 'the sheet leaves the dialog half empty').toBeGreaterThan(box.width - 60);
      await expect(dialog.locator('.fd-side')).toBeHidden();
      await name.fill('Nile Traders Ltd');
      const saveClose = dialog.getByRole('button', { name: 'Save & Close' });
      await saveClose.focus();
      await page.keyboard.press('Tab');
      expect(await holdsFocus(page)).toBe(true);
      await page.keyboard.press('Shift+Tab');
      await expect(saveClose).toBeFocused();
      await screen(page, `${variant}-dialog-open-record`, { viewport: true });
      await saveClose.click();
      await expect(dialog).toBeHidden();
      await expect(node(page, 'f-client').getByRole('combobox')).toHaveValue('Nile Traders Ltd');
      await expect(node(page, 'f-client').getByRole('button', { name: 'Open Nile Traders Ltd' })).toBeFocused();
      expect((await partners(page))[1]['name']).toBe('Nile Traders Ltd');
    });

    test('Escape and Discard close a dialog and keep nothing typed in it', async ({ page }) => {
      await open(page, variant, 'page=fields&skin=outlined');
      const opener = node(page, 'f-client').getByRole('button', { name: 'Open Nile Traders' });
      for (const leave of ['Escape', 'Discard']) {
        await opener.click();
        const dialog = page.getByRole('dialog', { name: 'Nile Traders' });
        await dialog.locator('[data-node="#title"] input').fill('Someone else');
        if (leave === 'Escape') await page.keyboard.press('Escape');
        else await dialog.getByRole('button', { name: 'Discard' }).click();
        await expect(dialog).toBeHidden();
        await expect(opener).toBeFocused();
      }
      await expect(node(page, 'f-client').getByRole('combobox')).toHaveValue('Nile Traders');
      expect((await partners(page))[1]['name']).toBe('Nile Traders');
    });

    test('Search more… shows every client, searches them, and picks one from the keyboard', async ({ page }) => {
      await open(page, variant, 'page=fields&skin=outlined');
      const client = node(page, 'f-client').getByRole('combobox');
      await client.click();
      const options = node(page, 'f-client').getByRole('option');
      await expect(options).toHaveCount(9);
      await expect(options.last()).toHaveText('Search more…');
      await options.last().click();
      const dialog = page.getByRole('dialog', { name: 'Client' });
      await expect(dialog.getByRole('option')).toHaveCount(12);
      await expect(dialog.getByRole('searchbox')).toBeFocused();
      // A list of rows, not of bullet points.
      expect(await dialog.getByRole('listbox').evaluate((list) => getComputedStyle(list).listStyleType)).toBe('none');
      const [first, second] = [(await dialog.getByRole('option').nth(0).boundingBox())!, (await dialog.getByRole('option').nth(1).boundingBox())!];
      const list = (await dialog.getByRole('listbox').boundingBox())!;
      expect(first.width, 'a row spans the list').toBeGreaterThan(list.width - 4);
      expect(second.y - (first.y + first.height)).toBeLessThan(2);
      await screen(page, `${variant}-dialog-search-more`, { viewport: true });
      await page.keyboard.type('zam');
      await expect(dialog.getByRole('option')).toHaveText(['Zamalek Studio']);
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('Enter');
      await expect(dialog).toBeHidden();
      await expect(client).toHaveValue('Zamalek Studio');
      expect(await value(page, 'client_id')).toEqual({ id: 30, label: 'Zamalek Studio' });
    });

    test('a line opens in a dialog with all its fields, its subtotal follows there, and Save & Close writes it to the grid', async ({ page }) => {
      await open(page, variant, 'page=order&skin=underline');
      const grid = node(page, 'f-lines');
      const cell = (row: number, col: string) => grid.locator(`.ag-row[row-index="${row}"] .ag-cell[col-id="${col}"]`);
      await expect(cell(1, 'subtotal')).toHaveText('E£21,546.00');
      await cell(1, '__open').getByRole('button', { name: 'Open line' }).click();
      const dialog = page.getByRole('dialog', { name: 'Order lines' });
      await expect(dialog.getByLabel('Description')).toHaveValue('Black mesh back');
      // A column the grid hides is in the dialog too.
      await expect(dialog.getByLabel('Lead time (days)')).toHaveValue('14');
      await expect(dialog.getByLabel('Line type')).toHaveCount(0);
      // Its title once, in its head; its fields on the dialog's own surface, clear of its edges.
      await expect(page.getByRole('heading', { name: 'Order lines' })).toHaveCount(1);
      const edge = (await dialog.boundingBox())!;
      const label = (await dialog.locator('.fd-label').first().boundingBox())!;
      expect(label.x - edge.x, 'the labels touch the dialog edge').toBeGreaterThanOrEqual(16);
      const surfaces = await dialog.evaluate((el) => {
        const body = el.querySelector('.fd-form-dialog-body')!;
        const head = el.querySelector('.fd-form-dialog-head')!;
        return [getComputedStyle(body).backgroundColor, getComputedStyle(head).backgroundColor];
      });
      expect(surfaces[0], 'the fields sit on the page grey').toBe(surfaces[1]);
      await dialog.getByLabel('Quantity').fill('15');
      await expect(dialog.locator('[data-node="values-subtotal"] input')).toHaveValue('26,932.50');
      await expect(cell(1, 'subtotal')).toHaveText('E£21,546.00');
      await screen(page, `${variant}-dialog-order-line`, { viewport: true });
      await dialog.getByRole('button', { name: 'Save & Close' }).click();
      await expect(dialog).toBeHidden();
      await expect(cell(1, 'subtotal')).toHaveText('E£26,932.50');
      await expect.poll(() => value(page, 'amount_untaxed')).toBe(70042.5);
    });
  });
}

test('a dialog wears the look of the page that opened it: the dark scheme on its box, its page and its buttons', async ({ page }) => {
  await open(page, 'plain', 'page=fields&skin=outlined&scheme=dark');
  const client = node(page, 'f-client').getByRole('combobox');
  await client.fill('Hilton Cairo');
  await node(page, 'f-client').getByRole('option', { name: 'Create and edit…' }).click();
  const dialog = page.getByRole('dialog', { name: 'Client' });
  await expect(dialog.locator('[data-node="#title"] input')).toHaveValue('Hilton Cairo');
  const colours = () =>
    dialog.evaluate((el) => {
      const input = el.querySelector('input.fd-input') as HTMLElement;
      const primary = el.querySelector('.fd-form-dialog-foot .fd-button-primary') as HTMLElement | null;
      return {
        scheme: getComputedStyle(el).colorScheme,
        ground: getComputedStyle(el).backgroundColor,
        text: getComputedStyle(input).color,
        primary: primary ? getComputedStyle(primary).backgroundColor : null,
      };
    });
  // The dark tokens: ground #16191e, words #e8eaed, the dark accent #5aa2ff.
  expect(await colours()).toEqual({ scheme: 'dark', ground: 'rgb(22, 25, 30)', text: 'rgb(232, 234, 237)', primary: 'rgb(90, 162, 255)' });
  await screen(page, 'dialog-dark-create', { viewport: true });
  await dialog.getByRole('button', { name: 'Discard' }).click();
  await expect(dialog).toBeHidden();
  await client.fill('');
  await client.click();
  await node(page, 'f-client').getByRole('option', { name: 'Search more…' }).click();
  await expect(dialog.getByRole('searchbox')).toBeFocused();
  await expect(dialog.getByRole('option')).toHaveCount(12);
  expect(await colours()).toEqual({ scheme: 'dark', ground: 'rgb(22, 25, 30)', text: 'rgb(232, 234, 237)', primary: null });
  await screen(page, 'dialog-dark-search', { viewport: true });
});
