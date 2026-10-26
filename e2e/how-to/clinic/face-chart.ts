import type { Locator } from '@playwright/test';
import { expect } from '../../fixtures';
import type { DemoReplay } from '../hand';

/** The face-chart demo’s how-to steps, replayed by hand (e2e/how-to.spec.ts). */
export const replay: DemoReplay = {
  steps: [
    {
      says: 'Click on the chin: pin 6 goes there',
      async run({ page, press, see }) {
        const chart = page.locator('[data-node="f-injections"]');
        const pins = chart.locator('.fd-pin');
        await see(pins).toHaveCount(5);
        const picture = chart.getByRole('img', { name: 'Face, from the front' });
        await expect.poll(() => picture.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth)).toBeGreaterThan(0);
        const box = (await picture.boundingBox())!;
        await press(picture, { position: { x: box.width * 0.5, y: box.height * 0.82 } });
        await see(pins).toHaveCount(6);
        await see(pins.nth(5)).toHaveAccessibleName(/^Pin 6, bottom, 5\d% across, 8\d% down$/);
        const note = chart.getByRole('textbox', { name: 'Note for pin 6' });
        await see(note).toBeFocused();
        await see(note).toHaveAttribute('placeholder', 'Product and units');
        await page.keyboard.type('Filler, 1 ml', { delay: 15 });
        await see(pins.nth(5)).toHaveAccessibleName(/^Pin 6, bottom, 5\d% across, 8\d% down: Filler, 1 ml$/);
      },
    },
    {
      says: 'Drag a pin to where the injection really went',
      notOnPhone: 'a pin is dragged by a finger, and Playwright’s WebKit has no touch drag; Escape is a key a phone has none of',
      async run({ page, keys, see }) {
        const chart = page.locator('[data-node="f-injections"]');
        const pins = chart.locator('.fd-pin');
        const picture = (await chart.getByRole('img', { name: 'Face, from the front' }).boundingBox())!;
        // Pin 5 carried to the nose's side.
        const five = (await pins.nth(4).boundingBox())!;
        await page.mouse.move(five.x + five.width / 2, five.y + five.height / 2);
        await page.mouse.down();
        await page.mouse.move(picture.x + picture.width * 0.62, picture.y + picture.height * 0.6, { steps: 8 });
        await page.mouse.up();
        await see(pins.nth(4)).toHaveAccessibleName(/^Pin 5, \w+, 6[0-4]% across, 5[8-9]% down: Filler, 0\.5 ml$|^Pin 5, \w+, 6[0-4]% across, 6[0-2]% down: Filler, 0\.5 ml$/);
        // Pin 1 carried, and Escape before it is let go: back where it was.
        const one = (await pins.first().boundingBox())!;
        await page.mouse.move(one.x + one.width / 2, one.y + one.height / 2);
        await page.mouse.down();
        await page.mouse.move(picture.x + picture.width * 0.2, picture.y + picture.height * 0.2, { steps: 8 });
        await keys('Escape');
        await page.mouse.up();
        await see(pins.first()).toHaveAccessibleName('Pin 1, top, 40% across, 33% down: Botox, 4 units');
      },
    },
    {
      says: 'Press Tab until the chart is reached',
      notOnPhone: 'Tab and the arrow keys are keys a phone has none of',
      async run({ page, press, keys, see }) {
        const chart = page.locator('[data-node="f-injections"]');
        const stage = chart.locator('.fd-pins-stage');
        // From the page's heading, Tab after Tab to the chart.
        await press(page.getByRole('heading', { name: 'Treatment', level: 1 }));
        for (let i = 0; i < 12 && !(await stage.evaluate((at) => at === document.activeElement)); i++) await keys('Tab');
        await see(stage).toBeFocused();
        await see(chart.locator('.fd-pins-cross')).toBeVisible();
        await keys('Shift+ArrowLeft', 'Shift+ArrowLeft', 'ArrowDown');
        await keys('Enter');
        await see(chart.locator('.fd-pin')).toHaveCount(7);
        await see(chart.getByRole('status')).toHaveText(/^Pin 7 added: \w+, 30% across, 52% down\.$/);
        await see(chart.getByRole('textbox', { name: 'Note for pin 7' })).toBeFocused();
        await page.keyboard.type('Botox, 2 units', { delay: 15 });
      },
    },
    {
      says: 'On a pin, the arrow keys move it, Delete takes it away',
      notOnPhone: 'the arrow keys, Delete and Enter are keys a phone has none of',
      async run({ page, press, keys, see }) {
        const chart = page.locator('[data-node="f-injections"]');
        const pins = chart.locator('.fd-pin');
        // A pin reached as the chart is, by Tab (a click on a pin goes to its note).
        const tabTo = async (pin: Locator) => {
          await press(page.getByRole('heading', { name: 'Treatment', level: 1 }));
          for (let i = 0; i < 16 && !(await pin.evaluate((at) => at === document.activeElement)); i++) await keys('Tab');
        };
        await tabTo(pins.nth(6));
        await see(pins.nth(6)).toBeFocused();
        await keys('ArrowUp');
        await see(chart.getByRole('status')).toHaveText(/^Pin 7 moved: \w+, 30% across, 50% down\.$/);
        await keys('Enter');
        await see(chart.getByRole('textbox', { name: 'Note for pin 7' })).toBeFocused();
        await tabTo(pins.nth(2));
        await see(pins.nth(2)).toBeFocused();
        await keys('Delete');
        await see(pins).toHaveCount(6);
        await see(chart.getByRole('status')).toHaveText('Pin 3 removed.');
        await see(pins.nth(2)).toHaveAccessibleName(/^Pin 3, right, 69% across, 47% down/);
      },
    },
  ],
};
