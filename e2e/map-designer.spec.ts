import { expect, test, type Page } from '@playwright/test';
import { tile, watch } from './designer-support';
import { stubMaps } from './map-support';
import { screen } from './support';

/**
 * The maps in the designer, as an app gives them (`mapKinds` as kinds, the
 * map widgets as widgets): Place and Area in the toolbox under Maps, each
 * with its settings, in the designer's language. Map images are a stand-in.
 */

const page_ = (page: Page) => page.evaluate(() => (window as any).fieldiaDesigner.designer.getPage());

test('in the survey: Place from the toolbox makes a json field drawn by the map; its settings keep options on it', async ({ page }) => {
  const problems = watch(page);
  await stubMaps(page);
  await page.goto('/designer/');
  await expect(page.locator('.fd-tool-group[data-group="Maps"] .fd-tool-heading-name')).toHaveText('Maps');
  await tile(page, 'kind:map-place').click();
  await page.keyboard.type('Delivery to');
  const picked = page.locator('.fd-q-selected');
  await expect(picked.getByRole('button', { name: 'Kind of question: Place' })).toBeVisible();
  const made = await page_(page);
  const node = made.layout.children[0].children[0];
  expect(node.widget).toBe('place');
  expect(made.fields[node.field].type).toBe('json');
  // The card shows what it is, not a live map: the map itself is in Try it.
  await expect(picked.locator('.fd-map-preview')).toContainText('Place');

  // Each change redraws the card: the setting is found again each time.
  await picked.getByLabel('Address search').click();
  await expect(picked.getByLabel('Address search')).not.toBeChecked();
  await picked.getByLabel('Map height').selectOption({ label: 'Large' });
  expect((await page_(page)).layout.children[0].children[0].options).toEqual({ search: false, height: 400 });
  await screen(page, 'map-designer-place');

  await page.getByRole('button', { name: 'Try it' }).click();
  const tried = page.locator('.fd-try-frame .fd-place');
  await expect(tried.locator('.fd-map-box')).toBeVisible();
  await expect(tried.locator('.fd-map-search')).toHaveCount(0);
  expect(await tried.locator('.fd-map-box').evaluate((el) => Math.round(el.getBoundingClientRect().height))).toBe(400);
  expect(problems).toEqual([]);
});

test('on a screen: Area from the toolbox, its shapes chosen on the panel, the canvas showing only those tools', async ({ page }) => {
  const problems = watch(page);
  await stubMaps(page);
  await page.goto('/screen/?start=blank');
  await tile(page, 'kind:map-area').click();
  await page.keyboard.type('Service area');
  const panel = page.locator('.fd-properties');
  const settings = panel.locator('[data-setting="Area settings"]');
  await expect(settings).toBeVisible();
  await settings.getByLabel('Circle').click();
  await expect(settings.getByLabel('Circle')).not.toBeChecked();
  const card = page.locator('.fd-canvas-field.fd-editing');
  await expect(card.getByRole('button', { name: 'Circle' })).toHaveCount(0);
  await expect(card.getByRole('button', { name: 'Polygon' })).toBeVisible();
  await expect(card.getByRole('button', { name: 'Box' })).toBeVisible();
  // The last shape left cannot be taken away.
  await settings.getByLabel('Box').click();
  await expect(settings.getByLabel('Box')).not.toBeChecked();
  await settings.getByLabel('Polygon').click();
  await expect(settings.getByLabel('Polygon')).toBeChecked();
  await screen(page, 'map-designer-area');
  expect(problems).toEqual([]);
});

test('in Arabic: the Maps group and its kinds have Arabic names', async ({ page }) => {
  await stubMaps(page);
  await page.goto('/designer/?locale=ar');
  await expect(page.locator('.fd-tool-group[data-group="الخرائط"] .fd-tool-heading-name')).toHaveText('الخرائط');
  await expect(tile(page, 'kind:map-place')).toContainText('مكان');
  await expect(tile(page, 'kind:map-area')).toContainText('منطقة');
});

test('a list on a map, in the screen designer: its Map in the list’s panel, and Try it shows the records on the map', async ({ page }) => {
  const problems = watch(page);
  await stubMaps(page);
  await page.goto('/screen/?start=homes');
  const map = page.locator('[data-part="map"]');
  await expect(map.getByLabel('Show the records on a map too')).toBeChecked();
  await expect(map.getByLabel('Where each record is')).toHaveValue('latlng');
  await expect(map.getByLabel('Each pin shows')).toHaveValue('price');
  await expect(map.locator('.fd-chip')).toHaveText(['Price×', 'Bedrooms×', 'Area, m²×', 'District×']);
  await map.getByLabel('Opens as').selectOption({ label: 'The map' });
  expect((await page_(page)).layout.map.view).toBe('map');
  await map.scrollIntoViewIfNeeded();
  await screen(page, 'map-designer-list', { viewport: true });

  await page.getByRole('button', { name: 'Try it' }).click();
  const tried = page.locator('.fd-try-frame');
  await expect(tried.locator('.fd-list-views').getByRole('button', { name: 'Map', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(tried.locator('.fd-map-list .leaflet-tile-loaded').first()).toBeVisible();
  // Thirty-six made-up homes, all placed around the middle the app gave.
  await expect
    .poll(() => tried.locator('.fd-map-list .fd-map-mark').evaluateAll((marks) => marks.reduce((n, m) => n + (Number(m.querySelector('.fd-map-bubble')?.textContent) || 1), 0)))
    .toBe(36);
  await expect(tried.locator('.fd-map-list-note')).toBeHidden();
  expect(problems).toEqual([]);
});
