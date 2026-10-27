import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Page } from '@playwright/test';
import { expect } from '../../fixtures';
import type { DemoReplay } from '../hand';

/** A photo set's tile, by its caption, as its buttons name it. */
const photoTile = (page: Page, set: 'f-before' | 'f-after', caption: string) => page.locator(`[data-node="${set}"] .fd-photo`).filter({ has: page.locator(`.fd-photo-open[aria-label^="${caption},"]`) });
/** Photos as a phone's camera roll keeps them: three pictures from the review. */
const REVIEW = ['IMG_2041.jpg', 'IMG_2042.jpg', 'IMG_2043.jpg'].map((name) => ({ name, mimeType: 'image/jpeg', buffer: readFileSync(join(__dirname, '..', '..', '..', 'demos', 'samples', 'tour-poster.jpg')) }));

/** The clinic-before-after demo’s how-to steps, replayed by hand (e2e/how-to.spec.ts). */
export const replay: DemoReplay = {
  steps: [
    {
      says: 'Press Crop and turn on Right side',
      async run({ page, press, see }) {
        const side = photoTile(page, 'f-before', 'Right side');
        await press(side.getByRole('button', { name: 'Crop and turn Right side' }));
        const dialog = page.getByRole('dialog', { name: 'Crop and turn Right side' });
        const picture = dialog.locator('.fd-photo-picture');
        await see(picture).toBeVisible();
        // Taken with the phone on its side: wider than tall, until it is turned.
        const lying = (await picture.boundingBox())!;
        expect(lying.width).toBeGreaterThan(lying.height);
        await press(dialog.getByRole('button', { name: 'Turn right' }));
        await expect.poll(async () => { const now = (await picture.boundingBox())!; return now.height > now.width; }).toBe(true);
        await press(dialog.getByRole('button', { name: 'Apply' }));
        await see(dialog).toBeHidden();
        await expect.poll(async () => (await page.evaluate(() => (window as any).fieldiaDemo.handle.form.getState().values.before[2].edit?.turn))).toBe(90);
        // Upright in its square: the set's tile drawn from the turned picture.
        await see(side.locator('img')).toBeVisible();
      },
    },
    {
      says: 'Crop Right side again: it starts from the original',
      async run({ page, press, see }) {
        const side = photoTile(page, 'f-before', 'Right side');
        await press(side.getByRole('button', { name: 'Crop and turn Right side' }));
        const dialog = page.getByRole('dialog', { name: 'Crop and turn Right side' });
        const picture = dialog.locator('.fd-photo-picture');
        await see(picture).toBeVisible();
        // The original, as it was cropped and turned: upright.
        await expect.poll(async () => { const now = (await picture.boundingBox())!; return now.height > now.width; }).toBe(true);
        await press(dialog.getByRole('button', { name: 'Put back the original' }));
        await see(dialog).toBeHidden();
        await see(page.locator('[data-node="f-before"] .fd-announce')).toHaveText('The original of Right side is back');
        await expect.poll(async () => (await page.evaluate(() => (window as any).fieldiaDemo.handle.form.getState().values.before[2].edit))).toBeUndefined();
        // Opened again: lying on its side, as it was taken.
        await press(side.getByRole('button', { name: 'Crop and turn Right side' }));
        await see(picture).toBeVisible();
        const lying = (await picture.boundingBox())!;
        expect(lying.width).toBeGreaterThan(lying.height);
        await press(dialog.getByRole('button', { name: 'Cancel' }));
        await see(dialog).toBeHidden();
      },
    },
    {
      says: 'Add the after photos, up to six, and name each',
      async run({ page, press, pick, type, see }) {
        const after = page.locator('[data-node="f-after"]');
        await pick(after.locator('.fd-photos-add'), REVIEW);
        await see(after.locator('.fd-photo')).toHaveCount(3);
        await see(after.locator('.fd-photos-count')).toHaveText('3 of 6 photos');
        // Named as they were taken, not yet in the order of the ones before.
        for (const [i, angle] of ['Right side', 'Front', 'Left side'].entries()) {
          await type(after.getByRole('textbox', { name: `Caption for photo ${i + 1} of 3` }), angle);
        }
        await press(page.getByRole('textbox', { name: 'Patient', exact: true }));
        for (const [i, angle] of ['Right side', 'Front', 'Left side'].entries()) {
          await see(after.getByRole('button', { name: `${angle}, photo ${i + 1} of 3` })).toBeVisible();
        }
      },
    },
    {
      says: 'Drag a photo to put the angles in the order',
      notOnPhone: 'a photo is carried by a finger resting on it and dragged (no touch drag in Playwright’s WebKit), or moved by Alt and an arrow key, which a phone has none of',
      async run({ page, press, keys, see }) {
        const after = page.locator('[data-node="f-after"]');
        // Front carried before Right side with the mouse.
        const front = photoTile(page, 'f-after', 'Front').locator('.fd-photo-frame');
        const first = after.locator('.fd-photo').first().locator('.fd-photo-frame');
        await front.scrollIntoViewIfNeeded();
        const from = (await front.boundingBox())!;
        const to = (await first.boundingBox())!;
        await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
        await page.mouse.down();
        for (let step = 1; step <= 12; step++) await page.mouse.move(from.x + from.width / 2 + (to.x + 10 - from.x - from.width / 2) * (step / 12), from.y + from.height / 2);
        await page.mouse.up();
        await see(after.getByRole('button', { name: 'Front, photo 1 of 3' })).toBeVisible();
        await see(page.getByRole('dialog')).toHaveCount(0);
        // Left side moved a place back with Alt and an arrow key: reached from its caption's box by Shift+Tab.
        await press(after.getByRole('textbox', { name: 'Caption for photo 3 of 3' }));
        const left = after.getByRole('button', { name: 'Left side, photo 3 of 3' });
        for (let i = 0; i < 4 && !(await left.evaluate((button) => button === document.activeElement)); i++) await keys('Shift+Tab');
        await see(left).toBeFocused();
        await keys('Alt+ArrowLeft');
        for (const [i, angle] of ['Front', 'Left side', 'Right side'].entries()) {
          await see(after.getByRole('button', { name: `${angle}, photo ${i + 1} of 3` })).toBeVisible();
        }
        await see(page.locator('[data-node="f-after"] .fd-announce')).toContainText('Left side');
      },
    },
    {
      says: 'Open a photo: it is shown whole, its caption its title',
      async run({ page, phone, press, see }) {
        const after = page.locator('[data-node="f-after"]');
        // The first after photo: Front, put first by the step before (on the phone, not replayed there, Right side).
        const caption = phone ? 'Right side' : 'Front';
        await press(after.getByRole('button', { name: `${caption}, photo 1 of 3` }));
        const shown = page.getByRole('dialog');
        await see(shown.getByRole('heading')).toHaveText(caption);
        // Whole: the picture in sight from edge to edge, none of it cut.
        await see(shown.locator('img')).toBeInViewport({ ratio: 1 });
      },
    },
  ],
};
