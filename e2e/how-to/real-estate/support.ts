import type { Page } from '@playwright/test';
import { expect } from '../../fixtures';
import type { Hand } from '../hand';

/** The helpers the real-estate demos of real-estate.ts share. */

/** "5 homes", "1 home": a count in the page's word for its homes. */
export const homes = (n: number) => `${n} ${n === 1 ? 'home' : 'homes'}`;
/** A field of the form, by its node's id. */
export const part = (page: Page, id: string) => page.locator(`[data-node="${id}"]`);
/** The conversation beside a record. */
export const chatter = (page: Page) => page.locator('.fd-slot[data-slot="chatter"] .fd-chatter');
/** A message in it, by its words. */
export const message = (page: Page, words: string) => chatter(page).locator('.fd-message', { hasText: words });
/** The how-to panel, where every step and its links are. */
export const howToPanel = (page: Page) => page.getByRole('complementary', { name: 'About this demo' });
/**
 * A link a step names, followed as a person follows it (hand.follow: the line under the demo's name, else the how-to
 * panel), the page it opens waited for; and the panel, where it still lies over the page (a desktop's opens beside the
 * demo by itself), closed to have the page back.
 */
export async function followLink(hand: Hand, words: string | RegExp) {
  const { page, press, follow } = hand;
  const from = page.url();
  await follow(words);
  await expect.poll(() => page.url()).not.toBe(from);
  await page.waitForLoadState();
  await expect(page.locator('.fd-form').first()).toBeVisible();
  if (await howToPanel(page).isVisible()) await press(howToPanel(page).getByRole('button', { name: 'Close the panel' }));
}
/** What the app was told with each response, listed under the form, each response an item. */
export const told = (page: Page) => page.locator('.demo-sent-log ol > li');
