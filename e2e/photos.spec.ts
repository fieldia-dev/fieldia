import type { Browser, CDPSession, Locator, Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { axeFindings } from './a11y-support';
import { expectNoSidewaysScroll, node, open, screen } from './support';

/**
 * Photo sets (`"widget": "photos"`), as an agent and a clinic use them: a listing's photos put in the order a buyer
 * sees them — dragged with the mouse, a finger resting on one on a phone, moved by keys, Make cover — the first marked
 * the cover, which the agent's gallery card and map pin show once saved; a caption typed under a photo; a photo cropped
 * to the page's shape and turned in its dialog, the result stored through the data source's upload with the original
 * kept beside it, cropped again from that original, then put back; and a clinic's photo taken sideways turned upright.
 */

type Photo = { name: string; url?: string; data?: string; fileId?: number; caption?: string; original?: Photo; edit?: { turn: number; crop: { x: number; y: number; width: number; height: number } } };
const photos = (page: Page, field = 'photos') => page.evaluate((name) => ((window as any).fieldiaDemo.handle.form.getState().values[name] ?? []) as Photo[], field);
const tiles = (page: Page, id = 'f-photos') => node(page, id).locator('.fd-photo');
const tile = (page: Page, name: string, id = 'f-photos') => tiles(page, id).filter({ has: page.locator(`.fd-photo-open[aria-label^="${name},"]`) });
const said = (page: Page, id = 'f-photos') => node(page, id).locator('.fd-announce');
const ORDER = ['Living room.jpg', 'Kitchen.jpg', 'Master bedroom.jpg', 'Balcony view.jpg', 'Bathroom.jpg'];
const names = async (page: Page, field = 'photos') => (await photos(page, field)).map((photo) => photo.name);
const middle = async (locator: Locator) => {
  const box = (await locator.boundingBox())!;
  return { x: box.x + box.width / 2, y: box.y + box.height / 2, box };
};
const editor = (page: Page) => page.getByRole('dialog', { name: /^Crop and turn/ });

/** The mouse carried from one place to another in steps, as a hand moves it. */
async function drag(page: Page, from: { x: number; y: number }, to: { x: number; y: number }, steps = 12) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  for (let step = 1; step <= steps; step++) await page.mouse.move(from.x + ((to.x - from.x) * step) / steps, from.y + ((to.y - from.y) * step) / steps);
  await page.mouse.up();
}

function finger(cdp: CDPSession) {
  const at = (x: number, y: number) => [{ x: Math.round(x), y: Math.round(y) }];
  return {
    down: (x: number, y: number) => cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: at(x, y) }),
    move: (x: number, y: number) => cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: at(x, y) }),
    up: () => cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }),
  };
}
async function phone(browser: Browser, query: string) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  const opened = await open(page, 'plain', query);
  return { page, ...opened, hand: finger(await context.newCDPSession(page)), close: () => context.close() };
}

