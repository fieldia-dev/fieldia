import type { Page } from '@playwright/test';
import type { DemoReplay } from '../hand';

/** A row of the chart of accounts by its account's name. */
const account = (page: Page, name: string) => page.locator('.fd-list-row', { has: page.locator('td[data-col="name"]', { hasText: new RegExp(`^${name}$`) }) });

/** “A chart of accounts, opened a group at a time” (chart-of-accounts): its how-to replayed by hand (e2e/how-to.spec.ts). */
export const replay: DemoReplay = {
  steps: [
    {
      says: 'Open Assets, then Cash and banks: its first twenty accounts come under it',
      async run({ page, press, see }) {
        await see(page.locator('.fd-list-row:visible')).toHaveCount(5);
        await press(page.getByRole('button', { name: 'Assets', exact: true }));
        const banks = page.getByRole('button', { name: 'Cash and banks', exact: true });
        await see(banks).toBeVisible();
        await press(banks);
        const accounts = page.locator('.fd-list-row[data-depth="2"]:visible');
        await see(accounts).toHaveCount(20);
        await see(accounts.first()).toContainText('National Bank, account 1');
        const more = page.getByRole('button', { name: 'Show 20 more' });
        await press(more);
        await see(accounts).toHaveCount(40);
        await press(more);
        await see(accounts).toHaveCount(60);
        await see(more).toBeHidden();
      },
    },
    {
      says: 'On a row, Right opens it and Left closes it',
      async run({ page, phone, press, keys, see }) {
        const accounts = page.locator('.fd-list-row[data-depth="2"]:visible');
        const twisty = (name: string) => account(page, name).getByRole('button', { name, exact: true });
        if (phone) {
          // A phone has no Right or Left, and by its design no Collapse all (rows-styles.ts): each parent's arrow
          // opens and closes it, a press away.
          await see(page.getByRole('button', { name: 'Collapse all' })).toBeHidden();
          await press(twisty('Cash and banks'));
          await see(accounts).toHaveCount(0);
          await see(twisty('Cash and banks')).toHaveAttribute('aria-expanded', 'false');
          await press(twisty('Cash and banks'));
          await see(twisty('Cash and banks')).toHaveAttribute('aria-expanded', 'true');
          await see(accounts.first()).toContainText('National Bank, account 1');
          await press(twisty('Assets'));
          await see(page.locator('.fd-list-row:visible')).toHaveCount(5);
          return;
        }
        // To the rows as the keys go: from the search box, Tab past its options and the header's buttons.
        await press(page.getByRole('combobox', { name: 'Search' }));
        for (let i = 0; i < 10 && (await page.locator('.fd-list-row:focus').count()) === 0; i++) await keys('Tab');
        await see(account(page, 'Assets')).toBeFocused();
        await keys('ArrowDown');
        await see(account(page, 'Cash and banks')).toBeFocused();
        await keys('ArrowLeft');
        await see(accounts).toHaveCount(0);
        await see(twisty('Cash and banks')).toHaveAttribute('aria-expanded', 'false');
        await keys('ArrowRight');
        await see(twisty('Cash and banks')).toHaveAttribute('aria-expanded', 'true');
        await see(accounts.first()).toContainText('National Bank, account 1');
        await press(page.getByRole('button', { name: 'Collapse all' }));
        await see(page.locator('.fd-list-row:visible')).toHaveCount(5);
      },
    },
    {
      says: 'Search “bank”: every account with bank in its name, wherever it is',
      async run({ page, press, type, see }) {
        await type(page.getByRole('combobox', { name: 'Search' }), 'bank');
        await press(page.getByRole('option', { name: 'Search Account for: bank' }));
        const pager = page.locator('.fd-pager-text');
        await see(pager).toHaveText('1–20 of 23 accounts');
        const rows = page.locator('.fd-list-row:visible');
        // Each with the group it is in: a group under its class, an account under its group.
        await see(rows.locator('.fd-list-tree-in')).toHaveCount(20);
        await see(rows.first()).toContainText('Cash and banks');
        await see(rows.first().locator('.fd-list-tree-in')).toHaveText('in Assets');
        await see(rows.filter({ hasText: /National Bank, account 1(?!\d)/ }).locator('.fd-list-tree-in')).toHaveText('in Cash and banks');
        await see(rows.filter({ hasText: /Alex Bank, account 1(?!\d)/ }).locator('.fd-list-tree-in')).toHaveText('in Cash and banks');
        // Wherever it is: the bank loans, under Liabilities, on the next page.
        await press(page.getByRole('button', { name: 'Next page' }));
        await see(pager).toHaveText('21–23 of 23 accounts');
        await see(rows.filter({ hasText: 'Bank loan, short term' }).locator('.fd-list-tree-in')).toHaveText('in Loans');
        await see(rows.filter({ hasText: 'Bank loan, long term' }).locator('.fd-list-tree-in')).toHaveText('in Loans');
      },
    },
  ],
};
