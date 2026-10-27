import type { DemoReplay } from '../hand';
import { band, approvalTitle, levels, signedIn } from './support';

/** “An expense rejected, with why” (expense-approval): its how-to replayed by hand (e2e/how-to.spec.ts). */
export const replay: DemoReplay = {
  steps: [
    {
      says: 'You are Omar Said: “Rejected by Mona Adel (Finance)”',
      async run(hand) {
        const { page, press, type, see } = hand;
        await see(signedIn(hand)).toHaveText('Signed in as Omar Said, Employee.');
        await see(approvalTitle(hand)).toHaveText('Rejected by Mona Adel (Finance)');
        // Her reason, under it.
        await see(band(hand).locator('.fd-approval-reason')).toHaveText('Four of us for two guests is over the meals policy: claim the dinner for you and the two from Nile Traders, and name them.');
        // Open again: the amount his to change.
        const amount = page.getByRole('textbox', { name: 'Amount', exact: true });
        await see(amount).toBeEditable();
        await type(amount, '3200', { clear: true });
        await see(amount).toHaveValue('3200');
        await press(page.getByRole('button', { name: 'Submit for approval' }));
        await see(amount).toHaveValue('3,200.00');
      },
    },
    {
      says: 'It waits for your manager again — “Waiting for Manager',
      async run(hand) {
        const { page, type, see } = hand;
        await see(approvalTitle(hand)).toHaveText('Waiting for Manager: Karim Fathy');
        await see(levels(hand)).toHaveText(['ManagerWaiting', 'FinanceLater']);
        // Every field but the notes locked: typed at, the amount keeps what it was sent with.
        const amount = page.getByRole('textbox', { name: 'Amount', exact: true });
        await see(amount).not.toBeEditable();
        await type(amount, '9');
        await see(amount).toHaveValue('3,200.00');
        await see(page.getByRole('textbox', { name: 'Expense *What was it for?' })).not.toBeEditable();
        await see(page.getByRole('textbox', { name: 'Spent on', exact: true })).not.toBeEditable();
        await see(page.getByRole('combobox', { name: 'Category' })).toBeDisabled();
        await see(page.getByRole('textbox', { name: 'Who was there' })).not.toBeEditable();
        // The notes take what is typed.
        const notes = page.getByRole('textbox', { name: 'Notes for the approvers' });
        await see(notes).toBeEditable();
        await type(notes, 'Two guests now named.');
        await see(notes).toHaveValue('Two guests now named.');
      },
    },
    {
      says: 'Sign in as Karim Fathy, the manager: the claim is Omar’s',
      async run(hand) {
        const { page, press, type, see } = hand;
        await hand.follow('Sign in as Karim Fathy, the manager');
        await see(signedIn(hand)).toHaveText('Signed in as Karim Fathy, Manager.');
        await see(approvalTitle(hand)).toHaveText('Waiting for Manager: Karim Fathy');
        // Omar's claim: Karim reads it, told why it is not his to change, and changes nothing.
        await see(page.getByText('Only Omar Said, whose claim it is, can change it.')).toBeVisible();
        const amount = page.getByRole('textbox', { name: 'Amount', exact: true });
        await see(amount).toHaveValue('3,200.00');
        await see(amount).not.toBeEditable();
        await type(amount, '1');
        await see(amount).toHaveValue('3,200.00');
        await see(page.getByRole('textbox', { name: 'Notes for the approvers' })).not.toBeEditable();
        // No Submit offered him.
        await see(page.getByRole('button', { name: 'Submit for approval' })).toHaveCount(0);
        // He decides it: Reject asks why, and will not reject without it.
        await press(band(hand).getByRole('button', { name: 'Reject', exact: true }));
        const question = page.getByRole('dialog', { name: 'Reject this expense?' });
        await see(question).toBeVisible();
        const reason = question.getByRole('textbox', { name: 'Reason' });
        await see(reason).toBeFocused();
        await press(question.getByRole('button', { name: 'Reject', exact: true }));
        await see(question.locator('.fd-error')).toHaveText('Say why you reject it');
        await see(question).toBeVisible();
        await type(reason, 'Attach the receipt, please.');
        await press(question.getByRole('button', { name: 'Reject', exact: true }));
        await see(question).toBeHidden();
        await see(approvalTitle(hand)).toHaveText('Rejected by Karim Fathy (Manager)');
        await see(band(hand).locator('.fd-approval-reason')).toHaveText('Attach the receipt, please.');
      },
    },
    {
      says: 'Open Approval history: the first round and the second',
      async run(hand) {
        const { press, see } = hand;
        const history = band(hand).getByRole('button', { name: 'Approval history (6)' });
        await press(history);
        await see(history).toHaveAttribute('aria-expanded', 'true');
        // Both rounds — who, when, and why.
        await see(band(hand).locator('.fd-approval-entry-what')).toHaveText(['Omar Said asked for approval', 'Karim Fathy approved (Manager)', 'Mona Adel rejected it (Finance)', 'Omar Said changed it', 'Omar Said asked for approval', 'Karim Fathy rejected it (Manager)']);
        const entries = band(hand).locator('.fd-approval-entry');
        for (let i = 0; i < 6; i++) await see(entries.nth(i).locator('time').first()).toHaveText(/^\d{1,2} \w{3} 2\d{3}, \d\d:\d\d/);
        await see(band(hand).locator('.fd-approval-entry-reason')).toHaveText(['Four of us for two guests is over the meals policy: claim the dinner for you and the two from Nile Traders, and name them.', 'Attach the receipt, please.']);
        // What Omar changed between the rounds, said with it.
        await see(entries.nth(3).locator('.fd-approval-changes li')).toHaveText(/^Amount: E£\s4,850\.00 → E£\s3,200\.00$/);
      },
    },
  ],
};
