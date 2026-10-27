import type { Page } from '@playwright/test';
import { expect } from '../../fixtures';
import { FILES } from '../../files-support';
import { follow, closePanel, photosField } from './support-more';
import type { DemoReplay } from '../hand';

/** A photo set's tiles; one by its file (as it is kept, whatever its place), the words it says as it moves one. */
const tiles = (page: Page) => photosField(page).locator('.fd-photo');
const tileOf = (page: Page, file: string) => photosField(page).locator(`.fd-photo[data-key^="${file}"]`);
const announced = (page: Page) => photosField(page).locator('.fd-announce');
const cropper = (page: Page) => page.getByRole('dialog', { name: /^Crop and turn/ });

/** The listing-photo-set demo’s how-to steps, replayed by hand (e2e/how-to.spec.ts). */
export const replay: DemoReplay = {
  steps: [
    {
      says: 'Drag the kitchen’s photo before the living room’s: it is the cover now',
      async run({ page, press, drag, phone, see }) {
        const kitchen = tileOf(page, 'Kitchen.jpg');
        await see(tiles(page)).toHaveCount(5);
        await see(tiles(page).first().locator('.fd-photo-cover')).toHaveText('Cover');
        if (!phone) {
          // Carried by the mouse to the living room's left edge, the cover's place.
          const first = (await tiles(page).first().locator('.fd-photo-frame').boundingBox())!;
          await drag(kitchen.locator('.fd-photo-frame'), { x: first.x + 10, y: first.y + first.height / 2 });
          await see(announced(page)).toHaveText('Photo 2 of 5 moved to the cover');
          await see(tiles(page).first()).toHaveAttribute('data-key', /^Kitchen\.jpg/);
          await see(kitchen.locator('.fd-photo-cover')).toHaveText('Cover');
          await see(tileOf(page, 'Living room.jpg').locator('.fd-photo-cover')).toBeHidden();
          await see(page.getByRole('dialog')).toHaveCount(0);
        }
        // Make cover does the same: on the phone, for the kitchen (a finger cannot drag here); on a desktop, the bedroom.
        const next = phone ? kitchen : tileOf(page, 'Master bedroom.jpg');
        await press(next.getByRole('button', { name: /^Make .* the cover$/ }));
        await see(announced(page)).toHaveText(`Photo ${phone ? 2 : 3} of 5 moved to the cover`);
        await see(tiles(page).first()).toHaveAttribute('data-key', phone ? /^Kitchen\.jpg/ : /^Master bedroom\.jpg/);
        await see(tiles(page).first().locator('.fd-photo-cover')).toHaveText('Cover');
        await see(tiles(page).first().getByRole('button', { name: /^Make .* the cover$/ })).toHaveCount(0);
      },
    },
    {
      says: 'Press Alt and an arrow key on a photo to move it a place',
      notOnPhone: 'Alt and the arrow keys: a phone has no such keys',
      async run({ page, press, keys, see }) {
        // The bathroom's photo, last, reached from its caption's box by Shift+Tab.
        const bathroom = tileOf(page, 'Bathroom.jpg');
        await press(bathroom.getByRole('textbox', { name: /^Caption for photo/ }));
        for (let i = 0; i < 6 && !(await bathroom.locator('.fd-photo-open:focus').count()); i++) await keys('Shift+Tab');
        await see(bathroom.locator('.fd-photo-open')).toBeFocused();
        await keys('Alt+ArrowLeft');
        await see(announced(page)).toHaveText('Photo 5 of 5 moved to place 4 of 5');
        await see(tiles(page).nth(3)).toHaveAttribute('data-key', /^Bathroom\.jpg/);
        await see(bathroom.locator('.fd-photo-open')).toBeFocused();
        await keys('Alt+Home');
        await see(announced(page)).toHaveText('Photo 4 of 5 moved to the cover');
        await see(tiles(page).first()).toHaveAttribute('data-key', /^Bathroom\.jpg/);
        await see(bathroom.locator('.fd-photo-cover')).toHaveText('Cover');
      },
    },
    {
      says: 'Press Crop and turn on the balcony’s photo: drag the part kept',
      async run({ page, press, drag, phone, see }) {
        const balcony = tileOf(page, 'Balcony view.jpg');
        await press(balcony.getByRole('button', { name: 'Crop and turn The Nile from the balcony' }));
        const dialog = cropper(page);
        await see(dialog).toBeVisible();
        const crop = dialog.getByRole('group', { name: 'The part of the photo kept' });
        const picture = dialog.locator('.fd-photo-picture');
        await see(picture).toBeVisible();
        const whole = (await picture.boundingBox())!;
        if (!phone) {
          // Its lower right corner dragged in by a quarter: the part kept smaller, still the portal's 4:3.
          const corner = crop.locator('.fd-photo-handle[data-corner="se"]');
          const at = (await corner.boundingBox())!;
          await drag(corner, { x: at.x + at.width / 2 - whole.width / 4, y: at.y + at.height / 2 - whole.height / 4 });
          await expect.poll(async () => (await crop.boundingBox())!.width).toBeLessThan(whole.width * 0.8);
          const kept = (await crop.boundingBox())!;
          expect(kept.width / kept.height).toBeCloseTo(4 / 3, 1);
        }
        // Turned a quarter: the picture stands taller than wide.
        await press(dialog.getByRole('button', { name: 'Turn right' }));
        await expect.poll(async () => { const now = (await picture.boundingBox())!; return now.height > now.width; }).toBe(true);
        await press(dialog.getByRole('button', { name: 'Apply' }));
        await see(dialog).toBeHidden();
        await see(announced(page)).toHaveText('The Nile from the balcony changed: its original is kept');
        // Again: from the original, as it was cropped and turned.
        await press(balcony.getByRole('button', { name: 'Crop and turn The Nile from the balcony' }));
        await see(picture).toBeVisible();
        await expect.poll(async () => { const now = (await picture.boundingBox())!; return now.height > now.width; }).toBe(true);
        if (!phone) await expect.poll(async () => (await crop.boundingBox())!.height).toBeLessThan((await picture.boundingBox())!.height * 0.8);
        await press(dialog.getByRole('button', { name: 'Put back the original' }));
        await see(dialog).toBeHidden();
        await see(announced(page)).toHaveText('The original of The Nile from the balcony is back');
        // As it was taken: open again, it lies wider than tall, the whole of it kept.
        await press(balcony.getByRole('button', { name: 'Crop and turn The Nile from the balcony' }));
        await expect.poll(async () => { const now = (await picture.boundingBox())!; return now.width > now.height; }).toBe(true);
        await see(dialog.getByRole('button', { name: 'Put back the original' })).toBeHidden();
        await press(dialog.getByRole('button', { name: 'Cancel' }));
        await see(dialog).toBeHidden();
      },
    },
    {
      says: 'Type a caption under a photo, press Save, then open the agent’s listings',
      async run(hand) {
        const { page, press, type, see } = hand;
        const kitchen = tileOf(page, 'Kitchen.jpg');
        await type(kitchen.getByRole('textbox', { name: /^Caption for photo/ }), 'Newly fitted, with an island');
        await press(page.getByRole('button', { name: 'Save', exact: true }));
        await see(page.locator('.fd-status')).toHaveText('Saved');
        await see(kitchen.locator('.fd-photo-open')).toHaveAccessibleName(/^Newly fitted, with an island, (the cover, )?photo \d of 5$/);
        const cover = (await tiles(page).first().locator('img').first().getAttribute('src'))!;
        await follow(hand, 'open the agent’s listings');
        await see(page.getByRole('heading', { name: 'My listings', level: 1 })).toBeVisible();
        await press(page.getByRole('button', { name: 'Gallery', exact: true }));
        const card = page.locator('.fd-list-card').filter({ hasText: 'Garden flat with a view of the Nile' });
        await see(card.locator('img').first()).toHaveAttribute('src', cover);
        await see(card.locator('img').first()).toBeVisible();
      },
    },
    {
      says: 'Add photos of your own, up to 12, or take them',
      async run(hand) {
        const { page, pick, phone, see } = hand;
        // Back to the listing, as the browser's Back takes a person — on a phone, its panel as it was left: closed by its ×.
        await page.goBack();
        if (phone) await closePanel(hand);
        await see(tiles(page)).toHaveCount(5);
        await see(photosField(page).locator('.fd-photos-count')).toHaveText('5 of 12 photos');
        // A phone offers its camera for them.
        await see(photosField(page).locator('input[type=file]')).toHaveAttribute('capture', 'environment');
        const add = photosField(page).locator('.fd-photos-add label');
        await pick(add, Array.from({ length: 8 }, (_, i) => FILES.photo(`Room ${i + 1}.png`, i % 3)));
        await see(tiles(page)).toHaveCount(12);
        await see(photosField(page).locator('.fd-photos-count')).toHaveText('12 of 12 photos');
        await see(photosField(page).locator('.fd-file-note')).toHaveText('Up to 12 files: 1 not added');
        await see(add).toBeHidden();
      },
    },
  ],
};
