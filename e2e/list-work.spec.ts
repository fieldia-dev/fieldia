import { type Page } from '@playwright/test';
import { axeFindings } from './a11y-support';
import { expect, test } from './fixtures';
import { expectNoSidewaysScroll, open, screen } from './support';

/**
 * Lists people work in all day, as they use them: the customers ordered by several headers (Shift and a press, or Shift
 * and Enter on a header), and a sales team's queue whose saved views are kept on its server — the team's put on, one
 * saved for the team and deleted again. What each order should be is worked out here from the demo's own records,
 * never written down from the screen.
 */

type Values = Record<string, unknown>;
const CUSTOMERS = 'page=customers&skin=underline';
const NOW = 'now=2026-10-14T09:40';
const LEADS = `page=leads-queue&skin=underline&${NOW}`;

const names = (page: Page) => page.locator('.fd-list-row td:nth-child(2)');
const header = (page: Page, words: string) => page.locator('.fd-list-table thead th', { has: page.locator('.fd-list-head', { hasText: new RegExp(`^${words}$`) }) });
const records = async (page: Page, model: string) => Object.values(await page.evaluate((name) => (window as any).fieldiaDemo.dataSource.records[name], model)) as Values[];

/** Two values in a list's order, as a source sorts them: a link by its label, numbers by size, empty last whichever way. */
function compare(a: unknown, b: unknown, desc = false): number {
  const blank = (v: unknown) => v === null || v === undefined || v === '';
  if (blank(a) || blank(b)) return blank(a) === blank(b) ? 0 : blank(a) ? 1 : -1;
  const label = (v: unknown) => (typeof v === 'object' && v !== null && 'label' in v ? (v as { label: string }).label : v);
  const [x, y] = [label(a), label(b)];
  const result = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y));
  return desc ? -result : result;
}
const ordered = (rows: Values[], keys: { field: string; desc?: boolean }[]) =>
  [...rows].sort((a, b) => {
    for (const key of keys) {
      const by = compare(a[key.field], b[key.field], key.desc);
      if (by) return by;
    }
    return 0;
  });

test.describe('a list ordered by several headers', () => {
  test('adds a header with Shift and a press — or Shift and Enter — numbering each, and pages in that order', async ({ page }) => {
    const { problems } = await open(page, 'plain', CUSTOMERS);
    const customers = await records(page, 'partner');
    await header(page, 'Country').getByRole('button').click();
    await expect(header(page, 'Country')).toHaveAttribute('aria-sort', 'ascending');
    // Shift and a press adds Credit limit after Country; again, the other way.
    await header(page, 'Credit limit').getByRole('button').click({ modifiers: ['Shift'] });
    await header(page, 'Credit limit').getByRole('button').click({ modifiers: ['Shift'] });
    const keys = [{ field: 'country_id' }, { field: 'credit_limit', desc: true }, { field: 'name' }];
    const expected = ordered(customers, keys).map((one) => one['name'] as string);
    await expect(names(page)).toHaveText(expected.slice(0, 8));
    await expect(header(page, 'Country')).toHaveAttribute('aria-sort', 'ascending');
    await expect(header(page, 'Credit limit')).not.toHaveAttribute('aria-sort');
    await expect(header(page, 'Credit limit')).toHaveAttribute('data-sort', 'descending');
    await expect(header(page, 'Country').locator('.fd-list-sort-rank')).toHaveText('1');
    await expect(header(page, 'Credit limit').locator('.fd-list-sort-rank')).toHaveText('2');
    // A screen reader hears each key's place after its header's name.
    await expect(header(page, 'Credit limit').getByRole('button')).toHaveAccessibleName('Credit limit sorted 2 of 2, descending');
    await screen(page, 'list-work-sort', { viewport: true });
    expect(await axeFindings(page, 'a list ordered by two headers')).toEqual([]);
    // The next page in the same order.
    await page.getByRole('button', { name: 'Next page' }).click();
    await expect(names(page)).toHaveText(expected.slice(8));
    // Shift and Enter on a header, from the keyboard: Status joins as the third.
    await header(page, 'Status').getByRole('button').focus();
    await page.keyboard.press('Shift+Enter');
    await expect(header(page, 'Status').locator('.fd-list-sort-rank')).toHaveText('3');
    await expect(header(page, 'Status').getByRole('button')).toHaveAccessibleName('Status sorted 3 of 3, ascending');
    // A plain press: that header alone, the numbers gone.
    await header(page, 'Name').getByRole('button').click();
    await expect(page.locator('.fd-list-sort-rank')).toHaveCount(0);
    await expect(names(page).first()).toHaveText(ordered(customers, [{ field: 'name' }])[0]['name'] as string);
    expect(problems).toEqual([]);
  });

  test('numbers its keys on a phone’s chips too', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 800 });
    await open(page, 'plain', `${LEADS}`);
    await expect(page.locator('.fd-list')).toHaveAttribute('data-as', 'cards');
    await header(page, 'Agent').getByRole('button').click();
    await header(page, 'Budget').getByRole('button').click({ modifiers: ['Shift'] });
    await expect(header(page, 'Budget').locator('.fd-list-sort-rank')).toHaveText('2');
    await expect(header(page, 'Budget').locator('.fd-list-sort-rank')).toBeVisible();
    await screen(page, 'list-work-sort-phone', { viewport: true });
  });
});

