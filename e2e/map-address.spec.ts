import { type Locator, type Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { axeFindings } from './a11y-support';
import { tile, watch } from './designer-support';
import { mapOf, mapReady, stubMaps, valueOf, type PhotonPlace } from './map-support';
import { expectNoSidewaysScroll, node, open, screen } from './support';

/**
 * An address with suggestions (@fieldia/map's `address-search` on a char
 * field), in the customer's-address demo: typed as a person types, the
 * provider's suggestions in a list under it, picked by the keys, filling the
 * address's parts and its place on the map. In English and Arabic, light and
 * dark, on a desktop and a phone, on OpenStreetMap's search (Photon) and
 * Azure's. Every search is a stand-in (map-support.ts).
 */

const QUERY = 'page=map-address&skin=outlined';
const TAHRIR: PhotonPlace = { lat: 30.0487, lon: 31.2391, type: 'house', street: 'Tahrir Street', housenumber: '12', district: 'Downtown', city: 'Cairo', state: 'Cairo Governorate', postcode: '11511', country: 'Egypt', countrycode: 'EG' };
const JULY: PhotonPlace = { lat: 30.0626, lon: 31.2197, type: 'street', name: '26 July Street', district: 'Zamalek', city: 'Cairo', state: 'Cairo Governorate', country: 'Egypt', countrycode: 'EG' };
// Outside the countries the page names: never suggested.
const MECCA: PhotonPlace = { lat: 21.4225, lon: 39.8262, type: 'street', name: 'Tahrir Street', city: 'Mecca', state: 'Makkah Region', country: 'Saudi Arabia', countrycode: 'SA' };
const ARABIC: PhotonPlace[] = [
  { lat: 30.0487, lon: 31.2391, type: 'house', street: 'شارع التحرير', housenumber: '12', district: 'وسط البلد', city: 'القاهرة', state: 'محافظة القاهرة', country: 'مصر', countrycode: 'EG' },
  { lat: 30.0626, lon: 31.2197, type: 'street', name: 'شارع ٢٦ يوليو', district: 'الزمالك', city: 'القاهرة', state: 'محافظة القاهرة', country: 'مصر', countrycode: 'EG' },
];

async function openAddress(page: Page, query = QUERY, search: PhotonPlace[] = [TAHRIR, MECCA, JULY]) {
  const asked = await stubMaps(page, { search });
  const { problems } = await open(page, 'plain', query);
  const field = node(page, 'address');
  return { field, box: field.getByRole('combobox'), options: field.getByRole('option'), asked, problems };
}

/** Whether a person sees it: what is drawn at its middle is it, not a field or a map over it, and it is inside the window. */
async function seen(target: Locator) {
  const box = (await target.boundingBox())!;
  const size = target.page().viewportSize()!;
  const inside = box.x >= 0 && box.y >= 0 && box.x + box.width <= size.width && box.y + box.height <= size.height;
  const onTop = await target.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return !!hit && (hit === el || el.contains(hit));
  });
  return inside && onTop;
}

