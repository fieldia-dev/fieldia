import type { DemoReplay, Hand } from '../hand';
import { band, approvalTitle, levels, signedIn } from './support';

const conversation = (hand: Hand) => hand.page.locator('.fd-slot[data-slot="chatter"] .fd-message');

/** “A purchase order waiting for approval” (purchase-approval): its how-to replayed by hand (e2e/how-to.spec.ts). */
export const replay: DemoReplay = {
  steps: [
    {
      says: 'You are Mona Adel, in Finance: “Waiting for Finance',
      async run(hand) {
        const { page, press, type, see } = hand;
        await see(signedIn(hand)).toHaveText('Signed in as Mona Adel, Finance.');
        await see(approvalTitle(hand)).toHaveText('Waiting for Finance: Mona Adel or Hany Lotfy');
        // A quantity typed at: nothing goes in, the order locked while it waits.
        const quantity = page.locator('[data-node="f-lines"]').getByRole('textbox', { name: 'Quantity' }).first();
        await see(quantity).toHaveValue('40');
        await type(quantity, '5');
        await see(quantity).toHaveValue('40');
        await see(quantity).not.toBeEditable();
        // Its lock pressed: why, in words.
        await press(page.getByRole('button', { name: 'Locked: Products' }));
        await see(page.getByRole('tooltip')).toHaveText('Locked while it waits for approval');
        await see(band(hand).locator('.fd-approval-open')).toHaveText('While it waits, only Notes for the vendor can be changed.');
        // The notes for the vendor take what is typed.
        const notes = page.getByRole('textbox', { name: 'Notes for the vendor' });
        await see(notes).toBeEditable();
        // Pressed after its last words, where a person goes on writing (clear of the box's resize grip).
        await notes.scrollIntoViewIfNeeded();
        const notesBox = (await notes.boundingBox())!;
        await press(notes, { position: { x: notesBox.width - 30, y: notesBox.height - 12 } });
        await page.keyboard.type(' Ring Omar first.', { delay: 15 });
        await see(notes).toHaveValue('Deliver to Nile Towers, 12th floor, by the freight lift, 08:00 to 10:00. Ring Omar first.');
      },
    },
    {
      says: 'Press Approve: Finance has approved it, and it waits for the CFO',
      async run(hand) {
        const { press, see } = hand;
        await press(band(hand).getByRole('button', { name: 'Approve', exact: true }));
        await see(approvalTitle(hand)).toHaveText('Waiting for CFO: Sara Nabil');
        await see(levels(hand)).toHaveText(['FinanceApproved by Mona Adel', 'CFOWaiting']);
        // Nothing more for Finance to decide.
        await see(band(hand).locator('.fd-approval-actions button')).toHaveCount(0);
      },
    },
    {
      says: 'Sign in as Sara Nabil, the CFO and press Approve',
      async run(hand) {
        const { page, press, see } = hand;
        await hand.follow('Sign in as Sara Nabil, the CFO');
        await see(signedIn(hand)).toHaveText('Signed in as Sara Nabil, CFO.');
        await see(approvalTitle(hand)).toHaveText('Waiting for CFO: Sara Nabil');
        await see(page.locator('.fd-statusbar [aria-current="step"]')).toHaveText('To approve');
        await press(band(hand).getByRole('button', { name: 'Approve', exact: true }));
        await see(approvalTitle(hand)).toHaveText('Approved');
        await see(levels(hand)).toHaveText(['FinanceApproved by Mona Adel', 'CFOApproved by Sara Nabil']);
        await see(page.locator('.fd-statusbar [aria-current="step"]')).toHaveText('Purchase order');
      },
    },
    {
      says: 'Open Approval history, and read the order’s conversation',
      async run(hand) {
        const { press, see } = hand;
        // Four: the notes Mona wrote in step 1 were kept as she approved, and are told among them.
        const history = band(hand).getByRole('button', { name: 'Approval history (4)' });
        await see(history).toHaveAttribute('aria-expanded', 'false');
        await press(history);
        await see(history).toHaveAttribute('aria-expanded', 'true');
        // Who asked, who approved, and when.
        await see(band(hand).locator('.fd-approval-entry-what')).toHaveText(['Omar Said asked for approval', 'Mona Adel changed it', 'Mona Adel approved (Finance)', 'Sara Nabil approved (CFO)']);
        const at = /^\d{1,2} \w{3} 2\d{3}, \d\d:\d\d/;
        const entries = band(hand).locator('.fd-approval-entry');
        await see(entries).toHaveCount(4);
        for (let i = 0; i < 4; i++) await see(entries.nth(i).locator('time').first()).toHaveText(at);
        // The order's conversation says the same, each by its person and its time.
        const said = (words: string) => conversation(hand).filter({ hasText: words });
        for (const [who, what] of [['Sara Nabil', 'Approved (CFO)'], ['Mona Adel', 'Approved (Finance)'], ['Omar Said', 'Asked for approval']]) {
          await see(said(what)).toHaveCount(1);
          await see(said(what)).toContainText(who);
          await see(said(what).locator('time')).toHaveText(at);
        }
      },
    },
    {
      says: 'Sign in as Omar Said, the buyer: he sees where it stands',
      async run(hand) {
        const { page, see } = hand;
        await hand.follow('Sign in as Omar Said, the buyer');
        await see(signedIn(hand)).toHaveText('Signed in as Omar Said, Buyer.');
        // Where it stands: approved by both, a purchase order now…
        await see(approvalTitle(hand)).toHaveText('Approved');
        await see(levels(hand)).toHaveText(['FinanceApproved by Mona Adel', 'CFOApproved by Sara Nabil']);
        await see(page.locator('.fd-statusbar [aria-current="step"]')).toHaveText('Purchase order');
        // …and nothing of it his to decide.
        await see(band(hand).locator('.fd-approval-actions button')).toHaveCount(0);
        await see(band(hand).getByRole('button', { name: 'Approve', exact: true })).toHaveCount(0);
        await see(band(hand).getByRole('button', { name: 'Reject', exact: true })).toHaveCount(0);
      },
    },
    {
      says: 'Open an order under the limit: it needs no approval',
      async run(hand) {
        const { page, press, see } = hand;
        await hand.follow('Open an order under the limit');
        await see(page.locator('[data-node="f-partner"] input')).toHaveValue('Bayt Interiors');
        // Under its limit, nothing waits on it.
        await see(band(hand)).toBeHidden();
        await press(page.getByRole('button', { name: 'Ask for approval' }));
        await see(approvalTitle(hand)).toHaveText('No approval needed');
        await see(page.locator('.fd-statusbar [aria-current="step"]')).toHaveText('Purchase order');
        await press(band(hand).getByRole('button', { name: 'Approval history (2)' }));
        await see(band(hand).locator('.fd-approval-entry-what')).toHaveText(['Omar Said asked for approval', 'No approval needed']);
        await see(conversation(hand).first()).toContainText('No approval needed');
      },
    },
  ],
};
