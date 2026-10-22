import { type Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { expectNoSidewaysScroll, node, open, screen } from './support';

/**
 * Approvals on a record, as people meet them (`approval` on a record's page; the demos' memory source routes them as an
 * app's approval engine would): a purchase order over its limit waiting for Finance, then the CFO — said on the order,
 * Approve and Reject for those who may decide and no one else, the order locked meanwhile but its notes, each lock
 * saying why — and an expense Finance rejected, its reason said, put right and sent again to the manager, who must
 * say why to reject it. What was decided, by whom and when, folded under the band and told in the conversation.
 */

const WIDE = { width: 1280, height: 900 };
const PHONE = { width: 390, height: 844 };
const band = (page: Page) => page.locator('.fd-approval');
const title = (page: Page) => page.locator('.fd-approval-title');
const decide = (page: Page, name: string) => band(page).getByRole('button', { name, exact: true });
const levels = (page: Page) => page.locator('.fd-approval-level');
const state = (page: Page) => page.evaluate(() => (window as any).fieldiaDemo.handle.form.getState().values.state as string);
const signIn = (page: Page, who: RegExp) => page.locator('.demo-signed-in').getByRole('link', { name: who }).click();
const conversation = (page: Page) => page.locator('.fd-slot[data-slot="chatter"] .fd-message');

let problems: string[] = [];
test.afterEach(() => expect(problems).toEqual([]));

for (const variant of ['plain', 'react']) {
  test.describe(`${variant === 'plain' ? '' : `${variant}: `}a purchase order waiting for approval`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize(WIDE);
      ({ problems } = await open(page, variant, 'page=purchase-approval&record=1&skin=outlined'));
    });

    test('says who it waits for and why, locks the order but its notes, and offers Finance its decision', async ({ page }) => {
      await expect(title(page)).toHaveText('Waiting for Finance: Mona Adel or Hany Lotfy');
      await expect(band(page).locator('.fd-approval-why')).toHaveText('Orders over EGP 150,000 go to Finance, then the CFO.');
      await expect(levels(page)).toHaveText(['FinanceWaiting', 'CFOLater']);
      await expect(band(page).locator('.fd-approval-open')).toHaveText('While it waits, only Notes for the vendor can be changed.');
      await expect(decide(page, 'Approve')).toBeVisible();
      await expect(decide(page, 'Reject')).toBeVisible();
      // Locked while it waits, its lock saying why as it is reached; the notes typed in, and saved.
      await expect(node(page, 'f-requested').locator('input')).not.toBeEditable();
      await node(page, 'f-requested').locator('.fd-lock').focus();
      await expect(node(page, 'f-requested').getByRole('tooltip')).toHaveText('Locked while it waits for approval');
      await node(page, 'f-notes').locator('textarea').fill('Call Omar before the delivery.');
      await page.getByRole('button', { name: 'Save', exact: true }).click();
      await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeHidden();
      await expect(title(page)).toHaveText('Waiting for Finance: Mona Adel or Hany Lotfy');
      await screen(page, `${variant}-approval-waiting`);
    });

    test('approved by Finance, then by the CFO signed in after: the order moves on, its history told beside it', async ({ page }) => {
      await decide(page, 'Approve').click();
      await expect(title(page)).toHaveText('Waiting for CFO: Sara Nabil');
      // The button gone with the decision: the focus on where the order stands now.
      await expect(title(page)).toBeFocused();
      await expect(levels(page)).toHaveText(['FinanceApproved by Mona Adel', 'CFOWaiting']);
      // Nothing more for Finance to decide.
      await expect(band(page).locator('.fd-approval-actions button')).toHaveCount(0);
      await expect(conversation(page).first()).toContainText('Approved (Finance)');
      await signIn(page, /Sara Nabil/);
      await expect(page.locator('.demo-signed-in-said')).toHaveText('Signed in as Sara Nabil, CFO.');
      await expect(title(page)).toHaveText('Waiting for CFO: Sara Nabil');
      await decide(page, 'Approve').click();
      await expect(title(page)).toHaveText('Approved');
      await expect(band(page)).toHaveAttribute('data-status', 'approved');
      await expect(levels(page)).toHaveText(['FinanceApproved by Mona Adel', 'CFOApproved by Sara Nabil']);
      expect(await state(page)).toBe('purchase');
      await expect(page.locator('.fd-statusbar [aria-current="step"]')).toHaveText('Purchase order');
      // Its history, folded under its count: who asked, who approved, when.
      const history = band(page).getByRole('button', { name: 'Approval history (3)' });
      await expect(history).toHaveAttribute('aria-expanded', 'false');
      await history.click();
      await expect(band(page).locator('.fd-approval-entry-what')).toHaveText(['Omar Said asked for approval', 'Mona Adel approved (Finance)', 'Sara Nabil approved (CFO)']);
      await expect(band(page).locator('.fd-approval-entry time').first()).toHaveText(/^\d{1,2} \w{3} 2\d{3}, \d\d:\d\d/);
      await expect(conversation(page).locator('.fd-message-body')).toContainText(['Approved (CFO)', 'Approved (Finance)', 'Asked for approval']);
      await screen(page, `${variant}-approval-approved`);
    });

    test('decides nothing for the buyer, who sees where it stands', async ({ page }) => {
      await signIn(page, /Omar Said/);
      await expect(title(page)).toHaveText('Waiting for Finance: Mona Adel or Hany Lotfy');
      await expect(band(page).locator('.fd-approval-actions button')).toHaveCount(0);
    });

    test('an order under its limit, asked for approval, is a purchase order at once: “No approval needed”, in its history', async ({ page }) => {
      // The owner's walk of 0.29: it stood at "To approve", no one asked, and no button to move it on.
      ({ problems } = await open(page, variant, 'page=purchase-approval&record=2&skin=outlined'));
      await expect(band(page)).toBeHidden();
      await page.getByRole('button', { name: 'Ask for approval' }).click();
      await expect(title(page)).toHaveText('No approval needed');
      await expect(page.locator('.fd-statusbar [aria-current="step"]')).toHaveText('Purchase order');
      expect(await state(page)).toBe('purchase');
      await band(page).getByRole('button', { name: 'Approval history (2)' }).click();
      await expect(band(page).locator('.fd-approval-entry-what')).toHaveText(['Mona Adel asked for approval', 'No approval needed']);
      await expect(conversation(page).locator('.fd-message-body')).toContainText(['No approval needed']);
      await screen(page, `${variant}-approval-not-needed`);
    });

    test('the person who asks for approval decides none of it: Mona sends an order of Finance’s, and Hany alone is asked', async ({ page }) => {
      // The owner's walk of 0.29: the manager sent his employee's claim again, and approved it himself.
      ({ problems } = await open(page, variant, 'page=purchase-approval&record=2&skin=outlined'));
      // Two hundred lamps: over the limit, Finance's to approve.
      await node(page, 'f-lines').locator('td[data-column="qty"] input').fill('200');
      await page.getByRole('button', { name: 'Ask for approval' }).click();
      await expect(title(page)).toHaveText('Waiting for Finance: Hany Lotfy');
      await expect(band(page).locator('.fd-approval-actions button')).toHaveCount(0);
      await band(page).getByRole('button', { name: 'Approval history (1)' }).click();
      await expect(band(page).locator('.fd-approval-entry-what')).toHaveText(['Mona Adel asked for approval']);
      await screen(page, `${variant}-approval-asker-decides-none`);
    });

    test('says nothing on an order under its limit', async ({ page }) => {
      ({ problems } = await open(page, variant, 'page=purchase-approval&record=2&skin=outlined'));
      await expect(node(page, 'f-partner').locator('input')).toHaveValue('Bayt Interiors');
      await expect(band(page)).toBeHidden();
      await expect(node(page, 'f-requested').locator('input')).toBeEditable();
    });
  });

  test.describe(`${variant === 'plain' ? '' : `${variant}: `}an expense rejected, with why`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize(WIDE);
      ({ problems } = await open(page, variant, 'page=expense-approval&record=1&skin=outlined'));
    });

    test('says who rejected it and why; put right and sent again, it waits for the manager, who must say why to reject it', async ({ page }) => {
      await expect(title(page)).toHaveText('Rejected by Mona Adel (Finance)');
      await expect(band(page).locator('.fd-approval-reason')).toHaveText('Four of us for two guests is over the meals policy: claim the dinner for you and the two from Nile Traders, and name them.');
      await expect(levels(page)).toHaveText(['ManagerApproved by Karim Fathy', 'FinanceRejected by Mona Adel']);
      await screen(page, `${variant}-approval-rejected`);
      // Rejected, it is open again: put right, and sent for approval again.
      const amount = node(page, 'f-amount').locator('input');
      await amount.fill('2400');
      await node(page, 'f-guests').locator('input').fill('Omar Said, and Tarek and Nadia from Nile Traders');
      await page.getByRole('button', { name: 'Submit for approval' }).click();
      await expect(title(page)).toHaveText('Waiting for Manager: Karim Fathy');
      await expect(amount).not.toBeEditable();
      await expect(node(page, 'f-notes').locator('textarea')).toBeEditable();
      await expect(levels(page)).toHaveText(['ManagerWaiting', 'FinanceLater']);
      // The manager rejects it again: not without why.
      await signIn(page, /Karim Fathy/);
      await decide(page, 'Reject').click();
      const dialog = page.getByRole('dialog', { name: 'Reject this expense?' });
      await expect(dialog).toBeVisible();
      await expect(dialog.getByRole('textbox', { name: 'Reason' })).toBeFocused();
      await dialog.getByRole('button', { name: 'Reject', exact: true }).click();
      await expect(dialog.locator('.fd-error')).toHaveText('Say why you reject it');
      await screen(page, `${variant}-approval-reject-why`, { viewport: true });
      await dialog.getByRole('textbox', { name: 'Reason' }).fill('Attach the receipt, please.');
      await dialog.getByRole('button', { name: 'Reject', exact: true }).click();
      await expect(dialog).toBeHidden();
      await expect(title(page)).toHaveText('Rejected by Karim Fathy (Manager)');
      await expect(title(page)).toBeFocused();
      await expect(band(page).locator('.fd-approval-reason')).toHaveText('Attach the receipt, please.');
      await band(page).getByRole('button', { name: 'Approval history (5)' }).click();
      await expect(band(page).locator('.fd-approval-entry-what')).toHaveText(['Omar Said asked for approval', 'Karim Fathy approved (Manager)', 'Mona Adel rejected it (Finance)', 'Omar Said asked for approval', 'Karim Fathy rejected it (Manager)']);
      await expect(band(page).locator('.fd-approval-entry-reason')).toHaveText(['Four of us for two guests is over the meals policy: claim the dinner for you and the two from Nile Traders, and name them.', 'Attach the receipt, please.']);
    });

    test('Reject’s question keeps its keys: Escape lets it go, the focus back on Reject, nothing decided', async ({ page }) => {
      await page.getByRole('button', { name: 'Submit for approval' }).click();
      await expect(title(page)).toHaveText('Waiting for Manager: Karim Fathy');
      await signIn(page, /Karim Fathy/);
      await decide(page, 'Reject').click();
      const dialog = page.getByRole('dialog', { name: 'Reject this expense?' });
      await page.keyboard.type('Not now');
      await page.keyboard.press('Tab');
      await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeFocused();
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');
      await expect(dialog.getByRole('textbox', { name: 'Reason' })).toBeFocused();
      // A reason typed: Escape asks first, as a record's dialog asks; Discard lets it go.
      await page.keyboard.press('Escape');
      await expect(dialog.locator('.fd-file-confirm')).toHaveText('Discard your changes?DiscardKeep editing');
      await dialog.getByRole('button', { name: 'Discard', exact: true }).click();
      await expect(dialog).toBeHidden();
      await expect(decide(page, 'Reject')).toBeFocused();
      // Nothing typed: Escape lets it go at once.
      await decide(page, 'Reject').click();
      await expect(dialog.getByRole('textbox', { name: 'Reason' })).toBeFocused();
      await page.keyboard.press('Escape');
      await expect(dialog).toBeHidden();
      await expect(title(page)).toHaveText('Waiting for Manager: Karim Fathy');
    });
  });
}

