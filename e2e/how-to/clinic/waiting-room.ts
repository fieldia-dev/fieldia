import type { Page } from '@playwright/test';
import type { DemoReplay } from '../hand';

/** The waiting room's patients, in the order the list shows them. */
const patients = (page: Page) => page.locator('.fd-list-row td[data-col="name"]');
const WAITING = ['Omar Nabil', 'Hana Wael', 'Tamer Said', 'Laila Mostafa', 'Ziad Kamal', 'Mariam Ezz', 'Nour Hassan', 'Rana Fouad'];

/** The waiting-room demo’s how-to steps, replayed by hand (e2e/how-to.spec.ts). */
export const replay: DemoReplay = {
  notOnPhone: 'a patient is moved by a finger’s drag on the grip (Playwright’s WebKit has no touch drag) or by Alt and an arrow key, which a phone has none of',
  steps: [
    {
      says: 'Carry a patient by the dots at the row’s start',
      async run({ page, see }) {
        await see(patients(page)).toHaveText(WAITING);
        // Omar carried by his grip below Tamer: on the way, Hana and Tamer slide up a place.
        const grip = page.locator('.fd-list-row').first().locator('td[data-col] > .fd-list-rank');
        await grip.scrollIntoViewIfNeeded();
        const from = (await grip.boundingBox())!;
        const third = (await page.locator('.fd-list-row').nth(2).boundingBox())!;
        await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
        await page.mouse.down();
        await page.mouse.move(from.x + from.width / 2, third.y + third.height * 0.75, { steps: 10 });
        await see(page.locator('.fd-list-row').first()).toHaveAttribute('data-lifted', '');
        await see(page.locator('.fd-list-row').nth(1)).toHaveCSS('transform', /matrix\(1, 0, 0, 1, 0, -\d/);
        await see(page.locator('.fd-list-row').nth(2)).toHaveCSS('transform', /matrix\(1, 0, 0, 1, 0, -\d/);
        await see(page.locator('.fd-list-row').nth(3)).toHaveCSS('transform', 'none');
        await page.mouse.up();
        await see(patients(page)).toHaveText(['Hana Wael', 'Tamer Said', 'Omar Nabil', ...WAITING.slice(3)]);
        await see(page.locator('.fd-list > [role="status"]')).toHaveText('Omar Nabil moved to place 3 of 8');
      },
    },
    {
      says: 'Or press a row’s Tab stop and Alt+↓ or Alt+↑',
      async run({ page, press, keys, see }) {
        // Tab from the search box to the rows: the first row's Tab stop, then down to Laila's.
        await press(page.getByRole('combobox', { name: 'Search' }));
        const laila = page.locator('.fd-list-row').filter({ hasText: 'Laila Mostafa' });
        for (let i = 0; i < 12 && !(await laila.evaluate((row) => row === document.activeElement)); i++) {
          await keys((await page.locator('.fd-list-row:focus').count()) ? 'ArrowDown' : 'Tab');
        }
        await see(laila).toBeFocused();
        await keys('Alt+ArrowUp');
        await see(patients(page)).toHaveText(['Hana Wael', 'Tamer Said', 'Laila Mostafa', 'Omar Nabil', ...WAITING.slice(4)]);
        await see(page.locator('.fd-list > [role="status"]')).toHaveText('Laila Mostafa moved to place 3 of 8');
        await see(page.locator('.fd-list-row').nth(2)).toBeFocused();
        await keys('Alt+ArrowDown', 'Alt+ArrowDown');
        await see(patients(page)).toHaveText(['Hana Wael', 'Tamer Said', 'Omar Nabil', 'Ziad Kamal', 'Laila Mostafa', ...WAITING.slice(5)]);
        await see(page.locator('.fd-list > [role="status"]')).toHaveText('Laila Mostafa moved to place 5 of 8');
      },
    },
    {
      says: 'Reload the page: the order you made is still there',
      async run({ page, see }) {
        await page.reload();
        await see(patients(page)).toHaveText(['Hana Wael', 'Tamer Said', 'Omar Nabil', 'Ziad Kamal', 'Laila Mostafa', ...WAITING.slice(5)]);
      },
    },
  ],
};
