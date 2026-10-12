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

/** Every map on a page, wherever it sits. */
const mapsOn = (layout: unknown): { id: string; label?: string; layers: { id: string; pin?: { look?: string } }[] }[] => {
  const found: ReturnType<typeof mapsOn> = [];
  const walk = (node: unknown) => {
    if (!node || typeof node !== 'object') return;
    const part = node as { type?: string; children?: unknown[] };
    if (part.type === 'map') found.push(part as never);
    part.children?.forEach(walk);
  };
  walk(layout);
  return found;
};

test('a map on a page, in the screen designer: its layers in its panel, a new one from the toolbox, and Try it draws the places', async ({ page }) => {
  const problems = watch(page);
  await stubMaps(page);
  await page.goto('/screen/?start=order&ride=off');
  // On the canvas, its name and its layers: the map itself is drawn in Try it.
  const block = page.locator('.fd-map-preview.fd-canvas-block');
  await expect(block).toContainText('Where your order is');
  await expect(block).toContainText('Layers: kitchen, door, courier, way, me.');
  await block.click();
  const layers = page.locator('.fd-map-layer');
  await expect(layers).toHaveCount(5);
  await expect(layers.first().getByLabel('Words')).toHaveValue('Kitchen');
  await layers.first().getByLabel('Its pin looks like').selectOption({ label: 'A dot' });
  expect(mapsOn((await page_(page)).layout)[0].layers[0].pin?.look).toBe('dot');
  await screen(page, 'map-designer-form-map', { viewport: true });

  // A new map, among the blocks of Advanced: it starts with the reader's own place.
  await page.getByRole('button', { name: 'Advanced', exact: true }).click();
  await tile(page, 'block:map').click();
  const maps = mapsOn((await page_(page)).layout);
  expect(maps).toHaveLength(2);
  expect(maps[1].layers).toEqual([{ id: 'me', label: 'You', myLocation: true }]);

  // Try it: the order's places, made up around the middle of the app's maps.
  await page.getByRole('button', { name: 'Try it' }).click();
  const tried = page.locator('.fd-try-frame .fd-map-form').first();
  await expect(tried.locator('.leaflet-tile-loaded').first()).toBeVisible();
  await expect(tried.locator('.fd-map-mark')).toHaveCount(3);
  expect(problems).toEqual([]);
});

test('a kitchen’s map in the screen designer: its areas from the app’s borders, its tools, a reachable area, and a fence with its steps', async ({ page }) => {
  const problems = watch(page);
  await stubMaps(page);
  await page.goto('/screen/?start=kitchen&ride=off');
  await page.locator('.fd-map-preview.fd-canvas-block').click();
  const layers = page.locator('.fd-map-layer:not(.fd-map-fence)');
  await expect(layers).toHaveCount(4);
  // The districts: the app's borders, shaded by their fee, a press choosing into the offer's field.
  const areas = layers.first();
  await expect(areas.getByLabel('Areas', { exact: true })).toHaveValue('cairo-districts');
  await expect(areas.getByLabel('Shaded by')).toHaveValue('fee');
  await expect(areas.getByLabel('A press chooses it into')).toHaveValue('offer_district');
  // The area within fifteen minutes, made ten by typing.
  const near = layers.nth(1);
  await near.getByRole('spinbutton', { name: 'Minutes' }).fill('10');
  await expect.poll(async () => mapsOn((await page_(page)).layout)[0].layers[1]).toMatchObject({ reachable: { from: 'kitchen', minutes: 10 } });
  // Its tools, ticked as the page has them.
  const tools = page.getByRole('group', { name: 'Tools' });
  await expect(tools.getByLabel('Full screen')).toBeChecked();
  await expect(tools.getByLabel('Traffic')).toBeChecked();
  await expect(tools.getByLabel('Satellite')).not.toBeChecked();
  await tools.getByLabel('Satellite').check();
  await expect.poll(async () => (mapsOn((await page_(page)).layout)[0] as { tools?: string[] }).tools).toEqual(['satellite', 'traffic', 'fullscreen', 'measure']);
  // Its fences, named in words, each with its steps as a button's are set.
  const fences = page.locator('.fd-map-fence');
  await expect(fences).toHaveCount(2);
  await expect(fences.first().locator('.fd-map-layer-head strong')).toHaveText('When Courier goes into Drop-off zone');
  await expect(fences.first().locator('.fd-do-say')).toHaveText(['Set In the drop-off zone to Yes', 'Say as good news: The courier is in the drop-off zone: tell the customer they are almost there.']);
  await fences.nth(1).getByLabel('When it').selectOption({ label: 'Goes into' });
  await expect(fences.nth(1).locator('.fd-map-layer-head strong')).toHaveText('When Courier goes into Drop-off zone');
  await screen(page, 'map-designer-kitchen', { viewport: true });
  expect(problems).toEqual([]);
});