test('suggestions come as the typing pauses, near Cairo and in Egypt; the arrows and Enter pick one, and its parts and place fill in', async ({ page }) => {
  const { field, box, options, asked, problems } = await openAddress(page);
  await expect(box).toHaveAttribute('aria-expanded', 'false');
  await box.pressSequentially('tahr', { delay: 60 });
  // No Enter: the list comes as the typing pauses, without the place outside Egypt.
  await expect(options).toHaveCount(2);
  await expect(options.nth(0).locator('.fd-map-result-name')).toHaveText('Tahrir Street 12');
  await expect(options.nth(0).locator('.fd-map-result-detail')).toHaveText('Downtown, Cairo, Cairo Governorate, Egypt');
  await expect(options.nth(1).locator('.fd-map-result-name')).toHaveText('26 July Street');
  await expect(box).toHaveAttribute('aria-expanded', 'true');
  // What is typed is the answer until one is picked.
  expect(await valueOf(page, 'address')).toBe('tahr');
  // Near where the app's maps open, as a map's own search asks.
  const searched = asked.filter((url) => url.includes('photon.komoot.io/api')).at(-1)!;
  expect(searched).toContain('q=tahr');
  expect(searched).toMatch(/lat=30\.0444&lon=31\.2357&zoom=12/);
  // The list over the fields under it, every suggestion and the credit in sight.
  for (const option of await options.all()) expect(await seen(option)).toBe(true);
  const credit = field.locator('.fd-address-credit');
  await expect(credit).toHaveText('© OpenStreetMap contributors');
  expect(await seen(credit)).toBe(true);
  await screen(page, 'map-address-open', { viewport: true });

  await box.press('ArrowDown');
  await expect(options.nth(0)).toHaveAttribute('aria-selected', 'true');
  await expect(box).toHaveAttribute('aria-activedescendant', (await options.nth(0).getAttribute('id'))!);
  await box.press('Enter');
  await expect(field.getByRole('listbox')).toBeHidden();
  await expect(box).toHaveValue('Tahrir Street 12, Downtown, Cairo, Cairo Governorate, Egypt');
  await expect.poll(() => valueOf(page, 'parts')).toEqual({ street: 'Tahrir Street 12', city: 'Cairo', region: 'Cairo Governorate', postcode: '11511', country: 'EG' });
  expect(await valueOf(page, 'spot')).toEqual({ type: 'Point', coordinates: [31.2391, 30.0487] });
  // The address's parts in their boxes, the place on its map.
  const parts = node(page, 'parts');
  await expect(parts.locator('[data-part="street"]')).toHaveValue('Tahrir Street 12');
  await expect(parts.locator('[data-part="region"]')).toHaveValue('Cairo Governorate');
  await expect(parts.locator('[data-part="country"]')).toHaveValue('EG');
  const map = mapOf(page, 'spot');
  await mapReady(map);
  await expect(node(page, 'spot').locator('.fd-map-pin')).toBeVisible();
  // Enter picked: the form was not sent.
  await expect(page.locator('.fd-form')).toBeVisible();
  await screen(page, 'map-address-picked');

  // Another, by the arrows: the line under the street, typed by a person, stays.
  await parts.locator('[data-part="line2"]').fill('Flat 4');
  await box.fill('');
  await box.pressSequentially('26 jul', { delay: 60 });
  await expect(options).toHaveCount(2);
  await box.press('ArrowDown');
  await box.press('ArrowDown');
  await box.press('Enter');
  await expect.poll(() => valueOf(page, 'parts')).toEqual({ street: '26 July Street', city: 'Cairo', region: 'Cairo Governorate', country: 'EG', line2: 'Flat 4' });
  expect(await valueOf(page, 'spot')).toEqual({ type: 'Point', coordinates: [31.2197, 30.0626] });
  expect(await valueOf(page, 'address')).toBe('26 July Street, Zamalek, Cairo, Cairo Governorate, Egypt');
  expect(problems).toEqual([]);
});

test('what is typed stays when nothing is picked: Escape closes the list, the words and the empty place stay', async ({ page }) => {
  const { box, options, field } = await openAddress(page);
  await box.pressSequentially('7 Tahrir Street, flat 3', { delay: 30 });
  await expect(options).toHaveCount(2);
  await box.press('Escape');
  await expect(field.getByRole('listbox')).toBeHidden();
  await expect(box).toHaveAttribute('aria-expanded', 'false');
  await box.press('Escape');
  await expect(box).toHaveValue('7 Tahrir Street, flat 3');
  await box.press('Tab');
  expect(await valueOf(page, 'address')).toBe('7 Tahrir Street, flat 3');
  expect(await valueOf(page, 'spot')).toBeFalsy();
  expect(await valueOf(page, 'parts')).toBeFalsy();
});

