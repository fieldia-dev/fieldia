import { type Locator, type Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { open, screen } from './support';

/**
 * A customer's quotations in a tab that counts them (examples/pages/customer-account.page.json): the tab says how many
 * this customer has before it is opened, asked of the data source as the record is shown, and the next customer's
 * own. What each should be is worked out here from the demo's own records, never written down from the screen. The
 * demos' clock is pinned to Wednesday 14 October 2026, so the records are the same every run.
 */

const NOW = 'now=2026-10-14T09:40';
const CUSTOMER = `page=customer-account&record=1&skin=underline&${NOW}`;

type Link = { id: number; label: string };
type Quotation = { name: string; partner_id: Link; date: string; state: string };
const records = async <T>(page: Page, model: string) => Object.entries(await page.evaluate((m) => (window as any).fieldiaDemo.dataSource.records[m], model)).map(([id, values]) => ({ id: Number(id), ...(values as T) }));
/** A customer's quotations the tab counts: the lost left out, as its list does. */
const theirs = async (page: Page, partner: number) => (await records<Quotation>(page, 'quotation')).filter((q) => q.partner_id.id === partner && q.state !== 'lost');

const tab = (page: Page) => page.locator('[data-node="tab-quotations"]');
const pill = (page: Page) => tab(page).locator('.fd-tab-count');
const rows = (list: Locator) => list.locator('.fd-list-row');

test.describe('a tab that counts the related list in it', () => {
  test('says how many quotations the customer has before its tab is opened, and the next customer’s own', async ({ page }) => {
    const { problems } = await open(page, 'plain', CUSTOMER);
    const mine = await theirs(page, 1);
    expect(mine.length, 'the demo’s customer has quotations to count').toBeGreaterThan(0);
    await expect(pill(page)).toHaveText(String(mine.length));
    await expect(page.getByRole('tab', { name: `Quotations, ${mine.length}`, exact: true })).toHaveAttribute('aria-selected', 'false');
    // A pill after its words, on a page with no record head as on one with it.
    expect(await pill(page).evaluate((el) => [getComputedStyle(el).height, getComputedStyle(el).borderTopLeftRadius, getComputedStyle(el).marginInlineStart])).toEqual(['19px', '10px', '6px']);
    // The list itself is not drawn until its tab is opened.
    await expect(rows(page.locator('[data-node="quotations"]'))).toHaveCount(0);
    await screen(page, 'related-tab-count');
    await tab(page).click();
    await expect(rows(page.locator('[data-node="quotations"]'))).toHaveCount(Math.min(5, mine.length));
    await expect(pill(page)).toHaveText(String(mine.length));
    // The next customer: its own count, never the last one's.
    await page.getByRole('button', { name: 'Next record' }).click();
    await expect(page.locator('[data-node="#title"] textarea')).toHaveValue('Amira Clinics');
    const next = await theirs(page, 20);
    await expect(pill(page)).toHaveText(String(next.length));
    await expect(tab(page)).toHaveAccessibleName(`Quotations, ${next.length}`);
    expect(problems).toEqual([]);
  });

  test('a new customer’s tab counts nothing until it is saved', async ({ page }) => {
    const { problems } = await open(page, 'plain', `page=customer-account&record=new&skin=underline&${NOW}`);
    await expect(tab(page)).toBeVisible();
    await expect(pill(page)).toBeHidden();
    await expect(tab(page)).toHaveAccessibleName('Quotations');
    expect(problems).toEqual([]);
  });
});
