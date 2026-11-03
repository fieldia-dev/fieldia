import type { DemoReplay } from '../hand';
import { node } from './support';

/** The real-survey demo's how-to steps, replayed by hand (e2e/how-to.spec.ts). */
export const replay: DemoReplay = {
  steps: [
    {
      says: 'Add a question at the end of a section, then move it up with its grip or Alt+↑',
      async run({ page, phone, press, keys, see }) {
        const questions = node(page, 'f-questions');
        const asked = 'Would you recommend us to a colleague?';
        await press(questions.getByRole('button', { name: 'Add a question' }));
        if (phone) {
          // A phone's lines are cards: the question is written in its dialog, titled by the button that added it while it
          // has no words — never "Line 11" (the 0.37 walk).
          const dialog = page.getByRole('dialog', { name: 'Add a question', exact: true });
          await see(dialog.getByRole('textbox', { name: 'Question' })).toBeFocused();
          await page.keyboard.type(asked, { delay: 15 });
          await press(dialog.getByRole('button', { name: 'Save & Close' }));
          await see(dialog).toBeHidden();
          const titles = questions.locator('.fd-line-card-title');
          await see(questions.getByRole('button', { name: asked, exact: true })).toBeVisible();
          await see(titles.last()).toHaveText(asked);
          // Moved up by the ↑ on its card: a place up, said, the follow-up date now after it.
          await press(questions.getByRole('button', { name: `Move ${asked} up` }));
          await see(titles.nth(-2)).toHaveText(asked);
          await see(titles.last()).toHaveText('Best day for a follow-up call');
          await see(questions.getByRole('status').filter({ hasText: 'moved' })).toHaveText(`${asked} moved to place 13 of 14`);
          return;
        }
        const editor = questions.locator('.ag-cell-inline-editing input').first();
        await see(editor).toBeFocused();
        await page.keyboard.type(asked, { delay: 15 });
        // Done typing, the person clicks away: the line is kept, the last of the last section.
        await press(page.getByRole('textbox', { name: 'Survey Title' }));
        const rows = questions.locator('.ag-row:not(.fd-grid-totals)');
        const row = (title: string) => rows.filter({ has: page.locator('.ag-cell[col-id="title"]', { hasText: title }) });
        await see(row(asked)).toHaveAttribute('row-index', '13');
        await see(row('Best day for a follow-up call')).toHaveAttribute('row-index', '12');
        // Its title's cell pressed (its box opens; Escape leaves the cell picked), then Alt+↑.
        await press(row(asked).locator('.ag-cell[col-id="title"]'));
        await keys('Escape', 'Alt+ArrowUp');
        await see(row(asked)).toHaveAttribute('row-index', '12');
        await see(row('Best day for a follow-up call')).toHaveAttribute('row-index', '13');
      },
    },
    {
      says: 'Pick Assessment over the title: Time & Scoring appears',
      async run({ page, press, see }) {
        await press(page.getByRole('radiogroup', { name: 'Survey Type' }).getByRole('radio', { name: 'Assessment' }));
        await press(page.getByRole('tab', { name: 'Options' }));
        const scoring = page.getByRole('group', { name: 'Time & Scoring' });
        await see(scoring).toBeVisible();
        await see(scoring.getByRole('radio', { name: 'Scoring with answers at the end' })).toBeChecked();
        await see(page.getByRole('combobox', { name: 'Access Mode' }).locator('option:checked')).toHaveText('Invited people only');
      },
    },
    {
      says: 'Tick Is a Certification, then Require Login: Give Badge appears',
      async run({ page, press, see }) {
        const badge = page.getByRole('checkbox', { name: 'Give Badge' });
        await press(page.getByRole('checkbox', { name: 'Is a Certification' }));
        await see(badge).toBeHidden();
        const login = page.getByRole('checkbox', { name: /^Require Login/ });
        await press(login);
        await see(badge).toBeVisible();
        await press(login);
        await see(login).not.toBeChecked();
        await see(badge).toBeHidden();
      },
    },
    {
      says: 'Press Close: the survey is archived and Reopen takes its place.',
      async run({ page, press, see }) {
        await press(page.getByRole('button', { name: 'Close', exact: true }));
        await see(page.getByRole('button', { name: 'Reopen' })).toBeVisible();
        await see(page.getByRole('button', { name: 'Close', exact: true })).toBeHidden();
        await see(page.locator('.fd-ribbon', { hasText: 'Archived' })).toBeVisible();
      },
    },
  ],
};