test.describe('a sales team’s saved views', () => {
  const menu = (page: Page) => page.locator('.fd-search-panel [data-group-kind="favourites"]');
  const view = (page: Page, name: string) => menu(page).locator('.fd-favourite', { has: page.locator('.fd-view-name', { hasText: new RegExp(`^${name}$`) }) });
  const openMenu = async (page: Page) => {
    if (await page.locator('.fd-search-panel').isHidden()) await page.getByRole('button', { name: 'Search options' }).click();
  };

  test('lists the team’s, puts one on with its order, saves one for the team, keeps it, and deletes it', async ({ page }) => {
    const { problems } = await open(page, 'plain', LEADS);
    const leads = await records(page, 'lead');
    await openMenu(page);
    await expect(view(page, 'No agent yet, biggest first').locator('.fd-view-whose')).toHaveText('Shared by Mona Adel');
    await expect(view(page, 'Late, by agent').locator('.fd-view-whose')).toHaveText('Shared by Karim Samir');
    // Another's view is only put on.
    await expect(view(page, 'Late, by agent').locator('.fd-favourite-remove')).toHaveCount(0);
    await screen(page, 'list-work-views', { viewport: true });
    expect(await axeFindings(page, 'a list’s saved views open')).toEqual([]);
    await view(page, 'Late, by agent').locator('.fd-search-option').click();
    await expect(page.locator('.fd-facet .fd-facet-text')).toHaveText(['Late']);
    const late = leads.filter((lead) => lead['next_on'] !== null && (lead['next_on'] as string) < '2026-10-14' && lead['stage'] !== 'won');
    await expect(names(page)).toHaveText(ordered(late, [{ field: 'agent' }, { field: 'next_on' }]).map((lead) => lead['name'] as string));
    await expect(header(page, 'Agent')).toHaveAttribute('aria-sort', 'ascending');
    await expect(header(page, 'Next follow-up').locator('.fd-list-sort-rank')).toHaveText('2');
    // Saved for the team, as it stands.
    await openMenu(page);
    await menu(page).getByRole('button', { name: 'Save current search' }).click();
    await menu(page).getByRole('textbox', { name: 'Name of the search' }).fill('Late ones, ours');
    await menu(page).getByLabel('Share with the team').check();
    await menu(page).locator('.fd-favourite-form').getByRole('button', { name: 'Save' }).click();
    await expect(view(page, 'Late ones, ours').locator('.fd-view-whose')).toHaveText('Shared with the team');
    await screen(page, 'list-work-views-saved', { viewport: true });
    // Late, counted beside it, as each view kept is.
    await expect(view(page, 'Late ones, ours').locator('.fd-filter-count')).toHaveText(String(late.length));
    // Kept on the "server": a reload lists it, and the list opens on its own search.
    await page.reload();
    await expect(page.locator('.fd-facet')).toHaveCount(0);
    await openMenu(page);
    await expect(view(page, 'Late ones, ours')).toHaveCount(1);
    // The person's own, shared with the team: × asks first, as it goes for everyone.
    await view(page, 'Late ones, ours').getByRole('button', { name: 'Delete Late ones, ours' }).click();
    await expect(page.getByRole('alertdialog')).toContainText('Delete “Late ones, ours” for everyone on the team?');
    await page.getByRole('alertdialog').getByRole('button', { name: 'OK' }).click();
    await expect(view(page, 'Late ones, ours')).toHaveCount(0);
    await expect(menu(page).locator('.fd-favourite')).toHaveCount(2);
    expect(problems).toEqual([]);
  });

  test('opens on the person’s own default view, its order with it', async ({ page }) => {
    await open(page, 'plain', LEADS);
    await header(page, 'Budget').getByRole('button').click();
    await header(page, 'Budget').getByRole('button').click();
    await openMenu(page);
    await menu(page).getByRole('button', { name: 'Save current search' }).click();
    await menu(page).getByRole('textbox', { name: 'Name of the search' }).fill('Biggest first');
    await menu(page).getByLabel('Use by default').check();
    await menu(page).locator('.fd-favourite-form').getByRole('button', { name: 'Save' }).click();
    await expect(view(page, 'Biggest first')).toHaveCount(1);
    await page.reload();
    await expect(header(page, 'Budget')).toHaveAttribute('aria-sort', 'descending');
    const leads = await records(page, 'lead');
    await expect(names(page).first()).toHaveText(ordered(leads, [{ field: 'budget', desc: true }])[0]['name'] as string);
  });
});

