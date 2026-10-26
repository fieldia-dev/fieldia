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

/**
 * A press "while a save is on its way" is made while the source's answer is held (hold-support.ts, race-support.ts),
 * never timed against the source's own delay by waiting for the form to say it is saving: a slow runner's first save
 * answers before the second press.
 */
test('no spec times a press by the form saying it is saving', () => {
  const timed = readdirSync(__dirname, { recursive: true })
    .map(String)
    .filter((file) => file.endsWith('.spec.ts'))
    .filter((file) => /(?<!\.not)\.toBe\(\s*'saving'\s*\)/.test(readFileSync(join(__dirname, file), 'utf8')));
  expect(timed).toEqual([]);
});

test('a demo’s map gets its images from the stand-in, never from the real server', async ({ page }) => {
  const { TILE } = await import('./map-support');
  const image = page.waitForResponse((response) => response.url().startsWith('https://tile.openstreetmap.org/'));
  await page.goto('/plain/?page=map-homes&skin=outlined');
  const answer = await image;
  expect((await answer.body()).equals(TILE)).toBe(true);
});