test.describe('a listing’s photo set', () => {
  test('a photo dragged first is the cover, said so; saved, the agent’s gallery card and map pin show it', async ({ page }) => {
    const { problems } = await open(page, 'plain', 'page=listing-photo-set&skin=outlined');
    await expect(tiles(page)).toHaveCount(5);
    await expect(node(page, 'f-photos').locator('.fd-photos-count')).toHaveText('5 of 12 photos');
    await expect(tiles(page).first().locator('.fd-photo-cover')).toHaveText('Cover');
    await expect(tiles(page).first().locator('.fd-photo-open')).toHaveAttribute('aria-label', 'Light all day from the river side, the cover, photo 1 of 5');
    await expect(node(page, 'f-photos').locator('.fd-photos-how-keys')).toHaveText('Drag a photo to move it, or press Alt and an arrow key. The first is the cover.');
    await expect(node(page, 'f-photos').locator('.fd-photos-how-touch')).toBeHidden();
    await screen(page, 'photos-listing');

    // The kitchen's photo carried before the living room's: the others make room as it passes, then it is the cover.
    await tiles(page).first().scrollIntoViewIfNeeded();
    const kitchen = await middle(tile(page, 'Kitchen.jpg').locator('.fd-photo-frame'));
    const living = await middle(tiles(page).first().locator('.fd-photo-frame'));
    await page.mouse.move(kitchen.x, kitchen.y);
    await page.mouse.down();
    for (let step = 1; step <= 12; step++) await page.mouse.move(kitchen.x + (living.box.x + 10 - kitchen.x) * (step / 12), kitchen.y);
    await expect(tile(page, 'Kitchen.jpg')).toHaveAttribute('data-lifted', '');
    await screen(page, 'photos-listing-lifted', { viewport: true });
    await page.mouse.up();
    await expect(said(page)).toHaveText('Kitchen.jpg is the cover now');
    expect(await names(page)).toEqual(['Kitchen.jpg', 'Living room.jpg', 'Master bedroom.jpg', 'Balcony view.jpg', 'Bathroom.jpg']);
    await expect(tiles(page).first().locator('.fd-photo-cover')).toBeVisible();
    await expect(tiles(page).nth(1).locator('.fd-photo-cover')).toBeHidden();
    // The press that ended the drag opened nothing.
    await expect(page.getByRole('dialog')).toHaveCount(0);

    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.locator('.fd-status')).toHaveText(/Saved/);
    const cover = (await photos(page))[0].url;

    // The agent's listings: the card of this listing, and its pin on the map, show the kitchen.
    await page.goto('/plain/?page=agent-listings&skin=outlined');
    await page.getByRole('button', { name: 'Gallery' }).click();
    const card = page.locator('.fd-list-card').filter({ hasText: 'Garden flat with a view of the Nile' });
    await expect(card.locator('img').first()).toHaveAttribute('src', cover!);
    await screen(page, 'photos-agent-gallery');
    await page.getByRole('button', { name: 'Map', exact: true }).click();
    await expect(page.locator('.fd-map-face-photo').first()).toBeVisible();
    const pins = await page.locator('.fd-map-face-photo').evaluateAll((images) => images.map((image) => (image as HTMLImageElement).src));
    expect(pins).toContain(cover);
    await screen(page, 'photos-agent-map', { viewport: true });
    expect(problems).toEqual([]);
  });

  test('moved by keys and by Make cover, each said; a caption typed is kept; right to left, the arrows mirrored', async ({ page }) => {
    const { problems } = await open(page, 'plain', 'page=listing-photo-set&skin=outlined');
    const bedroom = tile(page, 'Master bedroom.jpg').locator('.fd-photo-open');
    await bedroom.focus();
    await page.keyboard.press('Alt+ArrowLeft');
    await expect(said(page)).toHaveText('Master bedroom.jpg moved to place 2 of 5');
    await expect(bedroom).toBeFocused();
    await page.keyboard.press('Alt+End');
    await expect(said(page)).toHaveText('Master bedroom.jpg moved to place 5 of 5');
    expect(await names(page)).toEqual(['Living room.jpg', 'Kitchen.jpg', 'Balcony view.jpg', 'Bathroom.jpg', 'Master bedroom.jpg']);
    // Make cover, its tools shown as the pointer rests on the photo.
    await tile(page, 'Bathroom.jpg').hover();
    await tile(page, 'Bathroom.jpg').getByRole('button', { name: 'Make Bathroom.jpg the cover' }).click();
    await expect(said(page)).toHaveText('Bathroom.jpg is the cover now');
    expect((await names(page))[0]).toBe('Bathroom.jpg');
    await expect(tiles(page).first().getByRole('button', { name: /Make .* the cover/ })).toBeHidden();
    // A caption typed under a photo, read as the box is left.
    const caption = tile(page, 'Kitchen.jpg').getByRole('textbox', { name: 'Caption for Kitchen.jpg' });
    await caption.fill('Newly fitted, with an island');
    await page.keyboard.press('Tab');
    expect((await photos(page)).find((photo) => photo.name === 'Kitchen.jpg')?.caption).toBe('Newly fitted, with an island');
    await expect(tile(page, 'Newly fitted, with an island').locator('.fd-photo-open')).toHaveAttribute('aria-label', /^Newly fitted, with an island, photo \d of 5$/);
    // Opened, the photo shows its caption as its title.
    await tile(page, 'Newly fitted, with an island').locator('.fd-photo-open').click();
    const viewer = page.getByRole('dialog', { name: 'Newly fitted, with an island' });
    await expect(viewer).toBeVisible();
    await expect(viewer.locator('img')).toBeVisible();
    await page.keyboard.press('Escape');
    expect(problems).toEqual([]);

    // Right to left: Alt and the left arrow move a photo on, as the photos run.
    const rtl = await open(page, 'plain', 'page=listing-photo-set&skin=outlined&dir=rtl&locale=ar');
    const first = tiles(page).first().locator('.fd-photo-open');
    await first.focus();
    await page.keyboard.press('Alt+ArrowLeft');
    await expect(said(page)).toHaveText(/في المرتبة 2 من 5$/);
    expect((await names(page))[1]).toBe('Living room.jpg');
    await expect(tiles(page).first().locator('.fd-photo-cover')).toHaveText('الغلاف');
    await screen(page, 'photos-listing-arabic');
    expect(rtl.problems).toEqual([]);
  });

  test('cropped to the page’s shape and turned: stored through the upload, the original kept; cropped again from it; put back', async ({ page }) => {
    const { problems } = await open(page, 'plain', 'page=listing-photo-set&skin=outlined');
    const balcony = tile(page, 'The Nile from the balcony');
    await balcony.hover();
    await balcony.getByRole('button', { name: 'Crop and turn The Nile from the balcony' }).click();
    const dialog = editor(page);
    await expect(dialog).toBeVisible();
    const crop = dialog.getByRole('group', { name: 'The part of the photo kept' });
    await expect(crop).toBeFocused();
    // The page's 4:3: no shapes to pick, the whole of the 4:3 photo kept at first.
    await expect(dialog.getByRole('group', { name: 'Shape' })).toBeHidden();
    const picture = await middle(dialog.locator('.fd-photo-picture'));
    let box = await middle(crop);
    expect(Math.round(box.box.width)).toBe(Math.round(picture.box.width));
    // Its bottom right corner dragged in by a quarter: the part kept stays 4:3.
    const corner = await middle(crop.locator('.fd-photo-handle[data-corner="se"]'));
    await drag(page, corner, { x: corner.x - picture.box.width / 4, y: corner.y - picture.box.height / 4 });
    box = await middle(crop);
    expect(box.box.width / box.box.height).toBeCloseTo(4 / 3, 1);
    expect(box.box.width).toBeLessThan(picture.box.width * 0.8);
    // The part kept dragged to the right edge, then nudged with the keys.
    await drag(page, box, { x: box.x + picture.box.width, y: box.y });
    await page.keyboard.press('ArrowLeft');
    await screen(page, 'photos-crop', { viewport: true });
    await dialog.getByRole('button', { name: 'Apply' }).click();
    await expect(dialog).toBeHidden();
    await expect(said(page)).toHaveText('The Nile from the balcony changed: its original is kept');
    // Stored through the source's upload: a link of the store's, the photo as it was beside it, what was done.
    await expect.poll(async () => (await photos(page))[3].fileId).toBeGreaterThan(0);
    const cropped = (await photos(page))[3];
    expect(cropped).toMatchObject({ name: 'Balcony view.jpg', caption: 'The Nile from the balcony', original: { name: 'Balcony view.jpg', url: expect.stringMatching(/^data:image\/jpeg;base64,/) }, edit: { turn: 0 } });
    expect(cropped.data).toBeUndefined();
    expect(cropped.original?.caption).toBeUndefined();
    expect(cropped.edit!.crop.x + cropped.edit!.crop.width).toBeCloseTo(0.99, 2);
    const size = await page.evaluate(async (src) => {
      const image = new Image();
      image.src = src;
      await image.decode();
      return [image.naturalWidth, image.naturalHeight];
    }, cropped.url!);
    expect(size[0] / size[1]).toBeCloseTo(4 / 3, 1);
    expect(size[0]).toBeLessThan(960 * 0.8);
    await screen(page, 'photos-listing-cropped');

    // Cropped again: it starts from the original, the part kept where it was left, and turns.
    await balcony.hover();
    await balcony.getByRole('button', { name: 'Crop and turn The Nile from the balcony' }).click();
    await expect(dialog.locator('.fd-photo-picture')).toBeVisible();
    const again = await middle(crop);
    const frame = await middle(dialog.locator('.fd-photo-picture'));
    expect(again.box.x + again.box.width).toBeCloseTo(frame.box.x + frame.box.width * 0.99, -1);
    await dialog.getByRole('button', { name: 'Turn right' }).click();
    await expect.poll(async () => { const now = (await dialog.locator('.fd-photo-picture').boundingBox())!; return now.height > now.width; }).toBe(true);
    await dialog.getByRole('button', { name: 'Apply' }).click();
    await expect.poll(async () => (await photos(page))[3].edit?.turn).toBe(90);
    expect((await photos(page))[3].original).toEqual(cropped.original);
    // Put back: the photo as it was taken, its caption kept.
    await balcony.hover();
    await balcony.getByRole('button', { name: 'Crop and turn The Nile from the balcony' }).click();
    await dialog.getByRole('button', { name: 'Put back the original' }).click();
    await expect(said(page)).toHaveText('The original of The Nile from the balcony is back');
    expect((await photos(page))[3]).toEqual({ ...cropped.original, caption: 'The Nile from the balcony' });
    expect(problems).toEqual([]);
  });

  test('added up to the most, refused past it with why; Escape closes the dialog and keeps the photo as it was', async ({ page }) => {
    const { problems } = await open(page, 'plain', 'page=listing-photo-set&skin=outlined');
    // A tiny PNG, eight times.
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
    const files = Array.from({ length: 8 }, (_, i) => ({ name: `Room ${i + 1}.png`, mimeType: 'image/png', buffer: png }));
    await node(page, 'f-photos').locator('input[type=file]').setInputFiles(files);
    await expect.poll(() => names(page)).toHaveLength(12);
    await expect(node(page, 'f-photos').locator('.fd-file-note')).toHaveText('Up to 12 files: 1 not added');
    await expect(node(page, 'f-photos').locator('.fd-photos-add')).toBeHidden();
    await expect(node(page, 'f-photos').locator('.fd-photos-count')).toHaveText('12 of 12 photos');
    await expect(tiles(page)).toHaveCount(12);
    const before = await photos(page);
    await tiles(page).nth(5).hover();
    await tiles(page).nth(5).getByRole('button', { name: 'Crop and turn Room 1.png' }).click();
    await expect(editor(page).locator('.fd-photo-picture')).toBeVisible();
    await editor(page).getByRole('button', { name: 'Turn left' }).click();
    await page.keyboard.press('Escape');
    await expect(editor(page)).toBeHidden();
    expect(await photos(page)).toEqual(before);
    await expect(tiles(page).nth(5).getByRole('button', { name: 'Crop and turn Room 1.png' })).toBeFocused();
    expect(problems).toEqual([]);
  });

  test('has no accessibility findings, its tiles, its tools and its crop dialog', async ({ page }) => {
    await open(page, 'plain', 'page=listing-photo-set&skin=outlined');
    expect(await axeFindings(page, 'a listing’s photos', '[data-node="f-photos"]')).toEqual([]);
    await tiles(page).nth(1).hover();
    await tiles(page).nth(1).getByRole('button', { name: /^Crop and turn/ }).click();
    await expect(editor(page).locator('.fd-photo-picture')).toBeVisible();
    expect(await axeFindings(page, 'a photo’s crop and turn', '.fd-photo-editor')).toEqual([]);
  });
});

