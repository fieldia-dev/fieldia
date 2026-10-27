import { expect } from '../../fixtures';
import type { Page } from '@playwright/test';
import type { DemoReplay } from '../hand';

/** How many entries a list has loaded, as its count says: "1–60 of 1,284 entries" (its rows are drawn round the view). */
const loadedOf = async (page: Page) => Number(/^1–([\d,]+) /.exec(await page.locator('.fd-pager-text').innerText())?.[1].replace(/,/g, '') ?? 0);

/** The activity-log demo's how-to steps, replayed by hand (e2e/how-to.spec.ts). */
export const replay: DemoReplay = {
  steps: [
    {
      says: 'Scroll down: the next thirty entries come as the end of the list',
      async run({ page, see, phone }) {
        const entries = page.locator('.fd-list-row');
        const count = page.locator('.fd-pager-text');
        await see(entries).toHaveCount(30);
        await see(count).toHaveText('1–30 of 1,284 entries');
        await see(page.getByRole('button', { name: 'Next page' })).toBeHidden();
        // Scrolled down as a person does — the mouse's wheel; on the phone, whose finger Playwright's WebKit cannot
        // swipe with, the end of the list brought into sight — until its end comes in sight.
        await expect
          .poll(async () => {
            if (phone) await entries.last().scrollIntoViewIfNeeded();
            else await page.mouse.wheel(0, 1500);
            return loadedOf(page);
          })
          .toBeGreaterThanOrEqual(60);
        await see(count).toHaveText(/^1–(60|90) of 1,284 entries$/);
        await see(page.getByRole('button', { name: 'Next page' })).toBeHidden();
      },
    },
    {
      says: 'With the keyboard, go down past the last entry: the next ones come',
      notOnPhone: 'a phone has no Tab or arrow keys: its list loads as it is scrolled (the steps before and after)',
      async run({ page, press, keys, see }) {
        const entries = page.locator('.fd-list-row');
        const loaded = await loadedOf(page);
        // Into the list from its search box, Tab after Tab: the first entry takes the focus.
        await press(page.getByRole('combobox', { name: 'Search' }));
        for (let i = 0; i < 12 && !(await entries.first().evaluate((row) => row === document.activeElement)); i++) await keys('Tab');
        await see(entries.first()).toBeFocused();
        await see(entries.first()).toHaveAttribute('data-id', '1');
        // Down, one entry at a time, past the last that had come: on to the next (the log's entries are numbered
        // newest first), the rows round it drawn as the list scrolls.
        for (let i = 0; i < loaded; i++) await keys('ArrowDown');
        await see(page.locator('.fd-list-row:focus')).toHaveAttribute('data-id', String(loaded + 1));
        await expect.poll(() => loadedOf(page)).toBeGreaterThan(loaded);
        await see(page.locator('.fd-pager-text')).not.toHaveText(`1–${loaded} of 1,284 entries`);
      },
    },
    {
      says: 'Narrow the window to a phone’s width: the entries are cards',
      async run({ page, see, phone }) {
        if (!phone) await page.setViewportSize({ width: 390, height: 844 });
        await see(page.locator('.fd-list')).toHaveAttribute('data-as', 'cards');
        const entries = page.locator('.fd-list-row');
        const loaded = await loadedOf(page);
        await see(entries.first()).toBeVisible();
        await expect
          .poll(async () => {
            if (phone) await entries.last().scrollIntoViewIfNeeded();
            else await page.mouse.wheel(0, 4000);
            return loadedOf(page);
          })
          .toBeGreaterThan(loaded);
        await see(page.locator('.fd-pager-text')).toHaveText(new RegExp(`^1–\\d+ of 1,284 entries$`));
      },
    },
  ],
};
