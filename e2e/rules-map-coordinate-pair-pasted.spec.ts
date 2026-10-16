import { expect, test } from './fixtures';
import { mapOf, mapReady, stubMaps } from './map-support';
import { open } from './support';

/**
 * Found by the 0.23 input-rules check (a place's coordinates), MINOR. A place is most often copied as its pair —
 * "30.0444, 31.2357", as a map's "copy coordinates", a phone's share or a spreadsheet writes it. Pasted into the
 * latitude's box it is refused whole ("“30.0444, 31.2357” is not a number, so it was not pasted"): a right way to write
 * the place is not taken. It could fill both boxes (or say to paste each into its own).
 */

test('a latitude and longitude pasted together into the latitude box set the place', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await stubMaps(page);
  const { problems } = await open(page, 'plain', 'page=map-delivery&skin=outlined');
  await mapReady(mapOf(page, 'deliver_to'));
  const latitude = page.locator('[data-node="deliver_to"] .fd-map-coords input').first();
  await page.evaluate(() => navigator.clipboard.writeText('30.0444, 31.2357'));
  await latitude.click();
  await latitude.press('Control+V');
  await latitude.press('Enter');
  const value = await page.evaluate(() => (window as any).fieldiaDemo.handle.form.getState().values['deliver_to']);
  const said = await page.locator('[data-node="deliver_to"] .fd-refusal-hint:not([hidden])').allInnerTexts();
  expect({ value, said }).toEqual({ value: { type: 'Point', coordinates: [31.2357, 30.0444] }, said: [] });
  expect(problems).toEqual([]);
});
