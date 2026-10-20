import { type Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { node, open, screen } from './support';

/**
 * Rows copied from a spreadsheet and pasted on a dropdown cell of a table of lines — a cell that takes no typing, where
 * no browser sends a paste — spread from it as from a text cell, each choice read by its words among its own line's
 * choices; one value picks the choice so called. Copied and pasted with the keys, in Chromium, Firefox and WebKit.
 */

// The clipboard is the browser's, one for every page a worker has open: these tests take turns with it.
test.describe.configure({ mode: 'default' });

type Line = { key: string; values: Record<string, unknown> };
const toolsOf = (page: Page) => page.evaluate(() => ((window as any).fieldiaDemo.handle.form.getState().values['tool_ids'] as Line[]).map((line) => line.values['tool']));
const table = (page: Page) => node(page, 'f-tools');
const tool = (page: Page, n: number) => table(page).locator('tbody tr[data-line]').nth(n).locator('td[data-column="tool"] select');

/** Rows copied as a spreadsheet puts them on the clipboard: from a box of their own, chosen whole and copied with the keys. */
async function copy(page: Page, text: string) {
  await page.evaluate((words) => {
    const sheet = document.createElement('textarea');
    sheet.id = 'e2e-copied';
    sheet.value = words;
    document.body.append(sheet);
    sheet.focus();
    sheet.select();
  }, text);
  await page.keyboard.press('ControlOrMeta+C');
  await page.evaluate(() => document.getElementById('e2e-copied')?.remove());
}

test('a block pasted on a dropdown cell spreads down from it, each choice read among its own line’s', async ({ page }) => {
  const { problems } = await open(page, 'plain', 'page=agent-tools&skin=underline');
  await expect.poll(async () => (await tool(page, 2).locator('option').allTextContents()).filter(Boolean)).toEqual(['Search contacts', 'Create a deal', 'Log a call']);
  await copy(page, 'Draft a reply\nSearch mail\nPost in a channel\n');
  await tool(page, 0).focus();
  await page.keyboard.press('ControlOrMeta+V');
  await expect(table(page).locator('.fd-lines-paste-note')).toHaveText('Pasted into 2 cells. Not pasted: Tool, line 3 (Tool: nothing is called “⁨Post in a channel⁩”; pick one from the list)');
  expect(await toolsOf(page)).toEqual(['draft_reply', 'search', 'search', 'post_message']);
  await expect(tool(page, 0).locator('option:checked')).toHaveText('Draft a reply');
  await expect(tool(page, 0)).toBeFocused();
  await screen(page, 'lines-paste-dropdown', { viewport: true });
  expect(problems).toEqual([]);
});

test('one value pasted on a dropdown cell picks the choice so called', async ({ page }) => {
  const { problems } = await open(page, 'plain', 'page=agent-tools&skin=underline');
  await expect.poll(async () => (await tool(page, 3).locator('option').allTextContents()).filter(Boolean)).toEqual(['Search messages', 'Post in a channel', 'Send a direct message']);
  await copy(page, 'Send a direct message');
  await tool(page, 3).focus();
  await page.keyboard.press('ControlOrMeta+V');
  await expect(tool(page, 3).locator('option:checked')).toHaveText('Send a direct message');
  expect((await toolsOf(page))[3]).toBe('direct_message');
  await expect(tool(page, 3)).toBeFocused();
  expect(problems).toEqual([]);
});
