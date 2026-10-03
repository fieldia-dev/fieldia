import { expect, test, type Page } from '@playwright/test';
import { drag, tile, watch } from './designer-support';
import { expectNoSidewaysScroll, screen } from './support';

/** A list page built in the screen editor: columns dragged along the row, one dropped in from the toolbox, one taken away; then tried. */
const headings = (page: Page) => page.locator('.fd-list-canvas .fd-list-table th[data-node]');
const heading = (page: Page, label: string) => headings(page).filter({ hasText: label });
const columns = (page: Page) => page.evaluate(() => (window.fieldiaDesigner.designer.getPage().layout as unknown as { columns: string[] }).columns);
const centre = async (page: Page, label: string) => {
  const box = (await heading(page, label).boundingBox())!;
  return { x: box.x + box.width / 2, y: box.y + box.height / 2, left: box.x, right: box.x + box.width };
};

test.describe('screen designer · list', () => {
  test('moves a column along the row, drops a field between two, takes one away, and tries the list', async ({ page }) => {
    const problems = watch(page);
    await page.goto('/screen/?start=list');
    await expect(headings(page)).toHaveText(['Name', 'Email', 'Country', 'Status', 'Credit limit']);
    await expect(page.locator('.fd-list-canvas .fd-search .fd-facet')).toHaveText(['Active']);
    await expect(page.locator('.fd-list-canvas tbody tr')).toHaveCount(5);
    await expect(page.locator('.fd-properties .fd-panel-title')).toHaveText('List');
    await screen(page, 'screen-list-start', { viewport: true });

    // Credit limit carried to just before Email: a line down the table where it lands.
    const from = await centre(page, 'Credit limit');
    const email = await centre(page, 'Email');
    await drag(page, from, { x: email.left + 6, y: email.y + 60 }, { release: false });
    await expect(page.locator('.fd-drop-marker')).toBeVisible();
    await screen(page, 'screen-list-dragging', { viewport: true });
    await page.mouse.up();
    expect(await columns(page)).toEqual(['name', 'credit_limit', 'email', 'country_id', 'state']);

    // Phone from the toolbox, let go between Name and Credit limit.
    const name = await centre(page, 'Name');
    const phone = (await tile(page, 'model:phone').boundingBox())!;
    await drag(page, { x: phone.x + phone.width / 2, y: phone.y + phone.height / 2 }, { x: name.right - 4, y: name.y });
    expect(await columns(page)).toEqual(['name', 'phone', 'credit_limit', 'email', 'country_id', 'state']);
    await expect(tile(page, 'model:phone')).toHaveCount(0);

    // Picked with a click: a bar on it, and the column's panel.
    await heading(page, 'Status').click();
    await expect(heading(page, 'Status')).toHaveClass(/fd-picked/);
    await expect(page.locator('.fd-properties .fd-panel-title')).toHaveText('Column');
    await screen(page, 'screen-list-column-picked', { viewport: true });
    await heading(page, 'Status').getByRole('button', { name: 'Remove the column' }).click();
    expect(await columns(page)).toEqual(['name', 'phone', 'credit_limit', 'email', 'country_id']);
    await expect(page.locator('.fd-properties .fd-panel-title')).toHaveText('List');
    // Status stays on the page all the same: the Active filter reads it.
    await expect(tile(page, 'model:state')).toHaveCount(0);
    await expectNoSidewaysScroll(page);

    // The real list, with the columns as they are now.
    await page.getByRole('button', { name: 'Try it' }).click();
    const tried = page.locator('.fd-try');
    await expect(tried.locator('.fd-list-table th[data-field]')).toHaveText(['Name', 'Phone', 'Credit limit', 'Email', 'Country']);
    await expect(tried.locator('.fd-search .fd-facet')).toContainText(['Active']);
    await screen(page, 'screen-list-tried', { viewport: true });
    expect(problems).toEqual([]);
  });
});
