import { expect, test, type Page } from '@playwright/test';
import { expectNoSidewaysScroll } from './support';

/** fieldia.dev, as built into dist/site and served on its own port. */
/** `SITE_URL=https://fieldia.dev npx playwright test e2e/site.spec.ts` runs the same checks on the live site. */
const SITE = process.env['SITE_URL'] ?? 'http://127.0.0.1:4322';
const PAGES = ['/', '/start/', '/pages/', '/fields/', '/data/', '/look/', '/demos/'];

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
  await page.locator('#live-locale').selectOption('ar');
  await expect(live.locator('.fd-form')).toHaveAttribute('dir', 'rtl');
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

test('every demo the site links to opens a working form', async ({ page }) => {
  const problems = watch(page);
  await page.goto(SITE + '/demos/');
  const demos = await page.locator('.demo-card a').evaluateAll((as) => as.map((a) => (a as HTMLAnchorElement).getAttribute('href') as string));
  expect(demos.length).toBe(21);
  for (const href of demos) {
    await page.goto(SITE + href);
    await expect(page.locator('.fd-form').first(), href).toBeVisible();
  }
  expect(problems).toEqual([]);
});
