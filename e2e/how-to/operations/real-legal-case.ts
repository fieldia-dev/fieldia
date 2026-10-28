import type { DemoReplay } from '../hand';

/** The real-legal-case demo's how-to steps, replayed by hand (e2e/how-to.spec.ts). */
export const replay: DemoReplay = {
  timeout: 90_000,
  steps: [
    {
      says: 'Press the Hearings counter at the top: the Hearings tab opens',
      async run({ page, press, type, see, phone }) {
        const counter = page.getByRole('button', { name: /^\d+ Hearings$/ });
        await see(counter).toHaveText(/4\s*Hearings/);
        await press(counter);
        await see(page.getByRole('tab', { name: 'Hearings' })).toHaveAttribute('aria-selected', 'true');
        const next = page.locator('[data-node="f-next-hearing"]');
        await see(next).toContainText('Next Hearing');
        // Tomorrow at nine: ahead of the next hearing.
        const day = new Date();
        day.setDate(day.getDate() + 1);
        const pad = (n: number) => String(n).padStart(2, '0');
        const typed = `${pad(day.getDate())}/${pad(day.getMonth() + 1)}/${day.getFullYear()} 09:00`;
        const hearings = page.locator('[data-node="f-hearings"]');
        await press(hearings.getByRole('button', { name: '+ Add a line' }));
        if (phone) {
          const hearing = page.getByRole('dialog', { name: 'Line 5' });
          await type(hearing.getByRole('textbox', { name: /^Hearing Title/ }), 'Urgent motion — attachment of receivables');
          await type(hearing.getByRole('textbox', { name: /^Date & Time/ }), typed);
          await press(hearing.getByRole('button', { name: 'Save & Close' }));
          await see(hearing).toBeHidden();
        } else {
          const editor = hearings.locator('.ag-cell-inline-editing input, .ag-popup-editor input').first();
          await see(editor).toBeFocused();
          await page.keyboard.type('Urgent motion — attachment of receivables', { delay: 15 });
          // Enter on the last line would start another: the next cell to fill is pressed.
          await press(hearings.locator('.ag-row[row-index="4"]:not(.fd-grid-totals) .ag-cell[col-id="date_time"]'));
          await see(editor).toBeFocused();
          await page.keyboard.type(typed, { delay: 15 });
          await press(page.getByRole('textbox', { name: 'Court Name' }));
        }
        await see(next).toContainText(new RegExp(`${day.getDate()} \\w+ ${day.getFullYear()}, 09:00`));
        await see(counter).toHaveText(/5\s*Hearings/);
      },
    },
    {
      says: 'In Timesheets, type COURT in a new line’s Shortcode: the category',
      async run({ page, press, type, see, phone }) {
        await press(page.getByRole('tab', { name: 'Billing' }));
        const progress = page.getByRole('progressbar', { name: 'Budget Progress (%)' });
        await see(progress).toContainText('21%');
        await press(page.getByRole('tab', { name: 'Timesheets' }));
        const sheet = page.locator('[data-node="f-timesheets"]');
        await press(sheet.getByRole('button', { name: '+ Add a line' }));
        if (phone) {
          const line = page.getByRole('dialog', { name: 'Line 9' });
          await type(line.getByRole('textbox', { name: /^Shortcode/ }), 'COURT');
          await type(line.getByRole('textbox', { name: /^Hours/ }), '2', { clear: true });
          await see(line.getByRole('combobox', { name: /^Activity Category/ })).toHaveValue('Court appearance (COURT)');
          await see(line.getByRole('textbox', { name: /^Work Description/ })).toHaveValue('Court appearance');
          await see(line.getByRole('textbox', { name: /^Hourly Rate/ })).toHaveValue('3,000.00');
          await press(line.getByRole('button', { name: 'Save & Close' }));
          await see(line).toBeHidden();
        } else {
          const cell = (column: string) => sheet.locator(`.ag-row[row-index="8"]:not(.fd-grid-totals) .ag-cell[col-id="${column}"]`);
          const editor = sheet.locator('.ag-cell-inline-editing input, .ag-popup-editor input').first();
          await press(cell('shortcode'));
          await see(editor).toBeFocused();
          await page.keyboard.type('COURT', { delay: 15 });
          await press(cell('unit_amount'));
          await see(editor).toBeFocused();
          await page.keyboard.type('2', { delay: 15 });
          await press(page.getByRole('textbox', { name: 'Court Name' }));
          await see(cell('activity_category_id')).toHaveText('Court appearance (COURT)');
          await see(cell('name')).toHaveText('Court appearance');
          await see(cell('hourly_rate')).toContainText('3,000.00');
          await see(cell('billable_amount')).toContainText('6,000.00');
        }
        await press(page.getByRole('tab', { name: 'Billing' }));
        await see(progress).toContainText('23%');
      },
    },
    {
      says: 'Open Billing and pick Flat Fee: the matter rate goes, the flat fee',
      async run({ page, press, see }) {
        await press(page.getByRole('tab', { name: 'Billing' }));
        const rate = page.getByRole('textbox', { name: /^Matter Rate/ });
        await see(rate).toBeVisible();
        const schedule = page.locator('[data-node="f-flat-fee-lines"]');
        await see(schedule).toBeHidden();
        await press(page.getByRole('radio', { name: 'Flat Fee' }));
        await see(page.getByRole('radio', { name: 'Flat Fee' })).toBeChecked();
        await see(rate).toBeHidden();
        await see(schedule).toBeVisible();
      },
    },
    {
      says: 'Press Close Case, pick an outcome and write the closing notes',
      async run({ page, press, type, see }) {
        await press(page.getByRole('button', { name: 'Close Case' }));
        const dialog = page.getByRole('dialog', { name: 'Close Case' });
        await see(dialog).toBeVisible();
        const outcome = dialog.getByRole('combobox', { name: /^Outcome/ });
        // A list the browser draws itself: the option chosen from it.
        await press(outcome);
        await outcome.selectOption({ label: 'Settled' });
        await type(dialog.getByRole('textbox', { name: /^Closing Notes/ }), 'Settled at the expert hearing: Delta pays in two instalments.');
        await press(dialog.getByRole('button', { name: 'Close Case' }));
        await see(dialog).toBeHidden();
        await see(page.locator('.fd-say', { hasText: 'Case closed with outcome: Settled.' })).toBeVisible();
        await see(page.locator('.fd-header .fd-statusbar [aria-current="step"]')).toHaveText('Closed');
        await see(page.getByRole('tab', { name: 'Outcome' })).toHaveAttribute('aria-selected', 'true');
        await see(page.getByRole('tabpanel', { name: 'Outcome' })).toBeVisible();
        await see(page.getByRole('button', { name: 'Reopen' })).toBeVisible();
        // The pending tasks, cancelled; the one done stays done.
        await press(page.getByRole('tab', { name: 'Tasks & Deadlines' }));
        const tasks = page.getByRole('tabpanel', { name: 'Tasks & Deadlines' });
        await see(tasks.getByText('Cancelled', { exact: true }).filter({ visible: true })).toHaveCount(4);
        await see(tasks.getByText('Completed', { exact: true }).filter({ visible: true })).toHaveCount(1);
      },
    },
    {
      says: 'Open the Trust tab and press Deposit: the deposit is made in a dialog',
      async run({ page, press, type, see, phone }) {
        await press(page.getByRole('tab', { name: 'Trust' }));
        await press(page.getByRole('button', { name: 'Deposit', exact: true }));
        const dialog = page.getByRole('dialog', { name: 'Trust Deposit' });
        await see(dialog).toBeVisible();
        await see(dialog.getByRole('textbox', { name: /^Amount/ })).toHaveValue('75,000.00');
        await press(dialog.getByRole('radio', { name: 'Cheque' }));
        await type(dialog.getByRole('textbox', { name: 'Cheque / Transfer Ref.' }), 'Banque Misr cheque 004417');
        await press(dialog.getByRole('button', { name: 'Save & Close' }));
        await see(dialog).toBeHidden();
        await see(page.locator('.fd-say', { hasText: 'Deposit TRD/2026/00137' })).toBeVisible();
        const ledger = page.locator('[data-node="f-trust-transactions"]');
        await see(ledger).toContainText('Banque Misr cheque 004417');
        if (!phone) await see(ledger.locator('.ag-row:not(.fd-grid-totals)').filter({ hasText: 'Banque Misr cheque 004417' })).toContainText('Draft');
        else await see(ledger.locator('.fd-line-card').filter({ hasText: 'Banque Misr cheque 004417' })).toContainText('Draft');
      },
    },
  ],
};