test('in Arabic, right to left: the list under the box from its right edge, its words Arabic, said to screen readers in Arabic', async ({ page }) => {
  const { field, box, options } = await openAddress(page, `${QUERY}&locale=ar&dir=rtl`, ARABIC);
  await box.pressSequentially('التحر', { delay: 60 });
  await expect(options).toHaveCount(2);
  await expect(options.nth(0).locator('.fd-map-result-name')).toHaveText('شارع التحرير 12');
  await expect(field.locator('.fd-address-search > [role="status"]')).toHaveText('الاقتراحات: 2');
  const input = (await box.boundingBox())!;
  const list = (await field.locator('.fd-address-popup').boundingBox())!;
  expect(Math.abs(list.x + list.width - (input.x + input.width))).toBeLessThanOrEqual(1);
  expect(await options.nth(0).evaluate((el) => getComputedStyle(el).direction)).toBe('rtl');
  for (const option of await options.all()) expect(await seen(option)).toBe(true);
  await screen(page, 'map-address-arabic', { viewport: true });
  await box.press('Enter');
  await expect.poll(() => valueOf(page, 'parts')).toEqual({ street: 'شارع التحرير 12', city: 'القاهرة', region: 'محافظة القاهرة', country: 'EG' });
  await screen(page, 'map-address-arabic-picked');
});

for (const skin of ['outlined', 'underline']) {
  test(`in the ${skin} skin the box is drawn as the page's other text boxes are, the list under it`, async ({ page }) => {
    const { box, options } = await openAddress(page, `page=map-address&skin=${skin}`);
    const look = (target: Locator) => target.evaluate((el) => ['border-top', 'border-bottom', 'border-radius', 'background-color', 'height', 'font-size'].map((key) => getComputedStyle(el).getPropertyValue(key)).join(' · '));
    expect(await look(box)).toBe(await look(node(page, 'customer').locator('input')));
    await box.pressSequentially('tahr', { delay: 60 });
    await expect(options).toHaveCount(2);
    for (const option of await options.all()) expect(await seen(option)).toBe(true);
    await screen(page, `map-address-${skin}`, { viewport: true });
  });
}

test('in the dark scheme the list takes the dark colours, its words readable', async ({ page }) => {
  const { field, box, options } = await openAddress(page, `${QUERY}&scheme=dark`);
  await box.pressSequentially('tahr', { delay: 60 });
  await expect(options).toHaveCount(2);
  const popup = field.locator('.fd-address-popup');
  const [background, text] = await popup.evaluate((el) => [getComputedStyle(el).backgroundColor, getComputedStyle(el.querySelector('.fd-map-result-name')!).color]);
  expect(background).not.toBe('rgb(255, 255, 255)');
  // Light words on the dark list.
  const light = (colour: string) => colour.match(/\d+/g)!.slice(0, 3).map(Number).reduce((a, b) => a + b, 0) / 3;
  expect(light(text) - light(background)).toBeGreaterThan(120);
  await screen(page, 'map-address-dark', { viewport: true });
});

test('in Arabic and dark together, on a phone: the list fits the screen, nothing scrolls sideways', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const { box, options } = await openAddress(page, `${QUERY}&locale=ar&dir=rtl&scheme=dark`, ARABIC);
  await box.pressSequentially('التحر', { delay: 60 });
  await expect(options).toHaveCount(2);
  for (const option of await options.all()) expect(await seen(option)).toBe(true);
  await expectNoSidewaysScroll(page);
  await screen(page, 'map-address-phone-arabic-dark', { viewport: true });
});

test('on a phone in English, light: the list fits under the box, and a pick fills the parts', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const { field, box, options } = await openAddress(page);
  await box.scrollIntoViewIfNeeded();
  await box.pressSequentially('tahr', { delay: 60 });
  await expect(options).toHaveCount(2);
  // The page moves up as the list comes, if it must, so all of it is in sight: its credit too.
  for (const option of await options.all()) expect(await seen(option)).toBe(true);
  await expect.poll(() => seen(field.locator('.fd-address-credit'))).toBe(true);
  await expectNoSidewaysScroll(page);
  await screen(page, 'map-address-phone', { viewport: true });
  await box.press('Enter');
  await expect.poll(() => valueOf(page, 'parts')).toMatchObject({ street: 'Tahrir Street 12' });
  await screen(page, 'map-address-phone-picked');
});

