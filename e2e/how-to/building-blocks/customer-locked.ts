import { expect } from '../../fixtures';
import type { DemoReplay } from '../hand';
import { node } from './support';

/** The customer-locked demo's how-to steps, replayed by hand (e2e/how-to.spec.ts). */
export const replay: DemoReplay = {
  steps: [
    {
      says: 'Notice the values read as text: nothing can be typed in.',
      async run({ page, press, see }) {
        const phone = node(page, 'f-phone').locator('input');
        await see(phone).toHaveValue('+20 2 2345 6789');
        await see(phone).not.toBeEditable();
        // As text: no box drawn round a value.
        await see(phone).toHaveCSS('border-top-color', 'rgba(0, 0, 0, 0)');
        await see(phone).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
        await press(phone);
        await page.keyboard.type('1', { delay: 15 });
        await see(phone).toHaveValue('+20 2 2345 6789');
      },
    },
    {
      says: 'Press Edit: the fields become editable.',
      async run({ page, press, see }) {
        await press(page.getByRole('button', { name: 'Edit', exact: true }));
        await see(node(page, 'f-phone').locator('input')).toBeEditable();
        await see(page.getByRole('textbox', { name: 'Website' })).toBeEditable();
        await see(page.getByRole('button', { name: 'Done', exact: true })).toBeVisible();
      },
    },
    {
      says: 'Change a field and press Done: the record is saved and locked again.',
      async run({ page, press, type, see, demo }) {
        const website = page.getByRole('textbox', { name: 'Website' });
        await type(website, 'niletraders.example');
        await press(page.getByRole('button', { name: 'Done', exact: true }));
        await see(website).not.toBeEditable();
        await see(website).toHaveValue('niletraders.example');
        await see(page.getByRole('button', { name: 'Edit', exact: true })).toBeVisible();
        await see(page.locator('.fd-status').first()).toHaveText('Saved');
        expect((await demo<Record<string, unknown>>('dataSource.records.partner.1'))['website']).toBe('niletraders.example');
      },
    },
  ],
};
