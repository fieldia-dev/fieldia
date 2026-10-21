import { type Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { DEMOS, FRAMEWORKS, GITHUB, OPENED, demoHref, sourceOf, stepParts, stepText } from '../demos/catalog.mjs';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
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
  // A section choosing its own look, for e2e/quiet-look.spec.ts: the work item's demo shows the switch whole.
  // Tables of lines with none yet, for e2e/grid-empty.spec.ts.
  const forTests = new Set(['work-item-mixed', 'empty-grids']);
  // A home's, a courier's and an order's own page, an appointment's, a booking's and a contact's: a record opened from its list's row,
  // pin or calendar, not a demo of its own — each named in the catalog (OPENED), as the test below holds it to.
  const opened = new Set(OPENED.map((o) => o.page));
  // The work item replica's lanes' own pages (shared/wi-*.ts), each a part of the popup tried on its own for its
  // browser gate: the work item's card is the backlog's, which shows it whole.
  const forGates = new Set(['wi-head', 'wi-history', 'wi-text']);
  const unnamed = Object.keys(pages).filter((name) => !shown.has(name) && !forTiming.has(name) && !forTests.has(name) && !opened.has(name) && !forGates.has(name));
  expect(unnamed).toEqual([]);
});

test('each list’s record page is a demo, or a page the catalog names as one a demo opens', () => {
  // What a row, a pin or a booking opens, by the list's page: demos/shared/sample-data.ts and the calendars' own.
  const pairs = [readFileSync('demos/shared/sample-data.ts', 'utf8'), readFileSync('demos/shared/calendar.ts', 'utf8')]
    .flatMap((source) => [...source.matchAll(/(?:RECORD_PAGES[^{]*\{|recordPages: \{)([^}]*)\}/g)])
    .flatMap((m) => [...m[1].matchAll(/'([a-z-]+)': '([a-z-]+)'/g)].map((pair) => pair[2]));
  expect(pairs.length).toBeGreaterThanOrEqual(6);
  const shown = new Set(DEMOS.map((demo) => new URLSearchParams(demo.query ?? '').get('page')));
  const named = new Set(OPENED.map((o) => o.page));
  expect([...new Set(pairs)].filter((page) => !shown.has(page) && !named.has(page))).toEqual([]);
  // And each one the catalog names comes from a demo that is in it.
  for (const o of OPENED) expect(DEMOS.some((demo) => demo.id === o.from), o.page).toBe(true);
});

test('every page the demos open is named for what it shows, in the heading and the tab, never for its framework', async ({ page }) => {
  const framework = /^(plain )?(JavaScript|React|Vue|Angular)$|Fieldia — (plain JavaScript|React|Vue|Angular)/;
  await page.goto('/plain/?page=customer&skin=underline');
  await expect(page.locator('.fd-form').first()).toBeVisible();
  await expect.poll(() => page.evaluate(() => (window as any).fieldiaDemo?.pageNames?.length ?? 0)).toBeGreaterThan(40);
  const names: string[] = await page.evaluate(() => (window as any).fieldiaDemo.pageNames);
  expect(names.length).toBeGreaterThan(40);
  test.setTimeout((names.length + OPENED.length * FRAMEWORKS.length) * 2500);
  // A page a demo opens, by its own name, in every framework: a booking pressed on the desk's week is "A booking".
  for (const o of OPENED) {
    for (const f of FRAMEWORKS) {
      await page.goto(`/${f.id}/?page=${o.page}&record=1&skin=outlined`);
      await expect(page.locator('.dh-title'), `${f.id} ${o.page}`).toHaveText(o.name);
      await expect(page, `${f.id} ${o.page}`).toHaveTitle(`${o.name} — Fieldia demos`);
    }
  }
  // Any page at all `?page=` opens — a demo's, one a demo opens, one a browser test keeps — is named for what it shows.
  for (const name of names) {
    await page.goto(`/plain/?page=${name}`);
    await expect(page.locator('.dh-title'), name).not.toBeEmpty();
    expect(await page.locator('.dh-title').textContent(), name).not.toMatch(framework);
    await expect(page, name).not.toHaveTitle(framework);
    await expect(page, name).toHaveTitle(/ — Fieldia demos$/);
  }
});

test('no how-to step sends a person to the address bar; a step naming a file links it, a file the demos serve', () => {
  // A setting typed into the address ("record=new", "&allIds=1000") is a link in the step instead (catalog.mjs: stepParts).
  const ADDRESS = /\b[a-zA-Z]+=[^\s,)]*|address bar|to the address|in the address\b/i;
  const FILE = /\bsample (workbook|CSV file|file)\b|\.(xlsx|csv|pdf)\b|\bdownload (the|a) (sample|file|workbook)/i;
  // A record named by its number ("Open record 4172") is a link that opens it, never a number to find by hand.
  const BY_NUMBER = /\brecords? (no\.? ?|number |#)?\d+\b/i;
  let files = 0;
  for (const demo of DEMOS) {
    for (const step of demo.howTo) {
      const text = stepText(step);
      expect(text, `${demo.id}: ${text}`).not.toMatch(ADDRESS);
      for (const plain of stepParts(step).filter((part) => !part.href)) expect(plain.text, `${demo.id}: ${text}`).not.toMatch(BY_NUMBER);
      const links = stepParts(step).filter((part) => part.href);
      if (FILE.test(text)) expect(links.some((link) => !link.href!.startsWith('?')), `${demo.id}: ${text}`).toBe(true);
      for (const link of links) {
        if (link.href!.startsWith('?')) continue;
        files++;
        expect(existsSync(`demos/${link.href}`), `${demo.id}: ${link.href}`).toBe(true);
      }
    }
  }
  expect(files).toBeGreaterThanOrEqual(2);
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
    await page.keyboard.type('record in arabic');
    await expect(menu(page).locator('.dn-item:visible')).toHaveText(['Customer record in Arabic']);
    await page.keyboard.press('Escape');

    // How to try it: at 1440 it waits folded — its first step is in the header — so the record keeps its room beside
    // the menu; the header's ? opens it: what the demo shows, and the steps.
    const howTo = page.getByRole('complementary', { name: 'About this demo' });
    await expect(howTo).toBeHidden();
    const about = page.locator('#demo-head').getByRole('button', { name: 'About this demo' });
    await expect(about).toHaveAttribute('aria-expanded', 'false');
    await about.click();
    await expect(howTo).toBeVisible();
    await expect(about).toHaveAttribute('aria-expanded', 'true');
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
    await expect(code.locator('.tok-string').first()).toHaveText('"0.8"');
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

  test('says under every demo’s name the first thing to try, and links its source on GitHub, a file that is there', async ({ page }) => {
    // What the gallery promises — read how to try it, and open its code — on the page itself, for everyone: a walk
    // in a test browser sees it too.
    for (const demo of DEMOS) expect(existsSync(sourceOf(demo)), `${demo.id}: ${sourceOf(demo)}`).toBe(true);
    await page.setViewportSize({ width: 1440, height: 900 });
    for (const demo of DEMOS.filter((d) => ['customer', 'test-drive', 'template-invoice', 'backlog', 'two-tabs', 'script', 'code'].includes(d.id))) {
      await page.goto(`/${demoHref(demo)}`);
      const line = page.locator('#demo-head .dh-try');
      await expect(line.locator('.dh-try-step'), demo.id).toHaveText(stepText(demo.howTo[0]));
      await expect(line.getByRole('link', { name: 'Its source on GitHub' }), demo.id).toHaveAttribute('href', `${GITHUB}/blob/main/${sourceOf(demo)}`);
      await expect(line, demo.id).toBeInViewport();
    }
    await page.goto('/plain/?page=customer&skin=underline');
    await screen(page, 'demo-frame-try-this', { viewport: true });
    // A person visiting: All the steps opens the panel of them.
    await asVisitor(page);
    await page.setViewportSize({ width: 1100, height: 800 });
    await page.goto('/plain/?page=customer&skin=underline');
    const howTo = page.getByRole('complementary', { name: 'About this demo' });
    await expect(howTo).toBeHidden();
    await page.locator('#demo-head').getByRole('button', { name: 'All 5 steps' }).click();
    await expect(howTo).toBeVisible();
    await expect(howTo.locator('li')).toHaveCount(5);
  });

  test('opens the menu and the how-to together only where the record stays whole beside them; else the how-to waits, a person’s choice kept', async ({ page }) => {
    await asVisitor(page);
    const howTo = page.getByRole('complementary', { name: 'About this demo' });
    const about = page.locator('#demo-head').getByRole('button', { name: 'About this demo' });
    /** What the record cuts at this width that it does not cut in a window as wide as can be: a cell, a column, a value. */
    const cutHere = async (width: number) => {
      const cut = () =>
        page.evaluate(() =>
          [...document.querySelectorAll('#app *')]
            .filter((e) => (e as HTMLElement).clientWidth > 0 && !e.closest('[hidden]'))
            .filter((e) => {
              const style = getComputedStyle(e);
              return (style.overflowX !== 'visible' || style.textOverflow === 'ellipsis') && e.scrollWidth > (e as HTMLElement).clientWidth + 1;
            })
            .map((e) => `${(e.className || e.tagName).toString().split(' ')[0]}: ${((e as HTMLElement).innerText || (e as HTMLInputElement).value || '').trim().slice(0, 30)}`)
        );
      // What a window as wide as can be leaves cut too (a label's own ellipsis) is no squeeze: once it holds still.
      await page.setViewportSize({ width: 2600, height: 900 });
      let wide = '';
      await expect.poll(async () => {
        const now = JSON.stringify(await cut());
        const still = now === wide;
        wide = now;
        return still;
      }).toBe(true);
      const known = new Set(JSON.parse(wide) as string[]);
      await page.setViewportSize({ width, height: 900 });
      // The grid sizes its columns a moment after the window changes: what is cut once it has.
      let left: string[] = [];
      await expect.poll(async () => (left = (await cut()).filter((c) => !known.has(c))).length, { timeout: 4000 }).toBe(0).catch(() => undefined);
      return left;
    };
    // The menu, the panel and the widest record — the sales order's lines — fit side by side from 1,744px: both open by
    // themselves, and nothing of the records the walk saw squeezed is cut.
    await page.setViewportSize({ width: 1744, height: 900 });
    for (const query of ['page=order&skin=underline', 'page=invoices&skin=underline', 'page=property&record=1&skin=underline', 'page=contacts&skin=underline']) {
      await page.goto(`/plain/?${query}`);
      await expect(page.locator('.fd-list-row, .fd-field').first()).toBeVisible();
      await expect(menu(page), query).toBeInViewport();
      await expect(howTo, query).toBeVisible();
      expect(await cutHere(1744), query).toEqual([]);
    }
    await screen(page, 'demo-frame-both-panels', { viewport: true });
    // At 1440 the menu alone; the how-to's first step is in the header, the rest a press away.
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/plain/?page=invoices&skin=underline');
    await expect(menu(page)).toBeInViewport();
    await expect(howTo).toBeHidden();
    await expect(page.locator('#demo-head .dh-try-step')).toBeVisible();
    await expect(page.locator('.fd-list-scroll')).toHaveJSProperty('scrollLeft', 0);
    expect(await page.locator('.fd-list-scroll').evaluate((e) => e.scrollWidth - e.clientWidth)).toBeLessThanOrEqual(1);
    await screen(page, 'demo-frame-1440', { viewport: true });
    // Opened by the person, it stays open on the next demo and after a reload; closed, it stays closed even where both fit.
    await about.click();
    await expect(howTo).toBeVisible();
    await page.goto('/plain/?page=contacts&skin=underline');
    await expect(howTo).toBeVisible();
    await howTo.getByRole('button', { name: 'Close the panel' }).click();
    await expect(about).toBeFocused();
    await page.setViewportSize({ width: 1920, height: 1000 });
    await page.reload();
    await expect(page.locator('.fd-list-row').first()).toBeVisible();
    await expect(howTo).toBeHidden();
  });

  test('a step’s files and settings are links in the step: the sample workbook in the header, a new customer a press away', async ({ page }) => {
    await asVisitor(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    const problems = watch(page);
    await page.goto('/plain/?page=contacts&skin=underline');
    // The first step, in the header for everyone, downloads the file it names from where it is said.
    const workbook = page.locator('#demo-head .dh-try-step').getByRole('link', { name: 'the sample workbook' });
    await expect(workbook).toHaveAttribute('download', '');
    const download = page.waitForEvent('download');
    await workbook.click();
    expect((await download).suggestedFilename()).toBe('contacts-to-import.xlsx');
    // And the steps: the CSV file in its own step; a server's limit on the ids a press away, not typed in the address.
    await page.locator('#demo-head').getByRole('button', { name: 'About this demo' }).click();
    const howTo = page.getByRole('complementary', { name: 'About this demo' });
    await expect(howTo.getByRole('link', { name: 'the sample CSV file' })).toHaveAttribute('href', /\/samples\/contacts-to-import\.csv$/);
    const csv = await page.request.get((await howTo.getByRole('link', { name: 'the sample CSV file' }).getAttribute('href'))!);
    expect(csv.ok()).toBe(true);
    await screen(page, 'demo-steps-files', { viewport: true });
    await howTo.getByRole('link', { name: /hands over at most 1,000/ }).click();
    await expect(page).toHaveURL(/[?&]allIds=1000(&|$)/);
    await expect(page).toHaveURL(/[?&]page=contacts&skin=underline/);
    // A related list's new customer: the step's link, the look kept. (The panel opens as it was left: open.)
    await page.goto('/plain/?page=customer-account&record=1&skin=outlined');
    await expect(howTo).toBeVisible();
    await howTo.getByRole('link', { name: 'Start a new customer' }).click();
    await expect(page).toHaveURL(/[?&]page=customer-account&record=new&skin=outlined$/);
    await expect(page.locator('[data-node="invoices"] .fd-related-note')).toBeVisible();
    expect(problems).toEqual([]);
  });

  test('a phone’s header holds About this demo beside Options: nothing floats over the demo’s cards and totals', async ({ page }) => {
    await asVisitor(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/plain/?page=invoices&skin=underline');
    await expect(page.locator('.fd-list-card, .fd-card').first()).toBeVisible();
    const about = page.locator('#demo-head').getByRole('button', { name: 'About this demo' });
    const options = page.locator('#demo-head .dh-options');
    const [a, o, head] = [(await about.boundingBox())!, (await options.boundingBox())!, (await page.locator('#demo-head').boundingBox())!];
    // One row: the ? just before Options, inside the header.
    expect(Math.abs(a.y + a.height / 2 - (o.y + o.height / 2))).toBeLessThanOrEqual(2);
    expect(a.x + a.width).toBeLessThanOrEqual(o.x);
    expect(a.y + a.height).toBeLessThanOrEqual(head.y + head.height);
    // Nothing of the frame is fixed over the demo but what a person opened.
    const floating = await page.evaluate(() => [...document.querySelectorAll('body > *')].filter((e) => getComputedStyle(e).position === 'fixed' && (e as HTMLElement).offsetParent !== null && getComputedStyle(e).display !== 'none').map((e) => e.id));
    expect(floating).toEqual([]);
    await page.mouse.wheel(0, 4000);
    await screen(page, 'demo-frame-phone-bottom', { viewport: true });
    await about.click();
    await expect(page.getByRole('complementary', { name: 'About this demo' })).toBeVisible();
    await expectNoSidewaysScroll(page);
  });

  test('a theme’s ground fills the window under a short page, light and dark, as the walk saw it stop mid-screen', async ({ page }) => {
    const ground = () =>
      page.evaluate(() => {
        const form = document.querySelector('#app .fd-form') as HTMLElement;
        // The page's own colour at the window's foot, under the form.
        return [getComputedStyle(form).backgroundColor, getComputedStyle(document.body).backgroundColor, form.getBoundingClientRect().bottom < innerHeight];
      });
    await page.setViewportSize({ width: 1440, height: 900 });
    for (const [query, scheme, name] of [
      ['page=template-task&theme=apple&record=new&scheme=dark', 'dark', 'apple-task'],
      ['page=template-leave-request&theme=bootstrap&record=new&scheme=dark', 'dark', 'bootstrap-time-off'],
      ['page=customer&skin=underline&theme=ant&scheme=dark', 'dark', 'ant-customer'],
      ['page=template-invoice&theme=odoo&record=new', 'light', 'odoo-invoice'],
    ] as const) {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto(`/plain/?${query}`);
      await expect(page.locator('#app .fd-form[data-fd-theme]')).toBeVisible();
      await expect(page.locator('html')).toHaveClass(/demo-themed/);
      const [form, body, short] = await ground();
      expect(body, name).toBe(form);
      if (name !== 'ant-customer') expect(short, `${name} is a short page`).toBe(true);
      await screen(page, `theme-ground-${name}`, { viewport: true });
    }
    // No theme: the frame's own page, as before. (A template wears its own: the task is Apple's.) Asked once the
    // form is drawn, so it is the frame's answer and not the moment before it.
    await page.goto('/plain/?page=customer&skin=underline&scheme=dark');
    await expect(page.locator('#app .fd-form')).toBeVisible();
    await expect(page.locator('#app .fd-form')).not.toHaveAttribute('data-fd-theme', /./);
    await expect(page.locator('html')).not.toHaveClass(/demo-themed/);
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
      const told = problems.length;
      await page.goto(`/${demoHref(demo, framework.id)}`);
      await expect(page.locator('.fd-form').first(), demo.id).toBeVisible();
      await expect(page.locator('.dh-title'), demo.id).toHaveText(demo.name);
      // A demo whose parts fail on purpose ("A part that fails") tells the console so: what it shows, not a fault.
      // Its own browser test (contain.spec.ts) reads what it says.
      if (demo.failsOnPurpose) problems.splice(told);
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
