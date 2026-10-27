import type { Locator, Page } from '@playwright/test';
import type { Hand } from '../hand';

/** What several of the accounting demos’ replays share (e2e/how-to/accounting/*.ts). */

/** The stage a record's status bar shows it in. */
export const stage = (page: Page) => page.locator('.fd-statusbar [aria-current="step"]');

/** The approvals band over a record, and its parts (e2e/approvals.spec.ts reads them so). */
export const band = (hand: Hand) => hand.page.locator('.fd-approval');
export const approvalTitle = (hand: Hand) => hand.page.locator('.fd-approval-title');
export const levels = (hand: Hand) => hand.page.locator('.fd-approval-level');
export const signedIn = (hand: Hand) => hand.page.locator('.demo-signed-in-said');

/**
 * A choice from a list the browser draws itself (a `<select>`), pressed: on a desktop its words typed to find it and
 * taken with Enter; on a phone its picker turned, one option at a time, to it (WebKit's typing to find one stops at a
 * space: "Last 7 days" typed lands on "Last week").
 */
export async function choose({ page, press, phone }: Hand, select: Locator, label: string) {
  await press(select);
  if (!phone) {
    await page.keyboard.type(label, { delay: 15 });
    await page.keyboard.press('Enter');
    return;
  }
  const options = (await select.locator('option').allTextContents()).map((words) => words.trim());
  const from = options.indexOf(((await select.locator('option:checked').textContent()) ?? '').trim());
  const to = options.indexOf(label);
  for (let at = from; at !== to; at += Math.sign(to - from)) await page.keyboard.press(to > from ? 'ArrowDown' : 'ArrowUp');
}

/**
 * The browser's own print, its dialog standing open until the replay closes it: told before (beforeprint), the page
 * laid out for paper (as print.spec.ts does) — no headless browser shows its print dialog, nor can a hand press it.
 */
export async function printDialog(page: Page) {
  await page.evaluate(() => (window.print = () => void window.dispatchEvent(new Event('beforeprint'))));
  return {
    paper: () => page.emulateMedia({ media: 'print' }),
    closed: async () => {
      await page.emulateMedia({ media: 'screen' });
      await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
    },
  };
}
