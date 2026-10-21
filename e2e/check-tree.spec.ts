import { expect, test } from './fixtures';
import { node, open, screen } from './support';

/**
 * A buyer's areas wanted on a lead: a tree to tick — all of Nasr City kept as itself, two neighbourhoods of New Cairo —
 * a district ticking all its neighbourhoods, part-ticked while some are, searched, moved and ticked by the keys of a
 * tree, right to left too; and saved as the field keeps it.
 */

const held = (page: import('@playwright/test').Page) => page.evaluate(() => ((window as any).fieldiaDemo.handle.form.getState().values.areas ?? []).map((record: { label: string }) => record.label) as string[]);
const row = (page: import('@playwright/test').Page, name: string) => node(page, 'f-areas').getByRole('treeitem', { name, exact: true });

test.describe('a checkbox tree', () => {
  test('a lead’s areas: a district ticked whole, a neighbourhood searched, moved by the keys', async ({ page }) => {
    const { problems } = await open(page, 'plain', 'page=lead&record=1&skin=underline');
    const tree = node(page, 'f-areas').getByRole('tree');
    await expect(tree).toHaveAttribute('aria-multiselectable', 'true');
    // As the lead holds them: Nasr City whole, New Cairo part-ticked, both opened to show it.
    await expect(row(page, 'Nasr City')).toHaveAttribute('aria-checked', 'true');
    await expect(row(page, 'New Cairo')).toHaveAttribute('aria-checked', 'mixed');
    await expect(row(page, 'Rehab')).toHaveAttribute('aria-checked', 'true');
    await expect(node(page, 'f-areas').locator('.fd-tree-count')).toHaveText('3 chosen');
    await screen(page, 'check-tree-lead');

    // New Cairo ticked whole: kept as itself, its neighbourhoods with it.
    await row(page, 'New Cairo').click();
    await expect(row(page, 'New Cairo')).toHaveAttribute('aria-checked', 'true');
    expect(await held(page)).toEqual(['New Cairo', 'Nasr City']);

    // Searched: the neighbourhood found, with the district it is in.
    const search = node(page, 'f-areas').getByRole('searchbox');
    await search.fill('degla');
    await expect(node(page, 'f-areas').getByRole('treeitem')).toHaveText(['Maadi', 'Degla']);
    await page.keyboard.press('ArrowDown');
    await expect(row(page, 'Maadi')).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Space');
    expect(await held(page)).toEqual(['New Cairo', 'Nasr City', 'Degla']);
    await expect(row(page, 'Maadi')).toHaveAttribute('aria-checked', 'mixed');
    await search.fill('');

    // The keys of a tree: ← closes a branch or goes up, → opens it or goes in.
    await row(page, 'Heliopolis').focus();
    await page.keyboard.press('ArrowRight');
    await expect(row(page, 'Heliopolis')).toHaveAttribute('aria-expanded', 'true');
    await page.keyboard.press('ArrowRight');
    await expect(row(page, 'Korba')).toBeFocused();
    await page.keyboard.press('ArrowLeft');
    await expect(row(page, 'Heliopolis')).toBeFocused();
    await screen(page, 'check-tree-keys');

    // Saved as the field keeps it: a whole district as itself, a neighbourhood alone — in the source's order, the tree
    // drawing them the same.
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect.poll(() => page.evaluate(() => (window as any).fieldiaDemo.handle.form.getState().dirty)).toEqual([]);
    expect((await held(page)).sort()).toEqual(['Degla', 'Nasr City', 'New Cairo']);
    await expect(row(page, 'New Cairo')).toHaveAttribute('aria-checked', 'true');
    await expect(node(page, 'f-areas').locator('.fd-tree-count')).toHaveText('3 chosen');
    expect(problems).toEqual([]);
  });

  test('right to left, in Arabic: the tree mirrored, ← opening a branch', async ({ page }) => {
    const { problems } = await open(page, 'plain', 'page=lead&record=1&skin=underline&locale=ar');
    await expect(node(page, 'f-areas').getByRole('searchbox')).toHaveAttribute('aria-label', 'البحث في Areas wanted');
    await row(page, 'Maadi').focus();
    await page.keyboard.press('ArrowLeft');
    await expect(row(page, 'Maadi')).toHaveAttribute('aria-expanded', 'true');
    await expect(node(page, 'f-areas').locator('.fd-tree-count')).toHaveText('اختير 3');
    await screen(page, 'check-tree-arabic');
    expect(problems).toEqual([]);
  });
});
