import type { Page } from '@playwright/test';
import { expect, test } from '../../fixtures';
import type { Hand } from '../hand';
import { offeredName } from '../../support';

/** What several of the CRM demos’ replays share (e2e/how-to/crm/<demo id>.ts). */

/**
 * A file the browser saves for a press — a link a step names, a button — kept under the name it is given, as a
 * person's Downloads folder keeps it (here, the test's own output folder): where it is, and that name.
 */
export async function download(page: Page, press: () => Promise<void>): Promise<{ name: string; path: string }> {
  const saving = page.waitForEvent('download');
  await press();
  const saved = await saving;
  const path = test.info().outputPath('downloads', `${Date.now()}`, saved.suggestedFilename());
  await saved.saveAs(path);
  // The name the page gave it: WebKit 27.2 hands it over with each space an underscore (offeredName, e2e/support.ts).
  return { name: offeredName(saved), path };
}
/** A list's header by its words (a chip over the cards on a phone), as the list specs find it. */
export const header = (page: Page, words: string) => page.locator('.fd-list-table thead th', { has: page.locator('.fd-list-head', { hasText: new RegExp(`^${words}$`) }) });
/** A list's row by the words in it. */
export const rowWith = (page: Page, words: string) => page.locator('.fd-list-row').filter({ hasText: words });
export const chips = (page: Page) => page.locator('.fd-facet .fd-facet-text');
export const searchMenu = (page: Page) => page.locator('.fd-search-panel');
/** The search's menu opened from the arrow at the box's end, unless it is open. */
export async function openMenu({ page, press }: Hand) {
  if (await searchMenu(page).isHidden()) await press(page.getByRole('button', { name: 'Search options' }));
  await expect(searchMenu(page)).toBeVisible();
}
/** The how-to panel, where every step and its links are. */
export const howToPanel = (page: Page) => page.getByRole('complementary', { name: 'About this demo' });
/** The how-to panel closed again, as a person closes it to have the page back, if it is open. */
export async function closePanel({ page, press }: Hand) {
  // A followed link's page draws its frame as its scripts run, after its address shows: the header's Options and the
  // panel, open as it remembers, in one pass (demos/shell.mjs). Looked at sooner, the panel was not there, then opened.
  await expect(page.locator('#demo-head .dh-options')).toBeAttached();
  if (await howToPanel(page).isVisible()) await press(howToPanel(page).getByRole('button', { name: 'Close the panel' }));
  await expect(howToPanel(page)).toBeHidden();
}
