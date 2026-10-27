import { type Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { node, open, screen } from './support';

/**
 * A table of lines drawn as cards, put in order by a tap. On a phone a card has no grip or handle to drag, and a phone
 * has no Alt key: the replay of the survey's how-to (0.36) found eleven handles in the page, none on show, and no way
 * to move a question up. Each card's ↑ and ↓ move it a place — a grid's where its lines keep an order, a plain table's
 * always — the one that would take it past an end hidden, never disabled; where it went said aloud. At a desk a table
 * is a table, its grip and Alt+↑/↓ moving a line, and no ↑ or ↓ on show. In every engine: each its own touch.
 */

type Line = { key: string; values: Record<string, unknown> };
const linesOf = (page: Page, field: string) => page.evaluate((name) => (window as any).fieldiaDemo.handle.form.getState().values[name] as Line[], field);

test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test('a survey’s questions, a grid’s cards: a question added at the end goes up a place by a tap on its ↑', async ({ page }) => {
    const { problems } = await open(page, 'plain', 'page=real-survey&record=7&skin=underline');
    const questions = node(page, 'f-questions');
    const asked = 'Would you recommend us to a colleague?';
    // Added as a phone adds a line: in its own form — which brings a plain table of its own, its answers, with it.
    await questions.getByRole('button', { name: 'Add a question' }).tap();
    const dialog = page.getByRole('dialog', { name: 'Sections and Questions' });
    await expect(dialog.getByRole('textbox', { name: 'Question' })).toBeFocused();
    await page.keyboard.type(asked);
    await dialog.getByRole('button', { name: 'Save & Close' }).tap();
    await expect(dialog).toBeHidden();
    const titles = () => questions.locator('.fd-line-card > .fd-line-card-title').allTextContents();
    const before = await titles();
    expect(before.slice(-2)).toEqual(['Best day for a follow-up call', asked]);
    const card = questions.locator('.fd-line-card').last();
    const up = card.getByRole('button', { name: `Move ${asked} up` });
    await expect(up).toBeVisible();
    // The last has no ↓; and a ↑ is a finger's size.
    await expect(card.getByRole('button', { name: `Move ${asked} down` })).toBeHidden();
    const size = (await up.boundingBox())!;
    expect(Math.min(size.width, size.height)).toBeGreaterThanOrEqual(32);
    await up.tap();
    await expect.poll(titles).toEqual([...before.slice(0, -2), asked, 'Best day for a follow-up call']);
    await expect(questions.locator('.fd-sr-only[role="status"]')).toHaveText(`${asked} moved to place ${before.length - 1} of ${before.length}`);
    // The form's order too, numbered again as a row dragged by its handle is.
    const kept = await linesOf(page, 'question_and_page_ids');
    expect(kept.slice(-2).map((line) => line.values['title'])).toEqual([asked, 'Best day for a follow-up call']);
    const order = kept.map((line) => line.values['sequence'] as number);
    expect(order).toEqual([...order].sort((a, b) => a - b));
    await card.scrollIntoViewIfNeeded();
    await screen(page, 'line-moves-grid-phone', { viewport: true });
    expect(problems).toEqual([]);
  });

  test('a plain table’s cards: a milestone goes down a place by a tap on its ↓, and back by its ↑', async ({ page }) => {
    const { problems } = await open(page, 'plain', 'page=fields&skin=outlined');
    const table = node(page, 'f-milestones');
    await table.scrollIntoViewIfNeeded();
    await expect(table.locator('.fd-lines')).toHaveAttribute('data-cards', 'narrow');
    const names = async () => (await linesOf(page, 'milestone_ids')).map((line) => line.values['name']);
    expect(await names()).toEqual(['Site survey', 'Design sign-off']);
    const first = table.locator('tbody tr').first();
    // As a card, no grip: its ↓ instead; the first has no ↑.
    await expect(first.locator('.fd-line-grip')).toBeHidden();
    await expect(first.getByRole('button', { name: 'Move Site survey up' })).toBeHidden();
    const down = first.getByRole('button', { name: 'Move Site survey down' });
    await expect(down).toBeVisible();
    const size = (await down.boundingBox())!;
    expect(Math.min(size.width, size.height)).toBeGreaterThanOrEqual(32);
    await down.tap();
    await expect.poll(names).toEqual(['Design sign-off', 'Site survey']);
    await expect(table.locator('.fd-lines > .fd-sr-only[role=status]')).toHaveText('Site survey moved to place 2 of 2');
    await screen(page, 'line-moves-plain-phone', { viewport: true });
    const up = table.locator('tbody tr').nth(1).getByRole('button', { name: 'Move Site survey up' });
    await expect(up).toBeVisible();
    await up.tap();
    await expect.poll(names).toEqual(['Site survey', 'Design sign-off']);
    expect(problems).toEqual([]);
  });
});

test('at a desk, a table is a table: no ↑ or ↓ on show, its grip there to drag', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const { problems } = await open(page, 'plain', 'page=fields&skin=outlined');
  const table = node(page, 'f-milestones');
  await table.scrollIntoViewIfNeeded();
  await expect(table.locator('tbody tr').first().locator('.fd-line-grip')).toBeVisible();
  await expect(table.locator('.fd-line-move:visible')).toHaveCount(0);
  expect(problems).toEqual([]);
});
