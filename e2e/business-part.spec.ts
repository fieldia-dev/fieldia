import { type Page } from '@playwright/test';
import { expect, test } from './fixtures';

/**
 * Flectra's business widgets — a record's statusbar, priority stars, hours
 * and a per cent's boxes, an analytic distribution, tax totals, payments —
 * come in the business part, loaded the first time a page shows one
 * (parts.ts in @fieldia/widgets).
 *
 * From one <script> tag: a page with none asks for no file but fieldia.js; a
 * sheet with a statusbar asks for fieldia.business.js beside it, and is drawn
 * whole once it came — nothing of it before — its stylesheet first of the
 * parts'. A widget made before the part came, by an app that did not wait for
 * it, shows its value plainly and keeps what is typed in it, and the part's
 * own widget takes its place with it. As an app's bundler builds it (the plain
 * demo, each part a chunk): a page with no business widget asks for no
 * business chunk; a customer's sheet asks for it once.
 */

const ORDER = {
  fieldia: '0.1',
  id: 'order',
  title: 'Order',
  data: { kind: 'record', model: 'sale.order' },
  fields: {
    name: { type: 'char', label: 'Order' },
    state: { type: 'selection', label: 'Status', default: 'sent', options: [{ value: 'draft', label: 'Quotation' }, { value: 'sent', label: 'Quotation Sent' }, { value: 'sale', label: 'Sales Order' }] },
    priority: { type: 'selection', label: 'Priority', default: '1', options: [{ value: '0', label: 'Normal' }, { value: '1', label: 'Urgent' }] },
    hours: { type: 'float', label: 'Hours spent', default: 2.5 },
  },
  layout: {
    type: 'sheet',
    id: 'sheet',
    title: { field: 'name' },
    statusbar: { field: 'state', clickable: true },
    children: [
      {
        type: 'section',
        id: 'g',
        columns: 2,
        children: [
          { type: 'field', id: 'f-priority', field: 'priority', widget: 'priority' },
          { type: 'field', id: 'f-hours', field: 'hours', widget: 'duration' },
        ],
      },
    ],
  },
};

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
  // The demo's memory source's members come in a part of their own as it is first asked, and Ctrl+Z's as a form is
  // first entered (script.spec): the source's and every form's, not the page's.
  return () => requested.filter((path) => /\/fieldia(\.\w+)?\.js$/.test(path) && !/\/fieldia\.(memory|undo)\.js$/.test(path)).sort();
}