test.describe('a photo set on a phone', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'a finger’s touches are sent through Chromium’s own protocol');

  test('two photos to a row, each tool in sight; a finger resting on a photo lifts it and it follows; a swipe scrolls', async ({ browser }) => {
    const { page, problems, hand, close } = await phone(browser, 'page=listing-photo-set&skin=outlined');
    await tiles(page).first().scrollIntoViewIfNeeded();
    const [a, b] = [await middle(tiles(page).first()), await middle(tiles(page).nth(1))];
    expect(Math.round(a.box.y)).toBe(Math.round(b.box.y));
    expect(b.box.x).toBeGreaterThan(a.box.x + a.box.width / 2);
    // Each photo's tools in sight with no pointer to rest on it, and a finger's way of moving one said.
    await expect(tiles(page).nth(1).locator('.fd-photo-tools')).toHaveCSS('opacity', '1');
    await expect(node(page, 'f-photos').locator('.fd-photos-how-touch')).toHaveText('Hold a photo a moment, then drag it to move it. The first is the cover.');
    await expect(node(page, 'f-photos').locator('.fd-photos-how-keys')).toBeHidden();
    await expectNoSidewaysScroll(page);
    // In view: a whole page's shot lays the page out again with no touch screen, its tools hidden for a mouse.
    await node(page, 'f-photos').scrollIntoViewIfNeeded();
    await screen(page, 'photos-listing-phone', { viewport: true });
    // A swipe over the photos scrolls the page and moves nothing.
    const third = await middle(tiles(page).nth(2).locator('.fd-photo-frame'));
    const scrolled = await page.evaluate(() => scrollY);
    await hand.down(third.x, third.y);
    for (let step = 1; step <= 10; step++) await hand.move(third.x, third.y - step * 15);
    await hand.up();
    await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(scrolled + 40);
    expect(await names(page)).toEqual(ORDER);
    // Resting on the bedroom's photo lifts it; carried to the first, it is the cover.
    await tiles(page).first().scrollIntoViewIfNeeded();
    const bedroom = await middle(tile(page, 'Master bedroom.jpg').locator('.fd-photo-frame'));
    const first = await middle(tiles(page).first().locator('.fd-photo-frame'));
    await hand.down(bedroom.x, bedroom.y);
    await expect(tile(page, 'Master bedroom.jpg')).toHaveAttribute('data-lifted', '');
    for (let step = 1; step <= 12; step++) await hand.move(bedroom.x + (first.box.x + 8 - bedroom.x) * (step / 12), bedroom.y + (first.y - bedroom.y) * (step / 12));
    await screen(page, 'photos-listing-phone-lifted', { viewport: true });
    await hand.up();
    await expect(said(page)).toHaveText('Master bedroom.jpg is the cover now');
    expect((await names(page))[0]).toBe('Master bedroom.jpg');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect(problems).toEqual([]);
    await close();
  });
});

