import { expect } from '../../fixtures';
import type { DemoReplay } from '../hand';
import { closePanel } from './support';

/** The customer-card demo’s how-to steps, replayed by hand (e2e/how-to.spec.ts). */
export const replay: DemoReplay = {
  steps: [
    {
      says: 'Type 02 2345 6789 in Phone and leave it: “A',
      async run({ page, type, keys, see }) {
        await type(page.locator('[data-node="f-phone"] .fd-phone-input'), '02 2345 6789');
        await keys('Tab');
        const note = page.locator('[data-node="f-phone"] .fd-duplicates');
        await see(note).toContainText('A customer with this phone already exists: Nile Traders');
        await see(note.getByRole('button')).toHaveText(['Open it', 'It’s a new customer']);
      },
    },
    {
      says: 'Press Open it: you are asked before what you',
      async run({ page, press, see, seePage }) {
        await press(page.locator('[data-node="f-phone"] .fd-duplicates').getByRole('button', { name: 'Open it' }));
        const question = page.getByRole('alertdialog');
        await see(question).toBeVisible();
        await press(question.getByRole('button', { name: 'Discard' }));
        await see(page.locator('[data-node="#title"] textarea')).toHaveValue('Nile Traders');
        await see(page.locator('[data-node="f-phone"] .fd-phone-input')).toHaveValue('+20 2 2345 6789');
        await seePage().toHaveURL(/[?&]record=1(&|$)/);
      },
    },
    {
      says: 'Start a new customer, type orders@niletraders',
      async run(hand) {
        const { page, press, type, see, seePage } = hand;
        await hand.follow('Start a new customer');
        await seePage().toHaveURL(/[?&]record=new(&|$)/);
        await see(page.locator('[data-node="#title"] textarea')).toHaveValue('');
        await closePanel(hand);
        await type(page.locator('[data-node="f-email"] input'), 'orders@niletraders.example');
        const rows = page.locator('[data-node="f-email"] .fd-duplicates .fd-duplicate');
        await see(rows.locator('.fd-duplicate-words')).toHaveText(['A customer with this email already exists: Nile Traders', 'A customer with this email already exists: Nile Traders Co.']);
        await press(rows.first().getByRole('button', { name: 'It’s a new customer' }));
        await see(rows).toHaveCount(1);
        // It stays gone for this customer: a name typed like it brings it back no more.
        await type(page.locator('[data-node="#title"] textarea'), 'Nile Traders');
        await see(rows.locator('.fd-duplicate-words')).toHaveText(['A customer with this email and a name like this already exists: Nile Traders Co.']);
      },
    },
    {
      says: 'Press Open it on Nile Traders Co.: it opens,',
      async run({ page, press, see }) {
        const note = page.locator('[data-node="f-email"] .fd-duplicates');
        await press(note.locator('.fd-duplicate', { hasText: 'Nile Traders Co.' }).getByRole('button', { name: 'Open it' }));
        await press(page.getByRole('alertdialog').getByRole('button', { name: 'Discard' }));
        await see(page.locator('[data-node="#title"] textarea')).toHaveValue('Nile Traders Co.');
        await see(note).toContainText('A customer with this email and a name like this already exists: Nile Traders');
        await press(note.getByRole('button', { name: 'Merge…' }));
        const merge = page.getByRole('dialog', { name: 'Merge two customers' });
        await see(merge.locator('thead th')).toHaveText(['Keep Nile Traders Co.This customer', 'Keep Nile Traders']);
        await see(merge.getByRole('radio', { name: 'Keep Nile Traders', exact: true })).toBeChecked();
        // Nile Traders' own empty Tax ID and Website take Nile Traders Co.'s.
        await see(merge.getByRole('radio', { name: /^Tax ID / }).and(merge.locator(':checked'))).toHaveAccessibleName('Tax ID 312-645-987');
        await see(merge.getByRole('radio', { name: /^Website / }).and(merge.locator(':checked'))).toHaveAccessibleName(/^Website \S+/);
      },
    },
    {
      says: 'Pick a value of your own in a row, then Merge',
      async run({ page, press, see, seePage, demo }) {
        const merge = page.getByRole('dialog', { name: 'Merge two customers' });
        await press(merge.getByRole('radio', { name: 'Name Nile Traders Co.' }));
        await see(merge.getByRole('radio', { name: 'Name Nile Traders Co.' })).toBeChecked();
        await press(merge.getByRole('button', { name: 'Merge', exact: true }));
        await see(merge).toBeHidden();
        await see(page.locator('.fd-say')).toContainText('Merged into Nile Traders Co.');
        // Nile Traders, record 1, kept, with the name picked and Co.'s tax id; Nile Traders Co. gone.
        await seePage().toHaveURL(/[?&]record=1(&|$)/);
        await see(page.locator('[data-node="#title"] textarea')).toHaveValue('Nile Traders Co.');
        await see(page.locator('[data-node="f-vat"] input')).toHaveValue('312-645-987');
        expect(await demo<unknown>('dataSource.records.partner.40')).toBeUndefined();
        await see(page.locator('.fd-duplicates')).toHaveCount(0);
      },
    },
  ],
};
