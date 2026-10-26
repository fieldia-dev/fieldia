import type { Page } from '@playwright/test';
import { expect } from '../../fixtures';
import type { DemoReplay } from '../hand';
import { mapSettled } from '../../map-support';
import { theMap, mapTool } from './support';

/**
 * Where a place is on the map's screen, by its latitude and longitude — read as a person reads a map, from the map's
 * own images: a tile of the level shown, its zoom and number in its address, its place on the screen.
 */
async function placeOnMap(page: Page, lat: number, lng: number) {
  return theMap(page).evaluate((el, [lat, lng]) => {
    const levels = [...el.querySelectorAll<HTMLElement>('.leaflet-tile-container')].filter((level) => level.querySelector('.leaflet-tile-loaded'));
    const top = levels.sort((a, b) => Number(b.style.zIndex || 0) - Number(a.style.zIndex || 0))[0];
    const tile = top.querySelector<HTMLImageElement>('.leaflet-tile-loaded')!;
    const [z, x, y] = /\/(\d+)\/(\d+)\/(\d+)\.png/.exec(tile.src)!.slice(1).map(Number);
    const box = tile.getBoundingClientRect();
    const scale = box.width / 256;
    const world = 256 * 2 ** z;
    const rad = (lat * Math.PI) / 180;
    const px = ((lng + 180) / 360) * world;
    const py = ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * world;
    return { x: box.x + (px - x * 256) * scale, y: box.y + (py - y * 256) * scale };
  }, [lat, lng] as const);
}

/** How much of the heat map glows: its pixels drawn in any colour, read off its canvas. */
const litPixels = (page: Page) =>
  theMap(page)
    .locator('canvas.fd-map-heat')
    .evaluate((canvas: HTMLCanvasElement) => {
      const data = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data;
      let lit = 0;
      for (let i = 3; i < data.length; i += 4) if (data[i] > 0) lit++;
      return lit;
    });

/** Where the heat map glows brightest, on the page: its most opaque, reddest pixel, as an eye finds the brightest spot. */
const brightest = (page: Page) =>
  theMap(page)
    .locator('canvas.fd-map-heat')
    .evaluate((canvas: HTMLCanvasElement) => {
      const data = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data;
      let best = 0;
      let most = -1;
      for (let i = 0; i < data.length; i += 4) {
        const glow = data[i + 3] * 4 + data[i] - data[i + 2];
        if (glow > most) [most, best] = [glow, i / 4];
      }
      const box = canvas.getBoundingClientRect();
      return { x: box.x + ((best % canvas.width) + 0.5) * (box.width / canvas.width), y: box.y + (Math.floor(best / canvas.width) + 0.5) * (box.height / canvas.height) };
    });

