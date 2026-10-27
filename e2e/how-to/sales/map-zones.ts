import type { Locator, Page } from '@playwright/test';
import { expect } from '../../fixtures';
import type { DemoReplay } from '../hand';
import { mapSettled } from '../../map-support';
import { theMap, mapTool } from './support';

/** A district of the map, by its name. */
const district = (page: Page, name: string) => page.locator(`path.fd-map-region[aria-label^="${name}:"]`);

/** How many records a list says it has: "1–10 / 180" → 180. */
const listTotal = async (page: Page) => Number(((await page.locator('.fd-pager-text').first().textContent()) ?? '').split('/ ')[1]);

/**
 * A spot of an area a person can point at or press: inside it, nothing over it (a pin, a bubble) — read from the page as
 * the pointer finds what is under it, as a place in the area's own box (for `press`'s position) and on the page. With
 * no such spot (all of it under something else) its middle, where the press then lands on what covers it, and says so.
 */
async function spotOf(area: Locator) {
  await area.scrollIntoViewIfNeeded();
  const box = (await area.boundingBox())!;
  const spot = await area.evaluate((path, b) => {
    for (let y = 0.3; y <= 0.7; y += 0.05)
      for (let x = 0.3; x <= 0.7; x += 0.05) {
        const px = b.x + b.width * x;
        const py = b.y + b.height * y;
        if (document.elementFromPoint(px, py) === path) return { x: px, y: py };
      }
    return null;
  }, box);
  const at = spot ?? { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  // What lies over its middle when nothing of it is free: a round mark's words ("126 here. Zoom in to see them.").
  const cover = spot ? null : await area.evaluate((path, p) => document.elementFromPoint(p.x, p.y)?.closest('[aria-label]')?.getAttribute('aria-label') ?? null, at);
  return { page: at, position: { x: at.x - box.x, y: at.y - box.y }, free: !!spot, cover };
}

/**
 * A point of the map's own ground near a place (parts of its width and height from its top left corner): where no button,
 * round mark, pin, legend or hint lies — found as the pointer finds what is under it, nearest first.
 */
async function groundNear(page: Page, x: number, y: number) {
  return theMap(page).evaluate((map, [fx, fy]) => {
    const box = map.getBoundingClientRect();
    const over = 'button, .leaflet-marker-icon, .leaflet-control, .fd-map-legend, .fd-map-hint, .leaflet-tooltip, a';
    for (let r = 0; r <= 0.3; r += 0.02)
      for (let a = 0; a < 2 * Math.PI; a += r ? Math.PI / 8 : 7) {
        const px = box.x + box.width * (fx + r * Math.cos(a));
        const py = box.y + box.height * (fy + r * Math.sin(a));
        // Ground for a finger's breadth round it too: WebKit 27.2 moves a tap onto a control within reach of it (the
        // legend folded at the map's foot took a tap 2 px above it).
        const ground = ([dx, dy]: number[]) => {
          const at = document.elementFromPoint(px + dx, py + dy);
          return !!at && map.contains(at) && !at.closest(over);
        };
        if ([[0, 0], [14, 0], [-14, 0], [0, 14], [0, -14]].every(ground)) return { x: px, y: py };
      }
    return { x: box.x + box.width * fx, y: box.y + box.height * fy };
  }, [x, y] as const);
}

/** A point of the map, as parts of its width and height from its top left corner. */
async function mapPoint(page: Page, x: number, y: number) {
  const box = (await theMap(page).boundingBox())!;
  return { x: box.x + box.width * x, y: box.y + box.height * y };
}

/** The map-zones demo's how-to steps, replayed by hand (e2e/how-to.spec.ts). */
export const replay: DemoReplay = {
  steps: [
    {
      says: 'Point at a district: it lights up and says its name and its orders',
      notOnPhone: 'a mouse pointed at a district: a phone has no pointer to rest on it (its finger presses, the next step)',
      async run({ page, see }) {
        await mapSettled(theMap(page));
        const zamalek = district(page, 'Zamalek');
        await see(zamalek).toHaveCSS('fill-opacity', '0.5');
        const spot = await spotOf(zamalek);
        await page.mouse.move(spot.page.x, spot.page.y);
        await see(page.locator('.leaflet-tooltip.fd-map-tip')).toHaveText(/^Zamalek: \d+$/);
        await see(zamalek).toHaveCSS('fill-opacity', '0.8');
      },
    },
    {
      says: 'Click Zamalek (if a round mark covers it, press the mark first: the map closes in)',
      async run({ page, press, see }) {
        await mapSettled(theMap(page));
        const zamalek = district(page, 'Zamalek');
        const orders = Number(/: (\d+) ·/.exec((await zamalek.getAttribute('aria-label')) ?? '')?.[1]);
        await see(page.locator('.fd-pager-text').first()).toHaveText('1–10 / 180');
        // A phone's small map: the "126" mark over the middle of the city, Zamalek under it — pressed, the map closes in.
        let spot = await spotOf(zamalek);
        if (!spot.free && spot.cover?.endsWith('Zoom in to see them.')) {
          const mark = theMap(page).getByRole('button', { name: spot.cover, exact: true });
          await press(mark);
          await see(mark).toHaveCount(0);
          await mapSettled(theMap(page));
          spot = await spotOf(zamalek);
        }
        await press(zamalek, { position: spot.position });
        await see(page.locator('.fd-facet .fd-facet-text')).toHaveText(['In Zamalek']);
        await see(page.locator('.fd-pager-text').first()).toContainText(`/ ${orders}`);
        await see(page.locator('.fd-list-row').filter({ visible: true }).first()).toContainText('Zamalek');
        for (const row of await page.locator('.fd-list-row').filter({ visible: true }).all()) await see(row).toContainText('Zamalek');
        // The chip taken away: every order again.
        await press(page.getByRole('button', { name: 'Remove In Zamalek' }));
        await see(page.locator('.fd-facet')).toHaveCount(0);
        await see(page.locator('.fd-pager-text').first()).toHaveText('1–10 / 180');
      },
    },
    {
      says: 'Pick Not delivered from the search menu: the shades change to the orders still out',
      async run({ page, phone, press, see }) {
        const downtown = district(page, 'Downtown');
        const label = (await downtown.getAttribute('aria-label')) ?? '';
        const all = Number(/: (\d+) ·/.exec(label)?.[1]);
        await press(page.getByRole('button', { name: 'Search options' }));
        await press(page.locator('.fd-search-panel').getByRole('button', { name: 'Not delivered' }));
        await see(page.locator('.fd-facet .fd-facet-text')).toHaveText(['Not delivered']);
        await expect.poll(() => listTotal(page)).toBeLessThan(180);
        // Each district says (and is shaded by) its orders still out: Downtown's fewer than all of its week's.
        await see(downtown).not.toHaveAttribute('aria-label', label);
        const out = Number(/: (\d+) ·/.exec((await downtown.getAttribute('aria-label')) ?? '')?.[1]);
        expect(out).toBeLessThan(all);
        // On a phone, the menu closed by a press beside it, on the page's heading: it lies over the map there.
        if (phone) {
          await press(page.getByRole('heading', { name: 'Orders this week, by district' }));
          await see(page.locator('.fd-search-panel')).toBeHidden();
        }
      },
    },
    {
      says: 'Tab to the districts on the map, move between them with the arrow keys, and press Enter for one',
      notOnPhone: 'a phone has no Tab, arrow or Enter keys to move among the districts with',
      async run({ page, keys, see }) {
        // Into the map by a press on its ground (no district there), then Tab: the districts are its next stop.
        const ground = await mapPoint(page, 0.06, 0.4);
        await page.mouse.click(ground.x, ground.y);
        await see(theMap(page)).toBeFocused();
        await keys('Tab');
        const focused = page.locator('path.fd-map-region:focus');
        // Its orders still out (step 3's search is on): none said for a district with none.
        await see(focused).toHaveAttribute('aria-label', /^[A-Z][a-z ]+(: \d+)? · Orders this week, by district$/);
        await see(page.locator('.leaflet-tooltip.fd-map-tip').last()).toBeVisible();
        const first = (await focused.getAttribute('aria-label'))!;
        await keys('ArrowRight');
        await see(focused).not.toHaveAttribute('aria-label', first);
        const name = (await focused.getAttribute('aria-label'))!.split(':')[0];
        await see(page.locator('.leaflet-tooltip.fd-map-tip').last()).toHaveText(new RegExp(`^${name}(: \\d+)?$`));
        await keys('Enter');
        await see(page.locator('.fd-facet .fd-facet-text')).toContainText([`In ${name}`]);
        for (const row of await page.locator('.fd-list-row').filter({ visible: true }).all()) await see(row).toContainText(name);
      },
    },
    {
      says: 'Press Nearest first under the zoom and allow your location (or not: the middle of the map is used)',
      async run({ page, phone, press, see }) {
        // The searches of the steps before taken away: the whole week, as the list first showed it.
        while (await page.locator('.fd-facet-remove').count()) await press(page.locator('.fd-facet-remove').first());
        await see(page.locator('.fd-facet')).toHaveCount(0);
        const firstOrder = page.locator('.fd-list-row').filter({ visible: true }).first();
        await see(firstOrder).toContainText('#1041');
        // Not allowed (the browser asked nobody): from the middle of the map, and said so. On a desktop only: a
        // phone's browser keeps the page's first answer about its place until the page is opened again, as Safari
        // does — the phone allows it at once.
        if (!phone) {
          await press(mapTool(page, 'Nearest first'));
          await see(mapTool(page, 'Nearest first')).toHaveAttribute('aria-pressed', 'true');
          await see(page.locator('.fd-map-list-note')).toHaveText('Nearest the middle of the map first: your place was not given.');
          await see(firstOrder).not.toContainText('#1041');
          await press(mapTool(page, 'Nearest first'));
          await see(mapTool(page, 'Nearest first')).toHaveAttribute('aria-pressed', 'false');
          await see(firstOrder).toContainText('#1041');
        }
        // Allowed, at Tahrir: the orders of Downtown or Garden City first.
        await page.context().grantPermissions(['geolocation']);
        await page.context().setGeolocation({ latitude: 30.0444, longitude: 31.2357 });
        await press(mapTool(page, 'Nearest first'));
        await see(mapTool(page, 'Nearest first')).toHaveAttribute('aria-pressed', 'true');
        await see(firstOrder).toContainText(/Downtown|Garden City/);
        await see(page.locator('.fd-map-list-note')).toBeHidden();
      },
    },
    {
      says: 'Press the ruler and click points along the river: the way’s length is said as it grows',
      async run({ page, phone, press, see }) {
        const map = theMap(page);
        await press(mapTool(page, 'Measure a distance'));
        await see(mapTool(page, 'Measure a distance')).toHaveAttribute('aria-pressed', 'true');
        // Its hint in a pointer's words, or a finger's on a touch screen.
        await see(map.locator('.fd-map-measure-hint')).toContainText(phone ? 'Tap points along the way; double-tap to finish.' : 'Click points along the way');
        const tap = async (x: number, y: number) => {
          const at = await groundNear(page, x, y);
          if (phone) await page.touchscreen.tap(at.x, at.y);
          else await page.mouse.click(at.x, at.y);
        };
        // Down the river through the middle of the map, on its ground (a district's press is the map's meanwhile).
        await tap(0.45, 0.2);
        await tap(0.5, 0.5);
        const tag = map.locator('.fd-map-measure-tag span');
        await see(tag).toHaveText(/^\d+(\.\d)? km$/);
        await see(map.locator('.fd-sr-only[aria-live]').last()).toHaveText(/^The way measures \d+(\.\d)? km\.$/);
        const two = (await tag.textContent())!;
        const last = await groundNear(page, 0.55, 0.8);
        if (phone) {
          // A third point, tapped: the way longer. Its double tap to finish is Leaflet's, made of two taps' clicks — and
          // the clicks Playwright's WebKit raises for a tap say they come from a mouse, so the map takes no double tap
          // from them (as the heat map's zoom): the finish is replayed on a desktop.
          await page.touchscreen.tap(last.x, last.y);
          await see(tag).not.toHaveText(two);
          await see(tag).toHaveText(/^\d+(\.\d)? km$/);
          await see(page.locator('.fd-facet')).toHaveCount(0);
          return;
        }
        // The last point, with a double-click: the way finished, its length longer.
        await page.mouse.dblclick(last.x, last.y);
        await see(map.locator('.fd-map-measure-hint')).toHaveCount(0);
        await see(tag).not.toHaveText(two);
        await see(tag).toHaveText(/^\d+(\.\d)? km$/);
        await see(page.locator('.fd-facet')).toHaveCount(0);
      },
    },
  ],
};