test('on Azure Maps: its suggestions, the one picked located then, its parts from its answer', async ({ page }) => {
  const { field, box, options, problems } = await openAddress(page, `${QUERY}&maps=azure`);
  await box.pressSequentially('26 july', { delay: 60 });
  await expect(options).toHaveCount(3);
  await expect(options.nth(0).locator('.fd-map-result-name')).toHaveText('26 26 July Street');
  await expect(options.nth(0).locator('.fd-map-result-detail')).toHaveText('El Sheikh Ali, Cairo, Egypt');
  // Azure's terms ask for nothing under its suggestions.
  await expect(field.locator('.fd-address-credit')).toHaveCount(0);
  await box.press('Enter');
  await expect.poll(() => valueOf(page, 'spot')).toEqual({ type: 'Point', coordinates: [31.230021, 30.056579] });
  expect(await valueOf(page, 'parts')).toEqual({ street: '26 26 July Street', city: 'El Sheikh Ali', region: 'Cairo', country: 'EG' });
  expect(await valueOf(page, 'address')).toBe('26 26 July Street, El Sheikh Ali, Cairo, Egypt');
  expect(problems).toEqual([]);
});

test('read-only: the address is shown, and nothing is searched', async ({ page }) => {
  const { box, field, asked } = await openAddress(page, `${QUERY}&readonly=1`);
  await page.evaluate(() => (window as any).fieldiaDemo.handle.form.setValue('address', '12 Tahrir Street, Cairo'));
  await expect(box).toHaveValue('12 Tahrir Street, Cairo');
  await expect(box).not.toBeEditable();
  await box.focus();
  await page.keyboard.type('zam');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(400);
  await expect(field.getByRole('listbox')).toBeHidden();
  expect(asked.filter((url) => url.includes('photon.komoot.io/api'))).toEqual([]);
});

test('no accessibility findings: empty, with its suggestions open, and picked', async ({ page }) => {
  const { box, options } = await openAddress(page);
  expect(await axeFindings(page, 'address, empty')).toEqual([]);
  await box.pressSequentially('tahr', { delay: 60 });
  await expect(options).toHaveCount(2);
  await box.press('ArrowDown');
  expect(await axeFindings(page, 'address, suggestions open')).toEqual([]);
  await box.press('Enter');
  await expect.poll(() => valueOf(page, 'parts')).toBeTruthy();
  expect(await axeFindings(page, 'address, picked')).toEqual([]);
});

for (const variant of ['react', 'vue', 'angular']) {
  test(`${variant}: the address suggests, and a pick fills its parts`, async ({ page }) => {
    await stubMaps(page, { search: [TAHRIR] });
    const { problems } = await open(page, variant, QUERY);
    const box = node(page, 'address').getByRole('combobox');
    await box.pressSequentially('tahr', { delay: 60 });
    await expect(node(page, 'address').getByRole('option')).toHaveCount(1);
    await box.press('Enter');
    await expect.poll(() => valueOf(page, 'parts')).toMatchObject({ street: 'Tahrir Street 12', country: 'EG' });
    expect(problems).toEqual([]);
  });
}

test('in the designer: Address search from the toolbox makes a char field; its settings keep options on it, and Try it suggests', async ({ page }) => {
  const problems = watch(page);
  await stubMaps(page, { search: [TAHRIR] });
  await page.goto('/designer/');
  await expect(tile(page, 'kind:map-address')).toContainText('Address search');
  await tile(page, 'kind:map-address').click();
  await page.keyboard.type('Delivery address');
  const picked = page.locator('.fd-q-selected');
  await expect(picked.getByRole('button', { name: 'Kind of question: Address search' })).toBeVisible();
  const made = await page.evaluate(() => (window as any).fieldiaDesigner.designer.getPage());
  const field = made.layout.children[0].children[0];
  expect([field.widget, made.fields[field.field].type]).toEqual(['address-search', 'char']);
  await picked.getByLabel('Addresses in').selectOption({ label: 'Egypt' });
  await expect.poll(async () => (await page.evaluate(() => (window as any).fieldiaDesigner.designer.getPage())).layout.children[0].children[0].options).toEqual({ countries: 'EG' });
  // The page it makes checks clean.
  await expect(page.getByRole('button', { name: /^Checks/ })).toHaveText('Checks✓');
  await screen(page, 'map-address-designer', { viewport: true });

  await page.getByRole('button', { name: 'Try it' }).click();
  const tried = page.locator('.fd-try-frame').getByRole('combobox');
  await tried.pressSequentially('tahr', { delay: 60 });
  await expect(page.locator('.fd-try-frame').getByRole('option')).toHaveCount(1);
  expect(problems).toEqual([]);
});
