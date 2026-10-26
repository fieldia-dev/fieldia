import type { DemoReplay } from '../hand';
import { closePanel } from './support';

/** The real-contact demo’s how-to steps, replayed by hand (e2e/how-to.spec.ts). */
export const replay: DemoReplay = {
  timeout: 90_000,
  steps: [
    {
      says: 'Pick Individual over the name: Job Position,',
      async run({ page, press, see }) {
        const at = (id: string) => page.locator(`[data-node="${id}"]`);
        // Before: a company — Industry in Sales & Purchase, the address under its heading, no job position.
        await press(page.getByRole('tab', { name: 'Sales & Purchase' }));
        await see(at('f-industry')).toBeVisible();
        await see(at('t-address')).toBeVisible();
        await see(at('f-function')).toBeHidden();
        await press(page.getByRole('radiogroup', { name: 'Company Type' }).getByRole('radio', { name: 'Individual' }));
        await see(page.getByRole('radio', { name: 'Individual' })).toBeChecked();
        await see(at('f-function')).toBeVisible();
        await see(at('f-title')).toBeVisible();
        await see(at('f-type')).toBeVisible();
        await see(at('f-industry')).toBeHidden();
        await see(at('t-address')).toBeHidden();
      },
    },
    {
      says: 'Open Contacts & Addresses: the people and',
      async run({ page, press, see }) {
        await press(page.getByRole('tab', { name: 'Contacts & Addresses' }));
        const cards = page.locator('[data-node="f-children"]');
        const names = cards.getByRole('textbox', { name: 'Contact Name' });
        await see(names).toHaveCount(4);
        await see(names.first()).toHaveValue('Hany Saber');
        await see(names.last()).toHaveValue('New Capital site office');
        await press(cards.getByRole('button', { name: 'Add', exact: true }));
        await see(names).toHaveCount(5);
        await press(cards.locator('.fd-repeat-card[data-line="c7002"]').getByRole('button', { name: 'Open line' }));
        const dialog = page.getByRole('dialog', { name: 'Contact' });
        await see(dialog.getByRole('radio', { name: 'Contact', exact: true })).toBeChecked();
        await see(dialog.locator('[data-node="child-function"] input')).toHaveValue('Chief Financial Officer');
        await see(dialog.locator('[data-node="child-address"]')).toBeHidden();
        await press(dialog.getByRole('radio', { name: 'Invoice Address' }));
        await see(dialog.locator('[data-node="child-function"]')).toBeHidden();
        await see(dialog.locator('[data-node="child-address"]')).toBeVisible();
        await press(dialog.getByRole('button', { name: 'Save & Close' }));
        await see(dialog).toBeHidden();
      },
    },
    {
      says: 'Open Invoicing and untick Partner Limit: the',
      async run({ page, press, see }) {
        await press(page.getByRole('tab', { name: 'Invoicing' }));
        const limit = page.locator('[data-node="f-credit-limit"]');
        await see(limit).toBeVisible();
        const partnerLimit = page.locator('[data-node="f-use-credit-limit"]').getByRole('checkbox');
        await see(partnerLimit).toBeChecked();
        await press(partnerLimit);
        await see(partnerLimit).not.toBeChecked();
        await see(limit).toBeHidden();
      },
    },
    {
      says: 'In Internal Notes, set the invoice warning to',
      async run({ page, press, type, see }) {
        await press(page.getByRole('tab', { name: 'Internal Notes' }));
        const message = page.locator('[data-node="f-invoice-warn-msg"]');
        await see(message).toBeHidden();
        // The page's own list (a <select>): its option picked as the browser's list picks it.
        await page.locator('[data-node="f-invoice-warn"] select').selectOption({ label: 'Warning' });
        await see(message).toBeVisible();
        // Saved with it empty: refused, the box saying what it needs.
        await press(page.getByRole('button', { name: 'Save', exact: true }));
        await see(message.locator('.fd-error')).toBeVisible();
        await see(page.locator('.fd-status')).not.toHaveText('Saved');
        await type(message.locator('textarea, input').first(), 'Ask finance before invoicing: a disputed payment.');
        await press(page.getByRole('button', { name: 'Save', exact: true }));
        await see(page.locator('.fd-status')).toHaveText('Saved');
      },
    },
    {
      says: 'Open Hany Saber: his address is the company’s',
      async run(hand) {
        const { page, press, see, seePage } = hand;
        await hand.follow('Open Hany Saber');
        await seePage().toHaveURL(/[?&]record=7002(&|$)/);
        await closePanel(hand);
        const at = (id: string) => page.locator(`[data-node="${id}"]`);
        await see(at('f-parent').getByRole('combobox')).toHaveValue('Nile Crest Developments');
        await see(at('f-street').locator('input')).toHaveValue('Plot 112, South 90th Street');
        await see(at('f-street').locator('input')).not.toBeEditable();
        // Invoicing, his: a word that it is the parent company's, and a link to it — none of its own settings.
        await press(page.getByRole('tab', { name: 'Invoicing', exact: true }));
        await see(at('t-accounting-on-parent')).toHaveText('Accounting-related settings are managed on the parent company.');
        await see(at('f-credit-limit')).toBeHidden();
        await see(page.getByRole('button', { name: 'the parent company' })).toBeVisible();
      },
    },
  ],
};
