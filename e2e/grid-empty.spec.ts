import { type Locator, type Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { expectNoSidewaysScroll, node, screen } from './support';

/**
 * A table of lines with no lines yet, drawn by the grid (shared/empty-grids.ts): it says so in its body — "No lines
 * yet" — clear of its header and, where it has one, of the totals row under its lines; with or without a totals row,
 * in every engine, on a desktop and on a phone.
 */

const box = async (element: Locator) => (await element.boundingBox()) as { x: number; y: number; width: number; height: number };

/** Where the words stand against the grid's header, its body and its totals row: each edge, in pixels. */
async function placed(page: Page, id: string) {
  const grid = node(page, id);
  const words = grid.locator('.fd-grid-empty');
  await expect(words).toBeVisible();
  await expect(words).toHaveText('No lines yet');
  // AG Grid's parts: its header, the rows that scroll (the body), the rows pinned under them (the totals).
  const [said, header, body] = await Promise.all([box(words), box(grid.locator('.ag-header')), box(grid.locator('.ag-grid-scrolling-rows'))]);
  const totals = grid.locator('.ag-grid-pinned-bottom-rows');
  const totalsShown = (await totals.count()) > 0 && (await totals.evaluate((el) => el.getBoundingClientRect().height > 0 && getComputedStyle(el).display !== 'none'));
  const under = totalsShown ? await box(totals) : null;
  return { said, header, body, under };
}

test.describe('an empty table of lines drawn by the grid', () => {
  for (const [width, height] of [[1440, 900], [390, 844]] as const) {
    test(`says it is empty in its body, clear of its header and its totals row, at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      const problems: string[] = [];
      page.on('pageerror', (error) => problems.push(error.message));
      await page.goto('/plain/?page=empty-grids&skin=underline');
      for (const [id, withTotals] of [['f-lines', true], ['f-notes', false]] as const) {
        const { said, header, body, under } = await placed(page, id);
        expect(!!under, `${id} has a totals row`).toBe(withTotals);
        // Under the header, and inside the body where its lines would be.
        expect(said.y, `${id}: the words start under the header`).toBeGreaterThanOrEqual(header.y + header.height - 0.5);
        expect(said.y, `${id}: the words start inside the body`).toBeGreaterThanOrEqual(body.y - 0.5);
        expect(said.y + said.height, `${id}: the words end inside the body`).toBeLessThanOrEqual(body.y + body.height + 0.5);
        // Over the totals row, never across the line above it.
        if (under) expect(said.y + said.height, `${id}: the words end over the totals row`).toBeLessThanOrEqual(under.y + 0.5);
        // In the middle of the body, where its first line would be.
        expect(Math.abs(said.y + said.height / 2 - (body.y + body.height / 2)), `${id}: the words sit in the middle of the body`).toBeLessThanOrEqual(3);
        await node(page, id).scrollIntoViewIfNeeded();
        await screen(page, `grid-empty-${id === 'f-lines' ? 'totals' : 'plain'}-${width}`, { viewport: true });
      }
      if (width === 390) await expectNoSidewaysScroll(page);
      expect(problems).toEqual([]);
    });
  }
});
