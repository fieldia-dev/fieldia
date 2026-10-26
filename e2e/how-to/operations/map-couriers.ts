import { expect } from '../../fixtures';
import type { Page } from '@playwright/test';
import type { DemoReplay } from '../hand';

/** How many records a list's map shows: one a pin, a bubble its count. */
const onTheMap = (page: Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll('.fd-map-list .fd-map-mark:not(.fd-map-ghost)')].reduce((sum, mark) => {
      const bubble = mark.querySelector('.fd-map-bubble');
      return sum + (bubble ? Number(bubble.textContent) : 1);
    }, 0)
  );

/** The map-couriers demo's how-to steps, replayed by hand (e2e/how-to.spec.ts). */
export const replay: DemoReplay = {
  steps: [
    {
      says: 'Tab to the map, then on through the couriers: each is read out',
      notOnPhone: 'a phone has no Tab key: its couriers are tapped',
      async run({ page, press, keys, see }) {
        const map = page.locator('.fd-map-list .fd-map-box');
        await see(page.locator('.fd-map-list .leaflet-tile-loaded').first()).toBeVisible();
        // From the search box above it, Tab after Tab: the map takes the focus.
        await press(page.getByRole('combobox', { name: 'Search' }));
        for (let i = 0; i < 8 && !(await map.evaluate((box) => box === document.activeElement)); i++) await keys('Tab');
        await see(map).toBeFocused();
        // On through the bubbles (each saying how many it holds) to the couriers, each by name.
        const focused = page.locator(':focus');
        const names: string[] = [];
        for (let i = 0; i < 12 && names.length < 5; i++) {
          await keys('Tab');
          await see(focused).toHaveClass(/leaflet-marker-icon/);
          const name = (await focused.getAttribute('aria-label'))!;
          if (await focused.getAttribute('data-id')) names.push(name);
          else expect(name).toMatch(/^\d+ here\. Zoom in to see them\.$/);
        }
        expect(names).toHaveLength(5);
        for (const name of names) expect(name).toMatch(/^[A-Z][a-z]+ [A-Z][a-z]+$/);
        // Enter opens the last one's card, Escape closes it.
        const card = page.locator('.fd-map-list .fd-map-card');
        await keys('Enter');
        await see(card).toBeVisible();
        await see(card).toContainText(names.at(-1)!);
        await see(card.locator('dt')).toHaveText(['Status', 'Vehicle', 'Orders today', 'Phone']);
        await keys('Escape');
        await see(card).toHaveCount(0);
        await see(focused).toHaveAttribute('aria-label', names.at(-1)!);
      },
    },
    {
      says: 'Ctrl-click (⌘-click) a courier: they are chosen, a tick on their icon',
      notOnPhone: 'a phone has no Ctrl key',
      async run({ page, press, mod, see }) {
        const courier = page.locator('.fd-map-list .fd-map-mark:not(.fd-map-ghost)[data-id]').first();
        const face = courier.locator('.fd-map-face');
        await see(face).not.toHaveAttribute('data-chosen');
        await press(face, { modifiers: [mod] });
        await see(face).toHaveAttribute('data-chosen', '');
        await see(page.locator('.fd-map-list .fd-map-card')).toHaveCount(0);
      },
    },
    {
      says: 'Press the circle at the map’s corner and drag out from a spot',
      notOnPhone: 'a drag: Playwright’s WebKit has no touch drag',
      async run({ page, press, drag, see }) {
        const map = page.locator('.fd-map-list .fd-map-box');
        const circle = page.getByRole('group', { name: 'Draw an area to search in' }).getByRole('button', { name: 'Circle' });
        await press(circle);
        await see(circle).toHaveAttribute('aria-pressed', 'true');
        // Out from the map's middle, 160 pixels.
        const box = (await map.boundingBox())!;
        await drag(map, { x: box.x + box.width / 2 + 160, y: box.y + box.height / 2 });
        await see(page.locator('.fd-facet .fd-facet-text')).toHaveText(['In the area drawn']);
        await expect.poll(() => onTheMap(page)).toBeLessThan(18);
        expect(await onTheMap(page)).toBeGreaterThan(0);
        await see(page.locator('.fd-map-list circle, .fd-map-list path.fd-map-searched').first()).toBeVisible();
      },
    },
    {
      says: 'Press List to see the same couriers as a table, and Map to come back',
      async run({ page, press, see }) {
        const shown = await onTheMap(page);
        const view = (name: string) => page.getByRole('group', { name: 'Show as' }).getByRole('button', { name, exact: true });
        await press(view('List'));
        await see(view('List')).toHaveAttribute('aria-pressed', 'true');
        await see(page.locator('.fd-map-list .fd-map-box')).toBeHidden();
        await see(page.locator('.fd-list-row')).toHaveCount(shown);
        await press(view('Map'));
        await see(view('Map')).toHaveAttribute('aria-pressed', 'true');
        await see(page.locator('.fd-map-list .fd-map-box')).toBeVisible();
        await see(page.locator('.fd-list-row').first()).toBeHidden();
      },
    },
  ],
};
