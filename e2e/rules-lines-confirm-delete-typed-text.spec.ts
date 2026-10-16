import { type Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { node, open } from './support';

/**
 * A table of lines that asks before a line with something in it goes (`options.confirmDelete`, the fields demo's
 * Milestones). A line whose only content is text typed that does not read — "1x5" in Hours, kept unread with why
 * (input rules §2, "Table of lines": each cell is its kind's box) — or a name still typed in its Owner, is taken away
 * at once by its ×, with no question: the delete button looks at the line's values only (lines-table.ts:
 * `cells.every(isEmpty(values[...]))`), never at what was typed. Typed "15", the same line asks first. What was typed
 * is lost without the question the table promises.
 */

const keys = (page: Page) => page.evaluate(() => ((window as any).fieldiaDemo.handle.form.getState().values['milestone_ids'] ?? []).map((l: { key: string }) => l.key));

for (const [column, typed] of [
  ['hours', '1x5'],
  ['owner_id', 'Narnia'],
] as const) {
  test(`a new line holding only “${typed}” typed in ${column} asks before its × takes it away`, async ({ page }) => {
    const { problems } = await open(page, 'plain', 'page=fields&skin=outlined');
    const table = node(page, 'f-milestones');
    await table.locator('.fd-lines-add').first().click();
    const all = await keys(page);
    const key = all[all.length - 1];
    const row = table.locator(`tr[data-line="${key}"]`);
    const box = row.locator(`td[data-column="${column}"] input`).first();
    await box.click();
    await box.pressSequentially(typed);
    await row.locator('.fd-line-delete').click();
    // Asked first, in place ("Remove line …?  Remove · Keep"): the line is still there until the answer.
    await expect(table.getByText(/Remove line/)).toBeVisible({ timeout: 2000 });
    expect(await keys(page)).toContain(key);
    expect(problems).toEqual([]);
  });
}
