import type { Page } from '@playwright/test';
import { axeFindings } from './a11y-support';
import { expect, test } from './fixtures';
import { screen } from './support';

/**
 * Deleting in the designers, findable (the owner's walk of 23 Oct: "no way to delete a question" — the bin showed only
 * once a question was picked, an icon at its card's foot). A picked question's bin says "Delete question"; a question
 * not picked shows a ⋮ where it is pointed at or the keys reach it, with Duplicate, Delete question and its moves; a
 * picked page's bin says "Delete page". Delete asks nothing: "Question deleted · Undo" comes at the foot of the
 * screen, and Undo brings it back. The screen designer's deletes say so the same way.
 */

const toast = (page: Page) => page.locator('.fd-deleted-says');
const questions = (page: Page) => page.locator('.fd-q');

test.describe('the survey designer: a question deleted, findable, with Undo', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/designer/?start=survey');
    await expect(questions(page).first()).toBeVisible();
  });

  test('a question picked: its bin says “Delete question”; pressed, it goes, and Undo brings it back', async ({ page }) => {
    const before = await questions(page).count();
    const card = page.locator('.fd-q-closed').filter({ hasText: 'How would you rate it?' });
    await card.click();
    const bin = page.locator('.fd-q-selected').getByRole('button', { name: 'Delete question' });
    await expect(bin).toBeVisible();
    await expect(bin).toHaveText('Delete question');
    await screen(page, 'designer-delete-picked', { viewport: true });
    await bin.click();
    await expect(questions(page)).toHaveCount(before - 1);
    await expect(page.locator('.fd-q').filter({ hasText: 'How would you rate it?' })).toHaveCount(0);
    // Nothing asked: said at the foot of the screen, with Undo.
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(toast(page)).toHaveText('Question deletedUndo');
    const shown = (await toast(page).locator('.fd-say').boundingBox())!;
    expect(shown.y + shown.height).toBeGreaterThan(900 - 80);
    await screen(page, 'designer-delete-toast', { viewport: true });
    expect(await axeFindings(page, 'a question deleted, its toast', '.fd-deleted-says')).toEqual([]);
    await toast(page).getByRole('button', { name: 'Undo' }).click();
    await expect(questions(page)).toHaveCount(before);
    // Back, picked, the cursor in its words.
    await expect(page.locator('.fd-q-selected .fd-q-label')).toHaveValue('How would you rate it?');
    await expect(page.locator('.fd-q-selected .fd-q-label')).toBeFocused();
    await expect(toast(page).locator('.fd-say')).toHaveCount(0);
  });

  test('a question not picked: a ⋮ where it is pointed at, with Duplicate, Delete question, and its moves', async ({ page }) => {
    const card = page.locator('.fd-q-closed').filter({ hasText: 'How easy was each part?' });
    await card.scrollIntoViewIfNeeded();
    const tools = card.getByRole('button', { name: 'Question tools' });
    await expect(tools).toHaveCSS('opacity', '0');
    await card.hover();
    await expect(tools).toHaveCSS('opacity', '1');
    await screen(page, 'designer-delete-hover', { viewport: true });
    await tools.click();
    const menu = page.getByRole('menu', { name: 'Question tools' });
    await expect(menu.getByRole('menuitem')).toHaveText(['Duplicate', 'Delete question', 'Move up', 'Move down']);
    // Its tools, not the card opening under them.
    await expect(page.locator('.fd-q-selected')).toHaveCount(0);
    const before = await questions(page).count();
    await menu.getByRole('menuitem', { name: 'Delete question' }).click();
    await expect(questions(page)).toHaveCount(before - 1);
    await expect(toast(page)).toHaveText('Question deletedUndo');
    await toast(page).getByRole('button', { name: 'Undo' }).click();
    await expect(questions(page)).toHaveCount(before);
  });

  test('by the keys alone: Tab reaches a question’s words and its ⋮; the Delete key takes the picked one away', async ({ page }) => {
    const card = page.locator('.fd-q-closed').filter({ hasText: 'What do you like?' });
    const words = card.getByRole('button', { name: 'What do you like?', exact: true });
    await words.focus();
    await page.keyboard.press('Tab');
    const tools = card.getByRole('button', { name: 'Question tools' });
    await expect(tools).toBeFocused();
    await expect(tools).toHaveCSS('opacity', '1');
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Enter');
    const label = page.locator('.fd-q-selected .fd-q-label');
    await expect(label).toHaveValue('What do you like?');
    // Picked, with the focus out of its words: Delete.
    await page.locator('.fd-q-selected .fd-q-kind').focus();
    await page.keyboard.press('Delete');
    await expect(page.locator('.fd-q').filter({ hasText: 'What do you like?' })).toHaveCount(0);
    await expect(toast(page)).toHaveText('Question deletedUndo');
  });

  test('a page picked: its bin says “Delete page”; deleted, Undo brings it back', async ({ page }) => {
    const steps = page.locator('.fd-design-step');
    const before = await steps.count();
    const second = steps.nth(1);
    await second.locator('.fd-step-title').click();
    const bin = second.getByRole('button', { name: 'Delete page' });
    await expect(bin).toHaveText('Delete page');
    await bin.click();
    await expect(steps).toHaveCount(before - 1);
    await expect(toast(page)).toHaveText('Page deletedUndo');
    await toast(page).getByRole('button', { name: 'Undo' }).click();
    await expect(steps).toHaveCount(before);
  });
});

test('on a phone, the bin is its icon, named for a screen reader; the toast clear of the bar at the foot', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/designer/?start=survey');
  const card = page.locator('.fd-q-closed').filter({ hasText: 'How would you rate it?' });
  await card.scrollIntoViewIfNeeded();
  await card.click();
  const bin = page.locator('.fd-q-selected').getByRole('button', { name: 'Delete question' });
  await bin.scrollIntoViewIfNeeded();
  await expect(bin.locator('.fd-q-tool-words')).toBeHidden();
  expect((await bin.boundingBox())!.width).toBeLessThanOrEqual(44);
  await screen(page, 'designer-delete-phone', { viewport: true });
  await bin.click();
  await expect(toast(page)).toHaveText('Question deletedUndo');
  const undo = toast(page).getByRole('button', { name: 'Undo' });
  await expect(undo).toBeVisible();
  // Over the + at the foot of the screen, never on it.
  const [said, rail] = [(await toast(page).locator('.fd-say').boundingBox())!, (await page.locator('.fd-q-rail').boundingBox())!];
  expect(said.y + said.height).toBeLessThanOrEqual(rail.y);
  await screen(page, 'designer-delete-phone-toast', { viewport: true });
  await undo.click();
  // Back, picked: its words in their box.
  await expect(page.locator('.fd-q-selected .fd-q-label')).toHaveValue('How would you rate it?');
});

test('the screen designer: the bar’s Delete says “Field deleted”, with Undo', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/screen/');
  const notes = page.locator('.fd-canvas-field').filter({ hasText: 'Notes' }).first();
  await notes.click();
  await page.locator('.fd-field-bar').getByRole('button', { name: 'Delete' }).click();
  await expect(page.locator('.fd-canvas-field').filter({ hasText: 'Notes' })).toHaveCount(0);
  await expect(toast(page)).toHaveText('Field deletedUndo');
  await toast(page).getByRole('button', { name: 'Undo' }).click();
  // Back, picked, the cursor in its words.
  const label = page.locator('.fd-canvas-field.fd-editing .fd-canvas-label-input');
  await expect(label).toHaveValue('Notes');
  await expect(label).toBeFocused();
});