test.describe('orders whose rows open in place', () => {
  const ORDERS = `page=orders-review&skin=underline&${NOW}`;
  type Order = Values & { name: string; line_ids: { values: Values }[] };
  /** An order's lines in their order, as its row opens to them: each one's description (a section's heading too). */
  const linesOf = (order: Order) => [...order.line_ids].sort((a, b) => compare(a.values['sequence'], b.values['sequence'])).map((line) => line.values['name'] as string);
  const shownLines = (page: Page, name: string) => page.getByRole('table', { name: `Order lines of ${name}` }).locator('[role="rowgroup"]:last-child > [role="row"]');

  test('opens an order to its lines, five at a time, sections across, several at once, and its row still opens the order', async ({ page }) => {
    const { problems } = await open(page, 'plain', ORDERS);
    const orders = ordered((await records(page, 'sale.order')) as Order[], [{ field: 'date_order', desc: true }]) as Order[];
    const [first, second] = orders;
    await expect(names(page).first()).toHaveText(first.name);
    const toggle = page.locator('.fd-list-row').first().getByRole('button', { name: `Order lines of ${first.name}` });
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    const lines = linesOf(first);
    await expect(shownLines(page, first.name)).toHaveCount(Math.min(5, lines.length));
    for (const [at, words] of lines.slice(0, 5).entries()) await expect(shownLines(page, first.name).nth(at)).toContainText(words);
    // A section's heading across the row.
    await expect(page.getByRole('table', { name: `Order lines of ${first.name}` }).locator('[data-kind="section"]').first()).toHaveText('Workstations');
    if (lines.length > 5) {
      await page.getByRole('group', { name: `Order lines of ${first.name}` }).getByRole('button', { name: 'Next page' }).click();
      await expect(shownLines(page, first.name).first()).toContainText(lines[5]);
    }
    // Another open too, from the keys: Right opens it, Left closes it.
    const secondRow = page.locator('.fd-list-row').nth(1);
    await secondRow.focus();
    await page.keyboard.press('ArrowRight');
    await expect(shownLines(page, second.name)).toHaveCount(Math.min(5, linesOf(second).length));
    await expect(shownLines(page, first.name).first()).toBeVisible();
    await screen(page, 'list-work-detail', { viewport: true });
    expect(await axeFindings(page, 'orders opened in place')).toEqual([]);
    await page.keyboard.press('ArrowLeft');
    await expect(page.getByRole('table', { name: `Order lines of ${second.name}` })).toHaveCount(0);
    // Down from the first passes over what it opened.
    await page.locator('.fd-list-row').first().focus();
    await page.keyboard.press('ArrowDown');
    await expect(secondRow).toBeFocused();
    // The row's own press opens the order.
    await page.locator('.fd-list-row').first().locator('td').nth(2).click();
    await expect(page).toHaveURL(/page=order&.*record=\d+/);
    await expect(page.locator('[data-node="#title"] textarea, [data-node="#title"] input').first()).toHaveValue(first.name);
    expect(problems).toEqual([]);
  });

  test('opens an order’s card on a phone to its lines, under the card', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await open(page, 'plain', ORDERS);
    const orders = ordered((await records(page, 'sale.order')) as Order[], [{ field: 'date_order', desc: true }]) as Order[];
    await expect(page.locator('.fd-list')).toHaveAttribute('data-as', 'cards');
    const toggle = page.locator('.fd-list-row').first().locator('.fd-list-detail-words');
    await expect(toggle).toBeVisible();
    await expect(toggle).toHaveText('Order lines');
    await toggle.click();
    await expect(shownLines(page, orders[0].name)).toHaveCount(Math.min(5, linesOf(orders[0]).length));
    await expect(page.getByRole('table', { name: `Order lines of ${orders[0].name}` })).toBeVisible();
    // Its lines scroll sideways in their own box: the page never does.
    await expectNoSidewaysScroll(page);
    await screen(page, 'list-work-detail-phone', { viewport: true });
  });
});