test.describe('the business widgets in a part of their own', () => {
  test('a sheet with a statusbar asks for fieldia.business.js, drawn whole once it came; a page with none never asks', async ({ page }) => {
    const problems = watch(page);
    const asked = scripts(page);
    await page.goto('/script/');
    await expect(page.locator('.fd-form')).toBeVisible();
    await page.waitForLoadState('networkidle');
    // The demo's own page: no business widget, no business part.
    expect(asked()).toEqual(['/script/fieldia.js']);
    const drawnAtOnce = await page.evaluate((shown) => {
      const fieldia = (window as any).Fieldia;
      const demo = (window as any).fieldiaDemo;
      demo.handle.destroy();
      demo.handle = fieldia.mountViewer(document.getElementById('app'), { page: shown, dataSource: fieldia.createMemoryDataSource() });
      return !!document.querySelector('#app [data-node]');
    }, ORDER);
    // Nothing of it before its part came: nothing to move.
    expect(drawnAtOnce).toBe(false);
    await page.evaluate(() => (window as any).fieldiaDemo.handle.drawn);
    await expect(page.locator('#app .fd-header .fd-statusbar [aria-current="step"]')).toHaveText('Quotation Sent');
    await expect(page.locator('[data-node="f-priority"] .fd-priority-star.fd-on')).toHaveCount(1);
    await expect(page.locator('[data-node="f-hours"] input')).toHaveValue('02:30');
    expect(asked()).toEqual(['/script/fieldia.business.js', '/script/fieldia.js']);
    // Its stylesheet first of the parts', where its rules stood in Fieldia's: the statusbar's steps drawn as arrows.
    expect(await page.evaluate(() => [...document.head.querySelectorAll('style[id^="fieldia"]')].map((style) => style.id))).toEqual([
      'fieldia-styles',
      'fieldia-business-styles',
      'fieldia-styles-looks',
    ]);
    expect(await page.locator('.fd-statusbar li > *').first().evaluate((step) => getComputedStyle(step).clipPath)).toContain('polygon');
    // A step clicked moves the record, as before.
    await page.locator('.fd-statusbar button', { hasText: 'Sales Order' }).click();
    await expect(page.locator('.fd-statusbar [aria-current="step"]')).toHaveText('Sales Order');
    expect(asked()).toEqual(['/script/fieldia.business.js', '/script/fieldia.js']);
    expect(problems).toEqual([]);
  });

  test('a box made before its part came keeps what is typed in it, and the part’s own box takes it on, the focus with it', async ({ page }) => {
    const problems = watch(page);
    const asked = scripts(page);
    // The part held back until the person has typed: as on a slow line.
    let release: () => void = () => undefined;
    const held = new Promise<void>((done) => (release = done));
    await page.route('**/fieldia.business.js', async (route) => {
      await held;
      await route.continue();
    });
    await page.goto('/script/');
    await expect(page.locator('.fd-form')).toBeVisible();
    // An app that draws a field itself, not waiting for its part: hours, and a priority, given their values.
    await page.evaluate(() => {
      const fieldia = (window as any).Fieldia;
      const fields = {
        hours: { type: 'float', label: 'Hours' },
        priority: { type: 'selection', label: 'Priority', options: ['0', '1', '2', '3'].map((value) => ({ value, label: `Level ${value}` })) },
      };
      const shown = { fieldia: '0.1', id: 'own', data: { kind: 'responses' }, fields, layout: { type: 'sections', id: 's', children: [] } };
      const form = fieldia.createForm({ page: shown, values: { hours: 6.5, priority: '2' } });
      const host = document.createElement('div');
      host.id = 'own';
      document.body.append(host);
      const widgets = (['hours', 'priority'] as const).map((name) => {
        const node = { type: 'field', id: `f-${name}`, field: name, widget: name === 'hours' ? 'duration' : 'priority' };
        const widget = fieldia.createWidget({ form, name, field: fields[name], node, id: `own-${name}`, document });
        host.append(widget.element);
        return [name, widget] as const;
      });
      const refresh = () => {
        for (const [name, widget] of widgets) widget.update({ value: form.getState().values[name], values: form.getState().values, readonly: false, required: false, invalid: false });
      };
      form.subscribe(refresh);
      refresh();
      (window as any).ownForm = form;
    });
    // Plainly meanwhile: the hours in a text box, the stars in words.
    const plain = page.locator('#own-hours');
    await expect(plain).toHaveValue('06:30');
    await expect(page.locator('#own-priority')).toHaveText('★ 2 of 3');
    expect(await plain.getAttribute('data-fd-plain')).toBe('');
    await plain.click();
    await plain.press('Control+A');
    await page.keyboard.type('7:');
    // Still typed in: never read under the keys (no value, no words), held by the box as typed (e7d349e).
    expect(await page.evaluate(() => (window as any).ownForm.getState().unread.hours ?? null)).toBeNull();
    // The part comes: the work tracker's box in the plain one's place, the text as it stood, the focus in it.
    release();
    await expect(page.locator('#own .fd-priority .fd-priority-star.fd-on')).toHaveCount(2);
    const box = page.locator('#own input.fd-duration');
    await expect(box).toBeFocused();
    await expect(box).toHaveValue('7:');
    await page.keyboard.type('15');
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => (window as any).ownForm.getState().values.hours)).toBe(7.25);
    await expect(box).toHaveValue('07:15');
    expect(asked()).toEqual(['/script/fieldia.business.js', '/script/fieldia.js']);
    expect(problems).toEqual([]);
  });

  test('as an app’s bundler builds it: a page with no business widget asks for no business chunk; a customer’s sheet asks for it once', async ({ page }) => {
    const problems = watch(page);
    const chunks: string[] = [];
    // The business part's chunk, named by its module (business-part.ts) as the bundler names a chunk loaded on demand.
    page.on('request', (request) => {
      const url = new URL(request.url()).pathname;
      if (/\/chunks\/business-part-[^/]+\.js$/.test(url)) chunks.push(url);
    });
    await page.goto('/plain/?page=signup&skin=outlined');
    await expect(page.locator('.fd-form [data-node]').first()).toBeVisible();
    await page.waitForLoadState('networkidle');
    expect(chunks).toEqual([]);
    await page.goto('/plain/?page=customer&skin=outlined');
    await expect(page.locator('.fd-header .fd-statusbar [aria-current="step"]')).toBeVisible();
    await page.waitForLoadState('networkidle');
    expect(chunks).toHaveLength(1);
    expect(problems).toEqual([]);
  });
});
