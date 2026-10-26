import type { Locator, Page } from '@playwright/test';
import { expect } from '../../fixtures';
import type { DemoReplay, Hand } from '../hand';
import { header, rowWith, chips, searchMenu, openMenu } from './support';

/** A filter in the search's menu by its first words, its count beside it. */
const filterIn = (menu: Locator, words: string) => menu.locator('.fd-search-option[data-filter]').filter({ hasText: new RegExp(`^${words}`) });
/** Every chip of the search taken off by its ×, one after another, as a person clears a search. */
async function closeAll(page: Page, press: Hand['press']) {
  const removers = page.locator('.fd-facet').getByRole('button', { name: /^Remove / });
  for (let left = await removers.count(); left > 0; left--) await press(removers.first());
  await expect(page.locator('.fd-facet')).toHaveCount(0);
}

/** The leads-queue demo’s how-to steps, replayed by hand (e2e/how-to.spec.ts). */
export const replay: DemoReplay = {
  steps: [
    {
      says: 'Press the arrow at the search box’s end: Late',
      async run(hand) {
        const { page, press, see } = hand;
        await openMenu(hand);
        const menu = searchMenu(page);
        await see(menu.getByRole('button', { name: 'Late, 5 leads' })).toBeVisible();
        await see(menu.getByRole('button', { name: 'Today, 3 leads' })).toBeVisible();
        await see(filterIn(menu, 'Late').locator('.fd-filter-count')).toHaveText('5');
        await see(filterIn(menu, 'Today').locator('.fd-filter-count')).toHaveText('3');
        await press(menu.getByRole('button', { name: 'Late, 5 leads' }));
        await see(chips(page)).toHaveText(['Late']);
        await see(page.locator('.fd-list-row')).toHaveCount(5);
      },
    },
    {
      says: 'Under Favourites, press “Late, by agent”, shared',
      async run(hand) {
        const { page, press, see } = hand;
        await openMenu(hand);
        const view = searchMenu(page).locator('.fd-favourite', { has: page.locator('.fd-view-name', { hasText: /^Late, by agent$/ }) });
        await see(view.locator('.fd-view-whose')).toHaveText('Shared by Karim Samir');
        await press(view.locator('.fd-search-option'));
        await see(chips(page)).toHaveText(['Late']);
        await see(page.locator('.fd-list-row')).toHaveCount(5);
        // By agent, then by day: Agent the first key, Next follow-up the second.
        await see(header(page, 'Agent')).toHaveAttribute('aria-sort', 'ascending');
        await see(header(page, 'Next follow-up').locator('.fd-list-sort-rank')).toHaveText('2');
      },
    },
    {
      says: 'Type “Mona” in the search and pick Search Agent',
      async run(hand) {
        const { page, press, type, see, demo } = hand;
        await type(page.getByRole('combobox', { name: 'Search' }), 'Mona');
        await press(page.getByRole('option', { name: 'Search Agent for: Mona' }));
        await see(chips(page)).toHaveText(['Late', 'Agent: Mona']);
        const shown = await page.locator('.fd-list-row').count();
        await openMenu(hand);
        const menu = searchMenu(page);
        // Late, on with Mona's: as many as the list shows; no lead of hers waits for an agent; every count hers alone.
        await see(filterIn(menu, 'Late').locator('.fd-filter-count')).toHaveText(String(shown));
        await see(filterIn(menu, 'No agent yet').locator('.fd-filter-count')).toHaveText('0');
        const leads = Object.values(await demo<Record<string, { agent: string | null; budget: number }>>('dataSource.records.lead'));
        const hers = leads.filter((lead) => lead.agent === 'Mona Adel');
        await see(filterIn(menu, 'Budget 10M or more').locator('.fd-filter-count')).toHaveText(String(hers.filter((lead) => lead.budget >= 10_000_000).length));
      },
    },
    {
      says: 'Save the search as “Mona’s”, ticking Share with',
      async run(hand) {
        const { page, press, type, see } = hand;
        await openMenu(hand);
        const menu = searchMenu(page);
        const shown = await page.locator('.fd-list-row').count();
        await press(menu.getByRole('button', { name: 'Save current search' }));
        await type(menu.getByRole('textbox', { name: 'Name of the search' }), 'Mona’s');
        await press(menu.getByRole('checkbox', { name: 'Share with the team' }));
        await press(menu.locator('.fd-favourite-form').getByRole('button', { name: 'Save' }));
        const view = menu.locator('.fd-favourite', { has: page.locator('.fd-view-name', { hasText: /^Mona’s$/ }) });
        await see(view.locator('.fd-view-whose')).toHaveText('Shared with the team');
        await see(view.locator('.fd-filter-count')).toHaveText(String(shown));
      },
    },
    {
      says: 'Add a custom filter: Budget, is between, 5,000',
      async run(hand) {
        const { page, press, type, see } = hand;
        await openMenu(hand);
        await press(searchMenu(page).getByRole('button', { name: 'Add a custom filter' }));
        const form = page.locator('.fd-custom-filter');
        await form.getByRole('combobox', { name: 'Field' }).selectOption({ label: 'Budget' });
        await form.getByRole('combobox', { name: 'Condition' }).selectOption({ label: 'is between' });
        await type(form.getByRole('textbox', { name: 'Budget: From' }), '5,000,000');
        await type(form.getByRole('textbox', { name: 'Budget: To' }), '15,000,000');
        await press(form.getByRole('button', { name: 'Apply' }));
        await see(chips(page).filter({ hasText: /^Budget/ })).toHaveText([/^Budget: E£\s5,000,000 – E£\s15,000,000$/]);
      },
    },
    {
      says: 'Clear the search with the × on each of its',
      async run({ page, press, type, keys, see }) {
        await closeAll(page, press);
        await see(page.locator('.fd-list-row')).toHaveCount(20);
        await press(rowWith(page, 'Omar Nabil'));
        await see(page.locator('.dh-title')).toHaveText('A lead');
        const areas = page.locator('[data-node="f-areas"]');
        const item = (name: string) => areas.getByRole('treeitem', { name, exact: true });
        await see(item('Nasr City')).toHaveAttribute('aria-checked', 'true');
        await see(item('New Cairo')).toHaveAttribute('aria-checked', 'mixed');
        await see(item('Rehab')).toHaveAttribute('aria-checked', 'true');
        await see(item('Madinaty')).toHaveAttribute('aria-checked', 'true');
        await see(areas.locator('.fd-tree-count')).toHaveText('3 chosen');
        await press(item('New Cairo'));
        await see(item('New Cairo')).toHaveAttribute('aria-checked', 'true');
        await see(item('Fifth Settlement')).toHaveAttribute('aria-checked', 'true');
        await type(areas.getByRole('searchbox', { name: 'Search Areas wanted' }), 'degla');
        await see(areas.getByRole('treeitem')).toHaveText(['Maadi', 'Degla']);
        await press(item('Degla'));
        await see(item('Degla')).toHaveAttribute('aria-checked', 'true');
        const budget = page.getByRole('textbox', { name: 'Budget' });
        await type(budget, '6.5m', { clear: true });
        await keys('Tab');
        await see(budget).toHaveValue('6,500,000');
        await see(budget).toHaveAttribute('aria-invalid', 'false');
      },
    },
  ],
};
