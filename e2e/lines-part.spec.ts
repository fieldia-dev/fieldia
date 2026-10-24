import { type Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { screen } from './support';

/**
 * A table of lines (a one2many's) and a many2many's table of records come in
 * the lines part, loaded the first time a page shows one (parts.ts in
 * @fieldia/widgets).
 *
 * From one <script> tag: a page with no table asks for no file but fieldia.js;
 * a page with one asks for fieldia.lines.js beside it and is drawn whole once
 * it came — nothing of it before, so no line moves and no focus is lost — and
 * its cells are typed in at once. A table an app draws without waiting shows
 * its lines as plain words meanwhile, keeps its value, and is the table, with
 * its lines as they are by then, once the part comes. As an app's bundler
 * builds it (the plain demo, each part a chunk): a page with no table asks for
 * no lines chunk; one with a table asks for it once.
 */

const ORDER = {
  fieldia: '0.1',
  id: 'order',
  title: 'An order',
  data: { kind: 'responses' },
  fields: {
    customer: { type: 'char', label: 'Customer' },
    line_ids: {
      type: 'one2many',
      label: 'Items',
      relation: 'order.line',
      fields: { name: { type: 'char', label: 'Item' }, quantity: { type: 'integer', label: 'Quantity' }, price: { type: 'monetary', label: 'Price', currency: 'EGP' } },
    },
  },
  layout: {
    type: 'sections',
    id: 'root',
    children: [
      {
        type: 'section',
        id: 's',
        children: [
          { type: 'field', id: 'f-customer', field: 'customer' },
          { type: 'field', id: 'f-lines', field: 'line_ids', columns: ['name', 'quantity', 'price'], totals: ['quantity'] },
        ],
      },
    ],
  },
};
const LINES = [
  { key: 'a', values: { name: 'Desk', quantity: 2, price: 1200 } },
  { key: 'b', values: { name: 'Chair', quantity: 4, price: 450 } },
];

function watch(page: Page) {
  const problems: string[] = [];
  page.on('console', (message) => message.type() === 'error' && problems.push(`console: ${message.text()}`));
  page.on('pageerror', (error) => problems.push(`page error: ${error.message}`));
  return problems;
}

/** The script files a page asked for, beside fieldia.js. */
function scripts(page: Page) {
  const requested: string[] = [];
  page.on('request', (request) => requested.push(new URL(request.url()).pathname));
  // The demo's memory source's members come in a part of their own as it is first asked, and Ctrl+Z's as a form is
  // first entered (script.spec): the source's and every form's, not the page's.
  return () => requested.filter((path) => /\/fieldia(\.\w+)?\.js$/.test(path) && !/\/fieldia\.(memory|undo)\.js$/.test(path)).sort();
}

test.describe('a table of lines in a part of its own', () => {
  test('from one script tag: fieldia.lines.js asked for the first time a page shows a table, the page drawn whole once it came, typed in at once', async ({ page }) => {
    const problems = watch(page);
    const asked = scripts(page);
    await page.goto('/script/');
    await expect(page.locator('.fd-form')).toBeVisible();
    await page.waitForLoadState('networkidle');
    // A page with no table asked for no lines part.
    expect(asked()).toEqual(['/script/fieldia.js']);
    const drawnAtOnce = await page.evaluate(
      ([shown, lines]) => {
        const fieldia = (window as any).Fieldia;
        const demo = (window as any).fieldiaDemo;
        demo.handle.destroy();
        demo.handle = fieldia.mountViewer(document.getElementById('app'), { page: shown, values: { customer: 'Nile Crest', line_ids: lines }, skin: 'outlined' });
        return !!document.querySelector('#app [data-node]');
      },
      [ORDER, LINES] as const,
    );
    // Nothing of it before its part came: no plain words to read and lose, nothing to move.
    expect(drawnAtOnce).toBe(false);
    const table = page.locator('[data-node="f-lines"] .fd-lines-table');
    await expect(table).toBeVisible();
    // The loading part beside the page's own: its skeleton while they come — asked for, never waited for.
    expect(asked()).toEqual(['/script/fieldia.js', '/script/fieldia.lines.js', '/script/fieldia.loading.js']);
    await expect(page.locator('#app .fd-lines-plain')).toHaveCount(0);
    await expect(table.locator('tbody tr')).toHaveCount(2);
    await expect(table.locator('tfoot td[data-column="quantity"]')).toHaveText('6');
    // Its own sheet, right after Fieldia's.
    expect(await page.evaluate(() => document.getElementById('fieldia-lines-styles')?.previousElementSibling?.id)).toBe('fieldia-styles');

    // A cell typed in at once; a line added and typed in; the total kept up.
    const quantity = table.locator('tr[data-line="b"] td[data-column="quantity"] input');
    await quantity.click();
    await quantity.press('Control+A');
    await page.keyboard.type('5');
    await page.keyboard.press('Tab');
    await expect(table.locator('tfoot td[data-column="quantity"]')).toHaveText('7');
    await page.locator('[data-node="f-lines"] .fd-lines-add').click();
    await page.keyboard.type('Lamp');
    await expect(table.locator('tbody tr')).toHaveCount(3);
    const lines = await page.evaluate(() => (window as any).fieldiaDemo.handle.form.getState().values.line_ids.map((line: any) => [line.values.name, line.values.quantity]));
    expect(lines).toEqual([
      ['Desk', 2],
      ['Chair', 5],
      ['Lamp', null],
    ]);
    await screen(page, 'lines-part-script');
    // Asked for once.
    expect(asked()).toEqual(['/script/fieldia.js', '/script/fieldia.lines.js', '/script/fieldia.loading.js']);
    expect(problems).toEqual([]);
  });

  test('a table an app draws without waiting: its lines as plain words meanwhile, its value kept, then the table with its lines as they are by then', async ({ page }) => {
    const problems = watch(page);
    const asked = scripts(page);
    // The part held back until the test lets it come.
    let release: () => void = () => undefined;
    const held = new Promise<void>((done) => (release = done));
    await page.route('**/fieldia.lines.js', async (route) => {
      await held;
      await route.continue();
    });
    await page.goto('/script/');
    await expect(page.locator('.fd-form')).toBeVisible();
    await page.evaluate(
      ([shown, lines]) => {
        const fieldia = (window as any).Fieldia;
        const demo = (window as any).fieldiaDemo;
        demo.handle.destroy();
        // The app's own form and widgets, drawn at once, waiting for nothing.
        const form = fieldia.createForm({ page: shown, values: { customer: 'Nile Crest', line_ids: lines } });
        const app = document.getElementById('app') as HTMLElement;
        app.replaceChildren();
        const make = (name: string) => {
          const widget = fieldia.createWidget({ form, name, field: shown.fields[name], node: (shown.layout as any).children[0].children.find((n: any) => n.field === name), id: `own-${name}`, document });
          const box = document.createElement('div');
          box.className = 'fd-form';
          box.dataset['own'] = name;
          box.append(widget.element);
          app.append(box);
          const update = () => widget.update({ value: form.getState().values[name], values: form.getState().values, readonly: false, required: false, invalid: false });
          form.subscribe(update);
          update();
          return widget;
        };
        make('customer');
        make('line_ids');
        (window as any).ownForm = form;
      },
      [ORDER, LINES] as const,
    );
    await expect.poll(asked).toEqual(['/script/fieldia.js', '/script/fieldia.lines.js']);
    // Meanwhile: each line as plain words, read only.
    const plain = page.locator('[data-own="line_ids"] .fd-lines-plain');
    await expect(plain.locator('[role="listitem"]')).toHaveText([/^Desk · 2 · E£\s1,200\.00$/, /^Chair · 4 · E£\s450\.00$/]);
    await expect(plain.locator('input, button')).toHaveCount(0);
    // Typed meanwhile, in the app's box beside it; and a line the app adds and one it changes, shown as they come.
    await page.locator('[data-own="customer"] input').fill('Nile Crest Trading');
    await page.evaluate(() => {
      const form = (window as any).ownForm;
      form.updateLine('line_ids', 'b', 'quantity', 6);
      form.addLine('line_ids', { name: 'Lamp', quantity: 1, price: 300 });
    });
    await expect(plain.locator('[role="listitem"]')).toHaveText([/^Desk/, /^Chair · 6/, /^Lamp · 1/]);
    await screen(page, 'lines-part-plain');
    const before = await page.evaluate(() => JSON.stringify((window as any).ownForm.getState().values));

    release();
    // The table in its place, its lines as they were by then; the value as it was, nothing lost or added.
    const table = page.locator('[data-own="line_ids"] .fd-lines-table');
    await expect(table.locator('tbody tr')).toHaveCount(3);
    await expect(page.locator('[data-own="line_ids"] .fd-lines-plain')).toHaveCount(0);
    await expect(table.locator('tr[data-line="b"] td[data-column="quantity"] input')).toHaveValue('6');
    expect(await page.evaluate(() => JSON.stringify((window as any).ownForm.getState().values))).toBe(before);
    expect(await page.evaluate(() => (window as any).ownForm.getState().values.customer)).toBe('Nile Crest Trading');
    // Typed in at once.
    const name = table.locator('tbody tr').nth(2).locator('td[data-column="name"] input');
    await name.click();
    await page.keyboard.press('End');
    await page.keyboard.type(' shade');
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => (window as any).ownForm.getState().values.line_ids[2].values.name)).toBe('Lamp shade');
    expect(problems).toEqual([]);
  });

  test('as an app’s bundler builds it: a page with no table asks for no lines chunk; one with a table asks for it once, typed in at once', async ({ page }) => {
    const problems = watch(page);
    const chunks: string[] = [];
    // The lines part's chunk, named by its module (lines-part.ts) as the bundler names a chunk loaded on demand.
    page.on('request', (request) => {
      const url = new URL(request.url()).pathname;
      if (/\/chunks\/lines-part-[^/]+\.js$/.test(url)) chunks.push(url);
    });
    await page.goto('/plain/?page=signup&skin=outlined');
    await expect(page.locator('.fd-form [data-node]').first()).toBeVisible();
    await page.waitForLoadState('networkidle');
    expect(chunks).toEqual([]);
    await page.goto('/plain/?page=rules&skin=outlined');
    const table = page.locator('.fd-lines-table').first();
    await expect(table).toBeVisible();
    await page.waitForLoadState('networkidle');
    expect(chunks).toHaveLength(1);
    await page.locator('.fd-lines-add').first().click();
    const cell = table.locator('tbody tr').last().locator('input').first();
    await expect(cell).toBeFocused();
    await page.keyboard.type('Gift wrap');
    await expect(cell).toHaveValue('Gift wrap');
    expect(problems).toEqual([]);
  });
});
