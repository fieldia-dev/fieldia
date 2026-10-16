import { type Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { mapOf, mapReady, stubMaps } from './map-support';
import { open } from './support';

/**
 * Found by the 0.23 input-rules check (a place's coordinates). A coordinate typed or pasted with more than six decimal
 * places — as a phone's GPS, a survey or Google Maps' "copy coordinates" give them (30.0444196) — is taken and rounded
 * to six (geo.ts round6, "about 11 cm"): the field keeps 30.044457 for "30.0444567" and the box shows it once left, and
 * nothing says so. 0.21's rule for every typed number: places past what a box keeps are refused with why, never rounded
 * in silence ("12.555 in a column of two places is not pasted, never shown as 12.56"); the rules table says a place's
 * coordinates are guarded "as every number box is".
 */

const valueOf = (page: Page) => page.evaluate(() => (window as any).fieldiaDemo.handle.form.getState().values['deliver_to'] as { coordinates: [number, number] } | null);

test('a latitude and longitude typed with seven places are kept as typed, or refused with why — never rounded in silence', async ({ page }) => {
  await stubMaps(page);
  const { problems } = await open(page, 'plain', 'page=map-delivery&skin=outlined');
  await mapReady(mapOf(page, 'deliver_to'));
  const [latitude, longitude] = [page.locator('[data-node="deliver_to"] .fd-map-coords input').first(), page.locator('[data-node="deliver_to"] .fd-map-coords input').nth(1)];
  await latitude.click();
  await latitude.pressSequentially('30.0444567');
  await longitude.click();
  await longitude.pressSequentially('31.2357891');
  await longitude.press('Enter');
  await page.locator('h1, .fd-form').first().click({ position: { x: 2, y: 2 } });
  const value = await valueOf(page);
  const said = await page.locator('[data-node="deliver_to"] .fd-refusal-hint:not([hidden]), [data-node="deliver_to"] .fd-map-note').allInnerTexts();
  const refused = said.some((words) => /place|decimal|digits/i.test(words));
  const shown = [await latitude.inputValue(), await longitude.inputValue()].join(', ');
  expect(refused ? 'refused with why' : `saved ${JSON.stringify(value?.coordinates)}, shown ${shown}`).toMatch(/refused with why|saved \[31\.2357891,30\.0444567\], shown 30\.0444567, 31\.2357891/);
  expect(problems).toEqual([]);
});
