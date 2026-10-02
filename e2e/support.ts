import { expect, type Page } from '@playwright/test';

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

/** Save a screenshot for a person to look at. */
export async function screen(page: Page, name: string) {
  await page.screenshot({ path: `test-results/screens/${name}.png`, fullPage: true });
}

/** Nothing on the page may scroll sideways. */
export async function expectNoSidewaysScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow, 'page scrolls sideways').toBeLessThanOrEqual(0);
}
