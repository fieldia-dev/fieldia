import { type Page } from '@playwright/test';
import { axeFindings } from './a11y-support';
import { expect, test } from './fixtures';
import { open, screen } from './support';

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
