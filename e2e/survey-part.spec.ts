import { type Page } from '@playwright/test';
import { expect, test } from './fixtures';

/**
 * The survey kinds — a ranking, a matrix, a slider, pictures to choose from, a
 * colour, properties, an address and a progress bar — come in the survey part,
 * loaded the first time a page shows one (parts.ts in @fieldia/widgets).
 *
 * From one <script> tag: a page with none asks for no file but fieldia.js; a
 * page with one asks for fieldia.survey.js beside it, and is drawn whole once
 * it came — nothing of it before. As an app's bundler builds it (the plain
 * demo, each part a chunk): a page with none asks for no survey chunk; one
 * with them asks for it once. And a widget an app draws before the part came
 * shows its value plainly, a slider as a number box that takes what is typed:
 * the part's slider takes its place with that value and the focus.
 */

const ROOMS = {
  fieldia: '0.1',
  id: 'rooms',
  title: 'Your new office',
  data: { kind: 'responses' },
  fields: {
    name: { type: 'char', label: 'Your name' },
    days: { type: 'integer', label: 'Days in the office', min: 0, max: 5 },
    order: {
      type: 'selection',
      label: 'What matters most',
      multiple: true,
      options: [
        { value: 'daylight', label: 'Daylight' },
        { value: 'quiet', label: 'Quiet' },
        { value: 'kitchen', label: 'Near the kitchen' },
      ],
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
          { type: 'field', id: 'f-name', field: 'name' },
          { type: 'field', id: 'f-days', field: 'days', widget: 'slider' },
          { type: 'field', id: 'f-order', field: 'order', widget: 'ranking' },
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

const held = (page: Page, name: string) => page.evaluate((field) => (window as any).fieldiaDemo.handle.form.getState().values[field], name);

test.describe('the survey kinds in a part of their own', () => {
  test('fieldia.survey.js asked for the first time a page shows a survey kind, the page drawn whole once it came, used at once', async ({ page }) => {
    const problems = watch(page);
    const requested: string[] = [];
    page.on('request', (request) => requested.push(new URL(request.url()).pathname));
    const scripts = () => requested.filter((path) => /\/fieldia\.(survey\.)?js$/.test(path)).sort();
    await page.goto('/script/');
    await expect(page.locator('.fd-form')).toBeVisible();
    await page.waitForLoadState('networkidle');
    // A page with no survey kind asked for no survey part.
    expect(scripts()).toEqual(['/script/fieldia.js']);
    const drawnAtOnce = await page.evaluate((shown) => {
      const fieldia = (window as any).Fieldia;
      const demo = (window as any).fieldiaDemo;
      demo.handle.destroy();
      demo.handle = fieldia.mountViewer(document.getElementById('app'), { page: shown, dataSource: fieldia.createMemoryDataSource(), skin: 'outlined' });
      return !!document.querySelector('#app [data-node]');
    }, ROOMS);
    // Nothing of it before its part came: no plain box to type into and lose, nothing to move.
    expect(drawnAtOnce).toBe(false);
    const slider = page.locator('[data-node="f-days"] input[type="range"]');
    await expect(slider).toBeVisible();
    expect(scripts()).toEqual(['/script/fieldia.js', '/script/fieldia.survey.js']);
    // Its sheets in their places: right after Fieldia's first, right before the page's own looks.
    const sheets = await page.evaluate(() => [...document.head.querySelectorAll('style')].map((style) => style.id).filter((id) => id.startsWith('fieldia-')));
    expect(sheets[sheets.indexOf('fieldia-styles') + 1]).toBe('fieldia-survey-styles');
    expect(sheets[sheets.indexOf('fieldia-styles-looks') - 1]).toBe('fieldia-survey-looks');

    // Slid with the keys, the value beside it.
    await slider.focus();
    await page.keyboard.press('Home');
    for (let step = 0; step < 3; step++) await page.keyboard.press('ArrowRight');
    await expect(page.locator('[data-node="f-days"] .fd-slider-value')).toHaveText('3');
    expect(await held(page, 'days')).toBe(3);
    // A line of the ranking moved down with Alt+↓, numbered again; kept as the answer.
    await page.locator('[data-node="f-order"] .fd-rank-item').first().locator('.fd-rank-down').focus();
    await page.keyboard.press('Alt+ArrowDown');
    await expect(page.locator('[data-node="f-order"] .fd-rank-words')).toHaveText(['Quiet', 'Daylight', 'Near the kitchen']);
    expect(await held(page, 'order')).toEqual(['quiet', 'daylight', 'kitchen']);
    // Asked for once.
    expect(scripts()).toEqual(['/script/fieldia.js', '/script/fieldia.survey.js']);
    expect(problems).toEqual([]);
  });

  test('drawn by an app before the part came: a slider as a number box, what is typed kept, then the slider with it and the focus', async ({ page }) => {
    const problems = watch(page);
    // The part's script held back until the person has typed: as on a slow line.
    let release: () => void = () => undefined;
    const released = new Promise<void>((done) => (release = done));
    await page.route('**/fieldia.survey.js', async (route) => {
      await released;
      await route.continue();
    });
    await page.goto('/script/');
    await expect(page.locator('.fd-form')).toBeVisible();
    await page.evaluate((shown) => {
      const fieldia = (window as any).Fieldia;
      const form = fieldia.createForm({ page: shown, dataSource: fieldia.createMemoryDataSource() });
      const host = document.createElement('div');
      host.id = 'drawn';
      host.className = 'fd-form';
      document.getElementById('app')!.after(host);
      const widget = fieldia.createWidget({ form, name: 'days', field: shown.fields.days, node: shown.layout.children[0].children[1], id: 'days', document });
      host.append(widget.element);
      const draw = () => widget.update({ value: form.getState().values.days ?? null, values: form.getState().values, readonly: false, required: false, invalid: false });
      form.subscribe(draw);
      draw();
      (window as any).drawn = { form, widget };
    }, ROOMS);
    // Meanwhile the number box: typed in, the value the form's.
    const box = page.locator('#drawn input#days');
    await expect(box).toHaveAttribute('inputmode', /decimal|numeric/);
    await box.click();
    await page.keyboard.type('4');
    await expect.poll(() => page.evaluate(() => (window as any).drawn.form.getState().values.days)).toBe(4);
    await expect(page.locator('#drawn .fd-slider')).toHaveCount(0);
    release();
    // The part's slider in its place, the value typed and the focus in it; the number box and its hint gone.
    const slider = page.locator('#drawn .fd-slider input[type="range"]');
    await expect(slider).toHaveValue('4');
    await expect(slider).toBeFocused();
    await expect(page.locator('#drawn input:not([type="range"]), #drawn .fd-refusal-hint')).toHaveCount(0);
    expect(await page.evaluate(() => (window as any).drawn.form.getState().values.days)).toBe(4);
    expect(problems).toEqual([]);
  });

  test('as an app’s bundler builds it: a page with no survey kind asks for no survey chunk; one with them asks for it once, used at once', async ({ page }) => {
    const problems = watch(page);
    const asked: string[] = [];
    // The survey part's chunk, named by its module (survey-part.ts) as the bundler names a chunk loaded on demand.
    page.on('request', (request) => {
      const url = new URL(request.url()).pathname;
      if (/\/chunks\/survey-part-[^/]+\.js$/.test(url)) asked.push(url);
    });
    await page.goto('/plain/?page=customer&skin=outlined');
    await expect(page.locator('.fd-form [data-node]').first()).toBeVisible();
    await page.waitForLoadState('networkidle');
    expect(asked).toEqual([]);
    await page.goto('/plain/?page=kinds&skin=outlined');
    const slider = page.locator('[data-node="q-days"] input[type="range"]');
    await expect(slider).toBeVisible();
    await page.waitForLoadState('networkidle');
    expect(asked).toHaveLength(1);
    await expect(page.locator('.fd-ranking').first()).toBeVisible();
    await expect(page.locator('.fd-image-choices').first()).toBeVisible();
    await expect(page.locator('.fd-matrix-table').first()).toBeVisible();
    await expect(page.locator('.fd-address').first()).toBeVisible();
    await slider.focus();
    await page.keyboard.press('End');
    await expect(slider).toHaveValue('5');
    await expect(page.locator('[data-node="q-days"] .fd-slider-value')).toHaveText('5');
    expect(problems).toEqual([]);
  });
});