test.describe('a waiting room ranked by hand', () => {
  const ROOM = 'page=waiting-room&skin=underline';
  const patients = (page: Page) => page.locator('.fd-list-row td[data-col="name"]');

  test('carries a patient by the grip to another place, keeps the order, and moves one with Alt and an arrow', async ({ page }) => {
    const { problems } = await open(page, 'plain', ROOM);
    const waiting = ordered(await records(page, 'clinic.waiting'), [{ field: 'turn' }]).map((one) => one['name'] as string);
    await expect(patients(page)).toHaveText(waiting);
    // The first carried below the third, by its grip.
    const grip = page.locator('.fd-list-row').first().locator('td[data-col] > .fd-list-rank');
    const target = (await page.locator('.fd-list-row').nth(2).boundingBox())!;
    const from = (await grip.boundingBox())!;
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await page.mouse.down();
    await page.mouse.move(from.x + from.width / 2, target.y + target.height * 0.75, { steps: 8 });
    await screen(page, 'list-work-rank-carried', { viewport: true });
    await page.mouse.up();
    const moved = [waiting[1], waiting[2], waiting[0], ...waiting.slice(3)];
    await expect(patients(page)).toHaveText(moved);
    await expect(page.locator('.fd-list > [role="status"]')).toHaveText(`${waiting[0]} moved to place 3 of ${waiting.length}`);
    // Written: the order kept on reload.
    await expect.poll(async () => ordered(await records(page, 'clinic.waiting'), [{ field: 'turn' }]).map((one) => one['name'])).toEqual(moved);
    await page.reload();
    await expect(patients(page)).toHaveText(moved);
    // From the keys: the last up a place.
    const last = page.locator('.fd-list-row').last();
    await last.focus();
    await page.keyboard.press('Alt+ArrowUp');
    const keyed = [...moved.slice(0, -2), moved[moved.length - 1], moved[moved.length - 2]];
    await expect(patients(page)).toHaveText(keyed);
    await expect(page.locator('.fd-list-row').nth(keyed.length - 2)).toBeFocused();
    // The pointer parked off the rows: a muted pill over a hovered row's ground is 4.16:1 in any list (not this one's).
    await page.mouse.move(0, 0);
    await screen(page, 'list-work-rank', { viewport: true });
    expect(await axeFindings(page, 'a waiting room ranked by hand')).toEqual([]);
    expect(problems).toEqual([]);
  });

  test('puts a carried row back on Escape', async ({ page }) => {
    await open(page, 'plain', ROOM);
    const before = await patients(page).allTextContents();
    const grip = page.locator('.fd-list-row').first().locator('td[data-col] > .fd-list-rank');
    const from = (await grip.boundingBox())!;
    await page.mouse.move(from.x + 4, from.y + 4);
    await page.mouse.down();
    await page.mouse.move(from.x + 4, from.y + 120, { steps: 6 });
    await page.keyboard.press('Escape');
    await page.mouse.up();
    await expect(patients(page)).toHaveText(before);
    await expect(page.locator('.fd-list-row[data-lifted]')).toHaveCount(0);
  });

  test('carries a card by its grip on a phone', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await open(page, 'plain', ROOM);
    const before = await patients(page).allTextContents();
    await expect(page.locator('.fd-list')).toHaveAttribute('data-as', 'cards');
    const grip = page.locator('.fd-list-row').first().locator('.fd-list-card > .fd-list-rank');
    await expect(grip).toBeVisible();
    const from = (await grip.boundingBox())!;
    const second = (await page.locator('.fd-list-row').nth(1).boundingBox())!;
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await page.mouse.down();
    await page.mouse.move(from.x + from.width / 2, second.y + second.height * 0.8, { steps: 8 });
    await page.mouse.up();
    await expect(patients(page)).toHaveText([before[1], before[0], ...before.slice(2)]);
    await screen(page, 'list-work-rank-phone', { viewport: true });
  });
});
