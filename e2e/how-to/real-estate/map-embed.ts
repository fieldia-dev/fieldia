import type { Locator, Page } from '@playwright/test';
import { expect } from '../../fixtures';
import { mapStill, zoomOf, panMap, insideMap } from './support-more';
import type { DemoReplay } from '../hand';

/** A map in a page of its own: its map, its marks, how many homes it shows, and where it stands in the address. */
const embedMap = (page: Page) => page.locator('.fd-map-embed .fd-map-box');
const embedPins = (page: Page) => page.locator('.fd-map-embed .fd-map-mark:not(.fd-map-ghost)[data-id]');
const embedBubbles = (page: Page) => page.locator('.fd-map-embed .fd-map-bubble');
const onTheEmbed = (page: Page) =>
  page.evaluate(() => [...document.querySelectorAll('.fd-map-embed .fd-map-mark:not(.fd-map-ghost)')].reduce((sum, mark) => sum + (Number(mark.querySelector('.fd-map-bubble')?.textContent) || 1), 0));
const atOf = (page: Page) => (new URL(page.url()).searchParams.get('at') ?? '').split(',').filter(Boolean).map(Number);
const panEmbed = (page: Page, by: { x: number; y: number }) => panMap(page, by, embedMap(page));
const insideEmbed = (page: Page, marks: Locator) => insideMap(page, marks, embedMap(page));