/** The map-heat demo's how-to steps, replayed by hand (e2e/how-to.spec.ts). */
export const replay: DemoReplay = {
  steps: [
    {
      says: 'Zoom in on the brightest glow until the streets show: the glow gives way to each order’s pin',
      notOnPhone: 'zooming in on a place is a pinch or a double tap there: Playwright’s WebKit has no pinch, and the clicks its taps raise say they come from a mouse, so the map takes no double tap from them',
      async run({ page, see }) {
        const map = theMap(page);
        await mapSettled(map);
        await see(map.locator('canvas.fd-map-heat')).toBeVisible();
        await see(map.locator('.fd-map-mark')).toHaveCount(0);
        await see(map.locator('.fd-map-list-note')).toHaveText('A heat map from afar: zoom in to the streets to see each one.');
        // The brightest glow, found as an eye finds it, zoomed in on as the map says to: Ctrl and the wheel, over it.
        const first = await brightest(page);
        const firstMohandessin = await placeOnMap(page, 30.0566, 31.2006);
        for (let turn = 0; turn < 8 && (await map.locator('canvas.fd-map-heat').isVisible()); turn++) {
          const at = await brightest(page);
          await page.mouse.move(at.x, at.y);
          await page.keyboard.down('Control');
          await page.mouse.wheel(0, -120);
          await page.keyboard.up('Control');
          await mapSettled(map);
        }
        await see(map.locator('.fd-map-mark').first()).toBeVisible();
        await see(map.locator('canvas.fd-map-heat')).toBeHidden();
        await see(map.locator('.fd-map-list-note')).toBeHidden();
        // The glow was the money of Mohandessin and Zamalek, west of the Nile and on its island: that is where it closed in.
        const mohandessin = await placeOnMap(page, 30.0566, 31.2006);
        const box = (await map.boundingBox())!;
        expect(mohandessin.x > box.x && mohandessin.x < box.x + box.width && mohandessin.y > box.y && mohandessin.y < box.y + box.height, 'Mohandessin in sight').toBe(true);
        // (Where it glowed brightest from afar: by Mohandessin, as the demo's orders weigh the money there.)
        expect(Math.hypot(first.x - firstMohandessin.x, first.y - firstMohandessin.y)).toBeLessThan(80);
      },
    },
    {
      says: 'Pick Over EGP 800 from the search menu: the heat map keeps the big orders alone',
      async run({ page, phone, press, see }) {
        const map = theMap(page);
        const pins = map.locator('.fd-map-mark .fd-map-face-text');
        const before = phone ? await litPixels(page) : await pins.count();
        await press(page.getByRole('button', { name: 'Search options' }));
        await press(page.locator('.fd-search-panel').getByRole('button', { name: 'Over EGP 800' }));
        await see(page.locator('.fd-facet .fd-facet-text')).toHaveText(['Over EGP 800']);
        if (phone) {
          // From afar (a phone did not zoom in, above): the glow, of fewer orders, lights less of the map.
          await see(map.locator('canvas.fd-map-heat')).toBeVisible();
          await expect.poll(() => litPixels(page)).toBeLessThan(before);
          // The menu closed by a press beside it, on the page's heading.
          await press(page.getByRole('heading', { name: 'Where orders come from' }));
          await see(page.locator('.fd-search-panel')).toBeHidden();
          return;
        }
        // At the streets: each pin left is an order over EGP 800.
        await expect.poll(() => pins.count()).toBeLessThan(before);
        for (const pin of await pins.all()) {
          await see(pin).toHaveText(/^E£\s?[\d,]+(\.\d\d)?$/);
          expect(Number(((await pin.textContent()) ?? '').replace(/[^\d.]/g, ''))).toBeGreaterThan(800);
        }
        // Out again, from afar: the glow is back, of the big orders alone.
        await page.keyboard.press('Escape');
        for (let turn = 0; turn < 8 && !(await map.locator('canvas.fd-map-heat').isVisible()); turn++) {
          await press(mapTool(page, 'Zoom out'));
          await mapSettled(map);
        }
        await see(map.locator('canvas.fd-map-heat')).toBeVisible();
        await see(map.locator('.fd-map-mark')).toHaveCount(0);
      },
    },
    {
      says: 'Press Full screen under the zoom; Escape brings it back',
      async run({ page, phone, press, keys, see }) {
        const map = theMap(page);
        await press(mapTool(page, 'Full screen'));
        await see(map).toHaveAttribute('data-full', '');
        await see(mapTool(page, 'Leave full screen')).toHaveAttribute('aria-pressed', 'true');
        const size = page.viewportSize()!;
        const box = (await map.boundingBox())!;
        expect(box.width).toBeGreaterThanOrEqual(size.width - 10);
        expect(box.height).toBeGreaterThanOrEqual(size.height - 10);
        // Escape on a desktop; a phone has no Escape key, its finger presses Leave full screen.
        if (phone) await press(mapTool(page, 'Leave full screen'));
        else {
          await keys('Escape');
          // Chromium gave the map the whole screen (the Fullscreen API): its Escape is the browser's own, outside the page,
          // which Playwright's keys never reach (they go to the page) — so the map's own button leaves it here.
          if (await page.evaluate(() => document.fullscreenElement?.classList.contains('fd-map-box') ?? false)) await press(mapTool(page, 'Leave full screen'));
        }
        await see(map).not.toHaveAttribute('data-full', '');
        await see(mapTool(page, 'Full screen')).toHaveAttribute('aria-pressed', 'false');
      },
    },
  ],
};
