import type { DemoReplay } from '../hand';
import { choose } from './support';

/** “Expense claim” (template-expense-claim): its how-to replayed by hand (e2e/how-to.spec.ts). */
export const replay: DemoReplay = {
  steps: [
    {
      says: 'Add two expenses with their dates, kinds and amounts',
      async run(hand) {
        const { page, press, type, see } = hand;
        const lines = page.locator('[data-node="f-lines"]');
        const total = page.getByRole('textbox', { name: 'Total', exact: true });
        for (const [at, date, shown, kind, amount, sum] of [
          [0, '12/10/2026', '12 Oct 2026', 'Travel', '120.50', '120.50'],
          [1, '13/10/2026', '13 Oct 2026', 'Meals', '45', '165.50'],
        ] as const) {
          await press(lines.getByRole('button', { name: '+ Add a line' }));
          const line = lines.locator('tbody tr[data-line]').nth(at);
          const day = line.getByRole('textbox', { name: 'Date', exact: true });
          await see(day).toBeFocused();
          await page.keyboard.type(date, { delay: 15 });
          await choose(hand, line.getByRole('combobox', { name: 'Kind' }), kind);
          await see(line.getByRole('combobox', { name: 'Kind' }).locator('option:checked')).toHaveText(kind);
          await type(line.getByRole('textbox', { name: 'Amount', exact: true }), amount);
          await see(day).toHaveValue(shown);
          await see(total).toHaveValue(sum);
        }
      },
    },
    {
      says: 'Write what it was for in the title and pick an Employee, then press Submit',
      async run({ page, press, type, see }) {
        const title = page.getByRole('textbox', { name: 'Expense claim' });
        await type(title, 'Client visit, Alexandria');
        await see(title).toHaveValue('Client visit, Alexandria');
        const employee = page.getByRole('combobox', { name: 'Employee' });
        await type(employee, 'Mona');
        await press(page.getByRole('option', { name: 'Mona Adel', exact: true }));
        await see(employee).toHaveValue('Mona Adel');
        await press(page.getByRole('button', { name: 'Submit', exact: true }));
        await see(page.getByRole('button', { name: 'Approve', exact: true })).toBeVisible();
        await see(page.getByRole('button', { name: 'Send back', exact: true })).toBeVisible();
        await see(page.getByRole('button', { name: 'Submit', exact: true })).toBeHidden();
        await see(page.locator('.fd-statusbar [aria-current="step"]')).toHaveText('Submitted');
      },
    },
  ],
};
