import { type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from './fixtures';

/**
 * The list screen — its table, search bar, pager and switcher, and its
 * stylesheet — comes in the list part, loaded the first time a page draws a
 * list (parts.ts in @fieldia/widgets).
 *
 * From one <script> tag: a page with no list asks for no file but fieldia.js;
 * a list asks for fieldia.list.js beside it (and the customers', whose phones it
 * writes as people read them, fieldia.phone.js), and is drawn whole once it came —
 * nothing of it before — searched at once. Where the part cannot come (offline),
 * "Loading…" stands in the list's place, then the records could not be loaded,
 * with Retry, which brings the list into that place. As an app's bundler builds
 * it (the plain demo, each part a chunk): a page with no list asks for no list
 * chunk; a list asks for it once.
 */

const CUSTOMERS = JSON.parse(readFileSync(join(__dirname, '..', 'examples', 'pages', 'customers.page.json'), 'utf8'));
const RECORDS = {
  partner: {
    1: { name: 'Nile Traders', email: 'sales@nile.example', state: 'active', credit_limit: 250000 },
    2: { name: 'Amira Clinics', email: 'hello@amira.example', state: 'draft', credit_limit: 50000 },
    3: { name: 'Petra Tours', email: 'desk@petra.example', state: 'active', credit_limit: 80000 },
  },
};

function watch(page: Page) {
  const problems: string[] = [];
  page.on('console', (message) => message.type() === 'error' && problems.push(`console: ${message.text()}`));
  page.on('pageerror', (error) => problems.push(`page error: ${error.message}`));
  return problems;
}

/** The script demo's page replaced by the customers list; whether anything of it was drawn at once. */
const mountList = (page: Page) =>
  page.evaluate(
    ([shown, records]) => {
      const fieldia = (window as any).Fieldia;
      const demo = (window as any).fieldiaDemo;
      demo.handle.destroy();
      demo.handle = fieldia.mountViewer(document.getElementById('app'), { page: shown, dataSource: fieldia.createMemoryDataSource({ records }), skin: 'outlined' });
      return !!document.querySelector('#app [data-node]');
    },
    [CUSTOMERS, RECORDS] as const,
  );

const rows = (page: Page) => page.locator('#app .fd-list-table tbody tr.fd-list-row');

test.describe('the list screen in a part of its own', () => {
  test('fieldia.list.js asked for the first time a page draws a list, the list drawn whole once it came, searched at once', async ({ page }) => {
    const problems = watch(page);
    const requested: string[] = [];
    page.on('request', (request) => requested.push(new URL(request.url()).pathname));
    // The demo's memory source's members come in a part of their own as it is first asked, and Ctrl+Z's as a form is
  // first entered (script.spec): the source's and every form's, not the page's.
    const scripts = () => requested.filter((path) => /\/fieldia(\.\w+)?\.js$/.test(path) && !/\/fieldia\.(memory|undo)\.js$/.test(path)).sort();
    await page.goto('/script/');
    await expect(page.locator('.fd-form')).toBeVisible();
    await page.waitForLoadState('networkidle');
    // A page with no list asked for no list part.
    expect(scripts()).toEqual(['/script/fieldia.js']);
    // Nothing of it before its part came: no half list to move.
    expect(await mountList(page)).toBe(false);
    await expect(rows(page)).toHaveCount(3);
    // The customers' list writes its phone column as people read them: the phone part beside it; and as it asks for
    // cards on a phone, the cards part.
    expect(scripts()).toEqual(['/script/fieldia.cards.js', '/script/fieldia.js', '/script/fieldia.list.js', '/script/fieldia.phone.js']);
    expect(await page.evaluate(() => !!document.getElementById('fd-list-styles'))).toBe(true);
    await expect(page.locator('#app .fd-pager-text')).toHaveText('1–3 of 3 customers');

    // Searched at once: a name typed, its suggestion taken, a chip, the records it names.
    const search = page.locator('#app .fd-search-input');
    await search.click();
    await page.keyboard.type('Petra');
    await expect(page.locator('#app .fd-search-suggestions [role="option"]').first()).toBeVisible();
    await page.keyboard.press('Enter');
    await expect(page.locator('#app .fd-facet')).toHaveCount(1);
    await expect(rows(page)).toHaveCount(1);
    await expect(rows(page).first()).toContainText('Petra Tours');
    // Its menu: a filter of the list's own.
    await page.locator('#app .fd-search-toggle').click();
    await expect(page.locator('#app .fd-search-panel')).toBeVisible();
    // Asked for once.
    expect(scripts()).toEqual(['/script/fieldia.cards.js', '/script/fieldia.js', '/script/fieldia.list.js', '/script/fieldia.phone.js']);
    expect(problems).toEqual([]);
  });

  test('where the part cannot come, “Loading…” in the list’s place, then the records could not be loaded; Retry brings the list in place', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    let offline = true;
    await page.route('**/fieldia.list.js', (route) => (offline ? route.abort('internetdisconnected') : route.continue()));
    await page.goto('/script/');
    await expect(page.locator('.fd-form')).toBeVisible();
    await mountList(page);
    // The page round it is drawn; the list's own words where it could not come, and Retry.
    const holder = page.locator('#app .fd-list[data-node="customers-list"]');
    const failed = holder.locator('.fd-list-failed');
    await expect(failed).toBeVisible();
    await expect(failed).toContainText('Could not load the customers.');
    await expect(holder.locator('.fd-list-waiting')).toBeHidden();
    await expect(holder).not.toHaveAttribute('aria-busy');
    await expect(page.locator('#app .fd-list-table')).toHaveCount(0);
    // Back online: Retry brings the list into its place, its records in, once.
    offline = false;
    await failed.getByRole('button', { name: 'Retry' }).click();
    await expect(rows(page)).toHaveCount(3);
    await expect(page.locator('#app .fd-list')).toHaveCount(1);
    await expect(page.locator('#app .fd-list-waiting')).toHaveCount(0);
    await expect(page.locator('#app .fd-search-input')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('as an app’s bundler builds it: a page with no list asks for no list chunk; a list asks for it once', async ({ page }) => {
    const problems = watch(page);
    const listed: string[] = [];
    // The list part's chunk, named by its module (list-part.ts) as the bundler names a chunk loaded on demand.
    page.on('request', (request) => {
      const url = new URL(request.url()).pathname;
      if (/\/chunks\/list-part-[^/]+\.js$/.test(url)) listed.push(url);
    });
    await page.goto('/plain/?page=customer&skin=outlined');
    await expect(page.locator('.fd-form [data-node]').first()).toBeVisible();
    await page.waitForLoadState('networkidle');
    expect(listed).toEqual([]);
    await page.goto('/plain/?page=customers&skin=outlined');
    await expect(page.locator('.fd-list-table tbody tr.fd-list-row').first()).toBeVisible();
    await page.waitForLoadState('networkidle');
    expect(listed).toHaveLength(1);
    expect(problems).toEqual([]);
  });
});
