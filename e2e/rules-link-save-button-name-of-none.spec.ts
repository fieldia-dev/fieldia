import { type Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { node, open } from './support';

/**
 * The Save button pressed straight from a box that picks by name, holding words that name nothing
 * (docs/plans/input-rules.md §2: Save = "L, then W" for a link, its tags and a reference; CHANGELOG 0.21.0: "a link,
 * tags of links, a reference, a path and a choice typed by name are read by … Save … : the save … refuses with
 * “nothing is called …”, never saving the one it was replacing"; the unit names-save.spec.ts "left for the Save
 * button, its lookup on its way: the save waits, and refuses words that name none, kept").
 *
 * The box is left as the button is pressed. Its lookup answers before the click lands when the data source is quick
 * (the demo's memory source; a server on a short line), and leaving then puts back what the box held — so the save
 * goes through with the record the words were replacing, over words that name none, and the words are gone from the
 * box. With a slow source the very same press is refused. It must be refused either way.
 */

const values = (page: Page) => page.evaluate(() => (window as any).fieldiaDemo.handle.form.getState().values);
const saves = (page: Page) => page.evaluate(() => ((window as any).fieldiaDemo.dataSource.calls ?? []).filter((c: { method: string }) => c.method === 'save').length);
const errors = (page: Page) => page.evaluate(() => (window as any).fieldiaDemo.handle.form.getState().errors as Record<string, string>);

/** Something else changed first, so the Save button shows. */
async function changeTheName(page: Page) {
  const name = node(page, 'f-name').locator('input').first();
  await name.click();
  await name.press('End');
  await name.pressSequentially(' x');
  await name.press('Tab');
}

for (const [id, field, typed, what] of [
  ['f-client', 'client_id', 'Narnia', 'a link holding a name of none'],
  ['f-client', 'client_id', 'Bayt', 'a link holding part of its only match’s name (leaving takes an exact name only)'],
  ['f-tags', 'tag_ids', 'Retail', 'tags of links holding a name of none'],
  ['f-source', 'source', 'Narnia', 'a reference holding a name of none'],
] as const) {
  test(`the Save button pressed from ${what} refuses the save, the words kept, never saving what the box held`, async ({ page }) => {
    const { problems } = await open(page, 'plain', 'page=fields&skin=outlined');
    await changeTheName(page);
    const box = node(page, id).locator('input[role="combobox"]');
    await box.click();
    await box.press('Control+A');
    await box.pressSequentially(typed);
    const held = (await values(page))[field];
    const before = await saves(page);
    await page.locator('.fd-form button[type="submit"].fd-button-primary').first().click();
    await expect.poll(async () => (await errors(page))[field] ?? '', 'the save is refused under the box').toContain(typed);
    expect(await saves(page), 'nothing saved').toBe(before);
    expect((await values(page))[field]).toEqual(held);
    await expect(box).toHaveValue(typed);
    expect(problems).toEqual([]);
  });
}

test('the Save button pressed while a grid’s product cell holds a name of none refuses the save, never saving the product it held', async ({ page }) => {
  const { problems } = await open(page, 'plain', 'page=order&skin=outlined');
  const grid = node(page, 'f-lines');
  const cell = (row: number, column: string) => grid.locator(`.ag-row[row-index="${row}"] .ag-cell[col-id="${column}"]`);
  // Another line's description changed first, so the Save button shows.
  await cell(2, 'name').dblclick();
  const words = grid.locator('.fd-grid-editor input').first();
  await words.press('End');
  await words.pressSequentially('!');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Escape');
  await cell(1, 'product_id').dblclick();
  const box = grid.locator('.fd-grid-editor input[role="combobox"]');
  await expect(box).toBeFocused();
  await box.press('Control+A');
  await box.pressSequentially('Narnia');
  const before = await saves(page);
  await page.locator('.fd-form button[type="submit"].fd-button-primary').first().click();
  await expect.poll(async () => Object.entries(await errors(page)).find(([path]) => path.endsWith('.product_id'))?.[1] ?? '', 'the save is refused at the cell').toContain('Narnia');
  expect(await saves(page), 'nothing saved').toBe(before);
  expect(problems).toEqual([]);
});
