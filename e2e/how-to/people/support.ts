import type { Locator, Page } from '@playwright/test';
import type { Hand } from '../hand';

/** What several of the people demos’ replays share (e2e/how-to/people/*.ts). */

/** A part of the page by its node's id. */
export const node = (page: Page, id: string) => page.locator(`[data-node="${id}"]`);

/**
 * A choice from a list the browser draws itself (a `<select>`): pressed, its words typed as a person types to find one
 * — its own list (a desktop's menu, a phone's picker) is the browser's, not the page's — and taken with Enter where a
 * desktop's menu is open.
 */
export async function choose({ page, press, phone }: Hand, select: Locator, label: string) {
  await press(select);
  await page.keyboard.type(label, { delay: 15 });
  if (!phone) await page.keyboard.press('Enter');
}

/** A date typed as the box asks for it, dd/mm/yyyy, in place of what it held. */
export async function date({ type }: Hand, target: Locator, ddmmyyyy: string) {
  await type(target, ddmmyyyy, { clear: true });
}