/** The map-embed demo’s how-to steps, replayed by hand (e2e/how-to.spec.ts). */
export const replay: DemoReplay = {
  timeout: 120_000,
  steps: [
    {
      says: 'Drag the map, and turn the wheel over it',
      notOnPhone: 'a drag and a mouse’s wheel: Playwright’s WebKit has no touch drag (a phone’s one finger moves it)',
      async run({ page, see }) {
        const map = embedMap(page);
        await mapStill(map);
        await expect.poll(() => atOf(page)).toHaveLength(3);
        const [, lng, zoom] = atOf(page);
        // A drag, with no key held: the map moves, the address says where it stands.
        await panEmbed(page, { x: -160, y: 0 });
        await expect.poll(() => atOf(page)[1]).toBeGreaterThan(lng);
        // The wheel over it, with no key held: it zooms, and asks for no Ctrl.
        const box = (await map.boundingBox())!;
        await page.mouse.move(box.x + box.width * 0.6, box.y + box.height / 2);
        await page.mouse.wheel(0, -300);
        await expect.poll(() => atOf(page)[2]).toBeGreaterThan(zoom);
        await see(map.locator('.fd-map-veil')).not.toHaveAttribute('data-show', '');
        await see(page.locator('.fd-map-embed .fd-map-here')).toBeVisible();
      },
    },
    {
      says: 'Move the map: Search this area says how many homes are in view',
      async run({ page, press, phone, see }) {
        const map = embedMap(page);
        // Moved: dragged on a desktop; on the phone by its + (a finger's drag is not in Playwright's WebKit).
        if (phone) await press(map.getByRole('button', { name: 'Zoom in', exact: true }));
        else await panEmbed(page, { x: 60, y: 40 });
        await mapStill(map);
        const here = page.locator('.fd-map-embed .fd-map-here');
        await see(here).toHaveText(/^Search this area \(\d+\)$/);
        const inView = Number(/\((\d+)\)$/.exec((await here.textContent())!)![1]);
        const where = new URL(page.url()).searchParams.get('at');
        await press(here);
        await see(page.locator('.hs-chip')).toHaveText(['In this area×']);
        await see(page.locator('.hs-count')).toHaveText(inView === 1 ? '1 home' : `${inView} homes`);
        await see(page.locator('.hs-home')).toHaveCount(inView);
        // The map stays where it is.
        await mapStill(map);
        expect(new URL(page.url()).searchParams.get('at')).toBe(where);
      },
    },
    {
      says: 'Move the map again, then reload the page',
      async run({ page, press, phone, see, seePage }) {
        const map = embedMap(page);
        if (phone) await press(map.getByRole('button', { name: 'Zoom out', exact: true }));
        else await panEmbed(page, { x: -50, y: 30 });
        await mapStill(map);
        await expect.poll(() => new URL(page.url()).searchParams.get('at')).not.toBeNull();
        const kept = new URL(page.url()).searchParams.get('at');
        const zoom = await zoomOf(map);
        await page.reload();
        await see(map.locator('.leaflet-tile-loaded').first()).toBeVisible();
        await mapStill(map);
        // Opened where it was left: the page's own address said so.
        await seePage().toHaveURL(/[?&]at=/);
        expect(new URL(page.url()).searchParams.get('at')).toBe(kept);
        expect(await zoomOf(map)).toBe(zoom);
      },
    },
    {
      says: 'Point at a home in the list: its pin lights up',
      notOnPhone: 'pointing is a mouse’s: a phone has no pointer to rest on a home or a pin',
      async run({ page, hover, press, see }) {
        const map = embedMap(page);
        // A home of its own on the map: closer by its bubbles until a pin shows.
        for (let i = 0; i < 6 && (await insideEmbed(page, embedPins(page))) < 0; i++) {
          const before = await zoomOf(map);
          await press(embedBubbles(page).nth(Math.max(0, await insideEmbed(page, embedBubbles(page)))));
          await expect.poll(() => zoomOf(map)).toBeGreaterThan(before);
          await mapStill(map);
        }
        const inside = await insideEmbed(page, embedPins(page));
        expect(inside, 'a pin inside the map').toBeGreaterThanOrEqual(0);
        const pin = embedPins(page).nth(inside);
        const id = (await pin.getAttribute('data-id'))!;
        await hover(page.locator(`.hs-home[data-id="${id}"]`));
        await see(pin.locator('.fd-map-face')).toHaveAttribute('data-hot', '');
        await hover(page.locator('.hs-title'));
        await see(pin.locator('.fd-map-face')).not.toHaveAttribute('data-hot', '');
        await hover(pin);
        await see(page.locator(`.hs-home[data-id="${id}"]`)).toHaveClass(/is-lit/);
      },
    },
    {
      says: 'Press To rent at the top: the page’s own filter',
      async run({ page, press, see, seePage }) {
        await press(page.getByRole('button', { name: 'To rent' }));
        await see(page.locator('.hs-title')).toHaveText('Homes to rent');
        await seePage().toHaveURL(/[?&]offer=rent(&|$)/);
        // The map follows it: the rentals alone, in their tone.
        const listed = await page.locator('.hs-home').count();
        await expect.poll(() => onTheEmbed(page)).toBeLessThanOrEqual(listed);
        await expect.poll(() => page.locator('.fd-map-embed .fd-map-mark:not(.fd-map-ghost) .fd-map-face:not([data-tone="info"])').count()).toBe(0);
      },
    },
    {
      says: 'Press a pin, then Open on its card',
      async run({ page, press, see }) {
        const map = embedMap(page);
        for (let i = 0; i < 6 && (await insideEmbed(page, embedPins(page))) < 0; i++) {
          const before = await zoomOf(map);
          await press(embedBubbles(page).nth(Math.max(0, await insideEmbed(page, embedBubbles(page)))));
          await expect.poll(() => zoomOf(map)).toBeGreaterThan(before);
          await mapStill(map);
        }
        const inside = await insideEmbed(page, embedPins(page));
        expect(inside, 'a pin inside the map').toBeGreaterThanOrEqual(0);
        const pin = embedPins(page).nth(inside);
        const id = (await pin.getAttribute('data-id'))!;
        await press(pin);
        const card = page.locator('.fd-map-embed .fd-map-card');
        await see(card).toBeVisible();
        await press(card.getByRole('button', { name: 'Open' }));
        await see(page.locator(`.hs-home[data-id="${id}"]`)).toHaveAttribute('aria-current', 'true');
      },
    },
  ],
};