test.describe('approvals on a phone', () => {
  test('the band reads whole, its buttons a row of their own, nothing sideways', async ({ page }) => {
    await page.setViewportSize(PHONE);
    ({ problems } = await open(page, 'plain', 'page=purchase-approval&record=1&skin=outlined'));
    await expect(title(page)).toHaveText('Waiting for Finance: Mona Adel or Hany Lotfy');
    const approve = await decide(page, 'Approve').boundingBox();
    const reject = await decide(page, 'Reject').boundingBox();
    const words = await title(page).boundingBox();
    expect(approve && reject && words).toBeTruthy();
    // Under the words, side by side.
    expect(approve!.y).toBeGreaterThan(words!.y + words!.height - 1);
    expect(Math.abs(approve!.y - reject!.y)).toBeLessThan(2);
    await expectNoSidewaysScroll(page);
    await screen(page, 'approval-phone');
  });
});

test.describe('approvals in Arabic', () => {
  test('are said right to left, in Arabic', async ({ page }) => {
    await page.setViewportSize(WIDE);
    ({ problems } = await open(page, 'plain', 'page=purchase-approval&record=1&skin=outlined&locale=ar&dir=rtl'));
    await expect(title(page)).toHaveText('بانتظار Finance: Mona Adel أو Hany Lotfy');
    await expect(decide(page, 'موافقة')).toBeVisible();
    await expect(decide(page, 'رفض')).toBeVisible();
    await screen(page, 'approval-arabic');
  });
});
