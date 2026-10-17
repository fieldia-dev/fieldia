import { type Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { sitePages } from './site-pages';
import { AREAS, AREA_IDS, DEMOS, FEATURED, areaOf, demoHref } from '../demos/catalog.mjs';
import { expectNoSidewaysScroll, screen } from './support';
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

test('the front page opens with what a business gets, then its business areas, each to its demos', async ({ page }) => {
  for (const width of [390, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(SITE + '/');
    // The first words after the headline are a business owner's; the developers' come after the areas.
    const copy = page.locator('.opening-copy > p, .opening-copy > nav');
    await expect(copy.nth(1)).toHaveClass(/lede-business/);
    await expect(copy.nth(2)).toHaveClass(/uses/);
    await expect(copy.nth(3)).toHaveClass(/lede-dev/);
    const uses = page.getByRole('navigation', { name: 'See it at work' }).getByRole('link');
    await expect(uses).toHaveCount(AREAS.length - 1);
    await expect(uses.first()).toBeInViewport();
  }
  await page.getByRole('navigation', { name: 'See it at work' }).getByRole('link', { name: /^Clinic/ }).click();
  await expect(page).toHaveURL(/\/demos\/#clinic$/);
  await expect(page.locator('.gallery-section#clinic')).toBeInViewport();
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
    expect((await file.json()).fieldia, json).toBe('0.3');
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
