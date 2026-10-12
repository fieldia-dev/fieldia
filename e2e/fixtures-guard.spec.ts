import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from './fixtures';

/**
 * Every spec takes `test` from e2e/fixtures.ts, never from Playwright
 * itself: there, each test's browser has stand-ins for every map server, so
 * no test reaches a real provider.
 */
test('every spec takes its test from the fixtures, with the map servers stood in', () => {
  const direct = readdirSync(__dirname, { recursive: true })
    .map(String)
    .filter((file) => file.endsWith('.ts') && file !== 'fixtures.ts')
    .filter((file) => /import \{[^}]*\btest\b[^}]*\} from '@playwright\/test'/.test(readFileSync(join(__dirname, file), 'utf8')));
  expect(direct).toEqual([]);
});

test('a demo’s map gets its images from the stand-in, never from the real server', async ({ page }) => {
  const { TILE } = await import('./map-support');
  const image = page.waitForResponse((response) => response.url().startsWith('https://tile.openstreetmap.org/'));
  await page.goto('/plain/?page=map-homes&skin=outlined');
  const answer = await image;
  expect((await answer.body()).equals(TILE)).toBe(true);
});
