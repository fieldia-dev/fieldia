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
    // A pill after its words, on a page with no record head as on one with it: about 6px from them, a space in the
    // tab's text and its own margin together ("Quotations 5" read as two words, WCAG 2.5.3).
    expect(await pill(page).evaluate((el) => [getComputedStyle(el).height, getComputedStyle(el).borderTopLeftRadius])).toEqual(['19px', '10px']);
    const gap = await tab(page).evaluate((button) => {
      const words = button.querySelector('bdi')!.getBoundingClientRect();
      const count = button.querySelector('.fd-tab-count')!.getBoundingClientRect();
      return getComputedStyle(button).direction === 'rtl' ? words.left - count.right : count.left - words.right;
    });
    expect(gap).toBeGreaterThanOrEqual(5);
    expect(gap).toBeLessThanOrEqual(7.5);
    // The list itself is not drawn until its tab is opened.
    await expect(rows(page.locator('[data-node="quotations"]'))).toHaveCount(0);
    await screen(page, 'related-tab-count');
    await tab(page).click();
    await expect(rows(page.locator('[data-node="quotations"]'))).toHaveCount(Math.min(5, mine.length));
    await expect(pill(page)).toHaveText(String(mine.length));
    // The next customer (the page names its records: its pager says so): its own count, never the last one's.
    await page.getByRole('button', { name: 'Next customer' }).click();
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

test.describe('a related list whose rows and New go the app’s own way', () => {
  test('a quotation opens on its own page by the app’s route, never in a dialog; New opens a new one with this customer in it', async ({ page }) => {
    const { problems } = await open(page, 'plain', CUSTOMER);
    const mine = (await theirs(page, 1)).sort((a, b) => b.date.localeCompare(a.date));
    await tab(page).click();
    const quotations = page.locator('[data-node="quotations"]');
    await expect(rows(quotations).first().locator('td').first()).toHaveText(mine[0].name);
    await rows(quotations).first().click();
    // The app's route: the quotation's own page, at its own address.
    await expect(page).toHaveURL(new RegExp(`[?&]page=quotation&record=${mine[0].id}(&|$)`));
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.locator('[data-node="#title"] textarea')).toHaveValue(mine[0].name);
    await expect(page.locator('[data-node="f-partner"] input')).toHaveValue('Nile Traders');
    expect(problems).toEqual([]);
    // Back to the customer, then New: a new quotation's page, the customer filled in through its values.
    await page.goBack();
    await tab(page).click();
    await quotations.locator('.fd-related-tools button', { hasText: 'New' }).click();
    await expect(page).toHaveURL(/[?&]page=quotation&record=new&values=/);
    await expect(page.locator('[data-node="f-partner"] input')).toHaveValue('Nile Traders');
    await expect(page.locator('[data-node="#title"] textarea')).toHaveValue('');
    await page.locator('[data-node="#title"] textarea').fill('S/2026/9001');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.locator('.fd-status')).toHaveText('Saved');
    const made = (await records<Quotation>(page, 'quotation')).find((q) => q.name === 'S/2026/9001');
    expect(made?.partner_id).toEqual({ id: 1, label: 'Nile Traders' });
    await screen(page, 'related-open-app-new');
  });
});
