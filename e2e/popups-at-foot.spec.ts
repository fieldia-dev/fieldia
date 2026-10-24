import { type Locator, type Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { node, open } from './support';

/**
 * A popup opened from a box near the window's foot (the owner's Customer record: a phone's countries opened from its
 * Contacts table ran off the window). Every popup Fieldia opens from a box — its own list, a link's list and its Search
 * more…, the country list, a date's calendar, a filter's menu, the search's suggestions — opens over its box where
 * there is not room under it and more over it, and stays inside the window. Each box is put near the foot as a person
 * scrolls to it: the page given room over its form, so any box can be scrolled there.
 */

const HEIGHT = 800;
let problems: string[] = [];
test.afterEach(() => expect(problems).toEqual([]));

/** The box scrolled until its foot is 40px over the window's. */
async function nearTheFoot(page: Page, box: Locator) {
  await page.evaluate(() => {
    const form = document.querySelector('.fd-form') as HTMLElement;
    const room = document.createElement('div');
    room.style.height = '1600px';
    form.parentElement?.insertBefore(room, form);
  });
  await box.scrollIntoViewIfNeeded();
  const at = (await box.boundingBox())!;
  await page.evaluate((by) => window.scrollBy(0, by), Math.round(at.y + at.height - (HEIGHT - 40)));
  await expect.poll(async () => Math.round(((await box.boundingBox())!.y + (await box.boundingBox())!.height) - HEIGHT)).toBeGreaterThan(-60);
}

/** The popup over its box, and inside the window. */
async function overItsBox(popup: Locator, box: Locator, what: string) {
  await expect(popup, what).toBeVisible();
  const [p, b] = [(await popup.boundingBox())!, (await box.boundingBox())!];
  expect(p.y + p.height, `${what}: its foot over its box`).toBeLessThanOrEqual(b.y + 1);
  expect(p.y, `${what}: inside the window`).toBeGreaterThanOrEqual(0);
  expect(p.y + p.height, `${what}: inside the window`).toBeLessThanOrEqual(HEIGHT);
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: HEIGHT });
});

test('the country list, a link’s list, its Search more… and a date’s calendar, on Every field', async ({ page }) => {
  ({ problems } = await open(page, 'plain', 'page=fields&skin=outlined'));
  const flag = node(page, 'f-phone').locator('.fd-phone-country');
  await nearTheFoot(page, flag);
  await flag.click();
  await overItsBox(page.locator('.fd-lookup-list:not([hidden])'), flag, 'the country list');
  await page.keyboard.press('Escape');

  const client = node(page, 'f-client').locator('input').first();
  await nearTheFoot(page, client);
  await client.click();
  await client.fill('a');
  const links = page.locator('.fd-listbox:not([hidden])');
  await overItsBox(links, client, 'a link’s list');
  await links.getByText('Search more…').click();
  const dialog = page.getByRole('dialog', { name: 'Client' });
  await expect(dialog).toBeVisible();
  const d = (await dialog.boundingBox())!;
  expect(d.y).toBeGreaterThanOrEqual(0);
  expect(d.y + d.height).toBeLessThanOrEqual(HEIGHT);
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();

  const start = node(page, 'f-start');
  await nearTheFoot(page, start);
  await start.locator('.fd-calendar-button').click();
  await overItsBox(start.locator('.fd-calendar:not([hidden])'), start.locator('input').first(), 'a date’s calendar');
});

test('Fieldia’s own list, on a work item', async ({ page }) => {
  ({ problems } = await open(page, 'plain', 'page=wi-picker'));
  const severity = node(page, 'f-severity').locator('.fd-own-box');
  await nearTheFoot(page, severity);
  await severity.click();
  await overItsBox(page.locator('.fd-own-list:not([hidden])'), severity, 'its own list');
  await page.keyboard.press('Escape');
});

test('a filter’s menu and the search’s suggestions, on lists', async ({ page }) => {
  ({ problems } = await open(page, 'plain', 'page=homes-search&skin=underline'));
  const kind = page.locator('.fd-filter-pick[data-field="kind"]');
  await nearTheFoot(page, kind);
  await kind.click();
  await overItsBox(page.locator('.fd-filter-field[data-field="kind"] .fd-filter-menu'), kind, 'a filter’s menu');
  await page.keyboard.press('Escape');

  ({ problems } = await open(page, 'plain', 'page=customers&skin=underline'));
  const search = page.getByRole('combobox', { name: 'Search' });
  await nearTheFoot(page, search);
  await search.pressSequentially('egy');
  await overItsBox(page.getByRole('listbox', { name: 'Search' }), search, 'the search’s suggestions');
});

test('room under the box: it opens under it, as before', async ({ page }) => {
  ({ problems } = await open(page, 'plain', 'page=fields&skin=outlined'));
  const flag = node(page, 'f-phone').locator('.fd-phone-country');
  // Near the window's top: the list's room is under it.
  const at = (await flag.boundingBox())!;
  await page.evaluate((by) => window.scrollBy(0, by), Math.round(at.y - 120));
  await expect.poll(async () => Math.round((await flag.boundingBox())!.y)).toBeLessThan(200);
  await flag.click();
  const list = page.locator('.fd-lookup-list:not([hidden])');
  await expect(list).toBeVisible();
  const [p, b] = [(await list.boundingBox())!, (await flag.boundingBox())!];
  expect(p.y).toBeGreaterThanOrEqual(b.y + b.height - 1);
});
