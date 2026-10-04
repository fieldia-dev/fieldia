import { expect, test, type Page } from '@playwright/test';
import { DEMOS, FRAMEWORKS, demoHref } from '../demos/catalog.mjs';
import { readFileSync } from 'node:fs';
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
  const unnamed = Object.keys(pages).filter((name) => !shown.has(name));
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
    await code.getByRole('tab', { name: 'React' }).click();
    await expect(code.locator('code')).toContainText('<FieldiaForm page={page} dataSource={dataSource} skin="underline" />');
    await code.getByRole('button', { name: 'Copy' }).click();
    await expect(code.getByRole('button', { name: 'Copied' })).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toContain('@fieldia/react');
    await screen(page, 'demo-frame-code', { viewport: true });
    expect(problems).toEqual([]);
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

for (const framework of FRAMEWORKS) {
  test(`${framework.id} · every demo of the gallery opens, with its name and no error`, async ({ page }) => {
    const problems = watch(page);
    for (const demo of DEMOS.filter((d) => !d.app)) {
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
