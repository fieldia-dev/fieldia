import { type Page } from '@playwright/test';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from './fixtures';

/**
 * The one-tag script checks each part before it is used (the audits' S-M8, R-H9): fieldia.js carries the hash of every
 * part it was built with, and the tag it adds for one carries it as `integrity` (with `crossorigin="anonymous"`), so
 * the browser runs a part only if it is the file released with that fieldia.js. A part changed after it was built —
 * on a CDN, in a cache, by anyone between — never runs: the browser refuses it, the page says in its own words that
 * it could not load what needed it (here a list: "Could not load the customers.", with Retry), and the real part,
 * once it can be had, is taken. Each engine enforces the hash its own way: the smoke set runs it in all three.
 */

const DEMO = join(__dirname, '..', 'dist', 'demos', 'script');
const CUSTOMERS = JSON.parse(readFileSync(join(__dirname, '..', 'examples', 'pages', 'customers.page.json'), 'utf8'));
const RECORDS = {
  partner: {
    1: { name: 'Nile Traders', email: 'sales@nile.example', state: 'active', credit_limit: 250000 },
    2: { name: 'Amira Clinics', email: 'hello@amira.example', state: 'draft', credit_limit: 50000 },
    3: { name: 'Petra Tours', email: 'desk@petra.example', state: 'active', credit_limit: 80000 },
  },
};

/** The script demo's page replaced by the customers list. */
const mountList = (page: Page) =>
  page.evaluate(
    ([shown, records]) => {
      const fieldia = (window as any).Fieldia;
      const demo = (window as any).fieldiaDemo;
      demo.handle.destroy();
      demo.handle = fieldia.mountViewer(document.getElementById('app'), { page: shown, dataSource: fieldia.createMemoryDataSource({ records }), skin: 'outlined' });
    },
    [CUSTOMERS, RECORDS] as const,
  );

const rows = (page: Page) => page.locator('#app .fd-list-table tbody tr.fd-list-row');

/** Each part's tag as fieldia.js added it: its address, integrity and crossorigin, read before the tag is taken away. */
async function watchTags(page: Page) {
  await page.addInitScript(() => {
    const seen: { src: string; integrity: string; crossOrigin: string | null }[] = [];
    (window as any).partTags = seen;
    new MutationObserver((changes) => {
      for (const change of changes) {
        for (const node of change.addedNodes) {
          if (node instanceof HTMLScriptElement && /\/fieldia\.\w+\.js$/.test(node.src)) seen.push({ src: new URL(node.src).pathname, integrity: node.integrity, crossOrigin: node.getAttribute('crossorigin') });
        }
      }
    }).observe(document, { childList: true, subtree: true });
  });
}

test.describe('fieldia.js checks each part it loads against the hash it was built with', () => {
  test('each part’s tag carries the hash of the file beside it, and asks for it without credentials', async ({ page }) => {
    await watchTags(page);
    await page.goto('/script/');
    await expect(page.locator('.fd-form')).toBeVisible();
    await mountList(page);
    await expect(rows(page)).toHaveCount(3);
    const tags: { src: string; integrity: string; crossOrigin: string | null }[] = await page.evaluate(() => (window as any).partTags);
    expect(tags.map((tag) => tag.src)).toEqual(expect.arrayContaining(['/script/fieldia.list.js', '/script/fieldia.phone.js']));
    for (const tag of tags) {
      const bytes = readFileSync(join(DEMO, tag.src.replace('/script/', '')));
      expect(tag.integrity, tag.src).toBe(`sha256-${createHash('sha256').update(bytes).digest('base64')}`);
      expect(tag.crossOrigin, tag.src).toBe('anonymous');
    }
  });

  test('a part changed after it was built never runs: the list could not load, said in its words, and Retry takes the real part', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    let changed = true;
    await page.route('**/fieldia.list.js', async (route) => {
      if (!changed) return route.continue();
      const real = await route.fetch();
      // The same part with one line more: what a tampered copy would run, given the chance.
      return route.fulfill({ response: real, body: `${await real.text()}\n;window.partTampered = true;\n` });
    });
    await page.goto('/script/');
    await expect(page.locator('.fd-form')).toBeVisible();
    await mountList(page);
    const holder = page.locator('#app .fd-list[data-node="customers-list"]');
    const failed = holder.locator('.fd-list-failed');
    await expect(failed).toBeVisible();
    await expect(failed).toContainText('Could not load the customers.');
    await expect(page.locator('#app .fd-list-table')).toHaveCount(0);
    // None of the changed file ran: not its own line, not the part it carries.
    expect(await page.evaluate(() => (window as any).partTampered)).toBeUndefined();
    expect(await page.evaluate(() => !!(window as any).Fieldia.listPart.loaded)).toBe(false);
    // The real part, once it can be had: Retry takes it, the list drawn whole.
    changed = false;
    await failed.getByRole('button', { name: 'Retry' }).click();
    await expect(rows(page)).toHaveCount(3);
    expect(await page.evaluate(() => (window as any).partTampered)).toBeUndefined();
    expect(errors).toEqual([]);
  });
});
