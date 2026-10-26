import type { Page } from '@playwright/test';
import { expect } from '../../fixtures';
import type { DemoReplay } from '../hand';

/** One of the loading demo's two panes: Customers, the list; Customer, the record beside it. */
const loadingPane = (page: Page, name: string) => page.locator(`section.ld-pane[aria-label="${name}"]`);

/** The loading demo’s how-to steps, replayed by hand (e2e/how-to.spec.ts). */
export const replay: DemoReplay = {
  // Each wait its steps look at — the skeleton, the bar, "Loading more…", "Searching…" — lasts the stand-in network's
  // 1.5 s, which a busy runner's phone can spend drawing the page: 4 s, still under "Still loading…"'s 5.
  slower: { query: 'slow=4000', why: 'a wait a step looks at outlasts a busy runner drawing the page' },
  steps: [
    {
      says: 'Watch the page open on a slow network:',
      async run({ page, see }) {
        const list = loadingPane(page, 'Customers').locator('.fd-list-records');
        const customer = loadingPane(page, 'Customer').locator('.fd-content').first();
        // The time the network takes: the list's rows and the customer's boxes as shapes, until they come.
        await see(list.locator('.fd-sk-row').first()).toBeVisible();
        await see(list).toHaveAttribute('data-fd-way', 'skeleton');
        await see(customer).toHaveAttribute('data-fd-way', 'skeleton');
        await see(customer).toHaveAttribute('data-fd-shaped', '');
        await see(list.locator('.fd-list-row').first()).toContainText('Delta Foods');
        await see(list.locator('.fd-sk-row')).toHaveCount(0);
        await see(loadingPane(page, 'Customer').locator('[data-node="f-name"] input')).toHaveValue('Nile Traders');
      },
    },
    {
      says: 'Type in the list’s search: the rows stay where',
      async run({ page, type, keys, see }) {
        const list = loadingPane(page, 'Customers').locator('.fd-list-records');
        const rows = list.locator('.fd-list-row');
        const shown = await rows.count();
        // Where the first row stands in the list (the page may scroll to the box as it is pressed; the list does not).
        const place = async () => {
          const [row, table] = await Promise.all([rows.first().boundingBox(), list.boundingBox()]);
          return { x: row!.x - table!.x, y: row!.y - table!.y };
        };
        const first = await place();
        await type(loadingPane(page, 'Customers').getByRole('combobox', { name: 'Search' }), 'Delta');
        await keys('Enter');
        const bar = list.locator('.fd-loader[data-way="keep"] .fd-bar');
        await see(bar).toBeVisible();
        // Nothing moved while the bar runs: the same rows, the first where it was.
        await see(rows).toHaveCount(shown);
        await see(rows.first()).toContainText('Delta Foods');
        expect(await place()).toEqual(first);
        await see(rows).toHaveCount(5);
        await see(bar).toHaveCount(0);
      },
    },
    {
      says: 'Take the search off with its ×, then scroll',
      async run({ page, press, see }) {
        const list = loadingPane(page, 'Customers').locator('.fd-list-records');
        const rows = list.locator('.fd-list-row');
        // The search of the step before found five, all there are: taken off, the list's first twelve back.
        await press(loadingPane(page, 'Customers').locator('.fd-facet').getByRole('button', { name: /^Remove / }));
        await see(rows).toHaveCount(12);
        const end = list.locator('.fd-list-more-rows');
        await end.scrollIntoViewIfNeeded();
        await see(end.locator('.fd-loader[data-way="row"]')).toHaveText('Loading more…');
        await see(end).toHaveAttribute('aria-busy', 'true');
        await expect.poll(() => rows.count()).toBeGreaterThanOrEqual(24);
        await see(rows.nth(12)).toBeVisible();
      },
    },
    {
      says: 'Type in Account manager: “Searching…” in its',
      async run({ page, type, see }) {
        const manager = loadingPane(page, 'Customer').locator('[data-node="f-manager"]');
        await type(manager.locator('input[role="combobox"]'), 'Mo', { clear: true });
        const found = manager.getByRole('listbox');
        await see(found.locator('.fd-loader[data-way="inline"]')).toHaveText('Searching…');
        await see(found.getByRole('option', { name: 'Mona Adel' })).toBeVisible();
        await see(found.locator('.fd-loader')).toHaveCount(0);
      },
    },
    {
      says: 'Press Fail the next answer, then Ask again: the',
      async run({ page, press, keys, see }) {
        await keys('Escape');
        const panel = page.getByRole('region', { name: 'How the page waits' });
        await press(panel.getByRole('button', { name: 'Fail the next answer' }));
        await press(panel.getByRole('button', { name: 'Ask again' }));
        const list = loadingPane(page, 'Customers').locator('.fd-list-records');
        const failed = list.locator('.fd-list-failed');
        await see(failed).toHaveText('Could not load the customers. The server did not answer this once. Retry');
        await see(failed).toHaveAttribute('role', 'alert');
        await press(failed.getByRole('button', { name: 'Retry' }));
        await see(list.locator('.fd-list-row').first()).toContainText('Delta Foods');
        await see(failed).toBeHidden();
      },
    },
    {
      says: 'Change Drawn the first time to Spinner, or to',
      async run({ page, press, see }) {
        const panel = page.getByRole('region', { name: 'How the page waits' });
        const list = loadingPane(page, 'Customers').locator('.fd-list-records');
        const customer = loadingPane(page, 'Customer').locator('.fd-content').first();
        // The page's own list (a <select>): its option picked as the browser's list picks it. The forms are drawn again.
        await panel.getByRole('combobox', { name: 'Drawn the first time' }).selectOption({ label: 'Spinner' });
        await see(list.locator('.fd-loader[data-way="spinner"] .fd-spin')).toBeVisible();
        await see(customer.locator('.fd-loader[data-way="spinner"] .fd-spin')).toBeVisible();
        await see(list.locator('.fd-list-row').first()).toContainText('Delta Foods');
        await panel.getByRole('combobox', { name: 'Drawn the first time' }).selectOption({ label: 'Custom (the app’s)' });
        await see(list.locator('.ld-custom')).toContainText('Asking the warehouse…');
        await see(customer.locator('.ld-custom')).toContainText('Asking the warehouse…');
        await see(list.locator('.fd-list-row').first()).toContainText('Delta Foods');
        await see(list.locator('.ld-custom')).toHaveCount(0);
        // Slow network off: every loader the page puts in from here counted (looked at, nothing changed) — none.
        await press(panel.getByRole('checkbox', { name: 'Slow network (1.5 s)' }));
        await see(panel.getByRole('checkbox', { name: 'Slow network (1.5 s)' })).not.toBeChecked();
        await page.evaluate(() => {
          const seen: string[] = ((window as unknown as { loadersSeen: string[] }).loadersSeen = []);
          new MutationObserver((changes) => {
            for (const change of changes) {
              for (const added of change.addedNodes) if (added instanceof HTMLElement && added.matches('.fd-loader, .fd-sk-row, .fd-sk-page, .ld-custom')) seen.push(added.className);
              if (change.type === 'attributes' && (change.target as HTMLElement).hasAttribute('data-fd-wait')) seen.push(`wait ${(change.target as HTMLElement).getAttribute('data-fd-wait')}`);
            }
          }).observe(document, { subtree: true, childList: true, attributes: true, attributeFilter: ['data-fd-wait'] });
        });
        await panel.getByRole('combobox', { name: 'Drawn the first time' }).selectOption({ label: 'Spinner' });
        await press(panel.getByRole('button', { name: 'Ask again' }));
        await see(list.locator('.fd-list-row').first()).toContainText('Delta Foods');
        await see(loadingPane(page, 'Customer').locator('[data-node="f-name"] input')).toHaveValue('Nile Traders');
        await see(page.locator('.ld-indicator')).not.toHaveAttribute('data-on', /.*/);
        expect(await page.evaluate(() => (window as unknown as { loadersSeen: string[] }).loadersSeen), 'a loader that flashed with the network quick').toEqual([]);
      },
    },
  ],
};
