import type { Dialog } from '@playwright/test';
import { expect } from '../../fixtures';
import type { DemoReplay } from '../hand';
import { closePanel } from './support';

/** The real-opportunity demo’s how-to steps, replayed by hand (e2e/how-to.spec.ts). */
export const replay: DemoReplay = {
  timeout: 90_000,
  steps: [
    {
      says: 'Click Qualified on the stages at the top: the',
      async run({ page, press, see }) {
        const stages = page.getByRole('list', { name: 'Stage' });
        const probability = page.getByRole('textbox', { name: 'Probability' });
        await see(probability).toHaveValue('70.00');
        await press(stages.getByRole('button', { name: /^Qualified/ }));
        await see(page.locator('.fd-statusbar [aria-current="step"]')).toHaveText(/^Qualified/);
        await see(probability).toHaveValue('30.00');
      },
    },
    {
      says: 'Press Lost, pick a reason and Mark as Lost: the',
      async run({ page, press, type, see }) {
        await press(page.getByRole('button', { name: 'Lost', exact: true }));
        const dialog = page.getByRole('dialog', { name: 'Mark Lost' });
        await see(dialog).toBeVisible();
        const reason = dialog.locator('[data-node="f-lost-reason"]').getByRole('combobox');
        await type(reason, 'Too');
        await press(dialog.getByRole('option', { name: 'Too expensive', exact: true }));
        await see(reason).toHaveValue('Too expensive');
        await press(dialog.getByRole('button', { name: 'Mark as Lost' }));
        await see(dialog).toBeHidden();
        await see(page.locator('[data-node="ribbon-lost"]')).toBeVisible();
        await see(page.locator('[data-node="f-lost-reason"]').getByRole('combobox')).toHaveValue('Too expensive');
        await see(page.getByRole('button', { name: 'Restore', exact: true })).toBeVisible();
        await see(page.locator('.fd-chatter, [data-slot="chatter"]').first()).toContainText('Lost: Too expensive');
      },
    },
    {
      says: 'Press Restore to bring it back, then Won: it',
      async run({ page, press, see }) {
        await press(page.getByRole('button', { name: 'Restore', exact: true }));
        await see(page.locator('[data-node="ribbon-lost"]')).toBeHidden();
        await press(page.getByRole('button', { name: 'Won', exact: true }).and(page.locator('button[data-node="won"]')));
        await see(page.locator('.fd-statusbar [aria-current="step"]')).toHaveText(/^Won/);
        await see(page.getByRole('textbox', { name: 'Probability' })).toHaveValue('100.00');
        await see(page.locator('[data-node="ribbon-won"]')).toBeVisible();
      },
    },
    {
      says: 'Change the email under Customer: a note says',
      async run({ page, type, keys, see }) {
        const note = page.locator('[data-node="t-email-update"]');
        await see(note).toBeHidden();
        await type(page.locator('[data-node="f-email"] input'), 'mostafa@kamel-family.example', { clear: true });
        await keys('Tab');
        await see(note).toHaveText('By saving this change, the customer email will also be updated.');
      },
    },
    {
      says: 'Open the lead: its own groups and tab, and',
      async run(hand) {
        const { page, press, see, seePage } = hand;
        // The email changed in the step before is not saved: the browser asks before the page is left, and the
        // person says Leave, letting it go.
        const asked: string[] = [];
        const leave = (dialog: Dialog) => {
          asked.push(dialog.type());
          void dialog.accept();
        };
        page.on('dialog', leave);
        await hand.follow('Open the lead');
        await seePage().toHaveURL(/[?&]record=7702(&|$)/);
        page.off('dialog', leave);
        expect(asked, 'the browser asked before the changed record was left').toEqual(['beforeunload']);
        await closePanel(hand);
        await see(page.locator('[data-node="f-lead-contact-name"] input')).toHaveValue('Yasmin Ashraf');
        await see(page.locator('button[data-node="tab-extra"]')).toBeVisible();
        await see(page.locator('.fd-statusbar')).toBeHidden();
        await see(page.locator('[data-node="f-expected-revenue"]')).toBeHidden();
        await press(page.locator('button[data-node="convert"]'));
        const dialog = page.getByRole('dialog', { name: 'Convert to opportunity' });
        await see(dialog).toBeVisible();
        await see(dialog.locator('[data-node="f-user"]').getByRole('combobox')).toHaveValue('Karim Fathy');
        await press(dialog.getByRole('radio', { name: 'Do not link to a customer' }));
        await press(dialog.getByRole('button', { name: 'Save & Close' }));
        await see(dialog).toBeHidden();
        await see(page.locator('button[data-node="won"]')).toBeVisible();
        await see(page.locator('[data-node="f-expected-revenue"]')).toBeVisible();
      },
    },
  ],
};
