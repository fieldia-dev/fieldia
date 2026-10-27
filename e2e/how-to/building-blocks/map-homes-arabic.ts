import { expect } from '../../fixtures';
import { mapSettled } from '../../map-support';
import type { Locator, Page } from '@playwright/test';
import type { DemoReplay } from '../hand';

/** How many homes a list's map shows: a pin one, a bubble its count. */
const homesOnTheMap = (page: Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll('.fd-map-list .fd-map-mark:not(.fd-map-ghost)')].reduce((sum, mark) => {
      const bubble = mark.querySelector('.fd-map-bubble');
      return sum + (bubble ? Number(bubble.textContent) : 1);
    }, 0)
  );
/** Whether a part is drawn inside another's box: a pin inside its map, not past its edge under the page. */
async function insideOf(outer: Locator, inner: Locator) {
  const [o, i] = [await outer.boundingBox(), await inner.boundingBox()];
  return !!o && !!i && i.x >= o.x && i.y >= o.y && i.x + i.width <= o.x + o.width && i.y + i.height <= o.y + o.height;
}

/** The map-homes-arabic demo's how-to steps, replayed by hand (e2e/how-to.spec.ts). */
export const replay: DemoReplay = {
  steps: [
    {
      says: 'Look at the pins: “10.8 مليون” for a flat in pounds',
      async run({ page, press, type, keys, see }) {
        const map = page.locator('.fd-map-list .fd-map-box');
        const pin = (id: number) => map.locator(`.fd-map-mark[data-id="${id}"]:not(.fd-map-ghost) .fd-map-face-text`);
        await see(map.locator('.leaflet-tile-loaded').first()).toBeVisible();
        // The whole of Cairo opens in bubbles, no price on any: Zamalek's homes brought onto the map by the list's
        // search, and the bubble left there opened, so each home is a pin with its price.
        await see(map.locator('.fd-map-bubble').first()).toBeVisible();
        await type(page.locator('.fd-search').getByRole('combobox'), 'Zamalek');
        await keys('Enter');
        await see(page.locator('.fd-list-row')).toHaveCount(6);
        // The map shows the six alone, each a pin or counted in a bubble, and has come to rest on them.
        await expect.poll(() => homesOnTheMap(page)).toBe(6);
        await mapSettled(map);
        await press(map.locator('.fd-map-bubble').first());
        await see(pin(2)).toBeVisible();
        await mapSettled(map);
        // Pounds unsaid, millions in Arabic words; a rent by the month; dollars named: each on the map, in sight.
        await see(pin(2)).toHaveText('10.8 مليون');
        await see(pin(25)).toHaveText('⁨47 ألف⁩/شهر');
        await see(pin(6)).toContainText('US$');
        await see(pin(6)).toContainText('/شهر');
        for (const id of [2, 25, 6]) expect(await insideOf(map, pin(id)), `the pin of home ${id} is on the map, in sight`).toBe(true);
      },
    },
    {
      says: 'Click a pin: its card reads right to left',
      async run({ page, press, see }) {
        const map = page.locator('.fd-map-list .fd-map-box');
        const card = page.locator('.fd-map-list .fd-map-card');
        await press(map.locator('.fd-map-mark[data-id="2"]:not(.fd-map-ghost) .fd-map-face'));
        await see(card).toBeVisible();
        await see(card).toHaveAttribute('dir', 'rtl');
        // Its English name as typed: its first letter at its left.
        const name = card.locator('.fd-map-card-title bdi');
        await see(name).toHaveText(/^\d-bedroom .+ in Zamalek$/);
        const ends = await name.evaluate((node) => {
          const text = node.firstChild as Text;
          const range = document.createRange();
          const x = (i: number) => (range.setStart(text, i), range.setEnd(text, i + 1), range.getBoundingClientRect().x);
          return { first: x(0), last: x(text.length - 1) };
        });
        expect(ends.first).toBeLessThan(ends.last);
        // Its line in the card's order, right to left: the district first, at the right; its area whole, "175 م²" as written.
        const parts = card.locator('dd').last().locator('bdi');
        await see(parts.first()).toHaveText('الزمالك');
        await see(parts.last()).toHaveText(/^\d+\sم²$/);
        const [district, size] = [(await parts.first().boundingBox())!, (await parts.last().boundingBox())!];
        expect(district.x).toBeGreaterThan(size.x);
        await see(card.getByRole('button', { name: 'فتح' })).toBeVisible();
      },
    },
    {
      says: 'Point at a row: its pin lights up, as on the English page.',
      notOnPhone: 'a phone has no pointer to rest on a row',
      async run({ page, press, hover, see }) {
        const card = page.locator('.fd-map-list .fd-map-card');
        await press(card.getByRole('button', { name: 'إغلاق' }));
        await see(card).toBeHidden();
        const pin = page.locator('.fd-map-list .fd-map-mark[data-id="25"]:not(.fd-map-ghost) .fd-map-face');
        await see(pin).not.toHaveAttribute('data-hot');
        await hover(page.locator('.fd-list-row[data-id="25"]'));
        await see(pin).toHaveAttribute('data-hot', '');
        await hover(page.getByRole('heading', { name: 'منازل في القاهرة' }));
        await see(pin).not.toHaveAttribute('data-hot');
      },
    },
  ],
};
