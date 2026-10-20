import { type Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { sitePages } from './site-pages';
import { AREAS, AREA_IDS, DEMOS, FEATURED, areaOf, demoHref } from '../demos/catalog.mjs';
import { HERO_JSON, TABS } from '../site/hero.mjs';
import { expectNoSidewaysScroll, screen } from './support';
import { axeFindings } from './a11y-support';
import { gzipSync } from 'node:zlib';
import { readFileSync } from 'node:fs';

/** fieldia.dev, as built into dist/site and served on its own port. */
/** `SITE_URL=https://fieldia.dev npx playwright test e2e/site.spec.ts` runs the same checks on the live site. */
const SITE = process.env['SITE_URL'] ?? `http://127.0.0.1:${process.env['FIELDIA_SITE_PORT'] ?? 4322}`;
// Every page of the site, as it builds them: none left off.
const PAGES = sitePages();

function watch(page: Page) {
  const problems: string[] = [];
  page.on('pageerror', (error) => problems.push(error.message));
  page.on('console', (message) => message.type() === 'error' && problems.push(message.text()));
  page.on('response', (response) => response.status() >= 400 && problems.push(`${response.status()} ${response.url()}`));
  return problems;
}

for (const path of PAGES) {
  test(`${path} reads well on a phone and a desktop, with no broken links`, async ({ page, request }) => {
    const problems = watch(page);
    for (const width of [390, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(SITE + path);
      await expect(page.locator('h1').first()).toBeVisible();
      await expectNoSidewaysScroll(page);
      const name = path === '/' ? 'home' : path.replace(/\//g, '');
      await page.screenshot({ path: `test-results/screens/site-${name}-${width}.png`, fullPage: true, animations: 'disabled' });
    }
    // Every link on the site's own domain answers.
    const links = await page.locator('a[href^="/"]').evaluateAll((as) => [...new Set(as.map((a) => (a as HTMLAnchorElement).getAttribute('href') as string))]);
    for (const href of links) expect((await request.get(SITE + href)).status(), href).toBe(200);
    expect(problems).toEqual([]);
  });
}

test('the live form on the front page checks, sends, changes skin and language', async ({ page }) => {
  const problems = watch(page);
  await page.goto(SITE + '/');
  const live = page.locator('#live-form');
  await expect(live.locator('.fd-form')).toHaveAttribute('data-fd-skin', 'outlined');
  await live.getByRole('button', { name: 'Submit' }).click();
  await expect(live.getByText('Your name is required')).toBeVisible();
  await live.getByLabel('Your name').fill('Lina');
  await live.getByLabel('Email').fill('lina@example.com');
  await live.getByLabel('Something else').check();
  await expect(live.getByLabel('Which one?')).toBeVisible();
  await live.getByLabel('Which one?').fill('Svelte');
  await live.getByRole('button', { name: 'Submit' }).click();
  await expect(page.locator('#live-note')).toContainText('nothing was sent anywhere');
  expect(await page.evaluate(() => (window as any).fieldiaLive.dataSource.responses[0].values)).toMatchObject({ name: 'Lina', framework: 'other', other: 'Svelte' });

  await page.locator('#live-skin').selectOption('underline');
  await expect(live.locator('.fd-form')).toHaveAttribute('data-fd-skin', 'underline');
  // Arabic's own script, fetched as it is picked: the live form's words in Arabic, right to left.
  const arabic = page.waitForResponse((response) => response.url().endsWith('/fieldia.ar.js'));
  await page.locator('#live-locale').selectOption('ar');
  expect((await arabic).status()).toBe(200);
  await expect(live.locator('.fd-form')).toHaveAttribute('dir', 'rtl');
  await expect(live.getByRole('button', { name: 'إرسال' })).toBeVisible();
  await page.screenshot({ path: 'test-results/screens/site-home-arabic.png', animations: 'disabled' });
  expect(problems).toEqual([]);
});

test('the numbers the site states agree: the script’s size is the size of the script it serves, the looks one count everywhere', async ({ page, request }) => {
  // Gzipped as tools/script-bundle.mjs measures it against its budget, and as site/facts.mjs reads it for the pages.
  const kb = Math.round(gzipSync(await (await request.get(SITE + '/fieldia.js')).body(), { level: 9 }).length / 1024);
  await page.goto(SITE + '/');
  await expect(page.locator('#numbers .count').nth(2)).toHaveAttribute('data-to', String(kb));
  const [skins, themes] = (/(\d+) skins, (\d+) themes/.exec((await page.locator('.power-figure', { hasText: 'skins' }).textContent()) ?? '') ?? []).slice(1).map(Number);
  // As the code defines them: core's SKINS and THEMES, as site/facts.mjs counts them for the pages.
  const listed = (name: string) => (new RegExp(`const ${name}\\b[^=]*= \\[([^\\]]*)\\]`).exec(readFileSync('libs/core/src/lib/format/themes.ts', 'utf8'))?.[1].match(/'[^']+'/g) ?? []).length;
  expect([skins, themes]).toEqual([listed('SKINS'), listed('THEMES')]);
  await page.goto(SITE + '/start/');
  await expect(page.locator('#script ~ p').first()).toContainText(`in ${kb} KB gzipped`);
  // Said in words on the Features page: the same counts.
  const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
  await page.goto(SITE + '/features/');
  await expect(page.locator('.feature-area', { hasText: 'Looks and languages' })).toContainText(new RegExp(`${WORDS[themes]} themes, ${WORDS[skins]} skins`, 'i'));
});

test('the docs’ code is coloured as it reads, and the words are the sample’s own', async ({ page }) => {
  await page.goto(SITE + '/maps/');
  const block = page.locator('pre.code[data-lang="json"]').first();
  await expect(block.locator('.tok-key').first()).toHaveText('"type"');
  await expect(block.locator('.tok-string').first()).toHaveText('"map"');
  const ts = page.locator('pre.code[data-lang="ts"]').first();
  await expect(ts.locator('.tok-keyword').first()).toHaveText('import');
  // The text is the sample's, letter for letter: the colours add nothing to it.
  expect(await ts.textContent()).toContain("import { azureMaps, mapListViews, mapParts, mapWidgets } from '@fieldia/map';");
  const colour = (selector: string) => block.locator(selector).first().evaluate((el) => getComputedStyle(el).color);
  expect(await colour('.tok-key')).not.toBe(await colour('.tok-string'));
});

test('a link to a heading shows the heading below the bar, not under it', async ({ page }) => {
  for (const anchor of ['/fields/#dialogs', '/fields/#grid', '/data/#requests']) {
    await page.goto(SITE + anchor);
    const bar = (await page.locator('.top').boundingBox())!;
    const heading = (await page.locator(anchor.slice(anchor.indexOf('#'))).boundingBox())!;
    expect(heading.y, `${anchor} is under the bar`).toBeGreaterThanOrEqual(bar.y + bar.height);
  }
});

test('the gallery shows every demo with its thumbnail, featured first, and each opens a working form or map', async ({ page }) => {
  // Time by the gallery's size: each demo opened, each thumbnail loaded.
  test.setTimeout(DEMOS.length * 3000);
  const problems = watch(page);
  await page.goto(SITE + '/demos/');
  const sections = await page.locator('.gallery-section h2').allTextContents();
  expect(sections[0]).toMatch(/Featured/);
  const cards = page.locator('a.demo-card');
  const hrefs = [...new Set(await cards.evaluateAll((as) => as.map((a) => (a as HTMLAnchorElement).getAttribute('href') as string)))];
  // Every demo of the catalog, once each, and the four featured again at the top.
  expect(hrefs.length).toBe(DEMOS.length);
  await expect(cards).toHaveCount(DEMOS.length + FEATURED.length);
  for (const image of await page.locator('.demo-thumb img').all()) {
    await image.scrollIntoViewIfNeeded();
    await expect.poll(() => image.evaluate((img) => (img as HTMLImageElement).naturalWidth)).toBe(600);
  }
  for (const href of hrefs) {
    const told = problems.length;
    await page.goto(SITE + href);
    // A form, or the map of a page of its own.
    await expect(page.locator('.fd-form, .fd-map-embed').first(), href).toBeVisible();
    await expect(page.locator('.dh-title'), href).not.toBeEmpty();
    // A demo whose parts fail on purpose ("A part that fails") tells the console so: what it shows, not a fault.
    if (DEMOS.some((demo) => demo.failsOnPurpose && href.endsWith(`/demos/${demoHref(demo)}`))) problems.splice(told);
  }
  expect(problems).toEqual([]);
});

test('every demo is in exactly one business area: none in two, none left out', () => {
  const listed = Object.values(AREA_IDS as Record<string, string[]>).flat();
  expect(listed.filter((id, at) => listed.indexOf(id) !== at)).toEqual([]);
  expect(DEMOS.filter((demo) => !areaOf(demo.id)).map((demo) => demo.id)).toEqual([]);
  expect(listed.filter((id) => !DEMOS.some((demo) => demo.id === id))).toEqual([]);
  expect(Object.keys(AREA_IDS).sort()).toEqual(AREAS.map((area) => area.id).sort());
});

test('the gallery by business area, found by words as they are typed, and by feature for developers', async ({ page }) => {
  const problems = watch(page);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(SITE + '/demos/');
  // By business area as it opens: each area its demos, each demo once.
  for (const area of AREAS) {
    const section = page.locator(`.gallery-section#${area.id}`);
    await expect(section, area.id).toBeVisible();
    await expect(section.locator('a.demo-card'), area.id).toHaveCount(DEMOS.filter((demo) => areaOf(demo.id) === area.id).length);
  }
  const shown = page.locator('.gallery-body a.demo-card:visible');
  const find = page.getByRole('searchbox', { name: 'Find a demo' });
  // "/" from anywhere finds; a name, a demo's words, an area's name each find; every word typed must hold.
  await page.locator('body').press('/');
  await expect(find).toBeFocused();
  await page.keyboard.type('postdated check');
  await expect(shown).toHaveCount(1);
  await expect(shown.first()).toContainText('Register a payment');
  await expect(page.locator('#gallery-said')).toHaveText('1 demo matches.');
  await expect(page.locator('#featured')).toBeHidden();
  await find.fill('timber');
  await expect(shown).toHaveCount(1);
  await expect(shown.first()).toContainText('Warehouse receipt');
  await find.fill('clinic');
  await expect(page.locator('.gallery-section#clinic a.demo-card:visible')).toHaveCount(DEMOS.filter((demo) => areaOf(demo.id) === 'clinic').length);
  await expect(page.locator('.gallery-section#people')).toBeHidden();
  await find.fill('zzzz nothing');
  await expect(shown).toHaveCount(0);
  await expect(page.locator('.gallery-none')).toBeVisible();
  // Escape lets every demo back.
  await find.press('Escape');
  await expect(find).toHaveValue('');
  await expect(shown).toHaveCount(DEMOS.length + FEATURED.length);
  // By feature: the same demos in the groups developers know, kept in the address; and back.
  await page.getByRole('button', { name: 'By feature' }).click();
  await expect(page).toHaveURL(/[?&]by=feature/);
  await expect(page.locator('.gallery-section#sales')).toBeHidden();
  await expect(page.locator('.gallery-section#records')).toBeVisible();
  await expect(page.locator('.gallery-section#records a.demo-card')).toHaveCount(DEMOS.filter((demo) => demo.category === 'records').length);
  await page.reload();
  await expect(page.getByRole('button', { name: 'By feature' })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'By business area' }).click();
  await expect(page).not.toHaveURL(/by=feature/);
  await expect(page.locator('.gallery-section#sales')).toBeVisible();
  expect(problems).toEqual([]);
});

test('the gallery opens in a business owner’s words, a demo is found by what it does, and headings count what a search keeps', async ({ page }) => {
  const problems = watch(page);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(SITE + '/demos/');
  // The first words under the title are a business owner's; the developers' — tests, frameworks — come after the search.
  const lead = page.locator('.gallery-hero .lead');
  await expect(lead).toContainText('quotes and orders');
  await expect(lead).not.toContainText(/test|JavaScript|React|Vue|Angular/);
  const dev = page.locator('.gallery-dev');
  await expect(dev).toContainText('in plain JavaScript, React, Vue and Angular');
  expect((await dev.boundingBox())!.y).toBeGreaterThan((await page.locator('.gallery-tools').boundingBox())!.y);
  // No card, and no demo's first thing to try, in a developer's words for an ERP's parts.
  const said = DEMOS.flatMap((demo) => [demo.name, demo.blurb, demo.howTo[0]]);
  for (const jargon of [/statusbar/i, /stat buttons?/i, /smart buttons?/i, /chatter/i, /\bpager\b/i, /\bwidgets?\b/i]) expect(said.filter((words) => jargon.test(words)), String(jargon)).toEqual([]);
  expect(await page.locator('.gallery-body .demo-blurb').allTextContents()).not.toContainEqual(expect.stringMatching(/statusbar|stat button|smart button|chatter|pager/i));
  // Found by what it does and the common words for it, as the walk typed them.
  const find = page.getByRole('searchbox', { name: 'Find a demo' });
  const shown = page.locator('.gallery-body a.demo-card:visible .demo-name');
  for (const [typed, demo] of [
    ['booking', 'A test drive, booked from the times free'],
    ['reservation', 'The booking desk’s week'],
    ['appointment', 'A test drive, booked from the times free'],
    ['phone', 'A customer or supplier'],
    ['mobile', 'Workshop sign-up'],
    ['bill', 'Invoices that add up'],
  ] as const) {
    await find.fill(typed);
    await expect(shown.filter({ hasText: demo }), typed).toHaveCount(1);
  }
  // While a search is on, each heading counts what it still shows, of all it has; Escape puts the whole counts back.
  const sales = DEMOS.filter((demo) => areaOf(demo.id) === 'sales').length;
  await find.fill('booking');
  await expect(page.locator('.gallery-section#sales h2 .count')).toHaveText(`1 of ${sales}`);
  await expect(page.locator('.gallery-section#clinic h2 .count')).toHaveText(/^\d+ of \d+$/);
  await screen(page, 'gallery-search-booking', { viewport: true });
  // A slip of the keys still finds: "invoce" brings the invoices, and says they are close to what was typed.
  await find.fill('invoce');
  await expect(shown.filter({ hasText: 'Invoices that add up' })).toHaveCount(1);
  await expect(page.locator('#gallery-said')).toContainText('words close to them');
  await find.press('Escape');
  await expect(page.locator('.gallery-section#sales h2 .count')).toHaveText(String(sales));
  await screen(page, 'gallery-top', { viewport: true });
  expect(problems).toEqual([]);
});

test('the gallery on a phone: a compact list, each demo its name and one line', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(SITE + '/demos/');
  await expectNoSidewaysScroll(page);
  const card = page.locator('.gallery-section#sales a.demo-card').first();
  await expect(card.locator('.demo-thumb')).toBeHidden();
  await expect(card.locator('.demo-name')).toBeVisible();
  expect((await card.boundingBox())!.height).toBeLessThan(90);
});

// ---- the front page's opening ----------------------------------------------------------

/** The stage's tabs, as site/hero.mjs writes them: the record first. */
const [RECORD, LIST, MAP, BOOKING] = TABS;
/** The words a tab's bar says once it is done: the last of its `used`. */
const finished = (tab: (typeof TABS)[number]) => tab.used[tab.used.length - 1];
/** The release the site is built from, as npm has it. */
const RELEASE = JSON.parse(readFileSync('libs/viewer/package.json', 'utf8')).version as string;
const tabOf = (page: Page, tab: (typeof TABS)[number]) => page.getByRole('tab', { name: tab.name });
const shownTab = (page: Page) => page.evaluate(() => (window as any).fieldiaHero.tab() as string);
const drawnPage = (page: Page) => page.evaluate(() => (window as any).fieldiaHero.page());
const jsonShown = async (page: Page) => JSON.parse((await page.locator('#stage-json').textContent())!);
/** Every word the stage's bar says, as it says it, kept in `heroSaid`. */
const keepWhatIsSaid = (page: Page) =>
  page.addInitScript(() => {
    const said: string[] = [];
    (window as any).heroSaid = said;
    new MutationObserver(() => {
      const words = document.getElementById('stage-step')?.textContent ?? '';
      if (words && said[said.length - 1] !== words) said.push(words);
    }).observe(document, { subtree: true, childList: true, characterData: true });
  });
/** One turn of the stage's screen between being made and made: the pane busy or not, the wait it shows, whether a line of the JSON is being typed, the bar's words. */
type Wait = { busy: string | null; kind?: string; typing: boolean; words: string };
/** Each turn, as it comes, kept in `heroWaits`. */
const keepTheWaits = (page: Page) =>
  page.addInitScript(() => {
    const waits: Wait[] = [];
    (window as any).heroWaits = waits;
    new MutationObserver(() => {
      const form = document.getElementById('stage-form');
      if (!form) return;
      const now = { busy: form.getAttribute('aria-busy'), kind: document.getElementById('stage-wait')?.dataset['kind'], typing: !!document.querySelector('#stage-json .caret'), words: document.getElementById('stage-step')?.textContent ?? '' };
      const last = waits[waits.length - 1] ?? { busy: 'false', typing: false };
      if (now.busy !== last.busy || now.typing !== last.typing) waits.push(now);
    }).observe(document, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['aria-busy', 'data-kind'] });
  });
const waitsKept = (page: Page): Promise<Wait[]> => page.evaluate(() => (window as any).heroWaits);

test('the front page opens with a headline, a line for a business and one for developers, Get started, and what is new in the release', async ({ page }) => {
  for (const width of [390, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(SITE + '/');
    // In this order, and nothing else: the kicker, the headline, a business owner's line, a developer's, the buttons.
    const copy = page.locator('.opening-copy > *');
    await expect(copy).toHaveCount(5);
    await expect(copy.nth(0)).toHaveClass(/kicker/);
    await expect(copy.nth(1)).toHaveText('Write the screen once.Fieldia runs it in your app.');
    await expect(copy.nth(2)).toHaveClass(/lede-business/);
    await expect(copy.nth(2)).toHaveText('Customer records, orders, invoices, bookings: the screens your team works in, in your look and your language.');
    await expect(copy.nth(3)).toHaveClass(/lede-dev/);
    await expect(copy.nth(3)).toHaveText('Each screen is a JSON file, not a component. Fieldia draws it in React, Vue, Angular or plain JavaScript, and hands every record to your backend.');
    await expect(copy.nth(4)).toHaveClass(/opening-actions/);
    // The business line in a business owner's words: no JSON, no framework.
    await expect(copy.nth(2)).not.toContainText(/JSON|JavaScript|React|Vue|Angular/);
  }
  // The kicker names the release and links to what is new in it, on GitHub.
  const minor = RELEASE.split('.').slice(0, 2).join('.');
  await expect(page.locator('.kicker')).toContainText(`Open source · MIT · ${minor}`);
  const news = page.getByRole('link', { name: `What’s new in ${minor}` });
  await expect(news).toHaveAttribute('href', `https://github.com/fieldia-dev/fieldia/releases/tag/v${RELEASE}`);
  await expect(page.getByRole('link', { name: 'Get started' }).first()).toHaveAttribute('href', '/start/');
  await expect(page.locator('#copy-install')).toHaveAttribute('data-copy', 'npm install @fieldia/viewer');
});

test('the business areas in a strip under the opening, each to its demos', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto(SITE + '/');
  const strip = page.getByRole('navigation', { name: 'See it at work' });
  // Under the opening, not among its words, and a strip: one row on a laptop.
  await expect(page.locator('.opening-copy .uses')).toHaveCount(0);
  const opening = (await page.locator('.home-opening').boundingBox())!;
  const box = (await strip.boundingBox())!;
  expect(Math.round(box.y)).toBe(Math.round(opening.y + opening.height));
  expect(box.height).toBeLessThan(80);
  const uses = strip.getByRole('link');
  await expect(uses).toHaveCount(AREAS.length - 1);
  // Each area's demos counted as the catalog has them.
  for (const area of AREAS.filter((a) => a.id !== 'building-blocks')) {
    const link = strip.locator(`a[href="/demos/#${area.id}"]`);
    await expect(link, area.id).toHaveText(`${area.label}${DEMOS.filter((demo) => areaOf(demo.id) === area.id).length} demos`);
  }
  await strip.getByRole('link', { name: /^Clinic/ }).click();
  await expect(page).toHaveURL(/\/demos\/#clinic$/);
  await expect(page.locator('.gallery-section#clinic')).toBeInViewport();
});

test('the opening on the first screen: side by side on a laptop, its tabs and the stage’s record readable; on a phone Get started before the fold', async ({ page }) => {
  test.setTimeout(180000);
  for (const [width, height] of [[1180, 720], [1280, 720], [1440, 900], [1920, 1080]]) {
    await page.setViewportSize({ width, height });
    await page.goto(SITE + '/');
    await expect(page.locator('#stage-step')).toHaveText(RECORD.steps[0].words, { timeout: 20000 });
    const stage = (await page.locator('.home-opening .stage').boundingBox())!;
    const copy = (await page.locator('.opening-copy').boundingBox())!;
    // Beside the words, and the words and the stage both whole on the first screen, under the bar.
    expect(stage.x, `${width}: the stage beside the words`).toBeGreaterThan(copy.x + copy.width);
    for (const [name, part] of [['stage', stage], ['words', copy]] as const) {
      expect(part.y, `${width}: the ${name}' top`).toBeGreaterThanOrEqual(60);
      expect(part.y + part.height, `${width}: the ${name}' foot`).toBeLessThanOrEqual(height);
    }
    // The four tabs over it, each whole in view, on one line.
    for (const tab of TABS) await expect(tabOf(page, tab), `${width}: ${tab.name}`).toBeInViewport({ ratio: 1 });
    const tops = await page.getByRole('tablist', { name: 'Examples' }).getByRole('tab').evaluateAll((tabs) => tabs.map((t) => Math.round(t.getBoundingClientRect().top)));
    expect(new Set(tops).size, `${width}: the tabs on one line`).toBe(1);
    // The record's first field on the screen, and the record not a postage stamp: as wide as a phone's screen or more.
    await expect(page.locator('#stage-form [data-field="name"]')).toBeInViewport({ ratio: 1 });
    expect((await page.locator('#stage-form').boundingBox())!.width, `${width}: the record's width`).toBeGreaterThanOrEqual(420);
    // The JSON readable: 13px or more.
    expect(parseFloat(await page.locator('#stage-json').evaluate((pre) => getComputedStyle(pre).fontSize))).toBeGreaterThanOrEqual(13);
    // Get started and the install line whole in the words' column, however narrow it is just side by side.
    const column = (await page.locator('.opening-copy').boundingBox())!;
    for (const action of await page.locator('.opening-copy .opening-actions > *').all()) {
      const box = (await action.boundingBox())!;
      expect(box.x + box.width, `${width}: ${await action.textContent()} in the words' column`).toBeLessThanOrEqual(column.x + column.width + 0.5);
    }
    await page.screenshot({ path: `test-results/screens/site-home-opening-${width}.png` });
  }
  for (const [width, height] of [[390, 844], [360, 740]]) {
    await page.setViewportSize({ width, height });
    await page.goto(SITE + '/');
    await expect(page.locator('#opening-h')).toBeInViewport({ ratio: 1 });
    await expect(page.getByRole('link', { name: 'Get started' }).first()).toBeInViewport({ ratio: 1 });
    // The stage after the words; its four tabs across the phone's width, none cut and nothing to scroll sideways.
    expect((await page.locator('.home-opening .stage').boundingBox())!.y).toBeGreaterThan((await page.locator('.opening-actions').first().boundingBox())!.y);
    const strip = page.getByRole('tablist', { name: 'Examples' });
    expect(await strip.evaluate((el) => el.scrollWidth - el.clientWidth), `${width}: the tabs fit`).toBeLessThanOrEqual(0);
    const across = (await strip.boundingBox())!;
    for (const tab of TABS) {
      const box = (await tabOf(page, tab).boundingBox())!;
      expect(box.x, `${width}: ${tab.name}`).toBeGreaterThanOrEqual(across.x);
      expect(box.x + box.width, `${width}: ${tab.name}`).toBeLessThanOrEqual(across.x + across.width + 0.5);
      expect(box.height, `${width}: ${tab.name}, a finger's target`).toBeGreaterThanOrEqual(40);
    }
    await page.screenshot({ path: `test-results/screens/site-home-opening-${width}.png` });
  }
  // Nothing sideways at any width, on either side of where the words and the stage go side by side: each tab's
  // finished state drawn at once (reduced motion) — the record's invoices' table, the list's cards, the map, the month.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const width of [1920, 1440, 1280, 1180, 1179, 1024, 800, 799, 768, 520, 390, 360]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(SITE + '/');
    await expect(page.locator('#stage-form .fd-related tbody tr')).toHaveCount(4);
    await expectNoSidewaysScroll(page);
    if (![1920, 1180, 800, 390, 360].includes(width)) continue;
    for (const [tab, drawn] of [[LIST, '.fd-list-group'], [MAP, '.fd-map-card'], [BOOKING, '.fd-slots-chosen']] as const) {
      await tabOf(page, tab).click();
      await expect(page.locator('#stage-step')).toHaveText(finished(tab));
      await expect(page.locator(`#stage-form ${drawn}`).first(), `${width}: ${tab.name}`).toBeVisible();
      await expectNoSidewaysScroll(page);
    }
  }
});

test('the record tab writes customer.page.json step by step, draws each step, and ends on the page it shows', async ({ page }) => {
  test.setTimeout(90000);
  const problems = watch(page);
  await keepWhatIsSaid(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(SITE + '/');
  const stage = page.locator('.home-opening .stage');
  const form = page.locator('#stage-form');
  // A customer's record, by its name, as the first step is drawn: the JSON pane says what was written.
  await expect(page.locator('#stage-step')).toHaveText(RECORD.steps[0].words, { timeout: 20000 });
  await expect(form.locator('[data-field="name"] textarea')).toHaveValue('Kessler Logistik GmbH');
  expect(await jsonShown(page)).toEqual(JSON.parse(RECORD.steps[0].text));
  await expect(stage.getByRole('button', { name: 'Skip' })).toBeVisible();
  // The tab named, and its panel named by it.
  await expect(tabOf(page, RECORD)).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('tabpanel', { name: RECORD.name })).toBeVisible();
  // The pointer resting on the stage: someone is reading, and it stays on this tab once it is done.
  const box = (await stage.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await expect(page.locator('#stage-step')).toHaveText(finished(RECORD), { timeout: 60000 });
  // Each step in order, then someone using it.
  const said: string[] = await page.evaluate(() => (window as any).heroSaid);
  expect(said.slice(said.indexOf(RECORD.steps[0].words))).toEqual([...RECORD.steps.map((step) => step.words), ...RECORD.used]);
  // The page drawn last is the page shown, and the page the site was built with.
  expect(await jsonShown(page)).toEqual(JSON.parse(HERO_JSON));
  expect(await drawnPage(page)).toEqual(JSON.parse(RECORD.json));
  // A real record: its phone read for its country, money in euros, Lead › Customer, and the rule's VAT number,
  // required now that it is a company.
  await expect(form.getByRole('combobox', { name: 'Country of Phone' })).toHaveValue('DE');
  await expect(form.locator('[data-field="phone"] input[type="tel"]')).toHaveValue('+49 30 1234 5678');
  await expect(form.locator('[data-field="credit"] input')).toHaveValue('25,000.00');
  await expect(form.locator('[data-field="credit"]')).toContainText('€');
  await expect(form.getByRole('list', { name: 'Stage' })).toHaveText('LeadCustomer');
  await expect(form.getByRole('list', { name: 'Stage' }).locator('[aria-current="step"]')).toHaveText('Customer');
  await expect(form.locator('[data-field="vat"] input')).toHaveValue('DE 123456789');
  await expect(form.locator('[data-field="vat"] input')).toHaveAttribute('aria-required', 'true');
  // Their invoices inside it, the overdue one toned and said in a key, its words in the invoice page's own names.
  const invoices = form.getByRole('group', { name: 'Their invoices, 4' });
  await expect(invoices.locator('tbody tr')).toHaveCount(4);
  await expect(invoices.locator('tbody tr[data-tone="danger"]')).toHaveCount(1);
  await expect(invoices.locator('tbody tr[data-tone="danger"]')).toContainText('INV-0412');
  await expect(invoices.getByRole('list', { name: 'Key to the rows' })).toHaveText('Overdue');
  await expect(invoices.getByRole('button', { name: 'New invoice' })).toBeVisible();
  // View all opens every invoice of this customer's, the app's own list of them.
  await invoices.getByRole('button', { name: 'View all invoices' }).click();
  const all = page.getByRole('dialog');
  await expect(all.locator('tbody tr')).toHaveCount(4);
  await page.keyboard.press('Escape');
  await expect(all).toBeHidden();
  // Try it: a person, not a company, has no VAT number to give.
  await form.getByRole('switch', { name: 'A company' }).uncheck();
  await expect(form.locator('[data-field="vat"]')).toBeHidden();
  // Still on the record: the pointer on it held the stage there.
  expect(await shownTab(page)).toBe(RECORD.id);
  await page.screenshot({ path: 'test-results/screens/site-home-stage-finished.png' });
  expect(problems).toEqual([]);
});

test('untouched, the stage plays each tab in turn: every step’s words, then its use, each ending on the page it shows', async ({ page }) => {
  test.setTimeout(180000);
  const problems = watch(page);
  await keepWhatIsSaid(page);
  await keepTheWaits(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(SITE + '/');
  for (const tab of TABS) {
    await expect(page.locator('#stage-step')).toHaveText(finished(tab), { timeout: 60000 });
    await expect(tabOf(page, tab)).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('#stage-file')).toHaveText(tab.file);
    expect(await jsonShown(page), tab.id).toEqual(JSON.parse(tab.json));
    expect(await drawnPage(page), tab.id).toEqual(JSON.parse(tab.json));
    await page.screenshot({ path: `test-results/screens/site-home-stage-${tab.id}.png` });
  }
  // Each tab's steps in order, then someone using it, the tabs one after another.
  const said: string[] = await page.evaluate(() => (window as any).heroSaid);
  expect(said.slice(said.indexOf(`Writing ${RECORD.file}`))).toEqual(TABS.flatMap((tab) => [`Writing ${tab.file}`, ...tab.steps.map((step) => step.words), ...tab.used]));
  // The screen being made for exactly as long as each step's lines are typed: busy while a line is written, and not
  // once the step is drawn; a tab's first step sketched, each later one under a veil; never while a tab is used or at rest.
  const waits = await waitsKept(page);
  for (const wait of waits) expect(wait.busy, JSON.stringify(wait)).toBe(String(wait.typing));
  expect(waits.filter((wait) => wait.busy === 'true').map((wait) => [wait.kind, wait.words])).toEqual(
    TABS.flatMap((tab) => tab.steps.map((step, i) => (i ? ['update', tab.steps[i - 1].words] : ['first', `Writing ${tab.file}`]))),
  );
  expect(waits.filter((wait) => wait.busy === 'false').map((wait) => wait.words)).toEqual(TABS.flatMap((tab) => tab.steps.map((step) => step.words)));
  // And after the last, it rests there: nothing goes round again.
  await page.waitForTimeout(4000);
  expect(await shownTab(page)).toBe(BOOKING.id);
  await expect(page.locator('#stage-step')).toHaveText(finished(BOOKING));
  expect(problems).toEqual([]);
});

test('a press in the stage keeps it on the tab it shows: the next never comes by itself', async ({ page }) => {
  test.setTimeout(90000);
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto(SITE + '/');
  await expect(page.locator('#stage-step')).toHaveText(RECORD.steps[1].words, { timeout: 20000 });
  // A press on the JSON, as someone reading it would.
  await page.locator('#stage-json').click();
  await expect(page.locator('#stage-step')).toHaveText(finished(RECORD), { timeout: 60000 });
  await page.waitForTimeout(5000);
  expect(await shownTab(page)).toBe(RECORD.id);
  await expect(page.locator('#stage-step')).toHaveText(finished(RECORD));
  await expect(tabOf(page, LIST)).toHaveAttribute('aria-selected', 'false');
  // A tab pressed plays that tab, and stays on it once it is done.
  await tabOf(page, LIST).click();
  await expect(page.locator('#stage-step')).toHaveText(LIST.steps[0].words, { timeout: 20000 });
  await expect(page.locator('#stage-step')).toHaveText(finished(LIST), { timeout: 60000 });
  await page.waitForTimeout(4000);
  expect(await shownTab(page)).toBe(LIST.id);
});

test('the stage’s tabs by keyboard: the arrows, Home and End, each tab marked and its panel named by it', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(SITE + '/');
  const tabs = page.getByRole('tablist', { name: 'Examples' }).getByRole('tab');
  await expect(tabs).toHaveText(TABS.map((tab) => tab.name));
  // One stop for the tabs: the one shown.
  await expect(tabs.nth(0)).toHaveAttribute('tabindex', '0');
  for (const i of [1, 2, 3]) await expect(tabs.nth(i)).toHaveAttribute('tabindex', '-1');
  // Reached by Tab from the buttons before it, its focus in sight.
  await page.locator('#copy-install').focus();
  await page.keyboard.press('Tab');
  await expect(tabOf(page, RECORD)).toBeFocused();
  expect(await tabOf(page, RECORD).evaluate((el) => getComputedStyle(el).outlineStyle)).not.toBe('none');
  const at = async (tab: (typeof TABS)[number]) => {
    await expect(tabOf(page, tab)).toBeFocused();
    await expect(tabOf(page, tab)).toHaveAttribute('aria-selected', 'true');
    await expect(tabOf(page, tab)).toHaveAttribute('tabindex', '0');
    await expect(tabs.and(page.locator('[aria-selected="true"]'))).toHaveCount(1);
    await expect(page.getByRole('tabpanel', { name: tab.name })).toBeVisible();
    await expect(page.locator('#stage-file')).toHaveText(tab.file);
    await expect(page.locator('#stage-step')).toHaveText(finished(tab));
  };
  await page.keyboard.press('ArrowRight');
  await at(LIST);
  await page.keyboard.press('End');
  await at(BOOKING);
  await page.keyboard.press('ArrowRight');
  await at(RECORD);
  await page.keyboard.press('ArrowLeft');
  await at(BOOKING);
  await page.keyboard.press('Home');
  await at(RECORD);
  // The tab's panel next, then into it: Replay, the JSON, the page drawn.
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Replay' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.locator('#stage-json')).toBeFocused();
});

test('the map’s code is not asked for before its tab, and comes when its tab is shown', async ({ page }) => {
  test.setTimeout(90000);
  const asked: string[] = [];
  page.on('request', (request) => request.url().includes('/hero/') && asked.push(request.url()));
  // While the first tab plays: none of it, nor Leaflet.
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(SITE + '/');
  await expect(page.locator('#stage-step')).toHaveText(RECORD.steps[5].words, { timeout: 40000 });
  expect(asked).toEqual([]);
  expect(await page.evaluate(() => 'L' in window || !!document.querySelector('.leaflet-container'))).toBe(false);

  // With reduced motion nothing plays by itself: the list's tab shown asks for none of it; the map's does.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(SITE + '/');
  asked.length = 0;
  await tabOf(page, LIST).click();
  await expect(page.locator('#stage-step')).toHaveText(finished(LIST));
  await page.waitForTimeout(500);
  expect(asked).toEqual([]);
  const map = page.waitForResponse((response) => response.url().endsWith('/hero/map.js'));
  await tabOf(page, MAP).click();
  expect((await map).status()).toBe(200);
  // Leaflet in a chunk of its own, asked for once a map is shown.
  await expect(page.locator('#stage-form .leaflet-container')).toBeVisible();
  expect(asked.some((url) => /\/hero\/leaflet-src-[A-Z0-9]+\.js$/.test(url))).toBe(true);
});

for (const colorScheme of ['light', 'dark'] as const) {
test(`with reduced motion each tab shows its finished state at once, the page it draws the JSON it shows, and none moves on · ${colorScheme}`, async ({ page }) => {
  test.setTimeout(120000);
  const problems = watch(page);
  await keepTheWaits(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: 'reduce', colorScheme });
  await page.goto(SITE + '/');
  const stage = page.locator('.home-opening .stage');
  const form = page.locator('#stage-form');
  // Each at rest, and the page round it passing axe: AA contrast, names, the tabs' roles.
  const atRest = async (tab: (typeof TABS)[number]) => {
    await expect(page.locator('#stage-step')).toHaveText(finished(tab));
    await expect(stage.getByRole('button', { name: 'Replay' })).toBeVisible();
    await expect(stage.getByRole('button', { name: 'Skip' })).toBeHidden();
    // Its screen made at once: never a sketch, a veil or a chip.
    await expect(form).toHaveAttribute('aria-busy', 'false');
    await expect(page.locator('#stage-wait')).toBeHidden();
    expect(await jsonShown(page), tab.id).toEqual(JSON.parse(tab.json));
    await expect.poll(() => drawnPage(page)).toEqual(JSON.parse(tab.json));
    expect(await axeFindings(page, `the stage's ${tab.id} · ${colorScheme}`)).toEqual([]);
  };
  // The record: a company, its VAT number typed, its invoices.
  await atRest(RECORD);
  await expect(form.locator('[data-field="vat"] input')).toHaveValue('DE 123456789');
  await expect(form.locator('.fd-related tbody tr')).toHaveCount(4);
  await page.waitForTimeout(3000);
  expect(await shownTab(page)).toBe(RECORD.id);

  // The list: a table of unpaid invoices grouped by customer, each with its sum, Kessler's opened, its overdue one in red.
  await tabOf(page, LIST).click();
  await atRest(LIST);
  await expect(form.locator('.fd-facet .fd-facet-text')).toHaveText(['Unpaid', 'Customer']);
  await expect(form.locator('.fd-list')).not.toHaveAttribute('data-as', /./);
  await expect(form.locator('.fd-list-table thead th')).toHaveText(['No.', 'Customer', 'Amount', 'Status']);
  await expect(form.locator('.fd-list-group')).toHaveText(['Brandt & Söhne (1) · € 12,400.00', 'Café Amsel (1) · € 640.00', 'Kessler GmbH (2) · € 7,010.50', 'Nordlicht AG (2) · € 4,405.00']);
  await expect(form.locator('.fd-list-row')).toHaveCount(2);
  await expect(form.locator('.fd-list-row[data-tone="danger"]')).toHaveText(['INV-0412Kessler GmbH€ 4,860.00Sent']);
  await expect(form.getByRole('list', { name: 'Key to the rows' })).toHaveText('Overdue');
  await expect(form.locator('.fd-list-totals')).toContainText('€ 24,455.50');
  await page.screenshot({ path: `test-results/screens/site-home-stage-list-at-rest-${colorScheme}.png` });

  // The map: Zamalek's homes found from its district, one home's card open, each district shaded with a key.
  await tabOf(page, MAP).click();
  await atRest(MAP);
  await expect(form.locator('.fd-facet .fd-facet-text')).toHaveText(['In Zamalek']);
  await expect(form.locator('.fd-map-card .fd-map-card-title')).toHaveText('Nile-view flat');
  await expect(form.locator('.fd-map-card')).toContainText('E£ 9,500,000.00');
  await expect(form.locator('.fd-map-legend .fd-map-legend-title')).toHaveText('Homes for sale');
  await expect(form.locator('path.fd-map-region[data-shade]').first()).toBeAttached();
  await page.screenshot({ path: `test-results/screens/site-home-stage-map-at-rest-${colorScheme}.png` });

  // The booking: on Berlin's clock, a day's free times, one chosen, its end written in Back by.
  await tabOf(page, BOOKING).click();
  await atRest(BOOKING);
  await expect(form.locator('.fd-slots-zone')).toHaveText(/^Times are Central European (Standard |Summer )?Time$/);
  await expect(form.locator('.fd-slots-chip[aria-pressed="true"]')).toHaveCount(1);
  await expect(form.locator('.fd-slots-chosen')).toHaveText(/, \d\d:00 to \d\d:45 CES?T$/);
  await expect(form.locator('[data-field="stop"] input')).not.toHaveValue('');
  await page.screenshot({ path: `test-results/screens/site-home-stage-booking-at-rest-${colorScheme}.png` });
  await page.waitForTimeout(3000);
  expect(await shownTab(page)).toBe(BOOKING.id);
  // Not once, on any tab, was the pane busy: nor as Replay writes one again, line by line.
  expect(await waitsKept(page)).toEqual([]);
  await stage.getByRole('button', { name: 'Replay' }).click();
  await expect(page.locator('#stage-step')).not.toHaveText(finished(BOOKING));
  await expect(page.locator('#stage-step')).toHaveText(finished(BOOKING), { timeout: 30000 });
  const waits = await waitsKept(page);
  expect(waits.some((wait) => wait.typing)).toBe(true);
  expect(waits.filter((wait) => wait.busy === 'true')).toEqual([]);
  await expect(page.locator('#stage-wait')).toBeHidden();
  expect(problems).toEqual([]);
});
}

