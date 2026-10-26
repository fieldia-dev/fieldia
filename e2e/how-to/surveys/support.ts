import type { Locator, Page } from '@playwright/test';
import type { Hand } from '../hand';

/** A field's wrapper, by its layout id. */
export const node = (page: Page, id: string) => page.locator(`[data-node="${id}"]`);
/** The page's ending, once its answers are sent. */
export const ending = (page: Page) => page.locator('.fd-done');

/**
 * A native list (a `<select>`) answered as a person answers it: pressed where it is drawn, then a choice picked from
 * the browser's own list — which is the browser's, not the page's, and Playwright answers as `pick` answers a file
 * dialog.
 */
export async function choose({ press }: Hand, list: Locator, label: string) {
  await press(list);
  await list.selectOption({ label });
}
