import { expect } from '../../fixtures';
import type { DemoReplay } from '../hand';
import { node, atTheTop } from './support';

/** The contained demo's how-to steps, replayed by hand (e2e/how-to.spec.ts). */
export const replay: DemoReplay = {
  // The two parts the demo shows failing, by their own words: told to the console by Fieldia as it contains each
  // ("could not be drawn", "could not be brought up to date"), and by React, which logs an error its boundary caught.
  allow: [/The delivery planner could not load its calendar/, /The price tag cannot draw 1200: four-digit prices are not supported yet/],
  steps: [
    {
      says: 'Look under Quote: the delivery planner failed as it loaded',
      async run({ page, see }) {
        const planner = node(page, 'n-planner').locator('.fd-broken');
        await see(planner).toHaveText('This part could not be shown');
        await see(planner).toBeVisible();
        // Under the quote's fields.
        const [quote, box] = [(await page.getByRole('group', { name: 'Quote' }).boundingBox())!, (await planner.boundingBox())!];
        expect(box.y).toBeGreaterThanOrEqual(quote.y + quote.height - 1);
      },
    },
    {
      says: 'Type 1200 in Price: the price tag fails, and a box naming Price takes its place.',
      async run({ page, type, see }) {
        const price = node(page, 'f-price');
        await see(price.locator('output')).toHaveText('EGP 450.00');
        await type(price.getByRole('textbox', { name: 'Price' }), '1200', { clear: true });
        await see(price.locator('.fd-broken-words')).toHaveText('This field could not be shown: Price');
        // Typed key by key, 120 was a price the tag drew: the 1200 it could not is the change not kept.
        await see(price.locator('.fd-broken-kept')).toHaveText('Your change was not kept: it is back to EGP 120.00.');
        await see(price.locator('.fd-label')).toHaveText('Price');
      },
    },
    {
      says: 'Change the customer and the notes, then press Save',
      async run({ page, press, type, see, demo }) {
        await type(node(page, 'f-customer').getByRole('textbox', { name: 'Customer' }), 'Delta Foods', { clear: true });
        await type(node(page, 'f-notes').getByRole('textbox', { name: 'Notes' }), 'Call before noon.', { clear: true });
        await press(page.getByRole('button', { name: 'Save', exact: true }));
        await see(page.locator('.fd-status').first()).toHaveText('Saved');
        await see(node(page, 'f-customer').getByRole('textbox', { name: 'Customer' })).toHaveValue('Delta Foods');
        expect(await demo<string>('dataSource.records.quote.1.customer')).toBe('Delta Foods');
        expect(await demo<string>('dataSource.records.quote.1.notes')).toBe('Call before noon.');
        expect(await demo<number>('dataSource.records.quote.1.price')).toBe(120);
      },
    },
    {
      says: 'Read the log under the form: what your app was told of each failure',
      async run({ page, press, see }) {
        const log = page.getByRole('region', { name: 'What your app’s error log was told' });
        const entries = log.getByRole('listitem');
        await see(entries).toHaveCount(2);
        await see(entries.nth(0)).toContainText('The app’s planner panel failed as it was drawn: The delivery planner could not load its calendar');
        await see(entries.nth(1)).toContainText('The Price field’s own widget failed as its value changed: The price tag cannot draw 1200: four-digit prices are not supported yet');
        const handed = entries.nth(0).getByText('What onError was handed');
        await press(handed);
        await see(entries.nth(0).locator('code')).toBeVisible();
        await see(entries.nth(0).locator('code')).toHaveText('{"stage":"draw","part":"slot","name":"planner","node":"n-planner"}');
        await press(entries.nth(1).getByText('What onError was handed'));
        await see(entries.nth(1).locator('code')).toContainText('"field":"price"');
      },
    },
    {
      says: 'Switch framework at the top: the same two parts are React, Vue and Angular components',
      async run(hand) {
        const { page, type, see, seePage } = hand;
        for (const [framework, folder] of [['React', 'react'], ['Vue', 'vue'], ['Angular', 'angular']]) {
          await atTheTop(hand, 'Framework', framework);
          await seePage().toHaveURL(new RegExp(`/${folder}/\\?page=contained`));
          await see(node(page, 'n-planner').locator('.fd-broken')).toHaveText('This part could not be shown');
          // The price saved in this tab, drawn by the app's tag, in this framework's component.
          const price = node(page, 'f-price');
          await see(price.locator('output')).toHaveText('EGP 120.00');
          await type(price.getByRole('textbox', { name: 'Price' }), '1200', { clear: true });
          await see(price.locator('.fd-broken-words')).toHaveText('This field could not be shown: Price');
          // Kept to its place: the rest of the form still takes what is typed.
          await type(node(page, 'f-notes').getByRole('textbox', { name: 'Notes' }), ' Ring twice.');
          await see(node(page, 'f-notes').getByRole('textbox', { name: 'Notes' })).toHaveValue(/Ring twice\.$/);
        }
      },
    },
  ],
};