test('the list is a table beside the JSON, its four columns whole and its amounts on one line; cards on a phone alone', async ({ page }) => {
  test.setTimeout(120000);
  const form = page.locator('#stage-form');
  /** How far the list's table runs past its box: nothing, or it scrolls sideways inside it. */
  const overrun = () => form.locator('.fd-list-scroll').evaluate((box) => box.scrollWidth - box.clientWidth);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  // Just side by side (1180 to 1279, the words' column narrower there), a laptop's, a desktop's, a tablet's.
  for (const [width, height] of [[1180, 720], [1200, 800], [1250, 800], [1280, 720], [1440, 900], [1920, 1080], [768, 1024]]) {
    await page.setViewportSize({ width, height });
    await page.goto(SITE + '/');
    await tabOf(page, LIST).click();
    await expect(page.locator('#stage-step')).toHaveText(finished(LIST));
    expect(await drawnPage(page), `${width}`).toEqual(JSON.parse(LIST.json));
    await expect(form.locator('.fd-list'), `${width}`).not.toHaveAttribute('data-as', /./);
    await expect(form.locator('.fd-list-table thead th')).toHaveText(['No.', 'Customer', 'Amount', 'Status']);
    expect(await overrun(), `${width}: the table fits its pane`).toBeLessThanOrEqual(0);
    // Every row the search finds, not only the group opened: the filter and the grouping taken off.
    await form.locator('.fd-facet-remove').first().click();
    await form.locator('.fd-facet-remove').first().click();
    await expect(form.locator('.fd-list-row')).toHaveCount(9);
    expect(await overrun(), `${width}: every row fits`).toBeLessThanOrEqual(0);
    // An amount on one line: as tall as its row's number.
    const lines = await form.locator('.fd-list-row').evaluateAll((rows) => rows.map((row) => [row.querySelector('td.fd-num')!.getBoundingClientRect().height, row.querySelector('td')!.getBoundingClientRect().height]));
    for (const [amount, number] of lines) expect(amount, `${width}: an amount on one line`).toBe(number);
  }

  // On a phone's screen: the same list, a step more — its rows as cards — and the page it draws the one it shows.
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await keepWhatIsSaid(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(SITE + '/');
  await tabOf(page, LIST).click();
  await expect(page.locator('#stage-step')).toHaveText(finished(LIST), { timeout: 60000 });
  const said: string[] = await page.evaluate(() => (window as any).heroSaid);
  expect(said.slice(said.indexOf(`Writing ${LIST.file}`))).toEqual([`Writing ${LIST.file}`, ...LIST.narrow!.map((step) => step.words), ...LIST.used]);
  expect(LIST.steps.map((step) => step.words)).not.toContain('At a phone’s width, cards');
  expect(await jsonShown(page)).toEqual(JSON.parse(LIST.narrowJson!));
  expect(await drawnPage(page)).toEqual(JSON.parse(LIST.narrowJson!));
  await expect(form.locator('.fd-list')).toHaveAttribute('data-as', 'cards');
  await expectNoSidewaysScroll(page);
});

test('Skip finishes the tab shown and Replay writes it again', async ({ page }) => {
  test.setTimeout(60000);
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto(SITE + '/');
  const stage = page.locator('.home-opening .stage');
  await expect(page.locator('#stage-step')).toHaveText(RECORD.steps[1].words, { timeout: 20000 });
  await stage.getByRole('button', { name: 'Skip' }).click();
  await expect(page.locator('#stage-step')).toHaveText(finished(RECORD));
  await expect(stage.getByRole('button', { name: 'Skip' })).toBeHidden();
  await expect(page.locator('#stage-form [data-field="vat"] input')).toHaveValue('DE 123456789');
  expect(await drawnPage(page)).toEqual(JSON.parse(HERO_JSON));
  // Replay writes it again from the first step.
  await stage.getByRole('button', { name: 'Replay' }).click();
  await expect(stage.getByRole('button', { name: 'Skip' })).toBeVisible();
  await expect(page.locator('#stage-step')).toHaveText(RECORD.steps[0].words, { timeout: 20000 });
  // Each tab its own: the booking's Skip finishes the booking.
  await tabOf(page, BOOKING).click();
  await expect(page.locator('#stage-step')).toHaveText(BOOKING.steps[0].words, { timeout: 20000 });
  await stage.getByRole('button', { name: 'Skip' }).click();
  await expect(page.locator('#stage-step')).toHaveText(finished(BOOKING));
  await expect(page.locator('#stage-form .fd-slots-chip[aria-pressed="true"]')).toHaveCount(1);
  expect(await drawnPage(page)).toEqual(JSON.parse(BOOKING.json));
});

test('while a step is written its screen shows it is being made: a tab’s first sketched, each later under a veil, neither once it is drawn', async ({ page }) => {
  test.setTimeout(90000);
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto(SITE + '/');
  const form = page.locator('#stage-form');
  const screen = page.locator('#stage-form > *');
  const sketch = page.locator('#stage-wait .stage-sketch');
  const chip = page.locator('#stage-wait .stage-busy');
  // The first step typed: the empty pane busy, a screen sketched in it and said to be drawn. The chip is not read out:
  // the bar's words are the stage's one live region.
  await expect(form).toHaveAttribute('aria-busy', 'true', { timeout: 20000 });
  await expect(page.locator('#stage-step')).toHaveText(`Writing ${RECORD.file}`);
  await expect(sketch).toBeVisible();
  await expect(chip).toBeVisible();
  await expect(chip).toHaveText('Drawing the screen…');
  await expect(page.locator('#stage-wait')).toHaveAttribute('aria-hidden', 'true');
  await expect(page.locator('.home-opening .stage [aria-live]')).toHaveCount(1);
  await expect(screen).toHaveCount(0);
  // Drawn: the record in the sketch's place, the pane no longer busy.
  await expect(page.locator('#stage-step')).toHaveText(RECORD.steps[0].words);
  await expect(form).toHaveAttribute('aria-busy', 'false');
  await expect(form.locator('[data-field="name"]')).toBeVisible();
  await expect(sketch).toBeHidden();
  await expect(chip).toBeHidden();
  // A later step typed (their invoices, the longest): the record stays, dimmed under a veil, the chip saying it is updating.
  await expect(page.locator('#stage-step')).toHaveText(RECORD.steps[4].words, { timeout: 30000 });
  await expect(form).toHaveAttribute('aria-busy', 'true', { timeout: 10000 });
  await expect(chip).toBeVisible();
  await expect(chip).toHaveText('Updating…');
  await expect(sketch).toBeHidden();
  await expect(form.locator('.fd-statusbar')).toBeVisible();
  await expect.poll(() => screen.evaluate((el) => Number(getComputedStyle(el).opacity))).toBeLessThan(0.6);
  // Drawn: the veil lifted, and what the step adds marked as just drawn.
  await expect(page.locator('#stage-step')).toHaveText(RECORD.steps[5].words);
  await expect(form).toHaveAttribute('aria-busy', 'false');
  await expect(chip).toBeHidden();
  await expect(form.locator('.fd-related.just-drawn')).toBeVisible();
  await expect.poll(() => screen.evaluate((el) => Number(getComputedStyle(el).opacity))).toBe(1);
});

test('the screen being made is never left behind: not by Skip, not by a tab changed mid-typing; Replay sketches it again', async ({ page }) => {
  test.setTimeout(90000);
  await keepTheWaits(page);
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto(SITE + '/');
  const stage = page.locator('.home-opening .stage');
  const form = page.locator('#stage-form');
  const none = async () => {
    await expect(form).toHaveAttribute('aria-busy', 'false');
    await expect(page.locator('#stage-wait')).toBeHidden();
  };
  const busySince = async (from: number) => (await waitsKept(page)).slice(from).filter((wait) => wait.busy === 'true');
  // Skip as the first step is typed: its sketch gone at once, and none comes as the tab finishes.
  await expect(form).toHaveAttribute('aria-busy', 'true', { timeout: 20000 });
  await stage.getByRole('button', { name: 'Skip' }).click();
  const skipped = (await waitsKept(page)).length;
  await none();
  await expect(page.locator('#stage-step')).toHaveText(finished(RECORD));
  await page.waitForTimeout(1500);
  await none();
  expect(await busySince(skipped)).toEqual([]);
  // Replay: from the sketch again.
  await stage.getByRole('button', { name: 'Replay' }).click();
  await expect(form).toHaveAttribute('aria-busy', 'true');
  await expect(page.locator('#stage-wait')).toHaveAttribute('data-kind', 'first');
  await expect(page.locator('#stage-wait .stage-sketch')).toBeVisible();
  await expect(page.locator('#stage-step')).toHaveText(RECORD.steps[0].words);
  // The map's tab pressed while a later step is typed under the veil: the veil gone with the press, while the map's own
  // code is fetched, and the map's first step sketched once it is typed.
  /** `id` pressed the moment a later step is typed under the veil; what the pane is straight after. */
  const pressUnderTheVeil = async (id: string) =>
    (
      await page.waitForFunction(
        (id) => {
          const pane = document.getElementById('stage-form')!;
          if (pane.getAttribute('aria-busy') !== 'true' || document.getElementById('stage-wait')!.dataset['kind'] !== 'update') return false;
          const from = (window as any).heroWaits.length;
          document.getElementById(id)!.click();
          return { from, busy: pane.getAttribute('aria-busy'), screens: pane.childElementCount };
        },
        id,
        { polling: 10, timeout: 30000 },
      )
    ).jsonValue();
  const switched = await pressUnderTheVeil('stage-tab-map');
  expect([switched.busy, switched.screens]).toEqual(['false', 0]);
  await expect(page.locator('#stage-step')).toHaveText(MAP.steps[0].words, { timeout: 20000 });
  await none();
  await expect(page.locator('#stage-form .fd-map-box')).toBeVisible();
  // The first the pane was busy after the press: the map's own first step, sketched.
  expect((await busySince(switched.from)).slice(0, 1).map((wait) => [wait.kind, wait.words])).toEqual([['first', `Writing ${MAP.file}`]]);
  // Skip as a later step of the map is typed: the veil lifted at once, and the map finished.
  const finishedNow = await pressUnderTheVeil('stage-skip');
  expect(finishedNow.busy).toBe('false');
  await none();
  await expect(page.locator('#stage-step')).toHaveText(finished(MAP));
  await expect(page.locator('#stage-form > *')).toHaveCSS('opacity', '1');
  await page.waitForTimeout(1000);
  expect(await busySince(finishedNow.from)).toEqual([]);
});

test('Maps has its own place in the top bar, beside Demos, and is the one lit on the maps page', async ({ page }) => {
  await page.goto(SITE + '/');
  const nav = page.locator('.top-nav a');
  await expect(nav).toContainText(['Docs', 'Features', 'Demos', 'Maps', 'Templates']);
  await nav.filter({ hasText: /^Maps$/ }).click();
  await expect(page).toHaveURL(/\/features\/maps\/$/);
  await expect(page.locator('.top-nav a[aria-current="page"]')).toHaveText(['Maps']);
  // Another feature's page lights Features, not Maps.
  await page.goto(SITE + '/features/forms/');
  await expect(page.locator('.top-nav a[aria-current="page"]')).toHaveText(['Features']);
});

test('the Designer page opens the designer at each starting point, with a way back', async ({ page }) => {
  const problems = watch(page);
  await page.goto(SITE + '/designer/');
  await expect(page.locator('.top-nav a[aria-current="page"]')).toHaveText('Designer');
  const cards = page.locator('a.demo-card[data-designer]');
  await expect(cards).toHaveCount(6);
  for (const image of await page.locator('.demo-thumb img').all()) {
    await image.scrollIntoViewIfNeeded();
    await expect.poll(() => image.evaluate((img) => (img as HTMLImageElement).naturalWidth)).toBe(600);
  }
  const hrefs = await cards.evaluateAll((as) => as.map((a) => (a as HTMLAnchorElement).getAttribute('href') as string));
  for (const href of hrefs) {
    await page.goto(SITE + href);
    await expect(page.locator('.fd-designer'), href).toBeVisible();
    await expect(page.locator('.fd-designer-bar [data-checks]'), href).toBeVisible();
    await expect(page.getByRole('link', { name: 'All starting points' }), href).toBeVisible();
  }
  await page.getByRole('link', { name: 'All starting points' }).click();
  await expect(page).toHaveURL(/\/designer\/$/);
  expect(problems).toEqual([]);
});

test('the Templates page: every template with its picture, and each tried, changed in its editor, and taken as JSON', async ({ page, request }) => {
  const problems = watch(page);
  const templates = DEMOS.filter((demo) => demo.category === 'templates');
  test.setTimeout(templates.length * 6000);
  await page.goto(SITE + '/templates/');
  await expect(page.locator('.top-nav a[aria-current="page"]')).toHaveText('Templates');
  const cards = page.locator('.template-card');
  await expect(cards).toHaveCount(templates.length);
  for (const image of await page.locator('.template-card .demo-thumb img').all()) {
    await image.scrollIntoViewIfNeeded();
    await expect.poll(() => image.evaluate((img) => (img as HTMLImageElement).naturalWidth)).toBe(600);
  }
  const links = await cards.evaluateAll((all) => all.map((card) => [...card.querySelectorAll<HTMLAnchorElement>('.template-uses a')].map((a) => a.getAttribute('href') as string)));
  for (const [tried, changed, json] of links) {
    const file = await request.get(SITE + json);
    expect(file.status(), json).toBe(200);
    expect((await file.json()).fieldia, json).toBe('0.6');
    await page.goto(SITE + tried);
    await expect(page.locator('.fd-form').first(), tried).toBeVisible();
    await page.goto(SITE + changed);
    // The template itself in the editor, not its usual starting page.
    await expect(page.locator('.fd-designer, .fd-survey-editor, [class*="fd-editor"]').first(), changed).toBeVisible();
    await expect(page.locator('input').first(), changed).toHaveValue((await file.json()).title);
  }
  expect(problems).toEqual([]);
});

// ---- light and dark ------------------------------------------------------------------

/** A colour as the browser computes it, `rgb(…)` or `rgba(…)`: red, green, blue, and how opaque. */
function channels(colour: string) {
  const [r, g, b, a = 1] = (colour.match(/[\d.]+/g) ?? []).map(Number);
  return { rgb: [r, g, b], alpha: a };
}
/** How bright a colour looks, as WCAG measures it: 0 for black, 1 for white. A ground must be opaque to be judged. */
function luminance(colour: string) {
  const { rgb, alpha } = channels(colour);
  expect(alpha, `${colour} is see-through`).toBe(1);
  const [r, g, b] = rgb.map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
/** How well words in one colour read on another: 1 to 21. */
function contrast(words: string, ground: string) {
  const [light, dark] = [luminance(words), luminance(ground)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}
/** A ground that reads as dark, and one that reads as light. */
const DARK = 0.05;
const LIGHT = 0.6;
const style = (page: Page, selector: string, property: string) =>
  page.locator(selector).first().evaluate((el, name) => getComputedStyle(el).getPropertyValue(name), property);
/** Each colour code takes (demos/highlight.mjs), as the stylesheet gives it to a word inside `selector`, and the ground under them. */
const TOKENS = ['tok-keyword', 'tok-string', 'tok-number', 'tok-literal', 'tok-key', 'tok-comment', 'tok-tag', 'tok-attr'];
function codeColours(page: Page, selector: string) {
  return page.locator(selector).first().evaluate((block, names) => {
    const inside = block.querySelector('code') ?? block;
    const colours: Record<string, string> = { text: getComputedStyle(block).color };
    for (const name of names) {
      const word = document.createElement('span');
      word.className = name;
      inside.append(word);
      colours[name] = getComputedStyle(word).color;
      word.remove();
    }
    return { ground: getComputedStyle(block).backgroundColor, colours };
  }, TOKENS);
}

test('a reader whose system is dark gets the site dark: its grounds, its bar, its cards, its words', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  // Each page with the ground its words are on, and words that must read there.
  const pages: [string, string, string[]][] = [
    ['/', '.story', ['.chapter-copy h2', '.chapter-copy > p', '.chapter-no', '.power-figure', '.figures b']],
    ['/maps/', 'body', ['.prose h1', '.prose p', '.side a[aria-current="page"]', '.prose a']],
    ['/data/', 'body', ['.prose p', 'th', 'td']],
    ['/features/maps/', '.story', ['.chapter-copy h2', '.chapter-copy > p', '.feature-links a:not(.btn)']],
    ['/demos/', 'body', ['.gallery-hero h1', '.gallery-section h2', '.demo-name', '.demo-blurb']],
  ];
  for (const [path, ground, words] of pages) {
    await page.goto(SITE + path);
    await expect(page.locator('h1').first()).toBeVisible();
    const under = await style(page, ground, 'background-color');
    expect(luminance(under), `${path}: the ground is dark`).toBeLessThan(DARK);
    expect(luminance(await style(page, '.top', 'background-color')), `${path}: the bar is dark`).toBeLessThan(DARK);
    expect(luminance(await style(page, '.foot', 'background-color')), `${path}: the footer is dark`).toBeLessThan(DARK);
    for (const selector of words) {
      // Each on its own card's ground where it has one, else the page's.
      const own = await page.locator(selector).first().evaluate((el) => {
        for (let at: Element | null = el; at; at = at.parentElement) {
          const colour = getComputedStyle(at).backgroundColor;
          if (!/rgba\(.*, 0\)$|transparent/.test(colour)) return colour;
        }
        return null;
      });
      expect(contrast(await style(page, selector, 'color'), own ?? under), `${path}: ${selector} reads`).toBeGreaterThanOrEqual(4.5);
    }
  }
  await page.goto(SITE + '/demos/');
  expect(luminance(await style(page, '.demo-card', 'background-color')), 'a demo’s card is dark').toBeLessThan(DARK);
});

for (const colorScheme of ['light', 'dark'] as const) {
  test(`the docs’ code reads at 4.5:1 or more in each of its colours · ${colorScheme}`, async ({ page }) => {
    await page.emulateMedia({ colorScheme });
    await page.goto(SITE + '/data/');
    const { ground, colours } = await codeColours(page, '.prose pre.code');
    // The code's ground follows the scheme.
    if (colorScheme === 'dark') expect(luminance(ground)).toBeLessThan(DARK);
    else expect(luminance(ground)).toBeGreaterThan(LIGHT);
    for (const [name, colour] of Object.entries(colours)) expect(contrast(colour, ground), `${name} ${colour} on ${ground}`).toBeGreaterThanOrEqual(4.5);
    // Code inline in a sentence, on its own ground.
    expect(contrast(await style(page, '.prose p code', 'color'), await style(page, '.prose p code', 'background-color'))).toBeGreaterThanOrEqual(4.5);
  });
}

test('the demos’ frame follows a dark system, the form inside it too, and a scheme in the address wins', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, 'webdriver', { get: () => false }));
  await page.setViewportSize({ width: 1440, height: 900 });
  const demo = SITE + '/demos/plain/?page=customers&skin=outlined';
  /** The frame's parts, open: the header, the menu, the how-to, the code drawer, and the page's own ground. */
  async function frame(address: string) {
    await page.goto(address);
    await expect(page.locator('.fd-form').first()).toBeVisible();
    await page.getByRole('button', { name: '‹/› Code' }).click();
    const grounds: Record<string, number> = {};
    for (const part of ['body', '#demo-head', '#demo-nav', '#demo-howto', '#demo-code', '#demo-code .dc-code']) grounds[part] = luminance(await style(page, part, 'background-color'));
    // A box's edge is seen on its ground, at 3:1 or more: the theme picker, the menu's filter.
    for (const box of ['#dh-theme', '#demo-nav .dn-filter']) {
      expect(contrast(await style(page, box, 'border-top-color'), await style(page, box, 'background-color')), `${address}: ${box}'s edge`).toBeGreaterThanOrEqual(3);
    }
    return grounds;
  }

  await page.emulateMedia({ colorScheme: 'dark' });
  for (const [part, light] of Object.entries(await frame(demo))) expect(light, `${part} is dark`).toBeLessThan(DARK);
  // The form follows the reader too, painting its own dark ground.
  await expect(page.locator('.fd-form').first()).toHaveAttribute('data-scheme', 'auto');
  expect(luminance(await style(page, '.fd-form', 'background-color'))).toBeLessThan(DARK);
  // The header's words, and the code's colours in the drawer, each read on their ground.
  for (const selector of ['.dh-title', '.dh-crumb', '.dh-links a', '.dh-theme']) {
    expect(contrast(await style(page, selector, 'color'), await style(page, '#demo-head', 'background-color')), selector).toBeGreaterThanOrEqual(4.5);
  }
  const drawer = await codeColours(page, '#demo-code .dc-code');
  for (const [name, colour] of Object.entries(drawer.colours)) expect(contrast(colour, drawer.ground), `drawer ${name}`).toBeGreaterThanOrEqual(4.5);
  await page.screenshot({ path: 'test-results/screens/site-demo-frame-dark.png', animations: 'disabled' });

  // `?scheme=light` wins over the dark system: frame and form light.
  for (const [part, light] of Object.entries(await frame(`${demo}&scheme=light`))) expect(light, `${part} is light`).toBeGreaterThan(LIGHT);
  await expect(page.locator('.fd-form').first()).toHaveAttribute('data-scheme', 'light');
  const lightDrawer = await codeColours(page, '#demo-code .dc-code');
  for (const [name, colour] of Object.entries(lightDrawer.colours)) expect(contrast(colour, lightDrawer.ground), `light drawer ${name}`).toBeGreaterThanOrEqual(4.5);

  // And `?scheme=dark` over a light one.
  await page.emulateMedia({ colorScheme: 'light' });
  for (const [part, light] of Object.entries(await frame(`${demo}&scheme=dark`))) expect(light, `${part} is dark`).toBeLessThan(DARK);
  await expect(page.locator('.fd-form').first()).toHaveAttribute('data-scheme', 'dark');
});
