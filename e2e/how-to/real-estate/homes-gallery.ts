import type { Locator, Page } from '@playwright/test';
import { expect } from '../../fixtures';
import type { DemoReplay } from '../hand';

/** The homes' cards, in the gallery (each a row of the list's table). */
const cards = (page: Page) => page.locator('.fd-list[data-as="gallery"] tbody tr.fd-list-row');
/** What the app was asked, said over the list as no app stands behind the demo. */
const appAsked = (page: Page) => page.locator('.fd-say');
/** A card's title, as its card shows it. */
const titleOf = async (card: Locator) => (await card.locator('.fd-list-card-title').textContent())!.trim();

export const replay: DemoReplay = {
  steps: [
    {
      says: 'Press Book a viewing on a card: the app is given that home alone',
      async run({ page, press, see, demo }) {
        await see(cards(page)).toHaveCount(12);
        const card = cards(page).nth(1);
        const home = await titleOf(card);
        const id = Number(await card.getAttribute('data-id'));
        await press(card.getByRole('button', { name: 'Book a viewing' }));
        await see(appAsked(page)).toHaveText([`The app was asked to book a viewing for ${home}.×`]);
        // The press was the button's: no home opened in its place.
        await see(page.locator('.dh-title')).toHaveText('Homes for sale, as a gallery');
        expect((await demo<{ action: string; recordIds?: unknown[] }[]>('requests')).at(-1)).toEqual(expect.objectContaining({ action: 'book_viewing', recordIds: [id] }));
      },
    },
    {
      says: 'Tick two cards by the box on their photos, then press Share with a buyer',
      async run({ page, press, see, demo }) {
        const picked = [cards(page).nth(0), cards(page).nth(2)];
        for (const card of picked) await press(card.getByRole('checkbox'));
        await see(page.locator('.fd-list-count')).toHaveText('2 selected');
        for (const card of picked) await see(card).toHaveAttribute('aria-selected', 'true');
        await press(page.getByRole('button', { name: 'Share with a buyer' }));
        const homes = await Promise.all(picked.map(titleOf));
        await see(appAsked(page)).toHaveText([`The app was asked to share 2 properties with a buyer: ${homes[0]} and ${homes[1]}.×`]);
        const ids = await Promise.all(picked.map(async (card) => Number(await card.getAttribute('data-id'))));
        expect((await demo<{ action: string; recordIds?: unknown[] }[]>('requests')).at(-1)?.recordIds).toEqual(ids);
      },
    },
    {
      says: 'Group By District: a heading over each district’s cards, its count beside it',
      async run({ page, press, see }) {
        const options = page.getByRole('button', { name: 'Search options' });
        await press(options);
        await press(page.getByRole('group', { name: 'Group By' }).getByRole('button', { name: 'District' }));
        // The options closed by their own button, as a finger closes them too.
        await press(options);
        await see(options).toHaveAttribute('aria-expanded', 'false');
        const dokki = page.getByRole('button', { name: 'Dokki, 9 properties' });
        await see(dokki).toHaveText('Dokki (9)');
        await see(page.getByRole('button', { name: 'Zamalek, 6 properties' })).toHaveText('Zamalek (6)');
        await press(dokki);
        // Its nine cards under it, the heading across their whole line.
        await see(cards(page)).toHaveCount(9);
        await see(cards(page).first().locator('.fd-list-card-lines')).toContainText('Dokki');
        const heading = (await page.locator('.fd-list-group').first().boundingBox())!;
        const list = (await page.locator('.fd-list-table tbody').boundingBox())!;
        expect(Math.round(heading.width)).toBe(Math.round(list.width));
      },
    },
    {
      says: 'Press List over the cards: the same homes as rows, each with a small photo',
      async run({ page, phone, press, see }) {
        const showAs = page.getByRole('group', { name: 'Show as' });
        await press(page.getByRole('button', { name: 'Remove District' }));
        await see(cards(page)).toHaveCount(12);
        const first = await titleOf(cards(page).first());
        await press(showAs.getByRole('button', { name: 'List' }));
        await see(showAs.getByRole('button', { name: 'List' })).toHaveAttribute('aria-pressed', 'true');
        const rows = page.locator('.fd-list-table tbody tr.fd-list-row');
        await see(rows).toHaveCount(12);
        await see(rows.first()).toContainText(first);
        if (phone) {
          // A phone's list is its cards, one to a line, each with its photo small beside its words.
          await see(page.locator('.fd-list')).toHaveAttribute('data-as', 'cards');
          const photo = rows.first().locator('.fd-list-card-photo img');
          await see(photo).toBeVisible();
          expect((await photo.boundingBox())!.width).toBeLessThan(100);
        } else {
          await see(page.locator('.fd-list')).not.toHaveAttribute('data-as', /./);
          await see(rows.first().locator('img.fd-list-thumb')).toBeVisible();
        }
        await press(showAs.getByRole('button', { name: 'Gallery' }));
        await see(cards(page)).toHaveCount(12);
        await see(cards(page).first().locator('.fd-list-card-photo img')).toBeVisible();
      },
    },
    {
      says: 'Use the arrow keys on a card: left and right along the line',
      notOnPhone: 'a phone has no arrow keys, and its cards are one to a line',
      async run({ page, press, keys, see }) {
        // The cards on the first line: as many as share its top.
        const tops = await cards(page).evaluateAll((all) => all.map((card) => Math.round(card.getBoundingClientRect().top)));
        const perLine = tops.filter((top) => top === tops[0]).length;
        expect(perLine).toBeGreaterThan(1);
        // A card reached by the keys (a press on it opens its home): its box pressed, then Shift+Tab to the card.
        await press(cards(page).nth(0).getByRole('checkbox'));
        await keys('Shift+Tab');
        await see(cards(page).nth(0)).toBeFocused();
        await keys('ArrowRight');
        await see(cards(page).nth(1)).toBeFocused();
        await keys('ArrowDown');
        await see(cards(page).nth(1 + perLine)).toBeFocused();
        await keys('ArrowLeft');
        await see(cards(page).nth(perLine)).toBeFocused();
        await keys('ArrowUp');
        await see(cards(page).nth(0)).toBeFocused();
      },
    },
  ],
};
