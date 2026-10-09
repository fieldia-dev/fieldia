import { expect, test, type Page } from '@playwright/test';
import { DEMOS, FEATURED } from '../demos/catalog.mjs';
import { expectNoSidewaysScroll } from './support';

/** fieldia.dev, as built into dist/site and served on its own port. */
/** `SITE_URL=https://fieldia.dev npx playwright test e2e/site.spec.ts` runs the same checks on the live site. */
const SITE = process.env['SITE_URL'] ?? `http://127.0.0.1:${process.env['FIELDIA_SITE_PORT'] ?? 4322}`;
const PAGES = ['/', '/start/', '/pages/', '/fields/', '/data/', '/behaviour/', '/actions/', '/record/', '/lists/', '/chatter/', '/look/', '/demos/', '/designer/', '/templates/', '/features/records/', '/accessibility/'];

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

test('a link to a heading shows the heading below the bar, not under it', async ({ page }) => {
  for (const anchor of ['/fields/#dialogs', '/fields/#grid', '/data/#requests']) {
    await page.goto(SITE + anchor);
    const bar = (await page.locator('.top').boundingBox())!;
    const heading = (await page.locator(anchor.slice(anchor.indexOf('#'))).boundingBox())!;
    expect(heading.y, `${anchor} is under the bar`).toBeGreaterThanOrEqual(bar.y + bar.height);
  }
});

test('the gallery shows every demo with its thumbnail, featured first, and each opens a working form', async ({ page }) => {
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
    await page.goto(SITE + href);
    await expect(page.locator('.fd-form').first(), href).toBeVisible();
    await expect(page.locator('.dh-title'), href).not.toBeEmpty();
  }
  expect(problems).toEqual([]);
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
    expect((await file.json()).fieldia, json).toBe('0.1');
    await page.goto(SITE + tried);
    await expect(page.locator('.fd-form').first(), tried).toBeVisible();
    await page.goto(SITE + changed);
    // The template itself in the editor, not its usual starting page.
    await expect(page.locator('.fd-designer, .fd-survey-editor, [class*="fd-editor"]').first(), changed).toBeVisible();
    await expect(page.locator('input').first(), changed).toHaveValue((await file.json()).title);
  }
  expect(problems).toEqual([]);
});
