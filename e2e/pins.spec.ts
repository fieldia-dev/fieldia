import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { axeFindings } from './a11y-support';
import { expectNoSidewaysScroll, node, open, screen } from './support';

/**
 * Pins on a picture, as a clinic's doctor and an agent on a site visit meet them: a face chart's injection points, each
 * a numbered pin with its note; one put by a click, its note typed, one dragged, one put and moved by the keyboard alone,
 * one taken away; read to a screen reader as a numbered list; a floor plan from the visit's own picture field. In every
 * engine, each moving its own pointer.
 */

const chart = (page: Page) => node(page, 'f-injections');
const stage = (page: Page) => chart(page).locator('.fd-pins-stage');
const value = (page: Page) => page.evaluate(() => (window as any).fieldiaDemo.handle.form.getState().values.injections as { x: number; y: number; note?: string }[]);
/** A point on the picture, as shares of its width and height, in the page's pixels. */
async function point(page: Page, x: number, y: number) {
  const box = await chart(page).locator('.fd-pins-image').boundingBox();
  if (!box) throw new Error('no picture');
  return { x: box.x + box.width * x, y: box.y + box.height * y };
}

test.describe('pins on a picture', () => {
  test('a face chart: a pin put by a click and its note typed, one dragged, one by the keyboard, one taken away', async ({ page }) => {
    const { problems } = await open(page, 'plain', 'page=face-chart&record=1&skin=outlined');
    const pins = chart(page).locator('.fd-pin');
    await expect(pins).toHaveCount(5);
    await expect(pins.first()).toHaveAccessibleName('Pin 1, top, 40% across, 33% down: Botox, 4 units');
    await expect.poll(() => chart(page).locator('.fd-pins-image').evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth)).toBeGreaterThan(0);
    await screen(page, 'pins-face-chart');

    // A click on the chin: pin 6, its note typed.
    const chin = await point(page, 0.5, 0.82);
    await page.mouse.click(chin.x, chin.y);
    await expect(pins).toHaveCount(6);
    const note = chart(page).getByRole('textbox', { name: 'Note for pin 6' });
    await expect(note).toBeFocused();
    await page.keyboard.type('Filler, 1 ml');
    await expect.poll(async () => (await value(page))[5]).toEqual({ x: expect.closeTo(0.5, 1), y: expect.closeTo(0.82, 1), note: 'Filler, 1 ml' });
    await expect(pins.nth(5)).toHaveAccessibleName(/^Pin 6, bottom, 5\d% across, 8\d% down: Filler, 1 ml$/);

    // Pin 5 dragged to the nose's side, at hand speed, the chart in sight.
    await stage(page).scrollIntoViewIfNeeded();
    const from = await pins.nth(4).boundingBox();
    if (!from) throw new Error('no pin');
    const to = await point(page, 0.62, 0.6);
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await page.mouse.down();
    await page.mouse.move(to.x, to.y, { steps: 8 });
    await page.mouse.up();
    await expect.poll(async () => (await value(page))[4]).toEqual({ x: expect.closeTo(0.62, 1), y: expect.closeTo(0.6, 1), note: 'Filler, 0.5 ml' });

    // By the keyboard alone: Tab to the picture, the cross moved, Enter; the new pin moved by its arrows.
    await stage(page).focus();
    await page.keyboard.press('Shift+ArrowLeft');
    await page.keyboard.press('Shift+ArrowLeft');
    await expect(chart(page).locator('.fd-pins-cross')).toBeVisible();
    await page.keyboard.press('Enter');
    await expect(pins).toHaveCount(7);
    await expect(chart(page).getByRole('status')).toHaveText('Pin 7 added: left, 30% across, 50% down.');
    await page.keyboard.type('Botox, 2 units');
    await pins.nth(6).focus();
    await page.keyboard.press('ArrowUp');
    await expect(chart(page).getByRole('status')).toHaveText('Pin 7 moved: left, 30% across, 48% down.');
    await screen(page, 'pins-face-chart-edited');

    // Pin 3 taken away: the rest numbered again, the list read in order.
    await pins.nth(2).focus();
    await page.keyboard.press('Delete');
    await expect(pins).toHaveCount(6);
    await expect(chart(page).getByRole('status')).toHaveText('Pin 3 removed.');
    await expect(chart(page).locator('.fd-pins-list li')).toHaveCount(6);
    expect((await value(page)).map((pin) => pin.note)).toEqual(['Botox, 4 units', 'Botox, 4 units', 'Botox, 2 units (crow’s feet)', 'Filler, 0.5 ml', 'Filler, 1 ml', 'Botox, 2 units']);
    expect(await axeFindings(page, 'a face chart with its pins')).toEqual([]);
    expect(problems).toEqual([]);
  });

  test('a site visit’s snags on its own floor plan, on a phone, right to left: the picture never mirrored', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const { problems } = await open(page, 'plain', 'page=site-visit&record=1&skin=outlined&locale=ar&dir=rtl');
    const snags = node(page, 'f-snags');
    await expect(snags.locator('.fd-pins-image')).toHaveAttribute('src', '../samples/floor-plan.svg');
    await expect(snags.locator('.fd-pin')).toHaveCount(2);
    // The kitchen's tap is on the plan's right, right to left too.
    const pin = await snags.locator('.fd-pin').first().boundingBox();
    const plan = await snags.locator('.fd-pins-image').boundingBox();
    if (!pin || !plan) throw new Error('no plan');
    expect((pin.x + pin.width / 2 - plan.x) / plan.width).toBeCloseTo(0.76, 1);
    await expectNoSidewaysScroll(page);
    await screen(page, 'pins-site-visit-phone-rtl');
    expect(problems).toEqual([]);
  });
});
