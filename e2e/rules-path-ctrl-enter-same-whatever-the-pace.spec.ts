import { type Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { node, open } from './support';

/**
 * A path picker (the work item's Iteration) typed with words several records hold — "Sprint 1" is in Sprint 12, 13
 * and 14, and names none of them — then Ctrl+Enter. The input rules (§2, Path picker): Ctrl+Enter is W, "a whole path,
 * or a name only it has"; else "unread: none or several called so". Pressed at once, the save is refused with
 * "nothing is called “Sprint 1”". Pressed once the list of matches has come (a person who reads before saving), the
 * first match the list reached is taken and SAVED — Sprint 12, a record the words do not name. The same keys must
 * give the same save, however fast they are pressed.
 */

const stored = (page: Page) => page.evaluate(() => (window as any).fieldiaDemo.dataSource.records['wi.picker'][1]?.iteration?.label ?? null);
const errors = (page: Page) => page.evaluate(() => (window as any).fieldiaDemo.handle.form.getState().errors as Record<string, string>);

async function typeThenSave(page: Page, pause: number) {
  await open(page, 'plain', 'page=wi-picker');
  const box = node(page, 'f-iteration').locator('input').first();
  await expect(box).toHaveValue('Portal\\Sprint 14');
  await box.click();
  await box.press('Control+A');
  await box.pressSequentially('Sprint 1');
  if (pause) await expect(page.locator('.fd-path-callout:popover-open [role=treeitem]')).toHaveCount(3);
  await box.press('Control+Enter');
  await expect.poll(async () => (await errors(page))['iteration'] ?? (await stored(page))).not.toBe('Sprint 14');
  return { saved: await stored(page), refused: (await errors(page))['iteration'] ?? null };
}

test('Ctrl+Enter on words three iterations hold, once their list has come, never saves one of them', async ({ page }) => {
  const afterTheList = await typeThenSave(page, 1);
  // Pressed before the list (or the tree) came, the same keys are refused: "nothing is called “Sprint 1”".
  expect(afterTheList, 'never Sprint 12, a record the words do not name').toEqual({ saved: 'Sprint 14', refused: expect.stringContaining('Sprint 1') });
});
