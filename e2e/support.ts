import { expect, type Page } from '@playwright/test';
import { test } from './fixtures';

/** Open a demo and fail the test on any console error or uncaught exception. */
export async function open(page: Page, variant: string, query: string) {
  const problems: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') problems.push(`console: ${message.text()}`);
  });
  page.on('pageerror', (error) => problems.push(`page error: ${error.message}`));
  await page.goto(`/${variant}/?${query}`);
  await expect(page.locator('.fd-form')).toBeVisible();
  return {
    problems,
    /** The demo's own handle: the form, the in-memory data source, the actions pressed. */
    demo: <T>(read: string) => page.evaluate((path) => path.split('.').reduce((value: any, key) => value?.[key], (window as any).fieldiaDemo), read) as Promise<T>,
  };
}

/** A field's wrapper, by its layout id. */
export const node = (page: Page, id: string) => page.locator(`[data-node="${id}"]`);

/**
 * Save a screenshot for a person to look at — transitions finished, so it shows where things settle.
 *
 * A full-page shot lays the page out at its whole height and back again (Chromium's `captureBeyondViewport`); the page
 * can come back scrolled to its foot, its own place given back only when something next moves it — the next press,
 * between its down and its up: what was under the pointer at the down has moved by the up, and the press is lost (the
 * tender's Lots tab, 37px lower by its up, its click on the grid above it). So the page is put back where it stood,
 * and a frame awaited that shows it there (or as near as the page's height now lets it). On its way Chromium lays the
 * page out in a window of 1×1: what watches its size (a status strip, a grid) moves for it. Mid-gesture — a mouse held
 * down — take what is in view (`viewport: true`): no person's window goes to 1×1 while they drag.
 */
export async function screen(page: Page, name: string, options: { viewport?: boolean } = {}) {
  // Firefox's and WebKit's beside Chromium's, never over them: screens/firefox/…, screens/webkit/….
  const engine = test.info().project.name;
  const folder = engine === 'chromium' || !engine ? 'test-results/screens' : `test-results/screens/${engine}`;
  // Only what is in view, for a dialog: a full-page shot would leave its backdrop over part of the page.
  const fullPage = !options.viewport;
  const stood = fullPage ? await page.evaluate(() => ({ x: scrollX, y: scrollY })) : null;
  await page.screenshot({ path: `${folder}/${name}.png`, fullPage, animations: 'disabled' });
  if (!stood) return;
  await expect
    .poll(() =>
      page.evaluate(
        (at) =>
          new Promise<boolean>((done) => {
            const root = document.scrollingElement ?? document.documentElement;
            const x = Math.min(at.x, root.scrollWidth - innerWidth);
            const y = Math.min(at.y, root.scrollHeight - innerHeight);
            if (Math.abs(scrollX - x) > 1 || Math.abs(scrollY - y) > 1) scrollTo({ left: x, top: y, behavior: 'instant' });
            requestAnimationFrame(() => done(Math.abs(scrollX - x) <= 1 && Math.abs(scrollY - y) <= 1));
          }),
        stood
      )
    )
    .toBe(true);
}

/**
 * A list's layout for `rows` rows: a page of the format holds 500 at the most (`pageSize`, which every viewer's check
 * holds a page to), so a longer list is an endless one — its rows loaded 500 at a time as a person scrolls to its end.
 */
export const longList = (rows: number) => (rows > 500 ? { pageSize: 500, endless: true } : { pageSize: rows });

/**
 * Every row of an endless list of `rows` loaded before a spec looks at it, its Show more pressed until they have all
 * come — in the page, so the view never moves: the list as a page of them all would have opened, its rows counted
 * (`aria-rowcount`). `table` is the list's table.
 */
export async function everyRowLoaded(page: Page, rows: number, table = page.locator('#app .fd-list-table'), timeout = 120_000) {
  await expect
    .poll(
      async () => {
        // Its records' Show more (list.ts, list-endless.ts), beside its table.
        await table.evaluate((el) => el.closest('.fd-list-records')?.querySelector<HTMLButtonElement>('.fd-list-more-rows:not([hidden]) button')?.click());
        return table.getAttribute('aria-rowcount');
      },
      { timeout, intervals: [100, 250, 500, 1000] }
    )
    .toBe(String(rows + 1));
}

/** Nothing on the page may scroll sideways. */
export async function expectNoSidewaysScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow, 'page scrolls sideways').toBeLessThanOrEqual(0);
}

/**
 * The loading demo's address (`/loading/?…`) for a test that holds its answers: a held wait is looked at for as long as
 * the test takes — its screenshot, axe, a slow runner (WebKit on CI) — so its words stay its first ("Loading…",
 * "Searching…", "Loading more…"), never "Still loading…" past the 5 s of `slowAfter`, unless the test names its own.
 */
export const unhurried = (query: string) => `/loading/?${/(^|&)slowAfter=/.test(query) ? query : `${query}${query ? '&' : ''}slowAfter=600000`}`;
