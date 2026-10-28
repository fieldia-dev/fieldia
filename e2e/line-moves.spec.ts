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
    // Titled as its card is headed while it has no words: by its place among the questions, never the table's plural.
    const dialog = page.getByRole('dialog', { name: 'Line 11' });
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

  test('a card moved by its ↑ stays where the eye is, its ↑ in sight with the focus — twice, as a person moves it', async ({ page }) => {
    // As the 0.36 walk had it on an iPhone (WebKit): the demo's frame as a person's browser shows it, a question added at
    // the end, then ↑ — which threw the page to its top, the card 2,400 px under the screen (WebKit scrolled to the button
    // it focused again from a layout not yet worked out). Chromium kept the page still and let the card go up out of the
    // eye's place. Now the page goes with the card in every engine.
    await page.addInitScript(() => Object.defineProperty(Navigator.prototype, 'webdriver', { get: () => false }));
    const { problems } = await open(page, 'plain', 'page=real-survey&record=7&skin=underline');
    const questions = node(page, 'f-questions');
    const asked = 'Would you recommend us to a colleague?';
    await questions.getByRole('button', { name: 'Add a question' }).tap();
    const dialog = page.getByRole('dialog', { name: 'Line 11' });
    await expect(dialog.getByRole('textbox', { name: 'Question' })).toBeFocused();
    await page.keyboard.type(asked);
    await dialog.getByRole('button', { name: 'Save & Close' }).tap();
    await expect(dialog).toBeHidden();
    const count = await questions.locator('.fd-line-card').count();
    const card = questions.locator('.fd-line-card', { hasText: asked });
    const up = card.getByRole('button', { name: `Move ${asked} up` });
    for (const place of [count - 1, count - 2]) {
      await up.scrollIntoViewIfNeeded();
      const before = (await card.boundingBox())!.y;
      await up.tap();
      await expect(questions.locator('.fd-sr-only[role="status"]')).toHaveText(`${asked} moved to place ${place} of ${count}`);
      // Where it was on the screen, give or take a pixel, a moment on too; its ↑ there, with the focus.
      await expect.poll(async () => Math.abs((await card.boundingBox())!.y - before)).toBeLessThanOrEqual(1);
      await page.evaluate(() => new Promise((done) => setTimeout(done, 300)));
      expect(Math.abs((await card.boundingBox())!.y - before)).toBeLessThanOrEqual(1);
      await expect(up).toBeFocused();
      await expect(up).toBeInViewport();
    }
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
    const before = (await first.boundingBox())!.y;
    await down.tap();
    await expect.poll(names).toEqual(['Design sign-off', 'Site survey']);
    // The card went down a place and stayed where the eye is: the page went with it.
    const moved = table.locator('tbody tr').nth(1);
    await expect.poll(async () => Math.abs((await moved.boundingBox())!.y - before)).toBeLessThanOrEqual(1);
    await expect(table.locator('.fd-lines > .fd-sr-only[role=status]')).toHaveText('Site survey moved to place 2 of 2');
    await screen(page, 'line-moves-plain-phone', { viewport: true });
    const up = table.locator('tbody tr').nth(1).getByRole('button', { name: 'Move Site survey up' });
    await expect(up).toBeVisible();
    await up.tap();
    await expect.poll(names).toEqual(['Site survey', 'Design sign-off']);
    expect(problems).toEqual([]);
  });
});

test.describe('on a phone, the other things a tap moves', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test('a ranking’s choice and a repeating group’s card, moved by a tap, stay where the eye is', async ({ page }) => {
    const { problems } = await open(page, 'plain', 'page=kinds&skin=outlined');
    const ranking = node(page, 'q-priorities');
    const first = ranking.locator('.fd-rank-item').first();
    await first.scrollIntoViewIfNeeded();
    const words = (await first.locator('.fd-rank-words').textContent())!.trim();
    const before = (await first.boundingBox())!.y;
    await ranking.getByRole('button', { name: `Move ${words} down` }).tap();
    await expect(ranking.locator('.fd-rank-item').nth(1)).toContainText(words);
    await expect.poll(async () => Math.abs((await ranking.locator('.fd-rank-item').nth(1).boundingBox())!.y - before)).toBeLessThanOrEqual(1);
    const group = node(page, 'q-movers');
    const add = group.getByRole('button', { name: 'Add a person' });
    await add.scrollIntoViewIfNeeded();
    await add.tap();
    await add.tap();
    const card = group.locator('.fd-repeat-card').first();
    const key = (await card.getAttribute('data-line'))!;
    await card.scrollIntoViewIfNeeded();
    const top = (await card.boundingBox())!.y;
    await card.getByRole('button', { name: 'Move Person 1 down' }).tap();
    const moved = group.locator(`.fd-repeat-card[data-line="${key}"]`);
    await expect(group.locator('.fd-repeat-card').nth(1)).toHaveAttribute('data-line', key);
    await expect.poll(async () => Math.abs((await moved.boundingBox())!.y - top)).toBeLessThanOrEqual(1);
    expect(problems).toEqual([]);
  });

  test('a photo made the cover by its tap is in sight with the focus, the page gone with it as far as it can go', async ({ page }) => {
    const { problems } = await open(page, 'plain', 'page=listing-photo-set&skin=outlined');
    const photos = node(page, 'f-photos').locator('.fd-photo');
    const count = await photos.count();
    const last = photos.last();
    await last.scrollIntoViewIfNeeded();
    const before = (await last.boundingBox())!.y;
    await last.locator('[data-tool="cover"]').tap();
    await expect(photos.first().locator('.fd-photo-cover')).toBeVisible();
    const cover = photos.first();
    // Where the eye is, unless the page's top came first: the page went up with it as far as it can.
    await expect.poll(async () => Math.abs((await cover.boundingBox())!.y - before) <= 1 || (await page.evaluate(() => scrollY)) === 0).toBe(true);
    await expect(cover).toBeInViewport();
    await expect(cover.locator('.fd-photo-open')).toBeFocused();
    expect(count).toBeGreaterThan(2);
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
