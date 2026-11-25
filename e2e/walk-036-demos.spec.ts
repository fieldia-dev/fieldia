import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { screen } from './support';

/**
 * The gallery as the owner's walk of 0.36 met it, where what was wrong was the demo's own page rather than Fieldia's: an
 * activity log entry's page had no way back of its own, only the browser's Back (its nitpick 13). Fieldia draws the
 * trail an app gives a record (`breadcrumbs`), as the vendor bill's and the real pages' show it; the demos gave none to a
 * record opened from its list's row. Now every list's row opens its record with the list's name over it, back to the
 * list where it was left.
 */

const trail = (page: Page) => page.getByRole('navigation', { name: 'Breadcrumbs' });

test('an entry opened from the activity log has its own way back: the log’s name over it, back to the log where it was left', async ({ page }) => {
  await page.goto('/plain/?page=activity-log&skin=underline');
  const rows = page.locator('.fd-list-row');
  await expect(rows.first()).toBeVisible();
  // Far enough down that a way back to the log's top would show.
  const count = page.locator('.fd-pager-text');
  for (let i = 0; i < 3; i++) await page.mouse.wheel(0, 1500);
  await expect(count).not.toHaveText(/^1–30 /);
  // The rows the scroll asked for all come before the entry is read: its count the same a moment later.
  await expect
    .poll(async () => {
      const before = await count.innerText();
      await page.waitForTimeout(400);
      return (await count.innerText()) === before;
    })
    .toBe(true);
  const read = () =>
    page.evaluate(() => {
      const row = document.elementFromPoint(innerWidth / 2, innerHeight / 2)?.closest<HTMLElement>('.fd-list-row');
      return row ? { id: row.dataset['id'] as string, top: Math.round(row.getBoundingClientRect().top), range: document.querySelector('.fd-pager-text')?.textContent } : null;
    });
  const left = (await read())!;
  expect(left).not.toBeNull();
  await page.locator(`.fd-list-row[data-id="${left.id}"]`).click({ position: { x: 40, y: 10 } });
  await expect(page).toHaveURL(new RegExp(`page=activity-entry.*record=${left.id}`));
  // The log's own name, as the app's other records show the trail to theirs, then the entry's.
  await expect(trail(page).getByRole('link', { name: 'What the team did' })).toBeVisible();
  await expect(trail(page).locator('[aria-current="page"]')).toHaveText(/\S/);
  await screen(page, 'walk-036-activity-entry-way-back');
  await trail(page).getByRole('link', { name: 'What the team did' }).click();
  // Back in the log where it was left: its rows loaded, the entry at its place, the keyboard on it.
  await expect(page).toHaveURL(/page=activity-log/);
  const entry = page.locator(`.fd-list-row[data-id="${left.id}"]`);
  await expect(entry).toBeFocused();
  await expect(count).toHaveText(left.range as string);
  await expect.poll(async () => Math.abs(((await entry.boundingBox())?.y ?? -1e6) - left.top)).toBeLessThanOrEqual(2);
});

test('an entry opened from a link of its own goes back to the log’s own address, the log at its top', async ({ page }) => {
  // No log before it in this tab: a link shared, or opened in a tab of its own.
  await page.goto('/plain/?page=activity-entry&skin=outlined&record=708&from=activity-log');
  await trail(page).getByRole('link', { name: 'What the team did' }).click();
  await expect(page).toHaveURL(/[?&]page=activity-log(&|$)/);
  await expect(page).toHaveURL(/skin=outlined/);
  await expect(page).not.toHaveURL(/record=|from=/);
  await expect(page.locator('.fd-pager-text')).toHaveText(/^1–30 of 1,284 entries$/);
});

test('every list whose rows open a record gives it that way back, by the list’s own name', async ({ page }) => {
  for (const [list, name, record] of [
    ['contacts', 'Contacts', 'contact'],
    ['chart-of-accounts', 'Chart of accounts', 'account'],
    ['leads-queue', 'Leads to follow up', 'lead'],
    ['orders-review', 'Orders to review', 'order'],
  ] as const) {
    await page.goto(`/plain/?page=${list}&skin=underline`);
    const row = page.locator('.fd-list-row[data-id]').first();
    await expect(row).toBeVisible();
    await row.click({ position: { x: 40, y: 10 } });
    await expect(page, list).toHaveURL(new RegExp(`page=${record}&`));
    await expect(trail(page).getByRole('link', { name }), list).toBeVisible();
  }
});
