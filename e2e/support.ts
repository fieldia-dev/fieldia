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
 * and a frame awaited that shows it there (or as near as the page's height now lets it).
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

/** Nothing on the page may scroll sideways. */
export async function expectNoSidewaysScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow, 'page scrolls sideways').toBeLessThanOrEqual(0);
}
