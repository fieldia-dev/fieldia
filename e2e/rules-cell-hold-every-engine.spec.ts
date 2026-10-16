import { existsSync } from 'node:fs';
import { type Browser, type Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { node, open } from './support';

/**
 * The hold (input-rules.md §3) in a table of lines' cell, in every engine. A refused key's hint floats under a cell's
 * box; the cell was made a positioned box only as the hint showed (`td:has(.fd-refusal-hint)`), so its position changed
 * in the middle of the edit being refused — and Firefox, building the cell again, emptied its box: "1x5" read "" and the
 * box took nothing more. Seen by lane B (ea18ae9 failed in Firefox alone). The cell is positioned from the moment its box
 * is entered now.
 */

async function holdInACell(page: Page) {
  const { problems } = await open(page, 'plain', 'page=fields&skin=outlined');
  const table = node(page, 'f-milestones');
  await table.locator('.fd-lines-add').first().click();
  const key = await page.evaluate(() => {
    const lines = (window as any).fieldiaDemo.handle.form.getState().values['milestone_ids'] as { key: string }[];
    return lines[lines.length - 1].key;
  });
  const box = table.locator(`tr[data-line="${key}"] td[data-column="hours"] input`).first();
  await box.click();
  // "1x5": the x refused and the 5 held with it, the box showing what was taken, the hint saying why.
  for (const key of '1x5') await box.press(key);
  await expect(box).toHaveValue('1');
  await expect(table.locator('.fd-refusal-hint:not([hidden])')).toHaveText('Hours: numbers only');
  // Backspace takes the keys held back, one by one; then the box takes keys again.
  await box.press('Backspace');
  await box.press('Backspace');
  await expect(box).toHaveValue('1');
  await box.press('2');
  await expect(box).toHaveValue('12');
  expect(problems).toEqual([]);
}

test.describe('a refused key in a table’s cell', () => {
  test('chromium: is held, never empties the box', async ({ page }) => {
    await holdInACell(page);
  });

  for (const engine of ['firefox', 'webkit'] as const) {
    test(`${engine}: is held, never empties the box`, async ({ playwright, baseURL }) => {
      // Each engine where it is installed: CI's Chromium jobs have Chromium alone; its engine job runs this file too.
      test.skip(!existsSync(playwright[engine].executablePath()), `${engine} is not installed here`);
      const browser: Browser = await playwright[engine].launch();
      try {
        await holdInACell(await browser.newPage({ baseURL }));
      } finally {
        await browser.close();
      }
    });
  }
});
