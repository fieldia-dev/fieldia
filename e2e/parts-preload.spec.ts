import type { Page, Request } from '@playwright/test';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from './fixtures';

/**
 * A page's parts written into it before fieldia.js (`partFiles`, the performance audit's M2: a list usable 16–27%
 * sooner on a phone): each fetched once. A part's `<script async>` tag still on its way as the page mounts is waited
 * for, never asked for a second time; a `<link rel="preload" as="script">` written with what the main script's own tag
 * carries (`Fieldia.partTags(page)`: its address, and the attributes the browser matches a preload by) is used as it
 * is. The parts are held back here, so the page mounts while they are still coming.
 */

const CUSTOMERS = {
  fieldia: '0.13',
  id: 'customers',
  title: 'Customers',
  data: { kind: 'record', model: 'partner' },
  fields: { name: { type: 'char', label: 'Name' }, email: { type: 'char', label: 'Email' } },
  layout: { type: 'list', id: 'people', columns: ['name', 'email'], card: {} },
};
const RECORDS = { partner: { 1: { name: 'Nile Traders', email: 'a@nile.example' }, 2: { name: 'Delta Foods', email: 'b@delta.example' } } };

/** The tags of the page's parts, as the one-tag script itself would ask for them. */
async function partTags(page: Page): Promise<Record<string, string>[]> {
  await page.goto('/script/');
  await page.waitForFunction(() => (window as unknown as { Fieldia?: unknown }).Fieldia);
  return page.evaluate((customers) => (window as unknown as { Fieldia: { partTags(p: unknown): Record<string, string>[] } }).Fieldia.partTags(customers), CUSTOMERS);
}

/** A page served from the script demo's folder: `head` before fieldia.js, then the list mounted. */
async function served(page: Page, head: string) {
  const body = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Customers</title>${head}<script src="fieldia.js"></script></head><body><main id="app"></main><script>
    Fieldia.mountViewer(document.getElementById('app'), { page: ${JSON.stringify(CUSTOMERS)}, dataSource: Fieldia.createMemoryDataSource({ records: ${JSON.stringify(RECORDS)} }) });
  </script></body></html>`;
  await page.route('**/script/preloaded.html', (route) => route.fulfill({ contentType: 'text/html; charset=utf-8', body }));
  // The parts held back: the page mounts, and asks for them, while they are still on their way.
  await page.route(/\/script\/fieldia\.(list|cards|loading|memory)\.js$/, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 700));
    await route.continue();
  });
  const asked: string[] = [];
  page.on('request', (request: Request) => {
    const file = /\/(fieldia\.[a-z]+\.js)$/.exec(request.url())?.[1];
    // The whole check aside: fieldia.js asks for it once nothing is waited for (page-check.spec), none writes its tag.
    if (file && file !== 'fieldia.check.js') asked.push(file);
  });
  await page.goto('/script/preloaded.html');
  await expect(page.locator('#app .fd-list-row')).toHaveCount(2);
  return asked;
}

const count = (asked: string[]) => asked.reduce<Record<string, number>>((by, file) => ((by[file] = (by[file] ?? 0) + 1), by), {});

/** The sha256 of a part's file as the build wrote it: the one value its tag, the docs' tags and fieldia.js carry. */
const DEMO = join(__dirname, '..', 'dist', 'demos', 'script');
const sha256 = (file: string) => `sha256-${createHash('sha256').update(readFileSync(join(DEMO, file))).digest('base64')}`;

test('each tag partTags gives carries its file’s hash, asked for without credentials', async ({ page }) => {
  for (const tag of await partTags(page)) {
    const file = tag['src'].replace(/^.*\//, '');
    expect(tag['integrity'], file).toBe(sha256(file));
    expect(tag['crossOrigin'], file).toBe('anonymous');
  }
});

test('a part’s script tag written before fieldia.js, as partTags gives it, is fetched once, still on its way as the page mounts', async ({ page }) => {
  const tags = await partTags(page);
  const files = tags.map((tag) => tag['src'].replace(/^.*\//, ''));
  // The loading part too: the list's first wait, a skeleton of its rows, is drawn from it.
  expect(files).toEqual(['fieldia.list.js', 'fieldia.cards.js', 'fieldia.loading.js']);
  const written = (file: string) => `<script async src="${file}" integrity="${sha256(file)}" crossorigin="anonymous"></script>`;
  const head = [...files, 'fieldia.memory.js'].map(written).join('');
  const asked = await served(page, head);
  expect(count(asked)).toEqual({ 'fieldia.list.js': 1, 'fieldia.cards.js': 1, 'fieldia.loading.js': 1, 'fieldia.memory.js': 1 });
});

test('a preload link written as partTags gives it is used by the part’s own tag: fetched once', async ({ page }) => {
  const tags = await partTags(page);
  // Each attribute the main script's tag carries, the link carries too: its address, how it is asked for and its hash.
  expect(tags.every((tag) => tag['integrity']?.startsWith('sha256-') && tag['crossOrigin'] === 'anonymous')).toBe(true);
  const attribute = (name: string, value: string) => ` ${name === 'crossOrigin' ? 'crossorigin' : name}="${value}"`;
  const head = tags.map((tag) => `<link rel="preload" as="script" href="${tag['src']}"${Object.entries(tag).filter(([name]) => name !== 'src' && name !== 'nonce').map(([name, value]) => attribute(name, value)).join('')}>`).join('');
  const asked = await served(page, head);
  expect(count(asked)).toEqual({ 'fieldia.list.js': 1, 'fieldia.cards.js': 1, 'fieldia.loading.js': 1, 'fieldia.memory.js': 1 });
});