test.describe('a clinic’s before and after', () => {
  test('square sets with no cover; a photo taken sideways turned upright and cropped to the face, its original kept', async ({ page }) => {
    const { problems } = await open(page, 'plain', 'page=clinic-before-after&skin=outlined');
    await expect(tiles(page, 'f-before')).toHaveCount(3);
    await expect(node(page, 'f-before').locator('.fd-photo-cover:visible')).toHaveCount(0);
    await expect(node(page, 'f-before').locator('.fd-photos-how-keys')).toHaveText('Drag a photo to move it, or press Alt and an arrow key.');
    const frame = await middle(tiles(page, 'f-before').first().locator('.fd-photo-frame'));
    expect(frame.box.width).toBeCloseTo(frame.box.height, 0);
    await screen(page, 'photos-clinic');
    const side = tile(page, 'Right side', 'f-before');
    await side.hover();
    await side.getByRole('button', { name: 'Crop and turn Right side' }).click();
    const dialog = editor(page);
    await expect(dialog.locator('.fd-photo-picture')).toBeVisible();
    // Taken sideways: wider than tall, until it is turned upright.
    const lying = (await dialog.locator('.fd-photo-picture').boundingBox())!;
    expect(lying.width).toBeGreaterThan(lying.height);
    await dialog.getByRole('button', { name: 'Turn right' }).click();
    await expect.poll(async () => { const now = (await dialog.locator('.fd-photo-picture').boundingBox())!; return now.height > now.width; }).toBe(true);
    await screen(page, 'photos-clinic-turned', { viewport: true });
    await dialog.getByRole('button', { name: 'Apply' }).click();
    await expect.poll(async () => (await photos(page, 'before'))[2].edit?.turn).toBe(90);
    const turned = (await photos(page, 'before'))[2];
    expect(turned).toMatchObject({ caption: 'Right side', original: { name: 'Right side.jpg' } });
    const size = await page.evaluate(async (src) => {
      const image = new Image();
      image.src = src;
      await image.decode();
      return [image.naturalWidth, image.naturalHeight];
    }, turned.url!);
    // A square of the upright photo: 900 × 900.
    expect(size).toEqual([900, 900]);
    await screen(page, 'photos-clinic-after-turn');
    expect(problems).toEqual([]);
  });
});
