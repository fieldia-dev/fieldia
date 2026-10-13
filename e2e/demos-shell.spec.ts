import { type Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { DEMOS, FRAMEWORKS, demoHref } from '../demos/catalog.mjs';
import { readdirSync, readFileSync } from 'node:fs';
import { expectNoSidewaysScroll, screen } from './support';

/**
 * The frame around every demo: the header for everyone; the menu of all
 * demos, the how-to panel and the code drawer for a person visiting. A test
 * browser says it is one (navigator.webdriver), so these tests say otherwise.
 */
async function asVisitor(page: Page) {
  await page.addInitScript(() => Object.defineProperty(navigator, 'webdriver', { get: () => false }));
}
function watch(page: Page) {
  const problems: string[] = [];
  page.on('pageerror', (error) => problems.push(error.message));
  page.on('console', (message) => message.type() === 'error' && problems.push(message.text()));
  return problems;
}
const menu = (page: Page) => page.locator('#demo-nav');

test('every page the demos serve has a card of its own, so a visitor can find it and it is named', () => {
  // The pages the demos serve, by the names `?page=` takes, as demos/shared/sample-data.ts lists them.
  const source = readFileSync('demos/shared/sample-data.ts', 'utf8');
  const list = source.slice(source.indexOf('export const pages'), source.indexOf('};', source.indexOf('export const pages')));
  const pages = Object.fromEntries([...list.matchAll(/^ {2}'?([a-z-]+)'?:/gm)].map((m) => [m[1], true]));
  expect(Object.keys(pages).length).toBeGreaterThan(10);
  // A card with no page in its address shows the sign-up, as the demos do.
  const shown = new Set(DEMOS.map((demo) => new URLSearchParams(demo.query ?? '').get('page') ?? 'signup'));
  // The 500-field page is for timing (e2e/perf.spec.ts), not for a visitor: it has no card on purpose.
  const forTiming = new Set(['big']);
  // A home's, a courier's and an order's own page: a record opened from its list's row or card, not a demo of its own.
  const opened = new Set(['map-home', 'map-courier', 'map-week-order']);
  // The work item replica's lanes' own pages (shared/wi-*.ts), for their browser gates: the work item's card is the backlog's.
  const forGates = new Set(['wi-head']);
  const unnamed = Object.keys(pages).filter((name) => !shown.has(name) && !forTiming.has(name) && !opened.has(name) && !forGates.has(name));
  expect(unnamed).toEqual([]);
});

test.describe('the demo frame', () => {
  test('gives a visitor the menu of every demo, how to try this one, and its code', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await asVisitor(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    const problems = watch(page);
    await page.goto('/plain/?page=customers&skin=underline');
    await expect(page.locator('.dh-title')).toHaveText('Customer list');
    await expect(page).toHaveTitle('Customer list — Fieldia demos');

    // The menu: every demo, the featured first, this one marked; a filter finds one.
    await expect(menu(page)).toBeInViewport();
    await expect(menu(page).locator('.dn-cat').first()).toHaveText('★ Featured');
    const names = await menu(page).locator('.dn-item').allTextContents();
    expect(new Set(names).size).toBe(DEMOS.length);
    await expect(menu(page).locator('.dn-item[aria-current="page"]').first()).toHaveText('Customer list');
    await page.locator('body').press('/');
    await expect(menu(page).getByRole('searchbox', { name: 'Filter demos' })).toBeFocused();
    await page.keyboard.type('arabic');
    await expect(menu(page).locator('.dn-item:visible')).toHaveText(['Customer record in Arabic']);
    await page.keyboard.press('Escape');

    // How to try it: what the demo shows, and the steps.
    const howTo = page.getByRole('complementary', { name: 'About this demo' });
    await expect(howTo).toBeVisible();
    const demo = DEMOS.find((d) => d.id === 'customers')!;
    await expect(howTo.locator('.ht-about')).toHaveText(demo.blurb);
    await expect(howTo.locator('li')).toHaveCount(demo.howTo.length);

    // The menu and the panel take room of their own: the demo is not under them.
    const list = (await page.locator('.fd-list').boundingBox())!;
    const side = (await menu(page).boundingBox())!;
    const panel = (await howTo.boundingBox())!;
    expect(list.x, 'the demo is under the menu').toBeGreaterThanOrEqual(side.x + side.width);
    expect(list.x + list.width, 'the demo is under the panel').toBeLessThanOrEqual(panel.x);
    await expectNoSidewaysScroll(page);
    await screen(page, 'demo-frame', { viewport: true });

    // The code: the page's own JSON, and the same page in a framework.
    await page.getByRole('button', { name: '‹/› Code' }).click();
    const code = page.locator('#demo-code');
    await expect(code.locator('code')).toContainText('"id": "customers"');
    // Coloured as it reads: a key apart from its value, in colours of their own.
    const colour = (selector: string) => code.locator(selector).first().evaluate((el) => getComputedStyle(el).color);
    await expect(code.locator('.tok-key').first()).toHaveText('"fieldia"');
    await expect(code.locator('.tok-string').first()).toHaveText('"0.1"');
    expect(await colour('.tok-key')).not.toBe(await colour('.tok-string'));
    expect(await colour('.tok-string')).not.toBe(await code.locator('code').evaluate((el) => getComputedStyle(el).color));
    await code.getByRole('tab', { name: 'React' }).click();
    await expect(code.locator('code')).toContainText('<FieldiaForm page={page} dataSource={dataSource} skin="underline" />');
    await expect(code.locator('.tok-keyword').first()).toHaveText('import');
    await expect(code.locator('.tok-tag').first()).toHaveText('<FieldiaForm');
    await expect(code.locator('.tok-attr')).toHaveText(['page', 'dataSource', 'skin']);
    await code.getByRole('button', { name: 'Copy' }).click();
    await expect(code.getByRole('button', { name: 'Copied' })).toBeVisible();
    // What is copied is the code, never its colours' markup.
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    expect(copied).toContain('@fieldia/react');
    expect(copied).not.toContain('tok-');
    await screen(page, 'demo-frame-code', { viewport: true });
    expect(problems).toEqual([]);
  });

  test('the Code drawer’s code names what each demo needs: its editors, its maps, its chatter, its own parts', async ({ page }) => {
    await asVisitor(page);
    const drawer = page.locator('#demo-code');
    const codeOf = async (query: string, tab: string) => {
      await page.goto(`/plain/?${query}`);
      await expect(page.locator('.fd-form').first()).toBeVisible();
      if (await drawer.isHidden()) await page.getByRole('button', { name: '‹/› Code' }).click();
      await drawer.getByRole('tab', { name: tab }).click();
      return (await drawer.locator('code').textContent()) ?? '';
    };
    // The code demo: both editors' packages, and only CodeMirror's when the switch shows CodeMirror alone.
    const code = await codeOf('page=code&skin=outlined', 'JavaScript');
    expect(code).toContain("import { codeWidgets } from '@fieldia/code';");
    expect(code).toContain("import { monacoWidgets } from '@fieldia/monaco';");
    expect(code).toContain('widgets: { ...codeWidgets, ...monacoWidgets },');
    expect(await codeOf('page=code&skin=outlined&editor=codemirror', 'JavaScript')).not.toContain('monaco');
    // A list's map with its borders, in React.
    const zones = await codeOf('page=map-zones&skin=outlined', 'React');
    expect(zones).toContain("import { mapListViews, openStreetMap } from '@fieldia/map';");
    expect(zones).toContain("'cairo-districts': () => fetch('/geo/cairo-districts.json')");
    expect(zones).toContain('listViews={listViews}');
    // A form's map and an area field, in Vue; the chatter beside a record, in Angular.
    const kitchen = await codeOf('page=map-kitchen&skin=outlined', 'Vue');
    expect(kitchen).toContain(':widgets="widgets" :maps="maps"');
    expect(kitchen).toContain('const maps = mapParts(mapSettings);');
    const customer = await codeOf('page=customer&skin=outlined', 'Angular');
    expect(customer).toContain('<ng-template fieldiaSlot="chatter" let-form><app-chatter [form]="form" /></ng-template>');
    // A plain sign-up needs nothing more than the viewer.
    expect(await codeOf('page=signup&skin=outlined', 'JavaScript')).not.toMatch(/@fieldia\/(map|code|monaco|grid|chatter)/);
  });

  test('every example page’s code parses, in every tab', async () => {
    const { snippets } = await import('../demos/snippets.mjs');
    const { transformSync } = await import('esbuild');
    const files = readdirSync('examples/pages').filter((file) => file.endsWith('.page.json'));
    expect(files.length).toBeGreaterThan(30);
    for (const file of files) {
      const code = snippets(JSON.parse(readFileSync(`examples/pages/${file}`, 'utf8')), new URLSearchParams('skin=outlined&theme=material&readonly=1'));
      for (const [tab, source] of Object.entries(code)) {
        // Vue's file is checked by its script; the rest as TypeScript with JSX.
        const text = tab === 'vue' ? /<script setup lang="ts">([\s\S]*?)<\/script>/.exec(source as string)![1] : (source as string);
        expect(() => transformSync(text, { loader: tab === 'json' ? 'json' : 'tsx' }), `${file} · ${tab}`).not.toThrow();
      }
    }
  });

  test('switches framework and look, keeping the demo', async ({ page }) => {
    await asVisitor(page);
    await page.goto('/plain/?page=order&skin=underline');
    await page.getByRole('navigation', { name: 'Framework' }).getByRole('link', { name: 'Vue' }).click();
    await expect(page).toHaveURL(/\/vue\/\?page=order&skin=underline$/);
    await expect(page.locator('.dh-title')).toHaveText('Sales order');
    await expect(page.getByRole('navigation', { name: 'Framework' }).getByRole('link', { name: 'Vue' })).toHaveAttribute('aria-current', 'page');
    await page.getByRole('navigation', { name: 'Look' }).getByRole('link', { name: 'Outlined' }).click();
    await expect(page).toHaveURL(/\/vue\/\?page=order&skin=outlined$/);
    await expect(page.locator('.fd-form').first()).toHaveAttribute('data-fd-skin', 'outlined');
    // Another look is the same demo: its name, its how-to, its place in the menu.
    await expect(page.locator('.dh-title')).toHaveText('Sales order');
  });

  test('a demo of one framework keeps its name and its look switch, whatever the look it opens in', async ({ page }) => {
    await asVisitor(page);
    // Opened without a look, as a link from the docs opens it.
    await page.goto('/plain/?page=code');
    await expect(page.locator('.dh-title')).toHaveText('Code in many languages');
    const looks = page.getByRole('navigation', { name: 'Look' });
    await expect(looks.getByRole('link', { name: 'Underline' })).toHaveAttribute('aria-current', 'page');
    // It runs in plain JavaScript alone: no framework to switch to.
    await expect(page.getByRole('navigation', { name: 'Framework' })).toHaveCount(0);
    await looks.getByRole('link', { name: 'Outlined' }).click();
    await expect(page).toHaveURL(/\/plain\/\?page=code&skin=outlined$/);
    await expect(page.locator('.dh-title')).toHaveText('Code in many languages');
    await expect(page.getByRole('navigation', { name: 'Look' }).getByRole('link', { name: 'Outlined' })).toHaveAttribute('aria-current', 'page');
    await expect(page.locator('.fd-form').first()).toHaveAttribute('data-fd-skin', 'outlined');
  });

  test('a Scheme switch beside the look: the reader’s own by default, or light or dark, the frame and the form together', async ({ page }) => {
    await asVisitor(page);
    const html = page.locator('html');
    const form = page.locator('.fd-form').first();
    const schemes = page.getByRole('navigation', { name: 'Scheme' });
    // A light system: the demo exactly as it always was, the form naming no scheme.
    await page.goto('/plain/?page=order&skin=underline');
    await expect(schemes.getByRole('link', { name: 'System' })).toHaveAttribute('aria-current', 'page');
    await expect(form).not.toHaveAttribute('data-scheme');
    await expect(html).toHaveAttribute('data-scheme', 'light');
    await schemes.getByRole('link', { name: 'Dark' }).click();
    await expect(page).toHaveURL(/\/plain\/\?page=order&skin=underline&scheme=dark$/);
    await expect(form).toHaveAttribute('data-scheme', 'dark');
    await expect(html).toHaveAttribute('data-scheme', 'dark');
    await expect(schemes.getByRole('link', { name: 'Dark' })).toHaveAttribute('aria-current', 'page');
    // Another framework keeps it, as it keeps the look.
    await page.getByRole('navigation', { name: 'Framework' }).getByRole('link', { name: 'React' }).click();
    await expect(page).toHaveURL(/\/react\/\?page=order&skin=underline&scheme=dark$/);
    await expect(form).toHaveAttribute('data-scheme', 'dark');
    await page.getByRole('navigation', { name: 'Scheme' }).getByRole('link', { name: 'System' }).click();
    await expect(page).toHaveURL(/\/react\/\?page=order&skin=underline$/);
    await expect(form).not.toHaveAttribute('data-scheme');

    // A dark system: the form follows the reader, and so does the frame; Light still wins.
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/plain/?page=order&skin=underline');
    await expect(form).toHaveAttribute('data-scheme', 'auto');
    await expect(html).toHaveAttribute('data-scheme', 'auto');
    await screen(page, 'demo-frame-dark', { viewport: true });
    await schemes.getByRole('link', { name: 'Light' }).click();
    await expect(page).toHaveURL(/scheme=light$/);
    await expect(form).toHaveAttribute('data-scheme', 'light');
    await expect(html).toHaveAttribute('data-scheme', 'light');
  });

  test('the script tag demo draws its form light, so its frame stays light with it on a dark system', async ({ page }) => {
    await asVisitor(page);
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto(`/${demoHref(DEMOS.find((d) => d.app === 'script')!)}`);
    await expect(page.locator('.fd-form').first()).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('data-scheme', 'light');
    // No look to switch: it has an app of its own.
    await expect(page.getByRole('navigation', { name: 'Scheme' })).toHaveCount(0);
  });

  test('fits a phone: the menu waits behind its button, and the page does not scroll sideways', async ({ page }) => {
    await asVisitor(page);
    await page.setViewportSize({ width: 400, height: 860 });
    await page.goto('/plain/?page=customer&skin=underline');
    await expect(page.locator('.fd-form').first()).toBeVisible();
    await expect(menu(page)).not.toBeInViewport();
    await expectNoSidewaysScroll(page);
    await page.getByRole('button', { name: 'All demos' }).click();
    await expect(menu(page)).toBeInViewport();
    await screen(page, 'demo-frame-phone', { viewport: true });
    await menu(page).getByRole('button', { name: 'Close the menu' }).click();
    await expect(menu(page)).not.toBeInViewport();
  });

  test('gives a test browser the header alone, so its measurements are of the demo', async ({ page }) => {
    await page.goto('/plain/?page=customer&skin=underline');
    await expect(page.locator('.dh-title')).toHaveText('Customer record');
    await expect(page.locator('#demo-nav, #demo-howto, #demo-code')).toHaveCount(0);
  });
});

test('embed=1: the demo alone, as a feature page frames it — no header, menu, how-to or code drawer', async ({ page }) => {
  await asVisitor(page);
  const problems = watch(page);
  await page.goto('/plain/?page=real-sale-order&record=7101&skin=underline&embed=1');
  await expect(page.locator('.fd-form').first()).toBeVisible();
  await expect(page.locator('#demo-head, #demo-nav, #demo-howto, #demo-code, .dh-menu')).toHaveCount(0);
  // Still the working demo: its buttons run.
  await page.getByRole('button', { name: 'Send by Email' }).click();
  await expect(page.locator('.fd-header .fd-statusbar [aria-current="step"]')).toHaveText('Quotation Sent');
  expect(problems).toEqual([]);
});

for (const framework of FRAMEWORKS) {
  test(`${framework.id} · every demo of the gallery opens, with its name and no error`, async ({ page }) => {
    const demos = DEMOS.filter((d) => !d.app);
    // Time by the gallery's size, not one test's: about a second a demo, three in hand, the slowest framework too.
    test.setTimeout(demos.length * 3000);
    const problems = watch(page);
    for (const demo of demos) {
      await page.goto(`/${demoHref(demo, framework.id)}`);
      await expect(page.locator('.fd-form').first(), demo.id).toBeVisible();
      await expect(page.locator('.dh-title'), demo.id).toHaveText(demo.name);
    }
    expect(problems).toEqual([]);
  });
}

test('the script tag demo opens in its frame too', async ({ page }) => {
  const problems = watch(page);
  const demo = DEMOS.find((d) => d.app === 'script')!;
  await page.goto(`/${demoHref(demo)}`);
  await expect(page.locator('.fd-form').first()).toBeVisible();
  await expect(page.locator('.dh-title')).toHaveText(demo.name);
  await expect(page.getByRole('navigation', { name: 'Framework' })).toHaveCount(0);
  expect(problems).toEqual([]);
});
