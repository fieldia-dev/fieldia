import type { Page } from '@playwright/test';
import { expect } from '../../fixtures';
import type { DemoReplay } from '../hand';

type Viewing = { starts_at: string; home_id: { id: number; label: string }; client: string; state: string };
/** A home's viewings, the latest first, from the demo's own records. */
const viewingsOf = async (demo: <T>(path: string) => Promise<T>, home: number) => Object.values(await demo<Record<string, Viewing>>('dataSource.records.viewing')).filter((viewing) => viewing.home_id?.id === home).sort((a, b) => b.starts_at.localeCompare(a.starts_at));
/** The viewings listed inside the home. */
const viewingsPart = (page: Page) => page.locator('[data-node="viewings"]');
/** A day as the When box takes it: dd/mm/yyyy. */
const ddmmyyyy = (day: Date) => `${String(day.getUTCDate()).padStart(2, '0')}/${String(day.getUTCMonth() + 1).padStart(2, '0')}/${day.getUTCFullYear()}`;

export const replay: DemoReplay = {
  steps: [
    {
      says: 'Viewings lists this home’s, the latest first, five at a time',
      async run({ page, see, demo }) {
        const mine = await viewingsOf(demo, 1);
        expect(mine.length, 'the home has more than a page of viewings').toBeGreaterThan(5);
        const viewings = viewingsPart(page);
        await see(viewings).toHaveAccessibleName(`Viewings, ${mine.length}`);
        await see(viewings.locator('.fd-related-count')).toHaveText(String(mine.length));
        const rows = viewings.locator('.fd-list-row');
        await see(rows).toHaveCount(5);
        for (const [i, viewing] of mine.slice(0, 5).entries()) await see(rows.nth(i)).toContainText(viewing.client);
        await see(viewings.locator('.fd-pager-text')).toHaveText(`1–5 of ${mine.length} viewings`);
      },
    },
    {
      says: 'Press New viewing: a viewing opens in a dialog, its home filled in',
      async run({ page, press, type, keys, see, demo }) {
        const mine = await viewingsOf(demo, 1);
        const viewings = viewingsPart(page);
        await press(viewings.getByRole('button', { name: 'New viewing' }));
        const dialog = page.getByRole('dialog', { name: 'New viewing' });
        await see(dialog).toBeVisible();
        await see(dialog.getByRole('combobox', { name: 'Home', exact: true })).toHaveValue('3-bedroom flat in Maadi');
        // A day after every viewing booked so far: the latest, first in the list.
        const day = new Date(Date.parse(mine[0].starts_at) + 86_400_000);
        await type(dialog.getByRole('textbox', { name: 'When', exact: true }), `${ddmmyyyy(day)} 11:00`);
        await keys('Tab');
        await type(dialog.getByRole('textbox', { name: 'Client', exact: true }), 'Mona Kamal');
        await press(dialog.getByRole('button', { name: 'Save & Close' }));
        await see(dialog).toBeHidden();
        await see(viewings.locator('.fd-related-count')).toHaveText(String(mine.length + 1));
        await see(viewings.locator('.fd-list-row').first()).toContainText('Mona Kamal');
        await see(viewings.locator('.fd-list-row').first()).toContainText('11:00');
      },
    },
    {
      says: 'Click a viewing: it opens in a dialog to change',
      async run({ page, phone, press, type, see }) {
        const viewings = viewingsPart(page);
        const row = viewings.locator('.fd-list-row').filter({ hasText: 'Mona Kamal' });
        await see(row).not.toContainText('Done');
        await press(row);
        const dialog = page.getByRole('dialog');
        await see(dialog.getByRole('textbox', { name: 'Client', exact: true })).toHaveValue('Mona Kamal');
        await dialog.getByRole('combobox', { name: 'Status' }).selectOption({ label: 'Done' });
        await type(dialog.getByRole('textbox', { name: 'Feedback' }), 'Liked the kitchen');
        await press(dialog.getByRole('button', { name: 'Save & Close' }));
        await see(dialog).toBeHidden();
        await see(row).toContainText('Done');
        // A phone's card shows who, how it went, when, the phone and the agent; the feedback is the table's.
        if (!phone) await see(row).toContainText('Liked the kitchen');
      },
    },
    {
      says: 'Press View all viewings: every viewing of this home, in a dialog',
      async run({ page, press, type, keys, see, demo }) {
        const mine = await viewingsOf(demo, 1);
        await press(viewingsPart(page).getByRole('button', { name: 'View all viewings' }));
        const dialog = page.getByRole('dialog', { name: 'Viewings' });
        await see(dialog).toBeVisible();
        const rows = dialog.locator('.fd-list-row');
        await see(rows).toHaveCount(mine.length);
        await see(dialog.locator('.fd-pager-text')).toHaveText(`1–${mine.length} of ${mine.length} viewings`);
        await see(dialog.getByRole('button', { name: 'Remove Home: 3-bedroom flat in Maadi' })).toBeVisible();
        // Searched: Mona Kamal's alone.
        await type(dialog.getByRole('combobox', { name: 'Search' }), 'Mona Kamal');
        await keys('Enter');
        await see(rows).toHaveCount(1);
        await see(rows.first()).toContainText('Mona Kamal');
        await press(dialog.getByRole('button', { name: /^Remove Client/ }));
        await see(rows).toHaveCount(mine.length);
        // Grouped by status: a heading for each, its count beside it.
        const options = dialog.getByRole('button', { name: 'Search options' });
        await press(options);
        await press(dialog.getByRole('group', { name: 'Group By' }).getByRole('button', { name: 'Status' }));
        await press(options);
        const done = mine.filter((viewing) => viewing.state === 'done').length;
        await see(dialog.getByRole('button', { name: `Done, ${done} viewings` })).toBeVisible();
        await press(dialog.getByRole('button', { name: 'Close' }).first());
        await see(dialog).toBeHidden();
      },
    },
    {
      says: 'Press › on the pager over the record, twice: the third home has had no viewings',
      async run({ page, press, see }) {
        const next = page.getByRole('button', { name: 'Next property' });
        await press(next);
        await see(page.getByRole('group', { name: 'Properties' })).toContainText('2 / 64');
        await press(next);
        await see(page.getByRole('group', { name: 'Properties' })).toContainText('3 / 64');
        const viewings = viewingsPart(page);
        await see(viewings.locator('.fd-list-empty')).toHaveText('No viewings yet.');
        await see(viewings.locator('.fd-related-count')).toHaveText('0');
      },
    },
  ],
};
