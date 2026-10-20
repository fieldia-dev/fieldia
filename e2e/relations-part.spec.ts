import { type Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { screen } from './support';

/**
 * A link to other records — a many2one's and a reference's box, a many2many's
 * tags and checkboxes, a char field's tags — comes in the relations part,
 * loaded the first time a page shows one (parts.ts in @fieldia/widgets); a
 * long choice's search box and several answers as tags in the choice part, a
 * one2many's cards in the lines part, a value to copy and a timer in the
 * business part (0.25).
 *
 * From one <script> tag: a page with no link asks for no file but fieldia.js;
 * a page with a many2one asks for fieldia.relations.js beside it, and is drawn
 * whole once it came — nothing of it before. A box made before the part came,
 * by an app that did not wait for it, keeps what is typed in it: the part's own
 * box takes it as typed, the focus with it; words left in it before are looked
 * up by their exact name. As an app's bundler builds it (the plain demo, each
 * part a chunk): a page with no link asks for no relations chunk; a customer's
 * sheet asks for it once.
 */

const FIELDS = {
  name: { type: 'char', label: 'Name' },
  partner: { type: 'many2one', label: 'Customer', relation: 'partner' },
  tag_ids: { type: 'many2many', label: 'Tags', relation: 'tag' },
};
const ORDER = {
  fieldia: '0.6',
  id: 'order',
  title: 'Order',
  data: { kind: 'record', model: 'sale.order' },
  fields: FIELDS,
  layout: {
    type: 'sections',
    id: 's',
    children: [
      { type: 'field', id: 'f-name', field: 'name' },
      { type: 'field', id: 'f-partner', field: 'partner' },
      { type: 'field', id: 'f-tags', field: 'tag_ids' },
    ],
  },
};
const RECORDS = { partner: { 1: { name: 'Nile Traders' }, 2: { name: 'Delta Foods' } }, tag: { 1: { name: 'Urgent' }, 2: { name: 'Export' } } };

function watch(page: Page) {
  const problems: string[] = [];
  page.on('console', (message) => message.type() === 'error' && problems.push(`console: ${message.text()}`));
  page.on('pageerror', (error) => problems.push(`page error: ${error.message}`));
  return problems;
}

/** The scripts a page asked for, by their paths. */
function scripts(page: Page) {
  const requested: string[] = [];
  page.on('request', (request) => requested.push(new URL(request.url()).pathname));
  // The demo's memory source's members come in a part of their own as it is first asked (script.spec): the source's.
  return () => requested.filter((path) => /\/fieldia(\.\w+)?\.js$/.test(path) && !path.endsWith('/fieldia.memory.js')).sort();
}

test.describe('a link to other records in a part of its own', () => {
  test('a page with a many2one asks for fieldia.relations.js, drawn whole once it came; a page with none never asks', async ({ page }) => {
    const problems = watch(page);
    const asked = scripts(page);
    await page.goto('/script/');
    await expect(page.locator('.fd-form')).toBeVisible();
    await page.waitForLoadState('networkidle');
    // The demo's own page: no link, no relations part.
    expect(asked()).toEqual(['/script/fieldia.js']);
    const drawnAtOnce = await page.evaluate(
      ([shown, records]) => {
        const fieldia = (window as any).Fieldia;
        const demo = (window as any).fieldiaDemo;
        demo.handle.destroy();
        demo.handle = fieldia.mountViewer(document.getElementById('app'), { page: shown, dataSource: fieldia.createMemoryDataSource({ records }), values: { tag_ids: [{ id: 1, label: 'Urgent' }] } });
        return !!document.querySelector('#app [data-node]');
      },
      [ORDER, RECORDS] as const
    );
    // Nothing of it before its part came: nothing to move.
    expect(drawnAtOnce).toBe(false);
    await page.evaluate(() => (window as any).fieldiaDemo.handle.drawn);
    const box = page.locator('[data-node="f-partner"] input[role="combobox"]');
    await expect(box).toBeVisible();
    await expect(page.locator('[data-node="f-tags"] .fd-chip')).toHaveText(['Urgent×']);
    expect(asked()).toEqual(['/script/fieldia.js', '/script/fieldia.relations.js']);
    // Typed and picked as ever: the list of matches, a record taken.
    await box.click();
    await page.keyboard.type('Del');
    await expect(page.locator('.fd-listbox [role="option"]', { hasText: 'Delta Foods' })).toBeVisible();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await expect(box).toHaveValue('Delta Foods');
    await screen(page, 'relations-part-drawn');
    expect(asked()).toEqual(['/script/fieldia.js', '/script/fieldia.relations.js']);
    expect(problems).toEqual([]);
  });

  test('a box made before its part came keeps what is typed in it: the part’s box takes it as typed, the focus with it; words left in another are looked up', async ({ page }) => {
    const problems = watch(page);
    const asked = scripts(page);
    // The part held back until the person has typed: as on a slow line.
    let release: () => void = () => undefined;
    const held = new Promise<void>((done) => (release = done));
    await page.route('**/fieldia.relations.js', async (route) => {
      await held;
      await route.continue();
    });
    await page.goto('/script/');
    await expect(page.locator('.fd-form')).toBeVisible();
    // An app that draws its fields itself, not waiting for their part: two links to a customer.
    await page.evaluate((records) => {
      const fieldia = (window as any).Fieldia;
      const fields = { partner: { type: 'many2one', label: 'Customer', relation: 'partner' }, payer: { type: 'many2one', label: 'Payer', relation: 'partner' } };
      const shown = { fieldia: '0.6', id: 'own', data: { kind: 'record', model: 'sale.order' }, fields, layout: { type: 'sections', id: 's', children: [] } };
      const form = fieldia.createForm({ page: shown, values: { partner: { id: 1, label: 'Nile Traders' }, payer: null }, dataSource: fieldia.createMemoryDataSource({ records }) });
      const host = document.createElement('div');
      host.id = 'own';
      document.body.append(host);
      const widgets = (['payer', 'partner'] as const).map((name) => {
        const widget = fieldia.createWidget({ form, name, field: fields[name], node: { type: 'field', id: `f-${name}`, field: name }, id: `own-${name}`, document });
        host.append(widget.element);
        return [name, widget] as const;
      });
      const refresh = () => {
        for (const [name, widget] of widgets) widget.update({ value: form.getState().values[name], values: form.getState().values, readonly: false, required: false, invalid: false });
      };
      form.subscribe(refresh);
      refresh();
      (window as any).ownForm = form;
    }, RECORDS);
    // Plainly meanwhile: a box showing the record's name.
    const plain = page.locator('#own-partner');
    await expect(plain).toHaveValue('Nile Traders');
    expect(await plain.getAttribute('data-fd-plain')).toBe('link');
    // The payer's name typed in full and left: looked up by its exact name, and taken.
    await page.locator('#own-payer').click();
    await page.keyboard.type('delta foods');
    await plain.click();
    await expect.poll(() => page.evaluate(() => (window as any).ownForm.getState().values.payer?.label ?? null)).toBe('Delta Foods');
    // The customer's box typed in as the part comes: never read under the keys.
    await page.keyboard.press('Control+A');
    await page.keyboard.type('Del');
    expect(await page.evaluate(() => (window as any).ownForm.getState().values.partner.label)).toBe('Nile Traders');
    release();
    const box = page.locator('#own input[role="combobox"]#own-partner');
    await expect(box).toBeFocused();
    await expect(box).toHaveValue('Del');
    // Typing goes on in the part's box: its list finds the record, Enter takes it.
    await page.keyboard.type('ta');
    await expect(page.locator('.fd-listbox [role="option"]', { hasText: 'Delta Foods' })).toBeVisible();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await expect.poll(() => page.evaluate(() => (window as any).ownForm.getState().values.partner?.label)).toBe('Delta Foods');
    await expect(page.locator('#own-payer')).toHaveValue('Delta Foods');
    expect(asked()).toEqual(['/script/fieldia.js', '/script/fieldia.relations.js']);
    expect(problems).toEqual([]);
  });

  test('the kinds moved into parts already there ask for those: tags and a long choice the choice part, cards the lines part, a copy box the business part', async ({ page }) => {
    const problems = watch(page);
    const asked = scripts(page);
    await page.goto('/script/');
    await expect(page.locator('.fd-form')).toBeVisible();
    await page.waitForLoadState('networkidle');
    const floors = Array.from({ length: 20 }, (_, i) => ({ value: String(i), label: `Floor ${i}` }));
    const shown = {
      fieldia: '0.6',
      id: 'moved',
      data: { kind: 'responses' },
      fields: {
        rooms: { type: 'selection', label: 'Rooms', multiple: true, options: [{ value: 'kitchen', label: 'Kitchen' }, { value: 'gym', label: 'Gym' }] },
        floor: { type: 'selection', label: 'Floor', options: floors },
        guests: { type: 'one2many', label: 'Guests', relation: 'guest', fields: { name: { type: 'char', label: 'Name' } } },
        code: { type: 'char', label: 'Code' },
      },
      layout: {
        type: 'sections',
        id: 's',
        children: [
          { type: 'field', id: 'f-rooms', field: 'rooms', widget: 'tags' },
          { type: 'field', id: 'f-floor', field: 'floor' },
          { type: 'field', id: 'f-guests', field: 'guests', widget: 'cards' },
          { type: 'field', id: 'f-code', field: 'code', widget: 'copy' },
        ],
      },
    };
    await page.evaluate((moved) => {
      const fieldia = (window as any).Fieldia;
      const demo = (window as any).fieldiaDemo;
      demo.handle.destroy();
      demo.handle = fieldia.mountViewer(document.getElementById('app'), { page: moved, dataSource: fieldia.createMemoryDataSource(), values: { rooms: ['gym'], code: 'INV/1', guests: [{ key: 'a', values: { name: 'Mona' } }] } });
    }, shown);
    await page.evaluate(() => (window as any).fieldiaDemo.handle.drawn);
    await expect(page.locator('[data-node="f-rooms"] .fd-chip')).toHaveText(['Gym×']);
    await expect(page.locator('[data-node="f-floor"] .fd-choice-search input')).toBeVisible();
    await expect(page.locator('[data-node="f-guests"] .fd-repeat-card')).toHaveCount(1);
    await expect(page.locator('[data-node="f-code"] .fd-copy .fd-copy-button')).toBeVisible();
    expect(asked()).toEqual(['/script/fieldia.business.js', '/script/fieldia.choice.js', '/script/fieldia.js', '/script/fieldia.lines.js']);
    // Each sheet in its place: the cards' after every other part's, before the page's own looks.
    const sheets = await page.evaluate(() => [...document.head.querySelectorAll('style[id^="fieldia"]')].map((style) => style.id));
    expect(sheets.indexOf('fieldia-cards-styles')).toBe(sheets.indexOf('fieldia-styles-looks') - 1);
    await screen(page, 'relations-part-moved-kinds');
    expect(problems).toEqual([]);
  });

  test('as an app’s bundler builds it: a page with no link asks for no relations chunk; a customer’s sheet asks for it once', async ({ page }) => {
    const problems = watch(page);
    const chunks: string[] = [];
    // The relations part's chunk, named by its module (relations-part.ts) as the bundler names a chunk loaded on demand.
    page.on('request', (request) => {
      const url = new URL(request.url()).pathname;
      if (/\/chunks\/relations-part-[^/]+\.js$/.test(url)) chunks.push(url);
    });
    await page.goto('/plain/?page=signup&skin=outlined');
    await expect(page.locator('.fd-form [data-node]').first()).toBeVisible();
    await page.waitForLoadState('networkidle');
    expect(chunks).toEqual([]);
    await page.goto('/plain/?page=customer&skin=outlined');
    await expect(page.locator('.fd-form input[role="combobox"]').first()).toBeVisible();
    await page.waitForLoadState('networkidle');
    expect(chunks).toHaveLength(1);
    expect(problems).toEqual([]);
  });
});
